import { cookies } from "next/headers";
import { INTERNAL_API_URL } from "./apiBase";

// Fetch para COMPONENTES DE SERVIDOR: reenvía la cookie de sesión del usuario
// al backend y nunca cachea (la sesión y los datos cambian a cada rato).
export async function serverFetch(path, options = {}) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  return fetch(`${INTERNAL_API_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.headers || {}),
      // Reenviamos las cookies para que el backend sepa quién es el usuario.
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  });
}

// Reemplaza al antiguo getCurrentUser() de lib/auth.js.
// Lee la sesión desde el backend Nest y devuelve el usuario o null.
export async function getCurrentUser() {
  const res = await serverFetch("/auth/me");
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return user || null;
}
