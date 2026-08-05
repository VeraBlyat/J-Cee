/** @type {import('next').NextConfig} */
const nextConfig = {
  // Imagen de runtime mínima para Docker (solo lo necesario para `node server.js`).
  output: "standalone",

  experimental: {
    // Al reenviar por el rewrite, Next bufferea el body de la request con un
    // tope que por defecto es 10MB. Una subida de video más grande se trunca a
    // los 10MB y el backend recibe datos incompletos, así que la conexión se
    // corta (ECONNRESET / socket hang up). Lo subimos a 500MB para que iguale
    // el límite de Multer del backend (MAX_UPLOAD_BYTES) y las subidas grandes
    // pasen enteras por el proxy.
    proxyClientMaxBodySize: "500mb",
  },

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
