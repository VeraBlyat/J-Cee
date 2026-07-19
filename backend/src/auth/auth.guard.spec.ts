import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

function makeContext(cookies: Record<string, string>) {
  const request: any = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let authService: { getUserById: jest.Mock };
  let guard: AuthGuard;

  beforeEach(() => {
    authService = { getUserById: jest.fn() };
    guard = new AuthGuard(authService as unknown as AuthService);
  });

  it('permite el paso y setea req.user cuando hay sesión válida', async () => {
    const user = { id: 1, username: 'toby', is_admin: false };
    authService.getUserById.mockResolvedValue(user);
    const context = makeContext({ userId: '1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest<any>().user).toEqual(user);
  });

  it('lanza UnauthorizedException si no hay cookie de sesión', async () => {
    authService.getUserById.mockResolvedValue(null);
    const context = makeContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
