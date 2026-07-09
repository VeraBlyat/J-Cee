import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { error: "Debes iniciar sesión para comentar." },
      { status: 401 }
    );
  }

  const { videoId, content } = await request.json();
  if (!videoId || !content || !content.trim()) {
    return Response.json({ error: "Falta el comentario." }, { status: 400 });
  }

  await query(
    "INSERT INTO comments (video_id, user_id, content) VALUES ($1, $2, $3)",
    [videoId, user.id, content]
  );

  return Response.json({ ok: true });
}
