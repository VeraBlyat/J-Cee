import { cookies } from "next/headers";
import { query } from "./db";

// Lee la cookie "userId" y devuelve el usuario actual, o null si no hay sesión.
// OJO: es un login MUY básico, sin seguridad real. Se mejora más adelante.
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return null;

  const result = await query(
    "SELECT id, username FROM users WHERE id = $1",
    [userId]
  );
  return result.rows[0] || null;
}
