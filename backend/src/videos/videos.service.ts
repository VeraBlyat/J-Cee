import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

// Carpeta donde guardamos los videos subidos (Nest la sirve en /uploads).
export const UPLOAD_DIR = join(process.cwd(), 'uploads');

@Injectable()
export class VideosService {
  constructor(private readonly db: DatabaseService) {}

  // Lista para la página de inicio.
  async findAll() {
    const result = await this.db.query(
      `SELECT v.id, v.title, v.file_path, u.username
         FROM videos v
         LEFT JOIN users u ON u.id = v.user_id
        ORDER BY v.created_at DESC`,
    );
    return result.rows;
  }

  // Detalle de un video (página /videos/:id).
  async findOne(id: string) {
    const result = await this.db.query(
      `SELECT v.id, v.title, v.description, v.file_path, u.username
         FROM videos v
         LEFT JOIN users u ON u.id = v.user_id
        WHERE v.id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }

  // Guarda el archivo en disco y crea la fila del video. Devuelve el id nuevo.
  async create(
    title: string,
    description: string,
    file: Express.Multer.File,
    userId: number,
  ) {
    const bytes = file.buffer;

    // Nombre único (con la fecha) para no sobreescribir archivos con el mismo nombre.
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const fileName = `${Date.now()}-${safeName}`;

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, fileName), bytes);

    // En la BD guardamos la ruta pública (lo que irá en el src del <video>).
    const filePath = `/uploads/${fileName}`;

    const result = await this.db.query(
      `INSERT INTO videos (title, description, file_path, user_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [title, description, filePath, userId],
    );
    return result.rows[0].id;
  }
}
