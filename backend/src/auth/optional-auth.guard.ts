import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

// Como AuthGuard, pero NUNCA rechaza: carga el usuario en req.user si hay
// sesión válida y deja pasar igual si no la hay.
//
// Es para rutas públicas cuyo contenido depende de quién mira (la página de un
// canal necesita saber si ya estás suscrito). Ojo: las rutas que usen esto
// tienen que tratar req.user como opcional, porque puede no estar.
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = await this.authService.getUserById(request.cookies?.userId);
    (request as any).user = user;
    return true;
  }
}
