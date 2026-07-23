import "./globals.css";
import Navbar from "@/components/Navbar";
import ReduxProvider from "@/components/ReduxProvider";
import { getCurrentUser } from "@/lib/api";

export const metadata = {
  title: "UniStream",
  description: "Plataforma de streaming universitaria",
};

export default async function RootLayout({ children }) {
  // Resolvemos la sesión en el servidor y con ella hidratamos el store, así el
  // navbar (ahora cliente) muestra al usuario desde el primer render sin parpadeo.
  const user = await getCurrentUser();

  return (
    <html lang="es">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <ReduxProvider initialUser={user}>
          <Navbar />
          <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        </ReduxProvider>
      </body>
    </html>
  );
}
