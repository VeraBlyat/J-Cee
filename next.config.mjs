/** @type {import('next').NextConfig} */

// Origen del backend Nest al que Next reenvía /api y /uploads.
//
// - Monolito (Azure): front y back en el MISMO contenedor -> localhost:3001.
// - LAN (dos computadoras): el backend está en otra máquina, así que acá va
//   algo como "https://api.unistream.lan".
//
// IMPORTANTE: los rewrites se resuelven cuando corre `next build` y quedan
// escritos en .next/routes-manifest.json. Es una variable de BUILD TIME:
// cambiarla en un contenedor ya construido no tiene efecto (por eso
// Dockerfile.frontend la recibe como ARG).
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "http://localhost:3001";

const nextConfig = {
  // Imagen de runtime mínima para Docker (solo lo necesario para `node server.js`).
  output: "standalone",

  // El navegador siempre le pega al host del frontend (NEXT_PUBLIC_API_URL="/api")
  // y estas reglas reenvían esas rutas al backend Nest.
  // En el despliegue en LAN, nginx ya proxea /api y /uploads antes de llegar a
  // Next (más eficiente para servir video), así que estas reglas quedan como
  // red de seguridad y para quien levante el contenedor sin nginx.
  // (En dev, NEXT_PUBLIC_API_URL apunta directo al backend y estas reglas
  // no se usan porque las llamadas del cliente ya son a otro origen.)
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
      { source: "/uploads/:path*", destination: `${BACKEND_ORIGIN}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
