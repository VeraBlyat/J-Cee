import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface SessionUser {
  id: number;
  username: string;
  is_admin: boolean;
}

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  // Comparación directa de contraseña (sin encriptar): la seguridad es una
  // fase posterior, igual que en la versión original con Next.
  async login(username?: string, password?: string) {
    const result = await this.db.query(
      'SELECT id, username FROM users WHERE username = $1 AND password = $2',
      [username, password],
    );
    const user = result.rows[0];
    if (!user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    }
    return user as { id: number; username: string };
  }

  async register(username: string, password: string) {
    // ¿Ya existe ese usuario?
    const existing = await this.db.query(
      'SELECT id FROM users WHERE username = $1',
      [username],
    );
    if (existing.rows.length > 0) {
      throw new ConflictException('Ese usuario ya existe.');
    }

    // Guardamos la contraseña en texto plano POR AHORA (inseguro, se cambia luego).
    const result = await this.db.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, password],
    );
    return result.rows[0] as { id: number; username: string };
  }

  // Carga el usuario de la cookie "userId". Devuelve null si no hay sesión.
  async getUserById(userId: string | undefined): Promise<SessionUser | null> {
    if (!userId) return null;
    const result = await this.db.query<SessionUser>(
      'SELECT id, username, is_admin FROM users WHERE id = $1',
      [userId],
    );
    return result.rows[0] || null;
  }
}
