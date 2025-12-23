import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Knowledge,
  KnowledgeRelation,
  Embedding,
  KnowledgeMetadata,
} from './entities';
import { TaskKnowledgeRepository } from './repositories/task-knowledge.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Knowledge,
      KnowledgeRelation,
      Embedding,
      KnowledgeMetadata,
    ]),
  ],
  providers: [TaskKnowledgeRepository],
  exports: [TaskKnowledgeRepository],
})
export class KnowledgeModule {}
