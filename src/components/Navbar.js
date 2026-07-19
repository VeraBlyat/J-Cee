import Link from "next/link";
import { getCurrentUser } from "@/lib/api";
import LogoutButton from "@/components/LogoutButton";
import Image from "next/image";
import logo from "../misc/LogoBGR.png";

// Componente de servidor: puede leer la sesión directamente.
export default async function Navbar() {
  const user = await getCurrentUser();
  return (
    <nav className="bg-primary">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/">
          <Image src={logo} alt="</> J-Cee" width={100} height={30} />
        </Link>

        <form action="/buscar" method="GET" className="flex-1 max-w-md">
          <input
            type="text"
            name="q"
            placeholder="Buscar videos..."
            className="w-full px-3 py-1.5 rounded-md bg-lpg text-sm text-white placeholder-slg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </form>

        <div className="flex items-center gap-4 text-sm text-slg">
          <Link href="/" className="hover:text-lpg">
            Inicio
          </Link>

          {user ? (
            <>
              <Link href="/upload" className="hover:text-lpg">
                Subir video
              </Link>
              {user.is_admin && (
                <Link href="/admin" className="hover:text-lpg text-warning">
                  Admin
                </Link>
              )}
              <span className="text-slg">Hola, {user.username}</span>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="hover:text-lpg">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}