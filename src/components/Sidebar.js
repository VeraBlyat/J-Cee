"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";

function Icon({ path, filled = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

const ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />,
  reels: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M10 9.5v5l4.5-2.5z" />
    </>
  ),
  subs: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="m8 3 4 3 4-3" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </>
  ),
  channel: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  admin: <path d="M12 3 4 6v6c0 4.5 3.2 8.4 8 9 4.8-.6 8-4.5 8-9V6Z" />,
};

function Item({ href, icon, children, active }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-field px-3.5 py-2.5 text-[13.5px] transition ${
        active
          ? "bg-page-2 font-bold text-brand"
          : "text-text-2 hover:bg-page-2 hover:text-text"
      }`}
    >
      <Icon path={icon} filled={active} />
      {children}
    </Link>
  );
}

export default function Sidebar() {
  const user = useSelector((state) => state.auth.user);
  const pathname = usePathname();

  return (
    <nav className="hidden w-[220px] shrink-0 flex-col gap-1 border-r border-border bg-surface p-5 px-3 md:flex">
      <Item href="/" icon={ICONS.home} active={pathname === "/"}>
        Inicio
      </Item>
      <Item href="/reels" icon={ICONS.reels} active={pathname === "/reels"}>
        Reels de código
      </Item>

      {user && (
        <>
          <Item
            href="/suscripciones"
            icon={ICONS.subs}
            active={pathname === "/suscripciones"}
          >
            Suscripciones
          </Item>

          <div className="my-2.5 h-px bg-border" />
          <p className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
            Tu contenido
          </p>

          <Item href="/upload" icon={ICONS.upload} active={pathname === "/upload"}>
            Subir video
          </Item>
          <Item
            href={`/canal/${encodeURIComponent(user.username)}`}
            icon={ICONS.channel}
            active={pathname === `/canal/${user.username}`}
          >
            Mi canal
          </Item>

          {user.is_admin && (
            <Item href="/admin" icon={ICONS.admin} active={pathname === "/admin"}>
              Administración
            </Item>
          )}
        </>
      )}
    </nav>
  );
}
