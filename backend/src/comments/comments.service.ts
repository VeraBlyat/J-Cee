import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

// Un comentario ya armado para la UI, con sus votos y sus respuestas.
export interface CommentNode {
  id: number;
  content: string;
  created_at: string;
  username: string | null;
  parent_id: number | null;
  likes: number;
  dislikes: number;
  // Voto del que mira: 1, -1, o 0 si no votó / no hay sesión.
  my_vote: number;
  replies: CommentNode[];
}

// Cuán profundo se puede responder. Sin tope, un hilo largo se vuelve
// ilegible y la UI se va de margen a la derecha.
export const MAX_DEPTH = 3;

@Injectable()
export class CommentsService {
  constructor(private readonly db: DatabaseService) {}

  // Trae TODOS los comentarios del video de una sola vez, con sus votos, y
  // arma el árbol en memoria.
  //
  // Una consulta sola y el árbol en JS, en vez de una consulta por nivel: la
  // alternativa es el problema N+1 clásico, donde un video con 50 comentarios
  // dispara 50 consultas más para traer las respuestas de cada uno.
  async findByVideo(videoId: string, viewerId?: number): Promise<CommentNode[]> {
    if (!/^\d+$/.test(videoId)) return [];

    const result = await this.db.query<any>(
      `SELECT c.id, c.content, c.created_at, c.parent_id, u.username,
              COUNT(*) FILTER (WHERE cv.value = 1)  AS likes,
              COUNT(*) FILTER (WHERE cv.value = -1) AS dislikes,
              COALESCE(
                MAX(cv.value) FILTER (WHERE cv.user_id = $2::int), 0
              ) AS my_vote
         FROM comments c
         LEFT JOIN users u ON u.id = c.user_id
         LEFT JOIN comment_votes cv ON cv.comment_id = c.id
        WHERE c.video_id = $1
        GROUP BY c.id, u.username
        ORDER BY c.created_at ASC`,
      [videoId, viewerId ?? null],
    );

    return buildTree(
      result.rows.map((row) => ({
        ...row,
        likes: Number(row.likes),
        dislikes: Number(row.dislikes),
        my_vote: Number(row.my_vote),
        replies: [],
      })),
    );
  }

  async create(
    videoId: number,
    userId: number,
    content: string,
    parentId?: number,
  ) {
    if (parentId) {
      // La respuesta tiene que colgar de un comentario del MISMO video: sin
      // este chequeo se podría responder a un comentario de otro video y el
      // hilo quedaría con un huérfano que nunca se muestra.
      const parent = await this.db.query<{ video_id: number; depth: string }>(
        `WITH RECURSIVE cadena AS (
           SELECT id, parent_id, video_id, 1 AS depth
             FROM comments WHERE id = $1
           UNION ALL
           SELECT c.id, c.parent_id, c.video_id, cadena.depth + 1
             FROM comments c JOIN cadena ON c.id = cadena.parent_id
         )
         SELECT max(video_id) AS video_id, max(depth) AS depth FROM cadena`,
        [parentId],
      );

      const row = parent.rows[0];
      if (!row || row.video_id == null) {
        throw new NotFoundException('El comentario que respondés no existe.');
      }
      if (Number(row.video_id) !== videoId) {
        throw new BadRequestException('Ese comentario pertenece a otro video.');
      }
      if (Number(row.depth) >= MAX_DEPTH) {
        throw new BadRequestException(
          'No se puede seguir anidando respuestas en este hilo.',
        );
      }
    }

    const result = await this.db.query<{ id: number }>(
      `INSERT INTO comments (video_id, user_id, content, parent_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [videoId, userId, content.trim(), parentId ?? null],
    );
    return result.rows[0].id;
  }

  // Registra un voto. value 1 = like, -1 = dislike, 0 = sacar el voto.
  async vote(commentId: number, userId: number, value: number) {
    if (![1, -1, 0].includes(value)) {
      throw new BadRequestException('Voto inválido.');
    }

    const exists = await this.db.query('SELECT 1 FROM comments WHERE id = $1', [
      commentId,
    ]);
    if (exists.rows.length === 0) {
      throw new NotFoundException('Ese comentario no existe.');
    }

    if (value === 0) {
      await this.db.query(
        'DELETE FROM comment_votes WHERE comment_id = $1 AND user_id = $2',
        [commentId, userId],
      );
    } else {
      // La PK (comment_id, user_id) garantiza un voto por persona; el
      // ON CONFLICT convierte "cambiar de like a dislike" en un UPDATE.
      await this.db.query(
        `INSERT INTO comment_votes (comment_id, user_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (comment_id, user_id) DO UPDATE SET value = EXCLUDED.value`,
        [commentId, userId, value],
      );
    }

    return this.tallyOf(commentId, userId);
  }

  // Borra un comentario. Sólo el autor o un admin. Las respuestas se van solas
  // por el ON DELETE CASCADE de parent_id.
  async remove(commentId: number, user: { id: number; is_admin: boolean }) {
    const result = await this.db.query<{ user_id: number }>(
      'SELECT user_id FROM comments WHERE id = $1',
      [commentId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException('Ese comentario no existe.');
    }
    if (result.rows[0].user_id !== user.id && !user.is_admin) {
      throw new ForbiddenException('No podés borrar este comentario.');
    }

    await this.db.query('DELETE FROM comments WHERE id = $1', [commentId]);
  }

  private async tallyOf(commentId: number, viewerId: number) {
    const result = await this.db.query<{
      likes: string;
      dislikes: string;
      my_vote: string;
    }>(
      `SELECT COUNT(*) FILTER (WHERE value = 1)  AS likes,
              COUNT(*) FILTER (WHERE value = -1) AS dislikes,
              COALESCE(MAX(value) FILTER (WHERE user_id = $2), 0) AS my_vote
         FROM comment_votes WHERE comment_id = $1`,
      [commentId, viewerId],
    );
    const row = result.rows[0];
    return {
      likes: Number(row.likes),
      dislikes: Number(row.dislikes),
      my_vote: Number(row.my_vote),
    };
  }
}

// Convierte la lista plana en árbol. Va fuera de la clase para poder testearla
// sin base de datos.
export function buildTree(rows: CommentNode[]): CommentNode[] {
  const byId = new Map<number, CommentNode>();
  for (const row of rows) byId.set(row.id, row);

  const roots: CommentNode[] = [];

  for (const row of rows) {
    const parent = row.parent_id != null ? byId.get(row.parent_id) : null;
    if (parent) {
      parent.replies.push(row);
    } else {
      // Sin parent_id es un comentario raíz. Si tiene parent_id pero el padre
      // no vino en la lista, también va a la raíz en vez de desaparecer: es
      // preferible mostrarlo fuera de lugar a perderlo.
      roots.push(row);
    }
  }

  // Las raíces, los más nuevos primero. Las respuestas quedan en el orden en
  // que llegaron (la consulta las trae por created_at ASC), porque un hilo se
  // lee en el orden en que se escribió.
  roots.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return roots;
}
