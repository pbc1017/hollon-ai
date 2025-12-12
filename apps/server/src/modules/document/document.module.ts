import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentService } from './document.service';
import { HybridSearchService } from './services/hybrid-search.service';
import { Hollon } from '../hollon/entities/hollon.entity';
import { Team } from '../team/entities/team.entity';
import { Project } from '../project/entities/project.entity';
import { Task } from '../task/entities/task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document, Hollon, Team, Project, Task])],
  providers: [DocumentService, HybridSearchService],
  exports: [DocumentService, HybridSearchService],
})
export class DocumentModule {}
