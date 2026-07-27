import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { VideosModule } from './videos/videos.module';
import { CommentsModule } from './comments/comments.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health/health.controller';

// Parseamos REDIS_URL (ej: redis://localhost:6379) a host/port,
// que es el formato que espera @nestjs/bullmq.
const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port) || 6379,
      },
    }),
    DatabaseModule,
    AuthModule,
    VideosModule,
    CommentsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}