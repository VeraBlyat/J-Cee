/** @type {import('next').NextConfig} */
const nextConfig = {
  // Imagen de runtime mínima para Docker (solo lo necesario para `node server.js`).
  output: "standalone",

  // En producción, frontend y backend viven en el mismo contenedor: Next
  // expone el único puerto público y reenvía estas rutas al backend Nest,
  // que solo escucha en localhost dentro del contenedor.
  // (En dev, NEXT_PUBLIC_API_URL apunta directo al backend y estas reglas
  // no se usan porque las llamadas del cliente ya son a otro origen.)
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:3001/api/:path*" },
      { source: "/uploads/:path*", destination: "http://localhost:3001/uploads/:path*" },
    ];
  },
};

export default nextConfig;
