import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { OptionalUser } from '../auth/optional-user.decorator';
import { SessionUser } from '../auth/auth.service';
import { CommentsService } from './comments.service';

const MAX_LENGTH = 2000;

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  // Público, pero cada comentario trae "my_vote" según quién mire: por eso el
  // guard opcional en vez de ninguno.
  @Get('videos/:id/comments')
  @UseGuards(OptionalAuthGuard)
  findByVideo(
    @Param('id') id: string,
    @OptionalUser() viewer: SessionUser | null,
  ) {
    return this.commentsService.findByVideo(id, viewer?.id);
  }

  // Crear comentario o respuesta (parentId opcional).
  @Post('comments')
  @UseGuards(AuthGuard)
  async create(
    @Body() body: { videoId?: number; content?: string; parentId?: number },
    @CurrentUser() user: SessionUser,
  ) {
    const { videoId, content, parentId } = body;

    if (!videoId || !content || !content.trim()) {
      throw new BadRequestException('Falta el comentario.');
    }
    if (content.length > MAX_LENGTH) {
      throw new BadRequestException(
        `El comentario no puede superar los ${MAX_LENGTH} caracteres.`,
      );
    }

    const id = await this.commentsService.create(
      Number(videoId),
      user.id,
      content,
      parentId ? Number(parentId) : undefined,
    );
    return { id };
  }

  // Votar. value: 1 like, -1 dislike, 0 saca el voto.
  @Post('comments/:id/vote')
  @UseGuards(AuthGuard)
  vote(
    @Param('id') id: string,
    @Body('value') value: number,
    @CurrentUser() user: SessionUser,
  ) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('Comentario inválido.');
    }
    return this.commentsService.vote(Number(id), user.id, Number(value));
  }

  @Delete('comments/:id')
  @UseGuards(AuthGuard)
  async remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('Comentario inválido.');
    }
    await this.commentsService.remove(Number(id), user);
    return { ok: true };
  }
}
