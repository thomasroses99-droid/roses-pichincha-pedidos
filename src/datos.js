import { db, storage, doc, setDoc, onSnapshot, ref, uploadBytes, getDownloadURL, deleteObject, collection, addDoc, query, orderBy, limit, runTransaction, increment } from "./firebase.js";

// ── Datos por defecto ─────────────────────────────────────────────
export const BURGERS_DEFAULT = [
  { id: 1,  nombre: "CHEESEBURGER",  tag: "RENOVADA", desc: "Pan brioche, doble cheddar, medallón 100gr, aderezo a base de mayonesa.",                                      simple: 11000, doble: 13000, triple: 15000, disponible: true },
  { id: 2,  nombre: "ROSES",         tag: "RENOVADA", desc: "Pan brioche, doble cheddar, medallón 100gr, ketchup, mayonesa, cebolla brunoise.",                              simple: 11000, doble: 13000, triple: 15000, disponible: true },
  { id: 3,  nombre: "1967",          tag: null,        desc: "Pan brioche, doble cheddar, medallón 100gr, lechuga, cebolla, pepino, aderezo a base de mayonesa.",            simple: 11000, doble: 13000, triple: 15000, disponible: true },
  { id: 4,  nombre: "CLASSIC",       tag: "RENOVADA", desc: "Pan brioche, doble cheddar, medallón 100gr, lechuga, tomate, cebolla, pepino, salsa mil islas.",               simple: 11000, doble: 13000, triple: 15000, disponible: true },
  { id: 5,  nombre: "CHEESE ONION",  tag: "RENOVADA", desc: "Pan brioche, doble cheddar, medallón smashed 100gr, cebolla, aderezo a base de mayonesa.",                     simple: 11000, doble: 13000, triple: 15000, disponible: true },
  { id: 6,  nombre: "COWBOY",        tag: "NUEVA",    desc: "Pan brioche, doble cheddar, medallón 100gr, cowboy butter.",                                                   simple: 11000, doble: 13000, triple: 15000, disponible: true },
  { id: 7,  nombre: "SMOKEY BACON",  tag: "RENOVADA", desc: "Pan brioche, doble cheddar, medallón 100gr, panceta ahumada, cebolla crispy, barbacoa.",                       simple: 11000, doble: 13000, triple: 15000, disponible: true },
  { id: 8,  nombre: "BLUE CHEESE",   tag: "RENOVADA", desc: "Pan brioche, roquefort, medallón 100gr, rúcula, panceta, cebolla caramelizada, honey mustard.",                simple: 11000, doble: 13000, triple: 15000, disponible: true },
  { id: 9,  nombre: "STACKED ONION", tag: "RENOVADA", desc: "Pan brioche, doble cheddar, medallón 100gr, panceta ahumada, aros de cebolla, stacked sauce.",                simple: 11000, doble: 13000, triple: 15000, disponible: true },
  { id: 10, nombre: "CHEESE BACON",  tag: "RENOVADA", desc: "Pan brioche, doble cheddar, medallón 100gr, panceta ahumada, bacon sauce.",                                    simple: 11000, doble: 13000, triple: 15000, disponible: true },
  { id: 11, nombre: "BIGGIE BURGER", tag: "RENOVADA", desc: "Pan brioche, doble cheddar, medallón 100gr, panceta ahumada, lechuga, cebolla morada, pepino, tasty sauce.",  simple: 11000, doble: 13000, triple: 15000, disponible: true },
  { id: 12, nombre: "CRISPY GARLIC", tag: "NUEVA",    desc: "Pan brioche, doble cheddar, medallón 100gr, panceta ahumada, cebolla crispy, alioli.",                         simple: 11000, doble: 13000, triple: 15000, disponible: true },
  { id: 13, nombre: "RUBY CLOVE",    tag: "NUEVA",    desc: "Pan brioche, doble cheddar, medallón 100gr, cebolla morada brunoise, alioli.",                                  simple: 11000, doble: 13000, triple: 15000, disponible: true },
];

