import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminGuard } from '../auth/admin.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController', () => {
  let controller: AdminController;
  let service: {
    setUserAdmin: jest.Mock;
    deleteUser: jest.Mock;
    deleteVideo: jest.Mock;
  };

  const admin = { id: 1, username: 'root', is_admin: true };

  beforeEach(async () => {
    service = {
      setUserAdmin: jest.fn().mockResolvedValue(undefined),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      deleteVideo: jest.fn().mockResolvedValue(true),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: service }],
    })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(AdminController);
  });

  describe('updateUser', () => {
    it('no permite que un admin se modifique a sí mismo', async () => {
      await expect(
        controller.updateUser({ id: admin.id, is_admin: false }, admin),
      ).rejects.toThrow(BadRequestException);
      expect(service.setUserAdmin).not.toHaveBeenCalled();
    });

    it('delega en el service para otro usuario', async () => {
      const result = await controller.updateUser(
        { id: 2, is_admin: true },
        admin,
      );

      expect(service.setUserAdmin).toHaveBeenCalledWith(2, true);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('deleteUser', () => {
    it('no permite que un admin se elimine a sí mismo', async () => {
      await expect(
        controller.deleteUser({ id: admin.id }, admin),
      ).rejects.toThrow(BadRequestException);
      expect(service.deleteUser).not.toHaveBeenCalled();
    });

    it('delega en el service para otro usuario', async () => {
      const result = await controller.deleteUser({ id: 2 }, admin);

      expect(service.deleteUser).toHaveBeenCalledWith(2);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('deleteVideo', () => {
    it('lanza NotFoundException si el service no encuentra el video', async () => {
      service.deleteVideo.mockResolvedValue(false);

      await expect(controller.deleteVideo({ id: 99 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('devuelve ok cuando el video se elimina', async () => {
      const result = await controller.deleteVideo({ id: 5 });

      expect(service.deleteVideo).toHaveBeenCalledWith(5);
      expect(result).toEqual({ ok: true });
    });
  });
});
