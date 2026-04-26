import { useState, useRef, useEffect } from "react";
import {
  BURGERS_DEFAULT, GUARNICIONES_DEFAULT, EXTRAS_DEFAULT, BEBIDAS_DEFAULT, ACOMP_DEFAULT, ENVIOS_DEFAULT,
  subscribeMenu, saveMenuFirestore,
  uploadFoto, deleteFotoStorage, getFotoURL, getFotoCached, setFotoCache, clearFotoCache,
  saveZonaFirestore, subscribeZona,
  subscribePedidos, updatePedidoEstado, marcarImpreso, saveConfigImpresoras, subscribeConfig,
  subscribeEstado, saveEstado,
  comprimirImagen, fmt,
} from "./datos.js";
import { imprimirPedido, qzDisponible } from "./imprimir.js";

// Hash SHA-256 de la contraseña — la contraseña real no está en el código fuente
const ADMIN_PASS_HASH = "1c9c66d9076f00934f4fa3f835ae860ca50b735798bf29300c39593f75013272";
const LS_SESSION = "rp-admin-session";

async function hashStr(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Variables de módulo (persisten entre renders, no entre tabs) ───
const _imprimiendoIds = new Set(); // Bug 2: evita doble impresión en misma tab
let   _audioCtx = null;            // Bug 6: AudioContext pre-calentado

function initAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
}

function playAlertSound() {
  try {
    if (!_audioCtx) return;
    [880, 1100, 880].forEach((freq, i) => {
      const osc  = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.connect(gain);
      gain.connect(_audioCtx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.3;
      osc.start(_audioCtx.currentTime + i * 0.18);
      osc.stop(_audioCtx.currentTime + i * 0.18 + 0.14);
    });
  } catch {}
}

// ── Estilos ────────────────────────────────────────────────────────
const G = {
  page:  { minHeight: "100vh", background: "#f4f7f5", fontFamily: "'Segoe UI', sans-serif", display: "flex", flexDirection: "column" },
  header:{ background: "#1a3a25", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 },
  title: { fontSize: 20, fontWeight: 900, color: "#a8e6bc" },
  card:  { background: "#fff", border: "1px solid #d0e8d8", borderRadius: 12, padding: "14px 16px", marginBottom: 10 },
  input: { border: "1px solid #ccc", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" },
  btn:   (bg = "#1a7a3a", txt = "#fff") => ({ background: bg, color: txt, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }),
};

const NAV_ITEMS = [
  { icon: "📋", label: "Pedidos" },
  { icon: "🍔", label: "Hamburguesas" },
  { icon: "🍟", label: "Guarniciones" },
  { icon: "🍟", label: "Acompañamientos" },
  { icon: "➕", label: "Extras" },
  { icon: "🥤", label: "Bebidas" },
  { icon: "🚚", label: "Envíos" },
  { icon: "🗺️", label: "Zona Delivery" },
];

// ── Login ──────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [pass, setPass] = useState("");
  const [err, setErr]   = useState(false);
  async function intentar() {
    initAudioCtx(); // Bug 6: inicializar audio en gesto de usuario (iOS)
    const h = await hashStr(pass);
    if (h === ADMIN_PASS_HASH) { localStorage.setItem(LS_SESSION, "1"); onLogin(); }
    else { setErr(true); setTimeout(() => setErr(false), 2000); }
  }
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a3a25" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 340, textAlign: "center", boxShadow: "0 8px 40px #0004" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🍔</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1a3a25", marginBottom: 4 }}>Roses Pichincha</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 28 }}>Panel de administración</div>
        <input type="password" style={{ ...G.input, width: "100%", textAlign: "center", fontSize: 15, padding: "12px", marginBottom: 12 }}
          placeholder="Contraseña" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && intentar()} autoFocus />
        {err && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>Contraseña incorrecta</div>}
        <button onClick={intentar} style={{ ...G.btn(), width: "100%", padding: "12px", fontSize: 15 }}>Entrar</button>
      </div>
    </div>
  );
}

// ── Upload de foto con Firebase Storage ───────────────────────────
function FotoUpload({ tipo, id }) {
  const [url, setUrl]       = useState(() => getFotoCached(tipo, id));
  const [cargando, setCarg] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (url) return;
    getFotoURL(tipo, id).then(u => { if (u) { setFotoCache(tipo, id, u); setUrl(u); } });
  }, []);

  async function onFile(e) {
    const file = e.target.files[0]; if (!file) return;
    setCarg(true);
    try {
      const b64 = await comprimirImagen(file);
      const newUrl = await uploadFoto(tipo, id, b64);
      setFotoCache(tipo, id, newUrl);
      setUrl(newUrl);
    } catch (err) { alert("Error al subir la foto. Intentá de nuevo."); }
    finally { setCarg(false); e.target.value = ""; }
  }

  async function quitar() {
    setCarg(true);
    try { await deleteFotoStorage(tipo, id); clearFotoCache(tipo, id); setUrl(null); }
    catch {}
    finally { setCarg(false); }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", background: "#f0f4f2", border: "1px solid #d0e8d8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {cargando
          ? <span style={{ fontSize: 10, color: "#888" }}>...</span>
          : url
          ? <img src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 22 }}>📷</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />
      <button style={G.btn(url ? "#4a8a5a" : "#1a7a3a")} onClick={() => inputRef.current.click()} disabled={cargando}>
        {cargando ? "Subiendo..." : url ? "Cambiar" : "Subir foto"}
      </button>
      {url && !cargando && <button style={G.btn("#dc2626")} onClick={quitar}>✕</button>}
    </div>
  );
}

