// CANDADO: impide que esta página se publique en el proyecto de Vercel de otra sucursal.
// Si algo no coincide, la compilación falla y Vercel NO publica nada (la página online queda como estaba).
import { readFileSync } from "node:fs";

const SUCURSAL = "Pichincha";
const DOMINIO  = "roses-pichincha-pedidos.vercel.app";
const BASES    = ["pedidos-online-pic", "pedidos-pic"];

function falla(msg) {
  console.error("\n⛔ CANDADO " + SUCURSAL + ": " + msg + "\n   No se publica nada.\n");
  process.exit(1);
}

// 1) El código tiene que usar la base de datos de esta sucursal y ninguna otra
const datos = readFileSync("src/datos.js", "utf8");
const usadas = [...new Set([...datos.matchAll(/(?:doc|collection)\(db, "([^"]+)"/g)].map(m => m[1]))].sort();
if (JSON.stringify(usadas) !== JSON.stringify([...BASES].sort()))
  falla("src/datos.js usa las bases [" + usadas + "] pero " + SUCURSAL + " usa [" + BASES + "]");

// 2) En Vercel, el proyecto destino tiene que ser el de esta sucursal
if (process.env.VERCEL) {
  const destino = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (destino !== DOMINIO)
    falla("este código es de " + DOMINIO + " pero se está publicando en " + (destino || "(desconocido)"));
}

console.log("✓ Candado OK: " + SUCURSAL + (process.env.VERCEL ? " → " + DOMINIO : " (compilación local)"));
