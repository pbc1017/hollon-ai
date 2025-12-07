import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingRecord } from './entities/meeting-record.entity';
import { Team } from '../team/entities/team.entity';
import { Hollon } from '../hollon/entities/hollon.entity';
import { Task } from '../task/entities/task.entity';
import { StandupService } from './services/standup.service';
import { MeetingController } from './meeting.controller';
import { ChannelModule } from '../channel/channel.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MeetingRecord, Team, Hollon, Task]),
    ChannelModule,
  ],
  controllers: [MeetingController],
  providers: [StandupService],
  exports: [StandupService],
})
export class MeetingModule {}
