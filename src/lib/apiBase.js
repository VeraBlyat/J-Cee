// URL pública de la API: la usa el NAVEGADOR (componentes de cliente y el
// <video> del reproductor). En local son dos procesos separados, así que
// apunta directo al backend; en producción todo corre en un solo
// contenedor detrás de Next, así que es una ruta relativa que el rewrite
// de next.config.mjs reenvía al backend interno.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// URL interna, servidor-a-servidor: la usan los Componentes de Servidor
// (serverFetch). Nunca llega al navegador (no lleva NEXT_PUBLIC_), así que
// en producción puede seguir apuntando directo al backend por localhost
// aunque el navegador no tenga acceso directo a ese puerto.
// OJO: no debe caer en API_URL como default, porque en producción API_URL
// suele ser una ruta relativa ("/api") pensada para el rewrite de Next, y
// una ruta relativa no es una URL válida para el `fetch` de Node en el
// servidor (rompe con "Failed to parse URL from /api/...").
export const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL || "http://localhost:3001/api";
