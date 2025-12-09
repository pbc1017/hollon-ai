import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { Hollon } from '../hollon/entities/hollon.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { DependencyAnalyzerService } from './services/dependency-analyzer.service';
import { ResourcePlannerService } from './services/resource-planner.service';
import { PriorityRebalancerService } from './services/priority-rebalancer.service';
import { UncertaintyDecisionService } from './services/uncertainty-decision.service';
import { PivotResponseService } from './services/pivot-response.service';
import { Project } from '../project/entities/project.entity';
import { Document } from '../document/entities/document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Hollon, Project, Document])],
  controllers: [TaskController],
  providers: [
    TaskService,
    DependencyAnalyzerService,
    ResourcePlannerService,
    PriorityRebalancerService,
    UncertaintyDecisionService,
    PivotResponseService,
  ],
  exports: [
    TaskService,
    DependencyAnalyzerService,
    ResourcePlannerService,
    PriorityRebalancerService,
    UncertaintyDecisionService,
    PivotResponseService,
  ],
})
export class TaskModule {}
