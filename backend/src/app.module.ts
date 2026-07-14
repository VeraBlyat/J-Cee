import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { VideosModule } from './videos/videos.module';
import { CommentsModule } from './comments/comments.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    VideosModule,
    CommentsModule,
    AdminModule,
  ],
})
export class AppModule {}
