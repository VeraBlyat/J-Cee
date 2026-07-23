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
    <button onClick={handleLogout} className="hover:text-red-400">
      Salir
    </button>
  );
}
