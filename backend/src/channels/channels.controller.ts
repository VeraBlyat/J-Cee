import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionUser } from '../auth/auth.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { OptionalUser } from '../auth/optional-user.decorator';
import { ChannelsService } from './channels.service';

@Controller()
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  // Feed de suscripciones. Va ANTES de /channels/:username porque si no
  // ":username" matchearía la palabra "feed".
  @Get('subscriptions/feed')
  @UseGuards(AuthGuard)
  feed(@CurrentUser() user: SessionUser) {
    return this.channels.feedFor(user.id);
  }

  // Canales a los que sigo.
  @Get('subscriptions')
  @UseGuards(AuthGuard)
  mySubscriptions(@CurrentUser() user: SessionUser) {
    return this.channels.subscriptionsOf(user.id);
  }

  // Público, pero el resultado depende de quién mira: is_subscribed sale del
  // visitante. De ahí el guard opcional.
  @Get('channels/:username')
  @UseGuards(OptionalAuthGuard)
  async findOne(
    @Param('username') username: string,
    @OptionalUser() viewer: SessionUser | null,
  ) {
    const channel = await this.channels.findByUsername(username, viewer?.id);
    if (!channel) {
      throw new NotFoundException('Ese canal no existe.');
    }
    return channel;
  }

  @Get('channels/:username/videos')
  videos(@Param('username') username: string) {
    return this.channels.videosOf(username);
  }

  @Post('channels/:username/subscribe')
  @UseGuards(AuthGuard)
  async subscribe(
    @Param('username') username: string,
    @CurrentUser() user: SessionUser,
  ) {
    const count = await this.channels.subscribe(user.id, username);
    return { is_subscribed: true, subscriber_count: count };
  }

  @Delete('channels/:username/subscribe')
  @UseGuards(AuthGuard)
  async unsubscribe(
    @Param('username') username: string,
    @CurrentUser() user: SessionUser,
  ) {
    const count = await this.channels.unsubscribe(user.id, username);
    return { is_subscribed: false, subscriber_count: count };
  }
}
