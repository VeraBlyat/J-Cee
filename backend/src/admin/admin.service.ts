import { unlink } from 'fs/promises';
import { join } from 'path';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  // --- Usuarios ---
  async listUsers() {
    const result = await this.db.query(
      'SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC',
    );
    return result.rows;
  }

  async setUserAdmin(id: number, isAdmin: boolean) {
    await this.db.query('UPDATE users SET is_admin = $1 WHERE id = $2', [
      isAdmin,
      id,
    ]);
  }

  async deleteUser(id: number) {
    // Borramos comentarios, luego videos (+ archivos) y por último el usuario.
    await this.db.query('DELETE FROM comments WHERE user_id = $1', [id]);
    const videos = await this.db.query(
      'SELECT file_path FROM videos WHERE user_id = $1',
      [id],
    );
    for (const video of videos.rows) {
      await this.unlinkFile(video.file_path);
    }
    await this.db.query('DELETE FROM videos WHERE user_id = $1', [id]);
    await this.db.query('DELETE FROM users WHERE id = $1', [id]);
  }

  // --- Videos ---
  async listVideos() {
    const result = await this.db.query(
      `SELECT v.id, v.title, v.file_path, v.created_at, u.username
         FROM videos v LEFT JOIN users u ON u.id = v.user_id
        ORDER BY v.created_at DESC`,
    );
    return result.rows;
  }

  // Devuelve false si el video no existe (para responder 404).
  async deleteVideo(id: number): Promise<boolean> {
    const result = await this.db.query(
      'SELECT file_path FROM videos WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return false;
    await this.db.query('DELETE FROM videos WHERE id = $1', [id]);
    await this.unlinkFile(result.rows[0].file_path);
    return true;
  }

  // --- Comentarios ---
  async listComments() {
    const result = await this.db.query(
      `SELECT c.id, c.content, c.created_at, u.username, v.title AS video_title, v.id AS video_id
         FROM comments c
         LEFT JOIN users u ON u.id = c.user_id
         LEFT JOIN videos v ON v.id = c.video_id
        ORDER BY c.created_at DESC`,
    );
    return result.rows;
  }

  async deleteComment(id: number) {
    await this.db.query('DELETE FROM comments WHERE id = $1', [id]);
  }

  // Borra el archivo del disco; ignora el error si ya no existe.
  private async unlinkFile(filePath: string) {
    try {
      await unlink(join(process.cwd(), filePath));
    } catch {
      // no pasa nada si el archivo ya no está
    }
  }
}
