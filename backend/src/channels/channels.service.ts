import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface Channel {
  id: number;
  username: string;
  created_at: string;
  subscriber_count: number;
  video_count: number;
  // null cuando mira alguien sin sesión: la UI usa eso para mandar al login
  // en vez de mostrar el botón en un estado que no significa nada.
  is_subscribed: boolean | null;
}

@Injectable()
export class ChannelsService {
  constructor(private readonly db: DatabaseService) {}

  // Un canal es un usuario. Se busca por username porque es lo que va en la
  // URL pública (/canal/toby), no por id.
  async findByUsername(
    username: string,
    viewerId?: number,
  ): Promise<Channel | null> {
    const result = await this.db.query<Channel>(
      `SELECT u.id, u.username, u.created_at,
              (SELECT count(*)::int FROM subscriptions s
                WHERE s.channel_id = u.id) AS subscriber_count,
              (SELECT count(*)::int FROM videos v
                WHERE v.user_id = u.id) AS video_count,
              CASE
                WHEN $2::int IS NULL THEN NULL
                ELSE EXISTS (
                  SELECT 1 FROM subscriptions s
                   WHERE s.channel_id = u.id AND s.subscriber_id = $2
                )
              END AS is_subscribed
         FROM users u
        WHERE u.username = $1`,
      [username, viewerId ?? null],
    );
    return result.rows[0] || null;
  }

  async videosOf(username: string) {
    const result = await this.db.query(
      `SELECT v.id, v.title, v.file_path, v.thumbnail_path,
              v.duration_seconds, u.username
         FROM videos v
         JOIN users u ON u.id = v.user_id
        WHERE u.username = $1
        ORDER BY v.created_at DESC`,
      [username],
    );
    return result.rows;
  }

  // Canales a los que sigue un usuario.
  async subscriptionsOf(subscriberId: number) {
    const result = await this.db.query(
      `SELECT u.id, u.username,
              (SELECT count(*)::int FROM subscriptions s2
                WHERE s2.channel_id = u.id) AS subscriber_count
         FROM subscriptions s
         JOIN users u ON u.id = s.channel_id
        WHERE s.subscriber_id = $1
        ORDER BY s.created_at DESC`,
      [subscriberId],
    );
    return result.rows;
  }

  // Videos de todos los canales que sigue el usuario: el feed personalizado.
  async feedFor(subscriberId: number) {
    const result = await this.db.query(
      `SELECT v.id, v.title, v.file_path, v.thumbnail_path,
              v.duration_seconds, u.username
         FROM videos v
         JOIN users u ON u.id = v.user_id
         JOIN subscriptions s ON s.channel_id = v.user_id
        WHERE s.subscriber_id = $1
        ORDER BY v.created_at DESC`,
      [subscriberId],
    );
    return result.rows;
  }

  async subscribe(subscriberId: number, username: string) {
    const channel = await this.channelIdOf(username);

    // La base también lo impide (CHECK no_auto_suscripcion), pero atajarlo acá
    // da un 400 con un mensaje entendible en vez de un 500.
    if (channel === subscriberId) {
      throw new BadRequestException('No podés suscribirte a tu propio canal.');
    }

    await this.db.query(
      `INSERT INTO subscriptions (subscriber_id, channel_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [subscriberId, channel],
    );

    return this.subscriberCountOf(channel);
  }

  async unsubscribe(subscriberId: number, username: string) {
    const channel = await this.channelIdOf(username);

    await this.db.query(
      'DELETE FROM subscriptions WHERE subscriber_id = $1 AND channel_id = $2',
      [subscriberId, channel],
    );

    return this.subscriberCountOf(channel);
  }

  private async channelIdOf(username: string): Promise<number> {
    const result = await this.db.query<{ id: number }>(
      'SELECT id FROM users WHERE username = $1',
      [username],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException('Ese canal no existe.');
    }
    return result.rows[0].id;
  }

  // Se devuelve el total actualizado para que el frontend no tenga que pedir
  // el canal entero de nuevo sólo para refrescar el número.
  private async subscriberCountOf(channelId: number) {
    const result = await this.db.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM subscriptions WHERE channel_id = $1',
      [channelId],
    );
    return result.rows[0].count;
  }
}
