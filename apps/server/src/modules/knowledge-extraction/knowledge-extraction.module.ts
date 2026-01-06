import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeItem } from './entities/knowledge-item.entity';
import { KnowledgeExtractionService } from './services/knowledge-extraction.service';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeItem])],
  providers: [KnowledgeExtractionService],
  exports: [KnowledgeExtractionService],
})
export class KnowledgeExtractionModule {}