export const GUARNICIONES_DEFAULT = [
  { id: "g1", nombre: "Papas Fritas",    detalle: "Chicas",          precio: 3500,  disponible: true },
  { id: "g2", nombre: "Papas Cheddar",   detalle: "Grandes",         precio: 8000,  disponible: true },
  { id: "g3", nombre: "Aros de Cebolla", detalle: "Grandes · 18 u.", precio: 10000, disponible: true },
  { id: "g4", nombre: "Aros de Cebolla", detalle: "Chicas · 9 u.",   precio: 5500,  disponible: true },
  { id: "g5", nombre: "Nuggets",         detalle: "10 u.",           precio: 6500,  disponible: true },
  { id: "g6", nombre: "Nuggets G",       detalle: "Grandes · 20 u.", precio: 12000, disponible: true },
];

export const EXTRAS_DEFAULT = [
  { id: "e1", nombre: "Medallón + Queso Extra", precio: 2500, disponible: true },
  { id: "e2", nombre: "Panceta",                precio: 1500, disponible: true },
  { id: "e3", nombre: "Cheddar",                precio: 1000, disponible: true },
  { id: "e4", nombre: "Pepino",                 precio: 500,  disponible: true },
  { id: "e5", nombre: "Cebolla",                precio: 200,  disponible: true },
];

export const BEBIDAS_DEFAULT = [
  { id: "b1", nombre: "Gaseosa", detalle: "Pepsi / Pepsi Black / 7UP / Mirinda 354cc", precio: 3000, disponible: true },
];

export const ENVIOS_DEFAULT = [
  { id: "env1", nombre: "Fisherton", precio: 2500 },
  { id: "env2", nombre: "Funes",     precio: 3000 },
];

export const ACOMP_DEFAULT = [
  { id: "ac1", nombre: "Papas fritas",      precio: 2500, disponible: true },
  { id: "ac2", nombre: "Aros de cebolla",   precio: 5000, disponible: true },
  { id: "ac3", nombre: "Papas con cheddar", precio: 6000, disponible: true },
  { id: "ac4", nombre: "Nuggets",           precio: 6000, disponible: true },
];

// ── Firestore: menú ───────────────────────────────────────────────
const MENU_DOC = doc(db, "pedidos-online-pic", "menu");

export async function saveMenuFirestore(data) {
  await setDoc(MENU_DOC, {
    burgers:      JSON.stringify(data.burgers),
    guarniciones: JSON.stringify(data.guarniciones),
    extras:       JSON.stringify(data.extras),
    bebidas:      JSON.stringify(data.bebidas),
    acomp:        JSON.stringify(data.acomp),
    envios:       JSON.stringify(data.envios),
  });
}

// Suscripción en tiempo real — llama a callback({ burgers, guarniciones, extras, bebidas })
export function subscribeMenu(callback) {
  return onSnapshot(MENU_DOC, snap => {
    if (!snap.exists()) { callback({ burgers: BURGERS_DEFAULT, guarniciones: GUARNICIONES_DEFAULT, extras: EXTRAS_DEFAULT, bebidas: BEBIDAS_DEFAULT, acomp: ACOMP_DEFAULT, envios: ENVIOS_DEFAULT }); return; }
    const d = snap.data();
    callback({
      burgers:      safeJSON(d.burgers,      BURGERS_DEFAULT),
      guarniciones: safeJSON(d.guarniciones, GUARNICIONES_DEFAULT),
      extras:       safeJSON(d.extras,       EXTRAS_DEFAULT),
      bebidas:      safeJSON(d.bebidas,      BEBIDAS_DEFAULT),
      acomp:        safeJSON(d.acomp,        ACOMP_DEFAULT),
      envios:       safeJSON(d.envios,       ENVIOS_DEFAULT),
    });
  });
}

