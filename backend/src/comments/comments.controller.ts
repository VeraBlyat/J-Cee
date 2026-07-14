import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionUser } from '../auth/auth.service';
import { CommentsService } from './comments.service';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  // Lista de comentarios de un video.
  @Get('videos/:id/comments')
  findByVideo(@Param('id') id: string) {
    return this.commentsService.findByVideo(id);
  }

  // Crear comentario (requiere sesión).
  @Post('comments')
  @UseGuards(AuthGuard)
  async create(
    @Body() body: { videoId?: number; content?: string },
    @CurrentUser() user: SessionUser,
  ) {
    const { videoId, content } = body;
    if (!videoId || !content || !content.trim()) {
      throw new BadRequestException('Falta el comentario.');
    }
    await this.commentsService.create(videoId, user.id, content);
    return { ok: true };
  }
}
