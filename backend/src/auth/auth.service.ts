import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
}

// Costo del hash. 10 es el estándar actual: ~65ms por hash, suficientemente
// caro para fuerza bruta y suficientemente barato para no trabar el login.
// Subirlo más adelante no rompe nada: bcrypt guarda el costo dentro del propio
// hash, así que los hashes viejos siguen validando con su costo original.
const SALT_ROUNDS = 10;

// Hash descartable contra el que comparamos cuando el email NO existe. Sirve
// para que "email inexistente" y "contraseña incorrecta" tarden lo mismo y
// nadie pueda averiguar qué emails están registrados midiendo el tiempo de
// respuesta.
const DUMMY_HASH = bcrypt.hashSync('cuenta-inexistente', SALT_ROUNDS);

// Validación deliberadamente laxa: alcanza para atajar typos evidentes sin
// rechazar direcciones raras pero válidas. La verificación de verdad es
// mandar un mail de confirmación (queda para más adelante).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignora todo lo que pase de 72 bytes.

// Cuánto vive un token de reseteo. Una hora es suficiente para revisar el mail
// y bastante corto para que un token filtrado no sirva por mucho tiempo.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  // El email es la credencial, así que lo normalizamos siempre igual (acá y
  // en el registro) para que "Toby@Mail.com " y "toby@mail.com" sean el mismo
  // usuario y el UNIQUE de la tabla funcione como esperamos.
  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  // Reglas de la contraseña, en un solo lugar: las usan el registro y el
  // reseteo, así "mínimo 8" no puede quedar distinto en cada camino.
  private assertValidPassword(password: string) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
    }
    if (Buffer.byteLength(password) > MAX_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `La contraseña no puede superar los ${MAX_PASSWORD_LENGTH} caracteres.`,
      );
    }
  }

  // El token viaja al usuario en claro pero en la base guardamos sólo su hash,
  // igual que con las contraseñas: así una fuga de la tabla no permite resetear
  // nada. SHA-256 (y no bcrypt) alcanza porque el token ya es aleatorio y de
  // 256 bits, no algo adivinable como una contraseña.
  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async login(email?: string, password?: string) {
    if (!email || !password) {
      throw new UnauthorizedException('Email o contraseña incorrectos.');
    }

    const result = await this.db.query<{
      id: number;
      username: string;
      email: string;
      password: string;
    }>('SELECT id, username, email, password FROM users WHERE email = $1', [
      this.normalizeEmail(email),
    ]);
    const user = result.rows[0];

    // Comparamos siempre, exista o no el usuario (ver DUMMY_HASH).
    const matches = await bcrypt.compare(
      password,
      user?.password ?? DUMMY_HASH,
    );

    // Mismo mensaje en los dos casos: no le confirmamos a un atacante si el
    // email está registrado o no.
    if (!user || !matches) {
      throw new UnauthorizedException('Email o contraseña incorrectos.');
    }

    return { id: user.id, username: user.username, email: user.email };
  }

  async register(email: string, username: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedUsername = username.trim();

    if (!EMAIL_RE.test(normalizedEmail)) {
      throw new BadRequestException('El email no tiene un formato válido.');
    }
    if (normalizedUsername.length < 3 || normalizedUsername.length > 50) {
      throw new BadRequestException(
        'El nombre de usuario debe tener entre 3 y 50 caracteres.',
      );
    }
    this.assertValidPassword(password);

    // Chequeo previo sólo para dar un mensaje de error útil ("el email ya está
    // en uso" vs "ese nombre de usuario ya existe"). La garantía real es el
    // UNIQUE de la tabla, que atajamos abajo por si dos registros entran a la
    // vez y los dos pasan este SELECT.
    const existing = await this.db.query<{ email: string; username: string }>(
      'SELECT email, username FROM users WHERE email = $1 OR username = $2',
      [normalizedEmail, normalizedUsername],
    );
    if (existing.rows.some((row) => row.email === normalizedEmail)) {
      throw new ConflictException('Ese email ya está registrado.');
    }
    if (existing.rows.length > 0) {
      throw new ConflictException('Ese nombre de usuario ya está en uso.');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    try {
      const result = await this.db.query<{
        id: number;
        username: string;
        email: string;
      }>(
        `INSERT INTO users (email, username, password)
         VALUES ($1, $2, $3) RETURNING id, username, email`,
        [normalizedEmail, normalizedUsername, passwordHash],
      );
      return result.rows[0];
    } catch (err: any) {
      // 23505 = unique_violation. Pasa si otro registro con el mismo email o
      // username se coló entre el SELECT de arriba y este INSERT.
      if (err?.code === '23505') {
        throw new ConflictException(
          'Ese email o nombre de usuario ya está en uso.',
        );
      }
      throw err;
    }
  }

  // Arranca la recuperación: si el email existe, crea un token y devuelve el
  // token EN CLARO (para armar el link). Si no existe, devuelve null. El
  // controller responde lo mismo en los dos casos, así que desde afuera no se
  // puede averiguar qué emails están registrados.
  async createPasswordReset(email?: string): Promise<string | null> {
    if (!email) return null;

    const result = await this.db.query<{ id: number }>(
      'SELECT id FROM users WHERE email = $1',
      [this.normalizeEmail(email)],
    );
    const user = result.rows[0];
    if (!user) return null;

    // Un pedido nuevo invalida los anteriores del mismo usuario: no tiene
    // sentido dejar varios tokens vivos para la misma cuenta.
    await this.db.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL',
      [user.id],
    );

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, this.hashToken(token), expiresAt],
    );

    return token;
  }

  // Cierra la recuperación: valida el token y cambia la contraseña. El mismo
  // mensaje de error para "no existe", "ya se usó" y "venció", para no darle
  // pistas a quien prueba tokens al azar.
  async resetPassword(token?: string, newPassword?: string) {
    if (!token || !newPassword) {
      throw new BadRequestException('Token o contraseña faltante.');
    }
    this.assertValidPassword(newPassword);

    const result = await this.db.query<{ id: number; user_id: number }>(
      `SELECT id, user_id FROM password_reset_tokens
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [this.hashToken(token)],
    );
    const row = result.rows[0];
    if (!row) {
      throw new BadRequestException(
        'El enlace de recuperación no es válido o ya venció.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Marcamos el token como usado en el mismo paso que cambiamos la clave, y
    // sólo si seguía sin usar (used_at IS NULL), por si dos pedidos con el
    // mismo token entran a la vez: uno gana y el otro no encuentra la fila.
    const consumed = await this.db.query(
      `UPDATE password_reset_tokens
          SET used_at = NOW()
        WHERE id = $1 AND used_at IS NULL`,
      [row.id],
    );
    if (consumed.rowCount === 0) {
      throw new BadRequestException(
        'El enlace de recuperación no es válido o ya venció.',
      );
    }

    await this.db.query('UPDATE users SET password = $1 WHERE id = $2', [
      passwordHash,
      row.user_id,
    ]);
  }

  // Carga el usuario de la cookie "userId". Devuelve null si no hay sesión.
  async getUserById(userId: string | undefined): Promise<SessionUser | null> {
    if (!userId) return null;

    // La cookie la manda el navegador, así que puede traer cualquier cosa.
    // Sin este filtro, un valor no numérico hace que Postgres tire un error
    // de casteo (22P02) y la request muera con un 500 en vez de un 401.
    if (!/^\d+$/.test(userId)) return null;

    const result = await this.db.query<SessionUser>(
      'SELECT id, username, email, is_admin FROM users WHERE id = $1',
      [userId],
    );
    return result.rows[0] || null;
  }
}