// ── Sección editable ───────────────────────────────────────────────
function SeccionItems({ titulo, icon, items, onUpdate, tipoFoto, mostrarSimDoTri = false }) {
  function set(id, campo, valor) { onUpdate(items.map(i => i.id === id ? { ...i, [campo]: valor } : i)); }
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#1a3a25", marginBottom: 12 }}>{icon} {titulo}</div>
      {items.map(item => (
        <div key={item.id} style={{ ...G.card, opacity: item.disponible ? 1 : 0.55 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <FotoUpload tipo={tipoFoto} id={item.id} />
            <div style={{ flex: "2 1 160px", display: "flex", flexDirection: "column", gap: 6 }}>
              <input style={{ ...G.input, width: "100%", fontWeight: 700, fontSize: 14 }}
                value={item.nombre} onChange={e => set(item.id, "nombre", e.target.value)} />
              {item.desc !== undefined && (
                <input style={{ ...G.input, width: "100%", fontSize: 12, color: "#555" }}
                  value={item.desc} onChange={e => set(item.id, "desc", e.target.value)} placeholder="Descripción..." />
              )}
              {item.detalle !== undefined && (
                <input style={{ ...G.input, width: "100%", fontSize: 12, color: "#555" }}
                  value={item.detalle} onChange={e => set(item.id, "detalle", e.target.value)} placeholder="Detalle..." />
              )}
            </div>
            {mostrarSimDoTri ? (
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end", flexWrap: "wrap" }}>
                {[["simple","Simple"],["doble","Doble"],["triple","Triple"]].map(([k, l]) => (
                  <div key={k} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 10, color: "#888" }}>{l}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 12, color: "#888" }}>$</span>
                      <input type="number" style={{ ...G.input, width: 90, textAlign: "right" }}
                        value={item[k]} onChange={e => set(item.id, k, parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#888" }}>$</span>
                <input type="number" style={{ ...G.input, width: 100, textAlign: "right" }}
                  value={item.precio} onChange={e => set(item.id, "precio", parseFloat(e.target.value) || 0)} />
              </div>
            )}
            <button style={G.btn(item.disponible ? "#f59e0b" : "#1a7a3a")} onClick={() => set(item.id, "disponible", !item.disponible)}>
              {item.disponible ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Mapa admin ─────────────────────────────────────────────────────
function MapaAdmin({ zona, onGuardar, onLimpiar }) {
  const ref     = useRef(null);
  const mapRef  = useRef(null);
  const drawnRef= useRef(null);

  function initMap(el) {
    if (!el || mapRef.current) return;
    import("leaflet").then(Lmod => {
      const L = Lmod.default || Lmod;
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css"; link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      const map = L.map(el).setView([-27.47, -58.83], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
      if (zona.length > 2) { L.polygon(zona, { color: "#1a7a3a", fillColor: "#1a7a3a", fillOpacity: 0.15, weight: 2 }).addTo(map); map.fitBounds(zona); }
      const puntos = [], markers = [];
      let polyLine = null;
      map.on("click", e => {
        puntos.push([e.latlng.lat, e.latlng.lng]);
        markers.push(L.circleMarker([e.latlng.lat, e.latlng.lng], { radius: 5, color: "#1a7a3a", fillOpacity: 1 }).addTo(map));
        if (polyLine) polyLine.remove();
        if (puntos.length > 1) polyLine = L.polyline([...puntos, puntos[0]], { color: "#1a7a3a", weight: 2 }).addTo(map);
      });
      drawnRef.current = { puntos, markers, getLine: () => polyLine };
      mapRef.current = map;
    });
  }

  function guardar() {
    const dl = drawnRef.current;
    if (!dl || dl.puntos.length < 3) { alert("Marcá al menos 3 puntos en el mapa"); return; }
    onGuardar([...dl.puntos]);
  }
  function limpiar() {
    const dl = drawnRef.current;
    if (dl) { dl.markers.forEach(m => m.remove()); dl.markers.length = 0; dl.puntos.length = 0; const pl = dl.getLine(); if (pl) pl.remove(); }
    onLimpiar();
  }

  return (
    <div>
      <div style={{ background: "#e8f5ec", border: "1px solid #a8d5b5", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#1a3a25" }}>
        <strong>Cómo usar:</strong> Hacé click en el mapa para marcar los puntos del área de delivery.
        {zona.length > 2 && <span style={{ color: "#1a7a3a", fontWeight: 700 }}> ✅ Zona guardada ({zona.length} puntos).</span>}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button style={G.btn()} onClick={guardar}>✅ Guardar zona</button>
        <button style={G.btn("#dc2626")} onClick={limpiar}>🗑 Limpiar</button>
      </div>
      <div ref={el => initMap(el)} style={{ height: 460, borderRadius: 12, overflow: "hidden", border: "1px solid #d4edd9" }} />
    </div>
  );
}

// ── Mapa de pedidos en curso ───────────────────────────────────────
function MapaPedidos({ pedidos }) {
  const ref    = useRef(null);
  const mapRef = useRef(null);

  const delivery   = pedidos.filter(p => p.estado === "pendiente" && p.tipo === "delivery" && p.lat && p.lng);
  const sinUbicar  = pedidos.filter(p => p.estado === "pendiente" && p.tipo === "delivery" && (!p.lat || !p.lng));
  const coordKey   = delivery.map(p => p.id).join(",");

  useEffect(() => {
    const el = ref.current; if (!el) return;
    import("leaflet").then(Lmod => {
      const L = Lmod.default || Lmod;
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link"); link.id = "leaflet-css"; link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(link);
      }
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      const map = L.map(el).setView([-27.47, -58.83], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);

      delivery.forEach(ped => {
        const icon = L.divIcon({
          html: `<div style="background:#1a3a25;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;border:3px solid #fff;box-shadow:0 2px 10px #0007;line-height:1">#${ped.numero}</div>`,
          className: "", iconAnchor: [18, 18], iconSize: [36, 36],
        });
        const popup = `<div style="font-family:'Segoe UI',sans-serif;min-width:190px;font-size:13px">
          <div style="font-weight:900;font-size:15px;color:#1a3a25;margin-bottom:6px">#${ped.numero} — ${ped.cliente}</div>
          <div style="color:#2563eb;margin-bottom:3px">📍 ${ped.direccion}</div>
          ${ped.telefono ? `<div style="color:#555;margin-bottom:3px">📱 ${ped.telefono}</div>` : ""}
          <div style="color:#555;margin-bottom:3px">💳 ${ped.pago}</div>
          <div style="font-weight:700;color:#1a7a3a;margin-top:6px">💰 ${fmt(ped.total)}</div>
        </div>`;
        L.marker([ped.lat, ped.lng], { icon }).addTo(map).bindPopup(popup);
      });

      if (delivery.length > 1) {
        map.fitBounds(L.latLngBounds(delivery.map(p => [p.lat, p.lng])), { padding: [50, 50] });
      } else if (delivery.length === 1) {
        map.setView([delivery[0].lat, delivery[0].lng], 15);
      }
      mapRef.current = map;
    });
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [coordKey]);

  return (
    <div>
      <div style={{ background: "#e8f5ec", border: "1px solid #a8d5b5", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#1a3a25" }}>
        <strong>Delivery en curso con ubicación:</strong> {delivery.length} pedido{delivery.length !== 1 ? "s" : ""}.
        Hacé click en un marcador para ver el detalle.
      </div>
      {delivery.length === 0 && sinUbicar.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa", fontSize: 15 }}>No hay pedidos delivery en curso</div>
      ) : (
        <div ref={ref} style={{ height: 500, borderRadius: 12, overflow: "hidden", border: "1px solid #d4edd9" }} />
      )}
      {sinUbicar.length > 0 && (
        <div style={{ marginTop: 14, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 8 }}>⚠️ Sin ubicación en el mapa ({sinUbicar.length})</div>
          {sinUbicar.map(ped => (
            <div key={ped.id} style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>
              #{ped.numero} — {ped.cliente} — 📍 {ped.direccion || "Sin dirección"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab Pedidos ────────────────────────────────────────────────────
function TarjetaPedido({ ped, config, onCambioEstado }) {
  const [imprimiendo, setImp] = useState(false);
  const tipoLabel = ped.tipo === "delivery" ? "🛵 Delivery" : "🏠 Retiro";
  const pagoColor = p => p === "Efectivo" ? "#92400e" : p === "Transferencia" ? "#1e40af" : "#065f46";

  async function handleImprimir() {
    if (imprimiendo) return;
    setImp(true);
    try {
      await imprimirPedido(ped, null, config.ipBarra);
      if (!ped.impreso) await marcarImpreso(ped.id);
    } catch (e) { alert(`Error al imprimir: ${e.message}`); }
    finally { setImp(false); }
  }

  const borderColor = ped.estado === "cancelado" ? "#dc2626" : ped.estado === "entregado" ? "#059669" : ped.tipo === "delivery" ? "#2563eb" : "#1a7a3a";

  return (
    <div style={{ ...G.card, borderLeft: `4px solid ${borderColor}`, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#1a3a25" }}>#{ped.numero}</span>
            <span style={{ background: ped.tipo === "delivery" ? "#dbeafe" : "#e8f5ec", color: ped.tipo === "delivery" ? "#1e40af" : "#1a7a3a", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>{tipoLabel}</span>
            <span style={{ fontSize: 12, color: "#888" }}>{ped.hora} — {ped.fecha}</span>
            <span style={{ background: "#fef3c7", color: pagoColor(ped.pago), fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>{ped.pago}</span>
            {ped.estado === "cancelado" && <span style={{ background: "#fef2f2", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>CANCELADO</span>}
            {ped.estado === "entregado" && <span style={{ background: "#f0fdf4", color: "#059669", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>ENTREGADO</span>}
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>👤 {ped.cliente}</div>
          {ped.telefono && <div style={{ fontSize: 12, color: "#555", marginBottom: 2 }}>📱 {ped.telefono}</div>}
          {ped.tipo === "delivery" && ped.direccion && (
            <div style={{ fontSize: 12, color: "#2563eb", marginBottom: 2 }}>📍 {ped.direccion}</div>
          )}
          {ped.tipo === "delivery" && ped.localidad && (
            <div style={{ fontSize: 12, color: "#2563eb", marginBottom: 6 }}>🏙️ {ped.localidad} — envío {fmt(ped.costoEnvio || 0)}</div>
          )}

          <div style={{ fontSize: 12, color: "#555", lineHeight: 1.8 }}>
            {ped.items?.map((item, i) => (
              <div key={i}>
                {item.tipo === "burger" && <>
                  <span style={{ fontWeight: 700 }}>🍔 {item.tamano} {item.nombre}</span>
                  <span style={{ color: "#888" }}> · {item.medallon === "vegetariano" ? "🥦 Veg" : "🥩 Carne"}</span>
                  {item.acomp && <span style={{ color: "#888" }}> + {item.acomp.nombre}</span>}
                  {item.extras?.length > 0 && <span style={{ color: "#888" }}> · {item.extras.map(e => e.nombre).join(", ")}</span>}
                  {item.aclaracion && <span style={{ color: "#dc2626", fontWeight: 700 }}> ⚠️ {item.aclaracion}</span>}
                </>}
                {item.tipo === "guar"   && <span>🍟 {item.nombre}</span>}
                {item.tipo === "bebida" && <span>🥤 {item.nombre}</span>}
              </div>
            ))}
            {ped.notas && <div style={{ color: "#dc2626", fontWeight: 700, marginTop: 4 }}>📝 {ped.notas}</div>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#1a3a25" }}>{fmt(ped.total)}</div>
          <button onClick={handleImprimir} disabled={imprimiendo} style={{ ...G.btn("#1a7a3a"), minWidth: 130 }}>
            {imprimiendo ? "Imprimiendo..." : "🖨️ Reimprimir"}
          </button>
          {ped.estado === "pendiente" && <>
            <button onClick={() => onCambioEstado(ped.id, "entregado")} style={{ ...G.btn("#059669"), minWidth: 130 }}>
              ✅ Entregado
            </button>
            <button onClick={() => { if (confirm(`¿Cancelar pedido #${ped.numero}?`)) onCambioEstado(ped.id, "cancelado"); }} style={{ ...G.btn("#dc2626"), minWidth: 130 }}>
              ❌ Cancelar
            </button>
          </>}
        </div>
      </div>
    </div>
  );
}

function TabPedidos() {
  const [pedidos,  setPedidos] = useState([]);
  const [config,   setConfig]  = useState({ ipCocina: "", ipBarra: "" });
  const [qzOk,       setQzOk]      = useState(null);
  const [ipEdit,     setIpEdit]    = useState(false);
  const [ipForm,     setIpForm]    = useState({ ipCocina: "", ipBarra: "" });
  const [subTab,     setSubTab]    = useState("curso");
  const [pagoTab,    setPagoTab]   = useState("Efectivo");
  const [fechasExp,  setFechasExp] = useState({});
  const [fireErr,      setFireErr]     = useState(null);
  const [alertaPedido, setAlertaPedido] = useState(false);
  const prevIds = useRef(new Set());
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);

  useEffect(() => {
    const u1 = subscribePedidos(lista => {
      setFireErr(null);
      setPedidos(lista);
      lista.forEach(ped => {
        if (!prevIds.current.has(ped.id)) {
          const esNuevo = prevIds.current.size > 0;
          prevIds.current.add(ped.id);
          if (esNuevo && ped.estado === "pendiente" && !ped.impreso && !_imprimiendoIds.has(ped.id)) {
            _imprimiendoIds.add(ped.id);
            // Alerta sonora (usa AudioContext pre-calentado en login)
            playAlertSound();
            // Alerta visual: título de pestaña y estado
            document.title = "🔔 NUEVO PEDIDO — Roses Pichincha";
            setTimeout(() => { document.title = "Roses Pichincha - Admin"; }, 6000);
            setAlertaPedido(true);
            setTimeout(() => setAlertaPedido(false), 5000);
            // Imprimir
            imprimirPedido(ped, configRef.current.ipCocina, configRef.current.ipBarra)
              .then(() => marcarImpreso(ped.id))
              .catch(() => {})
              .finally(() => _imprimiendoIds.delete(ped.id));
          }
        }
      });
    }, err => setFireErr(err.message));
    const u2 = subscribeConfig(c => { setConfig(c); setIpForm(c); });
    const checkServidor = () => qzDisponible().then(ok => setQzOk(ok));
    checkServidor();
    const interval = setInterval(checkServidor, 30000);
    return () => { u1(); u2(); clearInterval(interval); };
  }, []);

  async function guardarIPs() {
    await saveConfigImpresoras(ipForm);
    setConfig(ipForm);
    setIpEdit(false);
  }

  const PAGOS = [
    { key: "Efectivo", icon: "💵" },
    { key: "Transferencia", icon: "🔄" },
    { key: "Link de pago", icon: "🔗" },
  ];
  const hoy        = new Date().toLocaleDateString("es-AR");
  const enCurso    = pedidos.filter(p => p.estado === "pendiente");
  const entregados = pedidos.filter(p => p.estado === "entregado");
  const cancelados = pedidos.filter(p => p.estado === "cancelado");

  function agruparPorFecha(lista) {
    const map = {};
    lista.forEach(p => { const f = p.fecha || "Sin fecha"; if (!map[f]) map[f] = []; map[f].push(p); });
    return Object.entries(map).sort(([a], [b]) => {
      const parse = s => { const [d, m, y] = (s || "01/01/2000").split("/"); return new Date(+y, +m - 1, +d).getTime(); };
      return parse(b) - parse(a);
    });
  }
  function isExpanded(f) { return f in fechasExp ? fechasExp[f] : f === hoy; }
  function toggleFecha(f) { setFechasExp(prev => ({ ...prev, [f]: !isExpanded(f) })); }

  const subTabStyle = (active) => ({
    padding: "9px 22px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
    background: active ? "#1a7a3a" : "#e8f0eb", color: active ? "#fff" : "#555",
  });

  return (
    <div>
      {/* Alerta visual nuevo pedido */}
      {alertaPedido && (
        <div style={{ background: "#dc2626", color: "#fff", borderRadius: 12, padding: "16px 20px", marginBottom: 16, fontSize: 16, fontWeight: 900, textAlign: "center", animation: "pulse 0.5s infinite alternate" }}>
          🔔 ¡NUEVO PEDIDO ENTRANTE!
        </div>
      )}

      {/* Error Firestore */}
      {fireErr && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#991b1b", fontWeight: 700 }}>
          ⛔ Error de Firestore: {fireErr}
        </div>
      )}

      {/* Estado QZ Tray */}
      <div style={{ background: qzOk ? "#e8f5ec" : qzOk === false ? "#fef2f2" : "#fffbeb", border: `1px solid ${qzOk ? "#a8d5b5" : qzOk === false ? "#fca5a5" : "#fcd34d"}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: qzOk ? "#1a3a25" : qzOk === false ? "#991b1b" : "#92400e" }}>
          {qzOk === null ? "⏳ Verificando servidor de impresión..." : qzOk ? "✅ Servidor de impresión conectado — impresión automática activa" : "⚠️ Servidor de impresión no detectado — ejecutá node printserver.js en la PC del local"}
        </div>
        <button style={G.btn()} onClick={() => { setIpEdit(v => !v); setIpForm(config); }}>⚙️ IPs impresoras</button>
      </div>

      {ipEdit && (
        <div style={{ ...G.card, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: "#1a3a25" }}>Configurar IPs de impresoras</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>🍳 IP Cocina</div>
              <input style={{ ...G.input, width: "100%" }} value={ipForm.ipCocina} onChange={e => setIpForm(p => ({ ...p, ipCocina: e.target.value }))} placeholder="192.168.1.101" />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>🍹 IP Barra</div>
              <input style={{ ...G.input, width: "100%" }} value={ipForm.ipBarra} onChange={e => setIpForm(p => ({ ...p, ipBarra: e.target.value }))} placeholder="192.168.1.102" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={G.btn()} onClick={guardarIPs}>💾 Guardar IPs</button>
            <button style={G.btn("#6b7280")} onClick={() => setIpEdit(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Sub-tabs principales */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button style={subTabStyle(subTab === "curso")} onClick={() => setSubTab("curso")}>
          En curso {enCurso.length > 0 && <span style={{ background: "#dc2626", color: "#fff", borderRadius: 12, padding: "1px 7px", fontSize: 11, marginLeft: 6 }}>{enCurso.length}</span>}
        </button>
        <button style={subTabStyle(subTab === "mapa")} onClick={() => setSubTab("mapa")}>
          🗺️ Mapa {enCurso.filter(p => p.tipo === "delivery").length > 0 && <span style={{ background: "#2563eb", color: "#fff", borderRadius: 12, padding: "1px 7px", fontSize: 11, marginLeft: 6 }}>{enCurso.filter(p => p.tipo === "delivery").length}</span>}
        </button>
        <button style={subTabStyle(subTab === "entregados")} onClick={() => setSubTab("entregados")}>
          Entregados {entregados.length > 0 && <span style={{ background: "#059669", color: "#fff", borderRadius: 12, padding: "1px 7px", fontSize: 11, marginLeft: 6 }}>{entregados.length}</span>}
        </button>
        {cancelados.length > 0 && (
          <button style={subTabStyle(subTab === "cancelados")} onClick={() => setSubTab("cancelados")}>
            Cancelados <span style={{ background: "#dc2626", color: "#fff", borderRadius: 12, padding: "1px 7px", fontSize: 11, marginLeft: 6 }}>{cancelados.length}</span>
          </button>
        )}
      </div>

      {/* Mapa delivery */}
      {subTab === "mapa" && <MapaPedidos pedidos={pedidos} />}

      {/* Pedidos en curso */}
      {subTab === "curso" && (
        enCurso.length === 0
          ? <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa", fontSize: 15 }}>No hay pedidos en curso</div>
          : enCurso.map(ped => <TarjetaPedido key={ped.id} ped={ped} config={config} onCambioEstado={updatePedidoEstado} />)
      )}

      {/* Cancelados */}
      {subTab === "cancelados" && (
        cancelados.map(ped => <TarjetaPedido key={ped.id} ped={ped} config={config} onCambioEstado={updatePedidoEstado} />)
      )}

      {/* Entregados — resumen + solapas por medio de pago */}
      {subTab === "entregados" && (() => {
        const filtrados = entregados.filter(p => p.pago === pagoTab);
        const grupos    = agruparPorFecha(filtrados);
        const hoyEnt    = entregados.filter(p => p.fecha === hoy);

        return (
          <div>
            {/* Resumen del día */}
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "16px", marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#1a3a25", marginBottom: 12 }}>📊 Resumen de hoy — {hoy}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {PAGOS.map(({ key, icon }) => {
                  const lista = hoyEnt.filter(p => p.pago === key);
                  const tot   = lista.reduce((s, p) => s + (p.total || 0), 0);
                  return (
                    <div key={key} style={{ flex: "1 1 90px", background: "#fff", borderRadius: 10, padding: "12px 10px", textAlign: "center", border: "1px solid #d0e8d8" }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{icon} {key}</div>
                      <div style={{ fontWeight: 900, fontSize: 17, color: "#1a3a25" }}>{fmt(tot)}</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{lista.length} ped.</div>
                    </div>
                  );
                })}
                <div style={{ flex: "1 1 90px", background: "#1a3a25", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#a8e6bc", marginBottom: 4 }}>💰 TOTAL</div>
                  <div style={{ fontWeight: 900, fontSize: 17, color: "#fff" }}>{fmt(hoyEnt.reduce((s, p) => s + (p.total || 0), 0))}</div>
                  <div style={{ fontSize: 11, color: "#6ab88a" }}>{hoyEnt.length} ped.</div>
                </div>
              </div>
            </div>

            {/* Solapas por medio de pago */}
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
              {PAGOS.map(({ key, icon }) => {
                const cantHoy = hoyEnt.filter(p => p.pago === key).length;
                return (
                  <button key={key} onClick={() => setPagoTab(key)} style={{
                    padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
                    background: pagoTab === key ? "#1a7a3a" : "#e8f0eb", color: pagoTab === key ? "#fff" : "#555",
                  }}>
                    {icon} {key} {cantHoy > 0 && <span style={{ background: pagoTab === key ? "#ffffff33" : "#1a7a3a", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 11, marginLeft: 4 }}>{cantHoy}</span>}
                  </button>
                );
              })}
            </div>

            {/* Pedidos agrupados por fecha */}
            {filtrados.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa", fontSize: 15 }}>No hay pedidos entregados en {pagoTab}</div>
            ) : grupos.map(([fecha, lista]) => {
              const totalFecha = lista.reduce((s, p) => s + (p.total || 0), 0);
              const expandida  = isExpanded(fecha);
              return (
                <div key={fecha} style={{ marginBottom: 10 }}>
                  <button onClick={() => toggleFecha(fecha)} style={{
                    width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 16px", background: fecha === hoy ? "#e8f5ec" : "#f4f7f5",
                    border: `1px solid ${fecha === hoy ? "#86efac" : "#d0e8d8"}`,
                    borderRadius: expandida ? "10px 10px 0 0" : 10,
                    cursor: "pointer", fontWeight: 700, fontSize: 14,
                  }}>
                    <span style={{ color: "#1a3a25" }}>
                      📅 {fecha === hoy ? "Hoy" : fecha} — {lista.length} pedido{lista.length !== 1 ? "s" : ""}
                    </span>
                    <span style={{ color: "#1a7a3a" }}>{fmt(totalFecha)} {expandida ? "▲" : "▼"}</span>
                  </button>
                  {expandida && (
                    <div style={{ border: "1px solid #d0e8d8", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "12px", background: "#fff" }}>
                      {lista.map(ped => <TarjetaPedido key={ped.id} ped={ped} config={config} onCambioEstado={updatePedidoEstado} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ── Sección Envíos ────────────────────────────────────────────────
function SeccionEnvios({ envios, onUpdate }) {
  function setPrice(id, valor) {
    onUpdate(envios.map(e => e.id === id ? { ...e, precio: parseFloat(valor) || 0 } : e));
  }
  function setNombre(id, valor) {
    onUpdate(envios.map(e => e.id === id ? { ...e, nombre: valor } : e));
  }
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#1a3a25", marginBottom: 16 }}>🚚 Costos de envío por localidad</div>
      {envios.map(env => (
        <div key={env.id} style={{ ...G.card }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <input style={{ ...G.input, fontWeight: 700, fontSize: 14, flex: "1 1 140px" }}
              value={env.nombre} onChange={e => setNombre(env.id, e.target.value)} placeholder="Localidad..." />
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#888" }}>Costo envío $</span>
              <input type="number" style={{ ...G.input, width: 110, textAlign: "right" }}
                value={env.precio} onChange={e => setPrice(env.id, e.target.value)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Panel principal ────────────────────────────────────────────────
export default function PaginaAdmin() {
  const [logueado, setLogueado] = useState(() => localStorage.getItem(LS_SESSION) === "1");
  const [tab, setTab]           = useState(0);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [flashOk, setFlashOk]   = useState(false);

  const [estado,       setEstado]       = useState({ abierto: true, horaDesde: "19:30", horaHasta: "23:00" });
  const [burgers,      setBurgers]      = useState(BURGERS_DEFAULT);
  const [guarniciones, setGuarniciones] = useState(GUARNICIONES_DEFAULT);
  const [extras,       setExtras]       = useState(EXTRAS_DEFAULT);
  const [bebidas,      setBebidas]      = useState(BEBIDAS_DEFAULT);
  const [acomp,        setAcomp]        = useState(ACOMP_DEFAULT);
  const [envios,       setEnvios]       = useState(ENVIOS_DEFAULT);
  const [zona,         setZona]         = useState([]);

  useEffect(() => {
    if (!logueado) return;
    const unsubEstado = subscribeEstado(e => setEstado(e));
    const unsubMenu = subscribeMenu(data => {
      setBurgers(data.burgers);
      setGuarniciones(data.guarniciones);
      setExtras(data.extras);
      setBebidas(data.bebidas);
      setAcomp(data.acomp);
      setEnvios(data.envios || ENVIOS_DEFAULT);
      setCargando(false);
    });
    const unsubZona = subscribeZona(z => setZona(z));
    return () => { unsubEstado(); unsubMenu(); unsubZona(); };
  }, [logueado]);

  async function guardarMenu() {
    setGuardando(true);
    try {
      await saveMenuFirestore({ burgers, guarniciones, extras, bebidas, acomp, envios });
      setFlashOk(true); setTimeout(() => setFlashOk(false), 2500);
    } catch { alert("Error al guardar. Revisá tu conexión."); }
    finally { setGuardando(false); }
  }

  async function guardarZona(z) {
    setZona(z);
    await saveZonaFirestore(z);
    alert("✅ Zona guardada");
  }

  if (!logueado) return <Login onLogin={() => setLogueado(true)} />;

  const urlCliente = `${window.location.origin}/`;
  const showGuardar = (tab >= 1 && tab <= 5) || tab === 6;

  return (
    <div style={G.page}>
      {/* Header */}
      <div style={G.header}>
        <div>
          <div style={G.title}>🍔 Roses Pichincha — Admin</div>
          <div style={{ fontSize: 12, color: "#6ab88a", marginTop: 2 }}>Panel de pedidos online</div>
        </div>
        <button onClick={() => { localStorage.removeItem(LS_SESSION); setLogueado(false); }} style={{ ...G.btn("#ffffff22", "#fff"), fontSize: 12 }}>
          Cerrar sesión
        </button>
      </div>

      {/* Body: sidebar + content */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* Sidebar */}
        <div style={{ width: 210, background: "#1e4530", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* Link cliente */}
          <div style={{ padding: "16px 14px", borderBottom: "1px solid #2d5a40" }}>
            <div style={{ fontSize: 11, color: "#6ab88a", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Link clientes</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{ ...G.btn("#2d6a45", "#a8e6bc"), fontSize: 11, flex: 1, padding: "7px 8px" }} onClick={() => navigator.clipboard.writeText(urlCliente)}>📋 Copiar</button>
              <button style={{ ...G.btn("#2563eb"), fontSize: 11, flex: 1, padding: "7px 8px" }} onClick={() => window.open(urlCliente, "_blank")}>🔍 Ver</button>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "10px 0" }}>
            {NAV_ITEMS.map((item, i) => (
              <button key={i} onClick={() => setTab(i)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 18px",
                background: tab === i ? "#1a7a3a" : "transparent", color: tab === i ? "#fff" : "#a8c8b4",
                border: "none", cursor: "pointer", fontSize: 14, fontWeight: tab === i ? 700 : 400,
                textAlign: "left", transition: "background 0.15s",
              }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Estado + horarios + prueba */}
          <div style={{ padding: "14px", borderTop: "1px solid #2d5a40" }}>
            <div style={{ fontSize: 11, color: "#6ab88a", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Estado del local</div>

            {/* Toggle abierto/cerrado */}
            <button
              onClick={() => saveEstado({ abierto: !estado.abierto })}
              style={{
                width: "100%", padding: "13px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                background: estado.abierto ? "#059669" : "#dc2626",
                color: "#fff", fontWeight: 900, fontSize: 13,
                boxShadow: estado.abierto ? "0 0 12px #05966966" : "0 0 12px #dc262666",
                marginBottom: 12,
              }}>
              {estado.abierto ? "✅ Abierto" : "🔴 Cerrado"}
            </button>

            {/* Horarios */}
            <div style={{ fontSize: 11, color: "#6ab88a", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Horario</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
              <input type="time" value={estado.horaDesde}
                onChange={e => setEstado(p => ({ ...p, horaDesde: e.target.value }))}
                style={{ flex: 1, background: "#2d5a40", border: "1px solid #3d6a50", borderRadius: 6, color: "#fff", padding: "6px 4px", fontSize: 12, textAlign: "center" }} />
              <span style={{ color: "#6ab88a", fontSize: 12 }}>a</span>
              <input type="time" value={estado.horaHasta}
                onChange={e => setEstado(p => ({ ...p, horaHasta: e.target.value }))}
                style={{ flex: 1, background: "#2d5a40", border: "1px solid #3d6a50", borderRadius: 6, color: "#fff", padding: "6px 4px", fontSize: 12, textAlign: "center" }} />
            </div>
            <button
              onClick={() => saveEstado({ horaDesde: estado.horaDesde, horaHasta: estado.horaHasta })}
              style={{ width: "100%", padding: "7px", borderRadius: 8, border: "none", cursor: "pointer", background: "#2d6a45", color: "#a8e6bc", fontWeight: 700, fontSize: 12, marginBottom: 10 }}>
              💾 Guardar horario
            </button>

            {/* Botón prueba */}
            <button
              onClick={() => window.open(`${window.location.origin}/`, "_blank")}
              style={{ width: "100%", padding: "9px", borderRadius: 8, border: "1px solid #3d6a50", cursor: "pointer", background: "transparent", color: "#a8c8b4", fontWeight: 700, fontSize: 12 }}>
              🔍 Abrir en modo prueba
            </button>
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {/* Flash guardado */}
          {flashOk && (
            <div style={{ background: "#e8f5ec", border: "1px solid #1a7a3a", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontWeight: 700, color: "#1a7a3a", fontSize: 13 }}>
              ✅ Cambios guardados — ya los ven todos los clientes
            </div>
          )}

          {/* Botón guardar */}
          {showGuardar && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button onClick={guardarMenu} disabled={guardando} style={{ ...G.btn(), padding: "10px 24px", fontSize: 14, opacity: guardando ? 0.7 : 1 }}>
                {guardando ? "Guardando..." : "💾 Guardar cambios"}
              </button>
            </div>
          )}

          {cargando ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#888" }}>Cargando menú...</div>
          ) : (
            <>
              {tab === 0 && <TabPedidos />}
              {tab === 1 && <SeccionItems titulo="Hamburguesas" icon="🍔" items={burgers} onUpdate={setBurgers} tipoFoto="burger" mostrarSimDoTri />}
              {tab === 2 && <SeccionItems titulo="Guarniciones" icon="🍟" items={guarniciones} onUpdate={setGuarniciones} tipoFoto="guar" />}
              {tab === 3 && <SeccionItems titulo="Acompañamientos de burger" icon="🍟" items={acomp} onUpdate={setAcomp} />}
              {tab === 4 && <SeccionItems titulo="Extras para la burger" icon="➕" items={extras} onUpdate={setExtras} tipoFoto="extra" />}
              {tab === 5 && <SeccionItems titulo="Bebidas" icon="🥤" items={bebidas} onUpdate={setBebidas} tipoFoto="bebida" />}
              {tab === 6 && <SeccionEnvios envios={envios} onUpdate={setEnvios} />}
              {tab === 7 && <MapaAdmin zona={zona} onGuardar={guardarZona} onLimpiar={async () => { setZona([]); await saveZonaFirestore([]); }} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
