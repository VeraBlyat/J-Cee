import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { SessionUser } from './auth.service';

// @OptionalUser() da el usuario de la sesión, o null si no hay ninguna.
//
// Se usa en rutas públicas que igual cambian según quién mire: la página de un
// canal la ve cualquiera, pero el botón tiene que decir "Suscribirse" o
// "Suscrito" según el visitante. Con AuthGuard esas rutas darían 401 a los
// deslogueados; sin nada, no sabríamos quién mira.
//
// Necesita OptionalAuthInterceptor para que req.user esté cargado.
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as any).user ?? null;
  },
);
