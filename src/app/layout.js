import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "UniStream",
  description: "Plataforma de streaming universitaria",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
