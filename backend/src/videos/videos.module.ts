import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TranscodeService } from './transcode.service';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  imports: [AuthModule],
  controllers: [VideosController],
  // TranscodeService se exporta porque AdminModule lo necesita para tirar la
  // caché de segmentos cuando se borra un video.
  providers: [VideosService, TranscodeService],
  exports: [TranscodeService],
})
export class VideosModule {}
