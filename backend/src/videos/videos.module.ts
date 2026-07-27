import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { VideoTranscodeProcessor } from './video-transcode.processor';

@Module({
  imports: [
    AuthModule,
    // Registra la cola 'video-transcode' (la conexión a Redis se configura
    // una sola vez con BullModule.forRoot en el módulo raíz).
    BullModule.registerQueue({ name: 'video-transcode' }),
  ],
  controllers: [VideosController],
  providers: [VideosService, VideoTranscodeProcessor],
})
export class VideosModule {}