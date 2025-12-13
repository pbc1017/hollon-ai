import { Module, forwardRef } from '@nestjs/common';
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
import { GoalAutomationListener } from './listeners/goal-automation.listener';
import { TaskPullRequest } from '../collaboration/entities/task-pull-request.entity';
import { BrainProviderModule } from '../brain-provider/brain-provider.module';
import { TaskModule } from '../task/task.module';
import { OrchestrationModule } from '../orchestration/orchestration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Goal,
      GoalProgressRecord,
      Task,
      TaskPullRequest,
      Project,
      Organization,
      Team,
    ]),
    BrainProviderModule,
    TaskModule,
    forwardRef(() => OrchestrationModule), // For TaskExecutionService
  ],
  controllers: [GoalController],
  providers: [
    GoalService,
    GoalTrackingService,
    GoalReviewService,
    GoalDecompositionService,
    GoalAutomationListener, // Phase 3.12: 완전 자동화
  ],
  exports: [
    GoalService,
    GoalTrackingService,
    GoalReviewService,
    GoalDecompositionService,
  ],
})
export class GoalModule {}
