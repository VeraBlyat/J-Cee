import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { error: "Debes iniciar sesión para subir videos." },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const title = formData.get("title");
  const description = formData.get("description") || "";
  const file = formData.get("file");

  if (!title || !file || typeof file === "string") {
    return Response.json({ error: "Faltan datos o el archivo." }, { status: 400 });
  }

  // Convertimos el archivo recibido a bytes para poder escribirlo en disco.
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Nombre único (con la fecha) para no sobreescribir archivos con el mismo nombre.
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const fileName = `${Date.now()}-${safeName}`;

  // Guardamos dentro de /public/uploads, que Next sirve como archivo estático.
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), buffer);

  // Lo que guardamos en la BD es la ruta pública (lo que irá en el src del <video>).
  const filePath = `/uploads/${fileName}`;

  const result = await query(
    `INSERT INTO videos (title, description, file_path, user_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [title, description, filePath, user.id]
  );

  return Response.json({ id: result.rows[0].id });
}
