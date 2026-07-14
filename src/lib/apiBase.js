// URL base del backend Nest.js. Este archivo NO importa nada de servidor
// (como next/headers), así que puede usarse tanto en componentes de cliente
// como de servidor.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
