import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DatabaseService } from '../database/database.service';

export interface VideoTranscodeJob {
  videoId: number;
  sourcePath: string; // ruta al archivo original en UPLOAD_DIR
}

// concurrency: 1 para no saturar el contenedor (compite con la API por CPU)
@Processor('video-transcode', { concurrency: 1 })
export class VideoTranscodeProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoTranscodeProcessor.name);

  constructor(private readonly db: DatabaseService) {
    super();
  }

  async process(job: Job<VideoTranscodeJob>) {
    const { videoId, sourcePath } = job.data;
    this.logger.log(`Procesando video ${videoId} (${sourcePath})`);

    // TODO tarea 4: correr ffmpeg acá y generar el HLS.
    // Por ahora solo dejamos el flujo de status funcionando end-to-end.
    await this.db.query(`UPDATE videos SET status = 'ready' WHERE id = $1`, [
      videoId,
    ]);
  }
}