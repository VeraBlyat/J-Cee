import { query } from "@/lib/db";
import { cookies } from "next/headers";

export async function POST(request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return Response.json(
      { error: "Usuario y contraseña son obligatorios." },
      { status: 400 }
    );
  }

  // ¿Ya existe ese usuario?
  const existing = await query("SELECT id FROM users WHERE username = $1", [
    username,
  ]);
  if (existing.rows.length > 0) {
    return Response.json({ error: "Ese usuario ya existe." }, { status: 409 });
  }

  // Guardamos la contraseña en texto plano POR AHORA (inseguro, se cambia luego).
  const result = await query(
    "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
    [username, password]
  );
  const user = result.rows[0];

  // Iniciamos sesión guardando el id del usuario en una cookie.
  const cookieStore = await cookies();
  cookieStore.set("userId", String(user.id), { httpOnly: true, path: "/" });

  return Response.json({ id: user.id, username: user.username });
}
