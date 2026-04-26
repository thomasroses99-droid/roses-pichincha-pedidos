// ── Impresión ESC/POS via servidor local ──────────────────────────
// Ejecutar en la PC del local: node printserver.js
// No requiere QZ Tray

const PRINT_SERVER = "http://localhost:3001";

function binToBase64(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xFF;
  let bin = "";
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

async function imprimirEnDestino(destino, comandos) {
  const esIP = /^\d{1,3}(\.\d{1,3}){3}$/.test(destino.trim());
  const data = binToBase64(comandos.join(""));
  const body = esIP
    ? { ip: destino.trim(), data }
    : { name: destino.trim(), data };

  const res = await fetch(`${PRINT_SERVER}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error desconocido" }));
    throw new Error(err.error || "Error al imprimir");
  }
}

// ── Comandos ESC/POS básicos ───────────────────────────────────────
const ESC = "\x1B";
const GS  = "\x1D";
const INIT        = ESC + "@";
const BOLD_ON     = ESC + "E\x01";
const BOLD_OFF    = ESC + "E\x00";
const CENTER      = ESC + "a\x01";
const LEFT        = ESC + "a\x00";
const BIG         = GS  + "!\x22";
const NORMAL      = GS  + "!\x11";
const FEED3       = "\n\n\n";
const CUT         = GS  + "V\x41\x03";
const LINE        = "--------------------\n";

function fmt(n) { return `$${Number(n).toLocaleString("es-AR")}`; }

// ── COMANDA COCINA ─────────────────────────────────────────────────
export function buildCocina(pedido) {
  const { numero, hora, tipo, cliente, items, notas } = pedido;
  let t = INIT;
  t += CENTER + BIG + BOLD_ON + `PEDIDO #${numero}\n` + NORMAL + BOLD_OFF;
  t += CENTER + BOLD_ON + `${tipo === "delivery" ? "DELIVERY" : "RETIRO EN LOCAL"}\n` + BOLD_OFF;
  t += CENTER + `${hora}\n`;
  t += LEFT + LINE;

  items.forEach(item => {
    if (item.tipo === "burger") {
      t += BOLD_ON + `${item.tamano.toUpperCase()} ${item.nombre}\n` + BOLD_OFF;
      t += `  Medallon: ${item.medallon === "vegetariano" ? "VEGETARIANO" : "CARNE"}\n`;
      if (item.acomp)           t += `  + ${item.acomp.nombre}\n`;
      if (item.extras?.length)  t += `  Extras: ${item.extras.map(e => e.nombre).join(", ")}\n`;
      if (item.aclaracion)      t += BOLD_ON + `  *** ${item.aclaracion} ***\n` + BOLD_OFF;
    } else if (item.tipo === "guar") {
      t += `GUARNICION: ${item.nombre}\n`;
    } else if (item.tipo === "bebida") {
      t += `BEBIDA: ${item.nombre}\n`;
    }
  });

  t += LINE;
  t += `Cliente: ${cliente}\n`;
  if (notas?.trim()) t += BOLD_ON + `Nota: ${notas}\n` + BOLD_OFF;
  t += FEED3 + CUT;
  return t;
}

// ── COMANDA BARRA ──────────────────────────────────────────────────
export function buildBarra(pedido) {
  const { numero, hora, tipo, cliente, direccion, items, total, pago } = pedido;
  let t = INIT;
  t += CENTER + BIG + BOLD_ON + `PEDIDO #${numero}\n` + NORMAL + BOLD_OFF;
  t += CENTER + BOLD_ON + `${tipo === "delivery" ? "DELIVERY" : "RETIRO EN LOCAL"}\n` + BOLD_OFF;
  t += CENTER + `${hora}\n`;
  t += LEFT + LINE;

  if (tipo === "delivery" && direccion) {
    t += BOLD_ON + `Domicilio: ${direccion}\n` + BOLD_OFF;
    t += LINE;
  }

  t += `Cliente: ${cliente}\n`;
  if (pedido.telefono?.trim()) t += `Tel: ${pedido.telefono.trim()}\n`;
  t += LINE;

  items.forEach(item => {
    if (item.tipo === "burger") {
      t += BOLD_ON + `${item.tamano.toUpperCase()} ${item.nombre}\n` + BOLD_OFF;
      if (item.acomp)  t += `  + ${item.acomp.nombre} ........... ${fmt(item.acomp.precio)}\n`;
      if (item.extras?.length) item.extras.forEach(e => {
        t += `  + ${e.nombre} ........... ${fmt(e.precio)}\n`;
      });
      t += `  Subtotal: ${fmt(item.precio)}\n`;
    } else if (item.tipo === "guar") {
      t += `${item.nombre} ........... ${fmt(item.precio)}\n`;
    } else if (item.tipo === "bebida") {
      t += `${item.nombre} ........... ${fmt(item.precio)}\n`;
    }
  });

  t += LINE;
  t += BIG + BOLD_ON + `TOTAL: ${fmt(total)}\n` + NORMAL + BOLD_OFF;
  t += `Pago: ${pago}\n`;
  t += FEED3 + CUT;
  return t;
}

// ── Función principal ──────────────────────────────────────────────
export async function imprimirPedido(pedido, ipCocina, ipBarra) {
  const errores = [];

  if (ipCocina) {
    try { await imprimirEnDestino(ipCocina, [buildCocina(pedido)]); }
    catch (e) { errores.push(`Cocina: ${e.message}`); }
  }

  if (ipBarra) {
    try { await imprimirEnDestino(ipBarra, [buildBarra(pedido)]); }
    catch (e) { errores.push(`Barra: ${e.message}`); }
  }

  if (errores.length) throw new Error(errores.join(" | "));
}

export async function qzDisponible() {
  try {
    const res = await fetch(`${PRINT_SERVER}/ping`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch { return false; }
}
