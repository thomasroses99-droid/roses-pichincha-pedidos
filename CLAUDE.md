# Página de pedidos — Pichincha

Esta carpeta es **solo** la página de pedidos de **Pichincha**: https://roses-pichincha-pedidos.vercel.app (proyecto de Vercel `roses-pichincha-pedidos`, base de Firestore `pedidos-online-pic`).

Reglas:
- Trabajar únicamente en esta carpeta. No leer, copiar ni modificar las carpetas de las otras sucursales (`roses-burgers-pedidos-` = Fisherton, `roses-zona-sur-pedidos` = Zona Sur, `roses-pichincha-pedidos` = Pichincha). Si el pedido implica otra sucursal, avisar y que se haga en una sesión abierta en esa carpeta.
- Es un local real atendiendo clientes: no cambiar nada más que lo pedido. No tocar `src/datos.js`, `src/firebase.js` ni `src/PaginaAdmin.jsx` salvo que el pedido lo requiera.
- Publicar solo con `vercel --prod` desde esta carpeta, fuera del horario de atención (ver `estado` en Firestore), mostrando el diff antes. No hay deploy automático desde GitHub, a propósito.
- `verificar-sucursal.mjs` (el "candado") corre antes de cada build y frena la publicación si el código o el destino no son de Pichincha. No desactivarlo ni saltearlo.
- Después de publicar, verificar que el bundle online de https://roses-pichincha-pedidos.vercel.app contenga `pedidos-online-pic`.
