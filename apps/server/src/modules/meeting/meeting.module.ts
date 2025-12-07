import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingRecord } from './entities/meeting-record.entity';
import { Team } from '../team/entities/team.entity';
import { Hollon } from '../hollon/entities/hollon.entity';
import { Task } from '../task/entities/task.entity';
import { Project } from '../project/entities/project.entity';
import { StandupService } from './services/standup.service';
import { SprintPlanningService } from './services/sprint-planning.service';
import { RetrospectiveService } from './services/retrospective.service';
import { MeetingSchedulerService } from './services/meeting-scheduler.service';
import { MeetingController } from './meeting.controller';
import { ChannelModule } from '../channel/channel.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MeetingRecord, Team, Hollon, Task, Project]),
    ChannelModule,
  ],
  controllers: [MeetingController],
  providers: [
    StandupService,
    SprintPlanningService,
    RetrospectiveService,
    MeetingSchedulerService,
  ],
  exports: [
    StandupService,
    SprintPlanningService,
    RetrospectiveService,
    MeetingSchedulerService,
  ],
})
export class MeetingModule {}
