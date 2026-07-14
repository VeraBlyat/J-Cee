import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { SessionUser } from './auth.service';

// @CurrentUser() inyecta el usuario que AuthGuard/AdminGuard dejaron en req.user.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as any).user;
  },
);
