"use client";

import Link from "next/link";
import { useSelector } from "react-redux";
import LogoutButton from "@/components/LogoutButton";

// Componente de cliente: lee el usuario del store global de Redux (hidratado
// en el layout con la sesión resuelta en el servidor). Así reacciona al instante
// cuando alguien inicia o cierra sesión, sin necesidad de recargar.
export default function Navbar() {
  const user = useSelector((state) => state.auth.user);

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
              {/* Botón de cliente que cierra sesión en el backend y limpia el store. */}
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
