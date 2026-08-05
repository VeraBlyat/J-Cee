import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { parseHashtags } from './hashtags';
import { REEL_MAX_DURATION_SECONDS } from './reels';
import { TranscodeService, UPLOAD_DIR } from './transcode.service';

export { UPLOAD_DIR };

export interface VideoRow {
  id: number;
  title: string;
  description: string | null;
  file_path: string;
  thumbnail_path: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  username: string | null;
  hashtags?: string[];
  like_count?: number;
  // Si el que mira ya le dio like. false cuando no hay sesión.
  liked?: boolean;
}

@Injectable()
export class VideosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly transcode: TranscodeService,
  ) {}

  // Lista para la página de inicio.
  async findAll() {
    const result = await this.db.query(
      `SELECT v.id, v.title, v.file_path, v.thumbnail_path,
              v.duration_seconds, u.username
         FROM videos v
         LEFT JOIN users u ON u.id = v.user_id
        ORDER BY v.created_at DESC`,
    );
    return result.rows;
  }

  // Videos de un hashtag. El JOIN va por la tabla intermedia, así que usa el
  // índice y no recorre la tabla entera.
  async findByHashtag(name: string) {
    const result = await this.db.query(
      `SELECT v.id, v.title, v.file_path, v.thumbnail_path,
              v.duration_seconds, u.username
         FROM videos v
         JOIN video_hashtags vh ON vh.video_id = v.id
         JOIN hashtags h ON h.id = vh.hashtag_id
         LEFT JOIN users u ON u.id = v.user_id
        WHERE h.name = $1
        ORDER BY v.created_at DESC`,
      [name.toLowerCase()],
    );
    return result.rows;
  }

  // Feed de reels: verticales y cortos. Ver reels.ts para el criterio.
  async findReels(limit: number, offset: number) {
    const result = await this.db.query(
      `SELECT v.id, v.title, v.description, v.file_path, v.thumbnail_path,
              v.duration_seconds, v.width, v.height, u.username,
              COALESCE(
                ARRAY_AGG(h.name ORDER BY h.name) FILTER (WHERE h.name IS NOT NULL),
                '{}'
              ) AS hashtags,
              (SELECT count(*)::int FROM comments c WHERE c.video_id = v.id)
                AS comment_count
         FROM videos v
         LEFT JOIN users u ON u.id = v.user_id
         LEFT JOIN video_hashtags vh ON vh.video_id = v.id
         LEFT JOIN hashtags h ON h.id = vh.hashtag_id
        WHERE v.height > v.width
          AND v.duration_seconds IS NOT NULL
          AND v.duration_seconds <= $1
        GROUP BY v.id, u.username
        ORDER BY v.created_at DESC
        LIMIT $2 OFFSET $3`,
      [REEL_MAX_DURATION_SECONDS, limit, offset],
    );
    return result.rows;
  }

  // Detalle de un video (página /videos/:id). viewerId es opcional: sirve para
  // saber si el que mira ya le dio like (columna "liked").
  async findOne(id: string, viewerId?: number) {
    if (!/^\d+$/.test(id)) return null;

    const result = await this.db.query<VideoRow>(
      `SELECT v.id, v.title, v.description, v.file_path, v.thumbnail_path,
              v.duration_seconds, v.width, v.height, u.username,
              -- Los hashtags vienen en el mismo viaje, agregados como array.
              -- El COALESCE deja [] en vez de [null] cuando el video no tiene.
              COALESCE(
                ARRAY_AGG(h.name ORDER BY h.name) FILTER (WHERE h.name IS NOT NULL),
                '{}'
              ) AS hashtags,
              -- Likes como subconsultas y no como JOIN: un JOIN a video_likes
              -- multiplicaría las filas y rompería el ARRAY_AGG de hashtags.
              (SELECT count(*)::int FROM video_likes vl WHERE vl.video_id = v.id)
                AS like_count,
              EXISTS(
                SELECT 1 FROM video_likes vl
                 WHERE vl.video_id = v.id AND vl.user_id = $2::int
              ) AS liked
         FROM videos v
         LEFT JOIN users u ON u.id = v.user_id
         LEFT JOIN video_hashtags vh ON vh.video_id = v.id
         LEFT JOIN hashtags h ON h.id = vh.hashtag_id
        WHERE v.id = $1
        GROUP BY v.id, u.username`,
      [id, viewerId ?? null],
    );
    return result.rows[0] || null;
  }

  // Da o saca el like del usuario. `liked` true = dar, false = sacar. Devuelve
  // el total actualizado para que el front no tenga que adivinarlo sumando.
  async setLike(videoId: string, userId: number, liked: boolean) {
    if (!/^\d+$/.test(videoId)) {
      throw new BadRequestException('Video inválido.');
    }
    const id = Number(videoId);

    const exists = await this.db.query('SELECT 1 FROM videos WHERE id = $1', [
      id,
    ]);
    if (exists.rows.length === 0) {
      throw new NotFoundException('Video no encontrado.');
    }

    if (liked) {
      // ON CONFLICT DO NOTHING: dar like dos veces no rompe ni suma de más,
      // gracias a la PK (video_id, user_id).
      await this.db.query(
        `INSERT INTO video_likes (video_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, userId],
      );
    } else {
      await this.db.query(
        'DELETE FROM video_likes WHERE video_id = $1 AND user_id = $2',
        [id, userId],
      );
    }

    const tally = await this.db.query<{ like_count: number }>(
      'SELECT count(*)::int AS like_count FROM video_likes WHERE video_id = $1',
      [id],
    );
    return { liked, like_count: tally.rows[0].like_count };
  }

  // Guarda el archivo, lo analiza con ffprobe y crea la fila. Devuelve el id.
  async create(
    title: string,
    description: string,
    hashtagsInput: string | undefined,
    file: Express.Multer.File,
    thumbnail: Express.Multer.File | undefined,
    userId: number,
  ) {
    const baseName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const absolutePath = join(UPLOAD_DIR, baseName);

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    // ffprobe hace de validación real del contenido: la extensión y el
    // mimetype los manda el cliente y se pueden falsear, esto no.
    let metadata;
    try {
      metadata = await this.transcode.probe(absolutePath);
    } catch {
      await rm(absolutePath, { force: true }).catch(() => {});
      throw new BadRequestException(
        'El archivo no es un video válido o está dañado.',
      );
    }

    const thumbnailPath = await this.saveThumbnail(
      baseName,
      absolutePath,
      thumbnail,
      metadata.durationSeconds,
    );

    const result = await this.db.query<{ id: number }>(
      `INSERT INTO videos (title, description, file_path, thumbnail_path,
                           duration_seconds, width, height, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        title,
        description,
        `/uploads/${baseName}`,
        thumbnailPath,
        metadata.durationSeconds,
        metadata.width,
        metadata.height,
        userId,
      ],
    );

    const videoId = result.rows[0].id;
    await this.linkHashtags(videoId, parseHashtags(hashtagsInput));
    return videoId;
  }

  // Guarda la miniatura que subió el usuario, o saca una del video. Devuelve
  // la ruta pública, o null si las dos cosas fallaron.
  private async saveThumbnail(
    baseName: string,
    videoPath: string,
    uploaded: Express.Multer.File | undefined,
    durationSeconds: number,
  ): Promise<string | null> {
    const fileName = `${baseName}.thumb.jpg`;
    const target = join(UPLOAD_DIR, fileName);

    if (uploaded) {
      // La imagen del usuario se guarda aparte y se reencodea a nuestro
      // formato. Nunca se publica tal cual: ver convertToThumbnail.
      const rawPath = join(UPLOAD_DIR, `${baseName}.thumb.src`);
      try {
        await writeFile(rawPath, uploaded.buffer);
        await this.transcode.convertToThumbnail(rawPath, target);
        return `/uploads/${fileName}`;
      } catch {
        // No era una imagen decodificable: seguimos con la automática, en vez
        // de rechazar una subida de video que por lo demás está bien.
        await rm(target, { force: true }).catch(() => {});
      } finally {
        await rm(rawPath, { force: true }).catch(() => {});
      }
    }

    try {
      await this.transcode.generateThumbnail(videoPath, target, durationSeconds);
      return `/uploads/${fileName}`;
    } catch {
      // Sin miniatura el video se ve igual, así que no vale la pena tirar
      // abajo toda la subida por esto.
      return null;
    }
  }

  // Crea los hashtags que falten y los asocia al video.
  private async linkHashtags(videoId: number, tags: string[]) {
    for (const name of tags) {
      // ON CONFLICT DO UPDATE en vez de DO NOTHING: con DO NOTHING la fila
      // existente no se devuelve y RETURNING vendría vacío.
      const inserted = await this.db.query<{ id: number }>(
        `INSERT INTO hashtags (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [name],
      );

      await this.db.query(
        `INSERT INTO video_hashtags (video_id, hashtag_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [videoId, inserted.rows[0].id],
      );
    }
  }

  // Ruta absoluta del archivo original, que es la fuente de todo transcoding.
  absolutePathOf(video: { file_path: string }) {
    // file_path se guarda como "/uploads/xxx"; lo reanclamos en UPLOAD_DIR
    // usando sólo el nombre, así una ruta rara en la DB no puede hacernos
    // leer un archivo de fuera de la carpeta de uploads.
    const fileName = video.file_path.split('/').pop() as string;
    return join(UPLOAD_DIR, fileName);
  }
}
