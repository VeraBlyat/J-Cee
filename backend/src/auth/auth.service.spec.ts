import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DatabaseService } from '../database/database.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let db: { query: jest.Mock };

  beforeEach(async () => {
    db = { query: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('devuelve el usuario cuando las credenciales coinciden', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, username: 'toby' }] });

      const user = await service.login('toby', 'secreta');

      expect(user).toEqual({ id: 1, username: 'toby' });
      expect(db.query).toHaveBeenCalledWith(expect.any(String), [
        'toby',
        'secreta',
      ]);
    });

    it('lanza UnauthorizedException si no hay match', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(service.login('toby', 'mala')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('register', () => {
    it('lanza ConflictException si el usuario ya existe', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await expect(service.register('toby', 'secreta')).rejects.toThrow(
        ConflictException,
      );
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('crea el usuario cuando el username está libre', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 2, username: 'nuevo' }] });

      const user = await service.register('nuevo', 'secreta');

      expect(user).toEqual({ id: 2, username: 'nuevo' });
      expect(db.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUserById', () => {
    it('devuelve null sin consultar la DB si no hay userId', async () => {
      const user = await service.getUserById(undefined);

      expect(user).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('devuelve el usuario de la DB si existe', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 3, username: 'ana', is_admin: false }],
      });

      const user = await service.getUserById('3');

      expect(user).toEqual({ id: 3, username: 'ana', is_admin: false });
    });

    it('devuelve null si el id no corresponde a ningún usuario', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const user = await service.getUserById('999');

      expect(user).toBeNull();
    });
  });
});
