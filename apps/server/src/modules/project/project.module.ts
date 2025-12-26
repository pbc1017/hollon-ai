import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { Cycle } from './entities/cycle.entity';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { CycleService } from './cycle.service';
import { CycleController } from './cycle.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Cycle])],
  controllers: [ProjectController, CycleController],
  providers: [ProjectService, CycleService],
  exports: [ProjectService, CycleService],
})
export class ProjectModule {}