function safeJSON(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

// ── Firebase Storage: fotos ───────────────────────────────────────
// path: pedidos-fotos/{tipo}/{id}.jpg
export async function uploadFoto(tipo, id, blob) {
  const storageRef = ref(storage, `pedidos-fotos/${tipo}/${id}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  return await getDownloadURL(storageRef);
}

export async function deleteFotoStorage(tipo, id) {
  try {
    const storageRef = ref(storage, `pedidos-fotos/${tipo}/${id}.jpg`);
    await deleteObject(storageRef);
  } catch {}
}

export async function getFotoURL(tipo, id) {
  try {
    const storageRef = ref(storage, `pedidos-fotos/${tipo}/${id}.jpg`);
    return await getDownloadURL(storageRef);
  } catch { return null; }
}

// ── Cache local de URLs de fotos (evita re-fetch) ─────────────────
const fotoCache = {};
export function getFotoCached(tipo, id) { return fotoCache[`${tipo}-${id}`] || null; }
export function setFotoCache(tipo, id, url) { fotoCache[`${tipo}-${id}`] = url; }
export function clearFotoCache(tipo, id) { delete fotoCache[`${tipo}-${id}`]; }

// ── Estado (abierto/cerrado) ───────────────────────────────────────
const ESTADO_DOC = doc(db, "pedidos-online-pic", "estado");

export async function saveEstado(data) {
  await setDoc(ESTADO_DOC, data, { merge: true });
}

export function subscribeEstado(callback) {
  return onSnapshot(ESTADO_DOC, snap => {
    const d = snap.exists() ? snap.data() : {};
    callback({
      abierto:    d.abierto    !== false,
      horaDesde:  d.horaDesde  || "19:30",
      horaHasta:  d.horaHasta  || "23:00",
    });
  });
}

// ── Zona delivery ─────────────────────────────────────────────────
const ZONA_DOC = doc(db, "pedidos-online-pic", "zona");
export async function saveZonaFirestore(zona) { await setDoc(ZONA_DOC, { zona: JSON.stringify(zona) }); }
export function subscribeZona(callback) {
  return onSnapshot(ZONA_DOC, snap => {
    if (!snap.exists()) { callback([]); return; }
    callback(safeJSON(snap.data().zona, []));
  });
}

// ── Pedidos ───────────────────────────────────────────────────────
const COUNTER_DOC  = doc(db, "pedidos-online-pic", "contador");
const PEDIDOS_COL  = collection(db, "pedidos-pic");
const CONFIG_DOC   = doc(db, "pedidos-online-pic", "config");

export async function saveOrder(orderData) {
  // Contador + guardado del pedido dentro de la misma transacción atómica.
  // Así si addDoc falla, el contador NO avanza y el reintento obtiene el mismo número.
  let numeroPedido = 1;
  const hora  = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const fecha = new Date().toLocaleDateString("es-AR");

  await runTransaction(db, async tx => {
    const snap = await tx.get(COUNTER_DOC);
    const actual = snap.exists() ? (snap.data().ultimo || 0) : 0;
    numeroPedido = actual >= 100 ? 1 : actual + 1;
    tx.set(COUNTER_DOC, { ultimo: numeroPedido });

    const newRef = doc(PEDIDOS_COL);
    tx.set(newRef, {
      ...orderData,
      numero: numeroPedido,
      hora,
      fecha,
      timestamp: Date.now(),
      estado: "pendiente",
    });
  });

  return numeroPedido;
}

export function subscribePedidos(callback, onError) {
  const q = query(PEDIDOS_COL, orderBy("timestamp", "desc"), limit(200));
  return onSnapshot(q,
    snap => { callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
    err  => { if (onError) onError(err); else console.error("subscribePedidos error:", err); }
  );
}

export async function updatePedidoEstado(id, estado) {
  await setDoc(doc(db, "pedidos-pic", id), { estado }, { merge: true });
}

export async function marcarImpreso(id) {
  await setDoc(doc(db, "pedidos-pic", id), { impreso: true }, { merge: true });
}

export async function saveConfigImpresoras(config) {
  await setDoc(CONFIG_DOC, { impresoras: JSON.stringify(config) });
}
export function subscribeConfig(callback) {
  return onSnapshot(CONFIG_DOC, snap => {
    if (!snap.exists()) { callback({ ipCocina: "", ipBarra: "" }); return; }
    callback(safeJSON(snap.data().impresoras, { ipCocina: "", ipBarra: "" }));
  });
}

// ── Comprimir imagen ──────────────────────────────────────────────
export function comprimirImagen(file, maxPx = 600, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error("No se pudo comprimir la imagen"));
        }, "image/jpeg", quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export const fmt = n => `$${Number(n).toLocaleString("es-AR")}`;
