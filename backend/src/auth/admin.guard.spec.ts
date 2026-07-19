import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AuthService } from './auth.service';

function makeContext(cookies: Record<string, string>) {
  const request: any = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  let authService: { getUserById: jest.Mock };
  let guard: AdminGuard;

  beforeEach(() => {
    authService = { getUserById: jest.fn() };
    guard = new AdminGuard(authService as unknown as AuthService);
  });

  it('permite el paso cuando el usuario es admin', async () => {
    const admin = { id: 1, username: 'root', is_admin: true };
    authService.getUserById.mockResolvedValue(admin);
    const context = makeContext({ userId: '1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest<any>().user).toEqual(admin);
  });

  it('lanza ForbiddenException si el usuario no es admin', async () => {
    authService.getUserById.mockResolvedValue({
      id: 2,
      username: 'user',
      is_admin: false,
    });
    const context = makeContext({ userId: '2' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lanza ForbiddenException si no hay sesión', async () => {
    authService.getUserById.mockResolvedValue(null);
    const context = makeContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
