import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CommentsService {
  constructor(private readonly db: DatabaseService) {}

  // Comentarios de un video (para la página /videos/:id).
  async findByVideo(videoId: string) {
    const result = await this.db.query(
      `SELECT c.id, c.content, c.created_at, u.username
         FROM comments c
         LEFT JOIN users u ON u.id = c.user_id
        WHERE c.video_id = $1
        ORDER BY c.created_at DESC`,
      [videoId],
    );
    return result.rows;
  }

  async create(videoId: number, userId: number, content: string) {
    await this.db.query(
      'INSERT INTO comments (video_id, user_id, content) VALUES ($1, $2, $3)',
      [videoId, userId, content],
    );
  }
}
