import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

// Requiere una sesión de administrador. Lanza 403 si no lo es (o no hay sesión).
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.cookies?.userId;
    const user = await this.authService.getUserById(userId);
    if (!user?.is_admin) {
      throw new ForbiddenException('No autorizado.');
    }
    (request as any).user = user;
    return true;
  }
}
