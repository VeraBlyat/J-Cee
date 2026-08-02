import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { VideosModule } from './videos/videos.module';
import { CommentsModule } from './comments/comments.module';
import { ChannelsModule } from './channels/channels.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    VideosModule,
    CommentsModule,
    ChannelsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
