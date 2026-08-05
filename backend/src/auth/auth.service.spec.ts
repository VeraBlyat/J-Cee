import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { AuthService } from './auth.service';

// bcrypt es lento a propósito, así que hasheamos una sola vez para todo el
// archivo en vez de una vez por test.
const PASSWORD = 'contraseña-segura';
let PASSWORD_HASH: string;

beforeAll(async () => {
  PASSWORD_HASH = await bcrypt.hash(PASSWORD, 10);
});

describe('AuthService', () => {
  let service: AuthService;
  let db: { query: jest.Mock };

  beforeEach(async () => {
    db = { query: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [AuthService, { provide: DatabaseService, useValue: db }],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('devuelve el usuario cuando la contraseña coincide con el hash', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            username: 'toby',
            email: 'toby@mail.com',
            password: PASSWORD_HASH,
          },
        ],
      });

      const user = await service.login('toby@mail.com', PASSWORD);

      expect(user).toEqual({ id: 1, username: 'toby', email: 'toby@mail.com' });
    });

    it('busca por email normalizado (minúsculas, sin espacios)', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(service.login('  TOBY@Mail.com ', PASSWORD)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(db.query).toHaveBeenCalledWith(expect.any(String), [
        'toby@mail.com',
      ]);
    });

    it('nunca manda la contraseña a la consulta SQL', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(service.login('toby@mail.com', PASSWORD)).rejects.toThrow(
        UnauthorizedException,
      );

      const [, params] = db.query.mock.calls[0];
      expect(params).not.toContain(PASSWORD);
    });

    it('rechaza si la contraseña no coincide', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            username: 'toby',
            email: 'toby@mail.com',
            password: PASSWORD_HASH,
          },
        ],
      });

      await expect(
        service.login('toby@mail.com', 'contraseña-incorrecta'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza si el email no existe, con el mismo mensaje', async () => {
      db.query.mockResolvedValue({ rows: [] });

      // Mismo mensaje que el caso anterior: no revelamos si el email existe.
      await expect(service.login('nadie@mail.com', PASSWORD)).rejects.toThrow(
        'Email o contraseña incorrectos.',
      );
    });

    it('rechaza sin consultar la DB si faltan credenciales', async () => {
      await expect(service.login(undefined, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('guarda la contraseña hasheada, nunca en texto plano', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // no existe
        .mockResolvedValueOnce({
          rows: [{ id: 2, username: 'nuevo', email: 'nuevo@mail.com' }],
        });

      await service.register('nuevo@mail.com', 'nuevo', PASSWORD);

      const [, params] = db.query.mock.calls[1];
      const stored = params[2];
      expect(stored).not.toBe(PASSWORD);
      expect(stored).toMatch(/^\$2[aby]\$/); // formato de hash bcrypt
      await expect(bcrypt.compare(PASSWORD, stored)).resolves.toBe(true);
    });

    it('normaliza el email antes de guardarlo', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
        rows: [{ id: 2, username: 'nuevo', email: 'nuevo@mail.com' }],
      });

      await service.register('  Nuevo@MAIL.com ', 'nuevo', PASSWORD);

      const [, params] = db.query.mock.calls[1];
      expect(params[0]).toBe('nuevo@mail.com');
    });

    it('lanza ConflictException si el email ya está registrado', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ email: 'toby@mail.com', username: 'otro' }],
      });

      await expect(
        service.register('toby@mail.com', 'nuevo', PASSWORD),
      ).rejects.toThrow('Ese email ya está registrado.');
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('lanza ConflictException si el username ya está en uso', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ email: 'otro@mail.com', username: 'toby' }],
      });

      await expect(
        service.register('nuevo@mail.com', 'toby', PASSWORD),
      ).rejects.toThrow('Ese nombre de usuario ya está en uso.');
    });

    it('traduce la violación de UNIQUE de Postgres a un 409', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(
          Object.assign(new Error('dup'), { code: '23505' }),
        );

      await expect(
        service.register('nuevo@mail.com', 'nuevo', PASSWORD),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza un email con formato inválido', async () => {
      await expect(
        service.register('no-es-un-email', 'nuevo', PASSWORD),
      ).rejects.toThrow(BadRequestException);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('rechaza una contraseña de menos de 8 caracteres', async () => {
      await expect(
        service.register('nuevo@mail.com', 'nuevo', 'corta'),
      ).rejects.toThrow(BadRequestException);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('rechaza una contraseña de más de 72 bytes (límite de bcrypt)', async () => {
      await expect(
        service.register('nuevo@mail.com', 'nuevo', 'a'.repeat(73)),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un username demasiado corto', async () => {
      await expect(
        service.register('nuevo@mail.com', 'ab', PASSWORD),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserById', () => {
    it('devuelve null sin consultar la DB si no hay userId', async () => {
      const user = await service.getUserById(undefined);

      expect(user).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('devuelve null sin consultar la DB si la cookie no es numérica', async () => {
      const user = await service.getUserById("1' OR '1'='1");

      expect(user).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('devuelve el usuario de la DB si existe', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 3, username: 'ana', email: 'ana@mail.com', is_admin: false },
        ],
      });

      const user = await service.getUserById('3');

      expect(user).toEqual({
        id: 3,
        username: 'ana',
        email: 'ana@mail.com',
        is_admin: false,
      });
    });

    it('devuelve null si el id no corresponde a ningún usuario', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const user = await service.getUserById('999');

      expect(user).toBeNull();
    });
  });

  describe('createPasswordReset', () => {
    it('devuelve null sin consultar la DB si no hay email', async () => {
      const token = await service.createPasswordReset(undefined);

      expect(token).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('devuelve null (y no crea token) si el email no existe', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // SELECT sin resultados

      const token = await service.createPasswordReset('nadie@mail.com');

      expect(token).toBeNull();
      // Sólo el SELECT: no hay DELETE ni INSERT de token.
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('guarda el HASH del token, nunca el token en claro', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 5 }] }) // SELECT usuario
        .mockResolvedValueOnce({ rows: [] }) // DELETE tokens viejos
        .mockResolvedValueOnce({ rows: [] }); // INSERT token

      const token = await service.createPasswordReset('toby@mail.com');

      // El token que se devuelve es hex de 256 bits.
      expect(token).toMatch(/^[a-f0-9]{64}$/);

      const [, insertParams] = db.query.mock.calls[2];
      const storedHash = insertParams[1];
      expect(storedHash).not.toBe(token);
      expect(storedHash).toBe(
        createHash('sha256').update(token as string).digest('hex'),
      );
    });
  });

  describe('resetPassword', () => {
    it('rechaza sin tocar la DB si falta el token o la contraseña', async () => {
      await expect(service.resetPassword(undefined, PASSWORD)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resetPassword('token', undefined)).rejects.toThrow(
        BadRequestException,
      );
      expect(db.query).not.toHaveBeenCalled();
    });

    it('rechaza una contraseña corta antes de buscar el token', async () => {
      await expect(service.resetPassword('token', 'corta')).rejects.toThrow(
        BadRequestException,
      );
      expect(db.query).not.toHaveBeenCalled();
    });

    it('rechaza un token inexistente, vencido o ya usado', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // SELECT sin resultados

      await expect(service.resetPassword('token', PASSWORD)).rejects.toThrow(
        'El enlace de recuperación no es válido o ya venció.',
      );
    });

    it('busca por el HASH del token, no por el token en claro', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.resetPassword('mi-token', PASSWORD),
      ).rejects.toThrow(BadRequestException);

      const [, selectParams] = db.query.mock.calls[0];
      expect(selectParams[0]).toBe(
        createHash('sha256').update('mi-token').digest('hex'),
      );
      expect(selectParams[0]).not.toBe('mi-token');
    });

    it('guarda la nueva contraseña hasheada y marca el token como usado', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 10, user_id: 5 }] }) // SELECT token
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE token used_at
        .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE users password

      await service.resetPassword('token', PASSWORD);

      const [, updateUserParams] = db.query.mock.calls[2];
      const stored = updateUserParams[0];
      expect(stored).not.toBe(PASSWORD);
      expect(stored).toMatch(/^\$2[aby]\$/);
      await expect(bcrypt.compare(PASSWORD, stored)).resolves.toBe(true);
    });

    it('no cambia la contraseña si el token se consumió en el ínterin', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 10, user_id: 5 }] }) // SELECT token
        .mockResolvedValueOnce({ rowCount: 0 }); // UPDATE token: ya no estaba

      await expect(service.resetPassword('token', PASSWORD)).rejects.toThrow(
        BadRequestException,
      );
      // Nunca se llega al UPDATE de users.
      expect(db.query).toHaveBeenCalledTimes(2);
    });
  });
});
