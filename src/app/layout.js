import "./globals.css";
import Navbar from "@/components/Navbar";
import Logo from "../misc/LogoP.png"

export const metadata = {
  title: "J-Cee",
  description: "Plataforma de streaming upaniana",
  icons: { icon: Logo.src },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-bkg text-sbtxt min-h-screen">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}