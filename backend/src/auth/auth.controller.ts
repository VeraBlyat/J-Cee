import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';

// Opciones de la cookie de sesión. httpOnly para que no la lea el JS del
// navegador; sameSite "lax" basta porque front y back comparten host (localhost).
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // La credencial ahora es el email; "username" pasó a ser el nombre público
  // del canal y ya no sirve para iniciar sesión.
  @Post('login')
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.login(body.email, body.password);
    res.cookie('userId', String(user.id), COOKIE_OPTIONS);
    return { id: user.id, username: user.username, email: user.email };
  }

  @Post('register')
  async register(
    @Body() body: { email?: string; username?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, username, password } = body;
    if (!email || !username || !password) {
      throw new BadRequestException(
        'Email, nombre de usuario y contraseña son obligatorios.',
      );
    }
    const user = await this.authService.register(email, username, password);
    res.cookie('userId', String(user.id), COOKIE_OPTIONS);
    return { id: user.id, username: user.username, email: user.email };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('userId', COOKIE_OPTIONS);
    return { ok: true };
  }

  // Reemplaza a getCurrentUser(): lo usan el Navbar y la puerta de /admin.
  @Get('me')
  async me(@Req() req: Request) {
    const user = await this.authService.getUserById(req.cookies?.userId);
    return user;
  }
}
