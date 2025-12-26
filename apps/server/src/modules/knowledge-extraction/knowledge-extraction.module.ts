import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeItem } from './entities/knowledge-item.entity';
import { VectorEmbedding } from './entities/vector-embedding.entity';
import { KnowledgeExtractionService } from './services/knowledge-extraction.service';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeItem, VectorEmbedding])],
  providers: [KnowledgeExtractionService],
  exports: [KnowledgeExtractionService],
})
export class KnowledgeExtractionModule {}
