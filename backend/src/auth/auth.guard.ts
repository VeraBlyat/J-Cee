import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

// Requiere una sesión válida: lee la cookie "userId", carga el usuario y lo
// deja en req.user. Lanza 401 si no hay sesión.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(protected readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.cookies?.userId;
    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new UnauthorizedException('Debes iniciar sesión.');
    }
    (request as any).user = user;
    return true;
  }
}
