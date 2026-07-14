import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionUser } from '../auth/auth.service';
import { VideosService } from './videos.service';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  findAll() {
    return this.videosService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const video = await this.videosService.findOne(id);
    if (!video) {
      throw new NotFoundException('Video no encontrado.');
    }
    return video;
  }

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body('title') title: string,
    @Body('description') description: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: SessionUser,
  ) {
    if (!title || !file) {
      throw new BadRequestException('Faltan datos o el archivo.');
    }
    const id = await this.videosService.create(
      title,
      description || '',
      file,
      user.id,
    );
    return { id };
  }
}
