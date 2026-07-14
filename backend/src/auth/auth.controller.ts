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

  @Post('login')
  async login(
    @Body() body: { username?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.login(body.username, body.password);
    res.cookie('userId', String(user.id), COOKIE_OPTIONS);
    return { id: user.id, username: user.username };
  }

  @Post('register')
  async register(
    @Body() body: { username?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { username, password } = body;
    if (!username || !password) {
      throw new BadRequestException('Usuario y contraseña son obligatorios.');
    }
    const user = await this.authService.register(username, password);
    res.cookie('userId', String(user.id), COOKIE_OPTIONS);
    return { id: user.id, username: user.username };
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
