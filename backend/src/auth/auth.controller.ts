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

  // Pide un enlace de recuperación. Responde SIEMPRE lo mismo, exista o no el
  // email, para no revelar qué cuentas están registradas.
  //
  // Nota: este proyecto no tiene servidor de correo, así que el enlace no se
  // "envía": se escribe en el log del backend y, fuera de producción, se
  // devuelve en la respuesta para poder probar el flujo de punta a punta.
  // Cuando haya SMTP, esto se reemplaza por un mail y se deja de exponer.
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email?: string }) {
    const token = await this.authService.createPasswordReset(body.email);

    let resetUrl: string | undefined;
    if (token) {
      const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
      resetUrl = `${origin}/reset-password?token=${token}`;
      // eslint-disable-next-line no-console
      console.log(`[recuperación] Enlace para ${body.email}: ${resetUrl}`);
    }

    const response: { ok: true; resetUrl?: string } = { ok: true };
    if (resetUrl && process.env.NODE_ENV !== 'production') {
      response.resetUrl = resetUrl;
    }
    return response;
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token?: string; password?: string }) {
    await this.authService.resetPassword(body.token, body.password);
    return { ok: true };
  }

  // Reemplaza a getCurrentUser(): lo usan el Navbar y la puerta de /admin.
  @Get('me')
  async me(@Req() req: Request) {
    const user = await this.authService.getUserById(req.cookies?.userId);
    return user;
  }
}
