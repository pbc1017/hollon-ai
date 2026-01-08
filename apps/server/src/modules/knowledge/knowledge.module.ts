import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Knowledge } from './entities/knowledge.entity';
import { KnowledgeRepository } from './knowledge.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Knowledge])],
  providers: [KnowledgeRepository],
  exports: [KnowledgeRepository],
})
export class KnowledgeModule {}
