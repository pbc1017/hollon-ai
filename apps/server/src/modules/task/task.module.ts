import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { DependencyAnalyzerService } from './services/dependency-analyzer.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task])],
  controllers: [TaskController],
  providers: [TaskService, DependencyAnalyzerService],
  exports: [TaskService, DependencyAnalyzerService],
})
export class TaskModule {}
