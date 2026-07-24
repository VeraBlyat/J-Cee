"use client";

import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/apiBase";

// Cierra sesión llamando al backend Nest y refresca para que el navbar cambie.
export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="text-card hover:text-sbtxt">
      Salir
    </button>
  );
}
