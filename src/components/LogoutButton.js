"use client";

import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { logout } from "@/store/authSlice";

// Cierra sesión: dispara el thunk (Axios) que llama al backend Nest y limpia
// el usuario del store; el navbar reacciona solo. Refrescamos además para
// re-sincronizar los componentes de servidor.
export default function LogoutButton() {
  const router = useRouter();
  const dispatch = useDispatch();

  async function handleLogout() {
    await dispatch(logout());
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      className="grid h-[34px] w-[34px] place-items-center rounded-full border border-white/10 bg-white/[0.08] transition hover:bg-white/[0.15]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
        <path d="m16 17 5-5-5-5M21 12H9" />
      </svg>
    </button>
  );
}
