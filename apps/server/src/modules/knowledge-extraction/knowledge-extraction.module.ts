import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeItem } from './entities/knowledge-item.entity';
import { KnowledgeExtractionService } from './services/knowledge-extraction.service';
import { VectorSearchService } from './services/vector-search.service';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeItem])],
  providers: [KnowledgeExtractionService, VectorSearchService],
  exports: [KnowledgeExtractionService, VectorSearchService],
})
export class KnowledgeExtractionModule {}
