import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VideosModule } from '../videos/videos.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, VideosModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
