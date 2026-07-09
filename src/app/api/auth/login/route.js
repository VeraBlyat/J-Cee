import { query } from "@/lib/db";
import { cookies } from "next/headers";

export async function POST(request) {
  const { username, password } = await request.json();

  // Comparación directa (sin encriptar) porque la seguridad es una fase posterior.
  const result = await query(
    "SELECT id, username FROM users WHERE username = $1 AND password = $2",
    [username, password]
  );
  const user = result.rows[0];

  if (!user) {
    return Response.json(
      { error: "Usuario o contraseña incorrectos." },
      { status: 401 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.set("userId", String(user.id), { httpOnly: true, path: "/" });

  return Response.json({ id: user.id, username: user.username });
}
