"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import { useState } from "react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import LogoutButton from "@/components/LogoutButton";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

// Componente de cliente: lee el usuario del store global de Redux (hidratado
// en el layout con la sesión resuelta en el servidor). Así reacciona al instante
// cuando alguien inicia o cierra sesión, sin necesidad de recargar.
export default function Navbar() {
  const user = useSelector((state) => state.auth.user);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function search(e) {
    e.preventDefault();
    router.push(query.trim() ? `/?q=${encodeURIComponent(query.trim())}` : "/");
  }

  return (
    <header className="relative z-10 flex h-[60px] items-center gap-[18px] border-b border-white/[0.06] bg-header px-6 text-header-text">
      <Link href="/" aria-label="Ir al inicio">
        <Logo />
      </Link>

      <form
        onSubmit={search}
        className="mx-auto flex max-w-[540px] flex-1 items-center gap-2.5 rounded-full border border-white/[0.14] bg-white/[0.09] px-[18px] py-2 text-[13.5px] transition hover:border-white/[0.22] hover:bg-white/[0.13]"
      >
        <SearchIcon />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          name="q"
          placeholder="Buscar videos de programación…"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-white/85 outline-none placeholder:text-white/45"
        />
      </form>

      <div className="flex shrink-0 items-center gap-3.5">
        <ThemeToggle />

        {user ? (
          <>
            <Link
              href="/upload"
              aria-label="Subir video"
              className="grid h-[34px] w-[34px] place-items-center rounded-full border border-white/10 bg-white/[0.08] transition hover:bg-white/[0.15]"
            >
              <UploadIcon />
            </Link>

            <Link
              href={`/canal/${encodeURIComponent(user.username)}`}
              aria-label="Mi canal"
              title={`@${user.username}`}
              className="grid h-8 w-8 place-items-center rounded-full border-2 border-white/20 bg-gradient-to-br from-brand to-brand-3 font-display text-[13px] font-bold text-white"
            >
              {user.username.charAt(0).toUpperCase()}
            </Link>

            <LogoutButton />
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-brand px-4 py-2 text-[13px] font-bold text-white transition hover:bg-brand-2"
          >
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}
