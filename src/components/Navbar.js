import Link from "next/link";
import { getCurrentUser } from "@/lib/api";
import LogoutButton from "@/components/LogoutButton";

// Componente de servidor: puede leer la sesión directamente.
export default async function Navbar() {
  const user = await getCurrentUser();

  return (
    <nav className="border-b border-gray-800 bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-red-500">
          UniStream
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:text-red-400">
            Inicio
          </Link>

          {user ? (
            <>
              <Link href="/upload" className="hover:text-red-400">
                Subir video
              </Link>
              {user.is_admin && (
                <Link href="/admin" className="hover:text-red-400 text-yellow-400">
                  Admin
                </Link>
              )}
              <span className="text-gray-400">Hola, {user.username}</span>
              {/* Botón de cliente que llama al backend Nest y refresca. */}
              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="hover:text-red-400">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
