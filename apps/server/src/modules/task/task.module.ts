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

@Module({
  imports: [TypeOrmModule.forFeature([Task, Hollon])],
  controllers: [TaskController],
  providers: [
    TaskService,
    DependencyAnalyzerService,
    ResourcePlannerService,
    PriorityRebalancerService,
    UncertaintyDecisionService,
  ],
  exports: [
    TaskService,
    DependencyAnalyzerService,
    ResourcePlannerService,
    PriorityRebalancerService,
    UncertaintyDecisionService,
  ],
})
export class TaskModule {}
