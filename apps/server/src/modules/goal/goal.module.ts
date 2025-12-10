import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goal } from './entities/goal.entity';
import { GoalProgressRecord } from './entities/goal-progress-record.entity';
import { Task } from '../task/entities/task.entity';
import { Project } from '../project/entities/project.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Team } from '../team/entities/team.entity';
import { GoalService } from './goal.service';
import { GoalController } from './goal.controller';
import { GoalTrackingService } from './services/goal-tracking.service';
import { GoalReviewService } from './services/goal-review.service';
import { GoalDecompositionService } from './services/goal-decomposition.service';
import { BrainProviderModule } from '../brain-provider/brain-provider.module';
import { TaskModule } from '../task/task.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Goal,
      GoalProgressRecord,
      Task,
      Project,
      Organization,
      Team,
    ]),
    BrainProviderModule,
    TaskModule,
  ],
  controllers: [GoalController],
  providers: [
    GoalService,
    GoalTrackingService,
    GoalReviewService,
    GoalDecompositionService,
  ],
  exports: [
    GoalService,
    GoalTrackingService,
    GoalReviewService,
    GoalDecompositionService,
  ],
})
export class GoalModule {}
