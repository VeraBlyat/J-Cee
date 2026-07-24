import Link from "next/link";
import { getCurrentUser } from "@/lib/api";
import LogoutButton from "@/components/LogoutButton";
import Image from "next/image";
import Logo from "../misc/LogoG.png";

// Componente de servidor: puede leer la sesión directamente.
export default async function Navbar() {
  const user = await getCurrentUser();

  return (
    <nav className="bg-primary">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/">
          <Image src={Logo} alt="</> J-Cee" width={60} height={40}>

          </Image>
        </Link>

        <form action="/buscar" method="GET" className="flex-1 max-w-md">
          <input
            type="text"
            name="q"
            placeholder="Buscar videos..."
            className="w-full px-3 py-1.5 rounded-md bg-surface text-bkg placeholder-card focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </form>

        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-card hover:text-txt">
            Inicio
          </Link>

          {user ? (
            <>
              <Link href="/upload" className="text-card hover:text-txt">
                Subir video
              </Link>
              {user.is_admin && (
                <Link href="/admin" className="hover:bkg text-yellow-400">
                  Admin
                </Link>
              )}
              <span className="text-card">Hola, {user.username}</span>
              {/* Botón de cliente que llama al backend Nest y refresca. */}
              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="text-card hover:text-txt">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}