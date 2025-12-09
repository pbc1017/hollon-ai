import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { Hollon } from '../hollon/entities/hollon.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { DependencyAnalyzerService } from './services/dependency-analyzer.service';
import { ResourcePlannerService } from './services/resource-planner.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Hollon])],
  controllers: [TaskController],
  providers: [TaskService, DependencyAnalyzerService, ResourcePlannerService],
  exports: [TaskService, DependencyAnalyzerService, ResourcePlannerService],
})
export class TaskModule {}
