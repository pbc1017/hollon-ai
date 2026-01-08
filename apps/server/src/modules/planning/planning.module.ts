import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Task } from '../task/entities/task.entity';
import { Hollon } from '../hollon/entities/hollon.entity';
import { Team } from '../team/entities/team.entity';
import { Role } from '../role/entities/role.entity';
import { TaskPullRequest } from '../collaboration/entities/task-pull-request.entity';
import { BrainProviderModule } from '../brain-provider/brain-provider.module';
import { HollonModule } from '../hollon/hollon.module';

import { PlanningService } from './planning.service';
import { PlanningOrchestratorService } from './planning-orchestrator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Hollon, Team, Role, TaskPullRequest]),
    forwardRef(() => BrainProviderModule),
    forwardRef(() => HollonModule),
  ],
  providers: [PlanningService, PlanningOrchestratorService],
  exports: [PlanningService, PlanningOrchestratorService],
})
export class PlanningModule {}
