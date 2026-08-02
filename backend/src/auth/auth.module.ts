import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';
import { OptionalAuthGuard } from './optional-auth.guard';

// Exporta AuthService y los guards para que otros módulos (videos, comments,
// channels, admin) puedan proteger sus rutas.
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, AdminGuard, OptionalAuthGuard],
  exports: [AuthService, AuthGuard, AdminGuard, OptionalAuthGuard],
})
export class AuthModule {}
