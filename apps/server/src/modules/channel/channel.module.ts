import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from './entities/channel.entity';
import { ChannelMembership } from './entities/channel-membership.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { ChannelService } from './channel.service';
import { ChannelController } from './channel.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Channel, ChannelMembership, ChannelMessage]),
  ],
  controllers: [ChannelController],
  providers: [ChannelService],
  exports: [ChannelService],
})
export class ChannelModule {}
