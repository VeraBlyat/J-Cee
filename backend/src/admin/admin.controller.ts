import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionUser } from '../auth/auth.service';
import { AdminService } from './admin.service';

// Todas las rutas requieren ser administrador.
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --- Usuarios ---
  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Patch('users')
  async updateUser(
    @Body() body: { id: number; is_admin: boolean },
    @CurrentUser() admin: SessionUser,
  ) {
    if (body.id === admin.id) {
      throw new BadRequestException('No puedes modificar tu propio rol.');
    }
    await this.adminService.setUserAdmin(body.id, body.is_admin);
    return { ok: true };
  }

  @Delete('users')
  async deleteUser(
    @Body() body: { id: number },
    @CurrentUser() admin: SessionUser,
  ) {
    if (body.id === admin.id) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta.');
    }
    await this.adminService.deleteUser(body.id);
    return { ok: true };
  }

  // --- Videos ---
  @Get('videos')
  listVideos() {
    return this.adminService.listVideos();
  }

  @Delete('videos')
  async deleteVideo(@Body() body: { id: number }) {
    const deleted = await this.adminService.deleteVideo(body.id);
    if (!deleted) {
      throw new NotFoundException('Video no encontrado.');
    }
    return { ok: true };
  }

  // --- Comentarios ---
  @Get('comments')
  listComments() {
    return this.adminService.listComments();
  }

  @Delete('comments')
  async deleteComment(@Body() body: { id: number }) {
    await this.adminService.deleteComment(body.id);
    return { ok: true };
  }
}
