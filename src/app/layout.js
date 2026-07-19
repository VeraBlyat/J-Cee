import "./globals.css";
import Navbar from "@/components/Navbar";
import logo from "../misc/LogoBGR.png";


export const metadata = {
  title: "J-Cee",
  icons: { icon: logo.src, },
  description: "Plataforma de streaming upaniana",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-slg text-primary min-h-screen">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}