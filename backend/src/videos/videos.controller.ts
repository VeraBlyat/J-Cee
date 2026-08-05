import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { OptionalUser } from '../auth/optional-user.decorator';
import { SessionUser } from '../auth/auth.service';
import { parseHashtags } from './hashtags';
import { paginationFrom } from './reels';
import {
  buildMasterPlaylist,
  buildMediaPlaylist,
  findRendition,
  segmentCount,
} from './hls';
import { TranscodeService } from './transcode.service';
import { VideosService } from './videos.service';

// Tope de subida. Sin esto, Multer acepta archivos de cualquier tamaño y los
// carga enteros en memoria.
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB

@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly transcode: TranscodeService,
  ) {}

  // ?hashtag=nextjs filtra por tema; sin el parámetro devuelve todo.
  @Get()
  findAll(@Query('hashtag') hashtag?: string) {
    const [tag] = parseHashtags(hashtag);
    return tag
      ? this.videosService.findByHashtag(tag)
      : this.videosService.findAll();
  }

  // Feed de reels. Va ANTES de :id porque "reels" matchearía como id.
  @Get('reels')
  reels(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const { limit: take, offset: skip } = paginationFrom(limit, offset);
    return this.videosService.findReels(take, skip);
  }

  // --- HLS ---------------------------------------------------------------
  // Van ANTES de @Get(':id') a propósito: Nest resuelve las rutas en orden de
  // declaración, y ":id" matchearía "5/hls/master.m3u8" si estuviera primero.

  // Master playlist: qué calidades hay.
  @Get(':id/hls/master.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'no-cache')
  async master(@Param('id') id: string) {
    const video = await this.getPlayableVideo(id);
    return buildMasterPlaylist(video.width!, video.height!);
  }

  // Playlist de una calidad: la lista de segmentos, que todavía no existen.
  @Get(':id/hls/:quality/index.m3u8')
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'no-cache')
  async media(@Param('id') id: string, @Param('quality') quality: string) {
    const video = await this.getPlayableVideo(id);

    if (!findRendition(video.height!, quality)) {
      throw new NotFoundException('Esa calidad no existe para este video.');
    }
    return buildMediaPlaylist(video.duration_seconds!);
  }

  // Segmento de init (EXT-X-MAP): las cabeceras de códec de esta calidad. El
  // player lo pide una sola vez, antes del primer segmento.
  @Get(':id/hls/:quality/init.mp4')
  async init(
    @Param('id') id: string,
    @Param('quality') quality: string,
    @Res() res: Response,
  ) {
    const video = await this.getPlayableVideo(id);

    const rendition = findRendition(video.height!, quality);
    if (!rendition) {
      throw new NotFoundException('Esa calidad no existe para este video.');
    }

    const path = await this.transcode.initPath(
      video.id,
      this.videosService.absolutePathOf(video),
      rendition,
    );

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(path);
  }

  // El segmento en sí: acá es donde corre FFmpeg, sólo si el player lo pide.
  @Get(':id/hls/:quality/:index.m4s')
  async segment(
    @Param('id') id: string,
    @Param('quality') quality: string,
    @Param('index') index: string,
    @Res() res: Response,
  ) {
    const video = await this.getPlayableVideo(id);

    const rendition = findRendition(video.height!, quality);
    if (!rendition) {
      throw new NotFoundException('Esa calidad no existe para este video.');
    }

    // El índice viene de la URL: lo validamos contra la cantidad real de
    // segmentos para que nadie pueda pedir el segmento 99999 y hacernos
    // lanzar FFmpeg al pedo.
    if (!/^\d+$/.test(index)) {
      throw new BadRequestException('Segmento inválido.');
    }
    const segmentIndex = Number(index);
    if (segmentIndex >= segmentCount(video.duration_seconds!)) {
      throw new NotFoundException('Ese segmento no existe.');
    }

    const path = await this.transcode.segmentPath(
      video.id,
      this.videosService.absolutePathOf(video),
      rendition,
      segmentIndex,
      video.duration_seconds!,
    );

    // Los segmentos son inmutables (mismo video + calidad + índice = mismo
    // resultado siempre), así que el navegador puede cachearlos para siempre.
    // Esto es lo que evita re-transcodificar cuando el usuario rebobina.
    res.setHeader('Content-Type', 'video/iso.segment');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(path);
  }

  // --- Detalle y subida --------------------------------------------------

  // Público, pero "liked" depende de quién mira, así que el guard es opcional.
  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  async findOne(
    @Param('id') id: string,
    @OptionalUser() viewer: SessionUser | null,
  ) {
    const video = await this.videosService.findOne(id, viewer?.id);
    if (!video) {
      throw new NotFoundException('Video no encontrado.');
    }
    return video;
  }

  // Like / unlike. Devuelve el total actualizado y si quedó con like.
  @Post(':id/like')
  @UseGuards(AuthGuard)
  like(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.videosService.setLike(id, user.id, true);
  }

  @Delete(':id/like')
  @UseGuards(AuthGuard)
  unlike(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.videosService.setLike(id, user.id, false);
  }

  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_UPLOAD_BYTES } },
    ),
  )
  async create(
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('hashtags') hashtags: string,
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
    @CurrentUser() user: SessionUser,
  ) {
    const video = files?.file?.[0];
    if (!title || !video) {
      throw new BadRequestException('Faltan datos o el archivo.');
    }

    const id = await this.videosService.create(
      title,
      description || '',
      hashtags,
      video,
      files?.thumbnail?.[0],
      user.id,
    );
    return { id };
  }

  // Carga el video y se asegura de que tenga la metadata que HLS necesita.
  // Los videos subidos antes de la Fase 2 no la tienen: se pueden seguir
  // viendo por su MP4 original, pero no por HLS.
  private async getPlayableVideo(id: string) {
    const video = await this.videosService.findOne(id);
    if (!video) {
      throw new NotFoundException('Video no encontrado.');
    }
    if (!video.duration_seconds || !video.width || !video.height) {
      throw new NotFoundException(
        'Este video no tiene metadata de streaming (se subió antes de HLS).',
      );
    }
    return video;
  }
}
