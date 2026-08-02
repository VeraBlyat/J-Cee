import "./globals.css";
import { Baloo_2, Inter, JetBrains_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import ThemeScript from "@/components/ThemeScript";
import Logo from "../misc/LogoP.png";
import ReduxProvider from "@/components/ReduxProvider";
import { getCurrentUser } from "@/lib/api";

// Las tres tipografías del sistema de diseño. next/font las auto-hospeda en
// vez de pedirlas a Google en cada carga: sin request a un tercero y sin el
// salto de texto que provoca cargar una fuente tarde.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Baloo 2 es la tipografía de títulos y de la marca.
const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

// Monoespaciada para duraciones, contadores y todo lo numérico.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata = {
  title: "J-Cee",
  description: "Plataforma de streaming para programadores",
  icons: { icon: Logo.src },
};

export default async function RootLayout({ children }) {
  // Resolvemos la sesión en el servidor y con ella hidratamos el store, así el
  // navbar (ahora cliente) muestra al usuario desde el primer render sin parpadeo.
  const user = await getCurrentUser();

  return (
    <html
      lang="es"
      // suppressHydrationWarning porque ThemeScript escribe data-theme antes
      // de que React hidrate: el HTML del servidor y el del cliente difieren
      // en ese atributo a propósito.
      suppressHydrationWarning
      className={`${inter.variable} ${baloo.variable} ${jetbrains.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-page text-text">
        <ReduxProvider initialUser={user}>
          <Navbar />
          <div className="flex min-h-[calc(100vh-60px)]">
            <Sidebar />
            <main className="min-w-0 flex-1 px-7 py-7 pb-12">{children}</main>
          </div>
        </ReduxProvider>
      </body>
    </html>
  );
}
