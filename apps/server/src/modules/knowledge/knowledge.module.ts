import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeEntry } from './entities/knowledge-entry.entity';
import { Task } from '../task/entities/task.entity';
import { Document } from '../document/entities/document.entity';
import { KnowledgeRepository } from './services/knowledge.repository';
import { KnowledgeExtractionService } from './services/knowledge-extraction.service';
import { KnowledgeRetrievalService } from './services/knowledge-retrieval.service';
import { KnowledgeController } from './knowledge.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeEntry, Task, Document])],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeRepository,
    KnowledgeExtractionService,
    KnowledgeRetrievalService,
  ],
  exports: [
    KnowledgeRepository,
    KnowledgeExtractionService,
    KnowledgeRetrievalService,
  ],
})
export class KnowledgeModule {}
