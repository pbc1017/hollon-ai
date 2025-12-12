import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Document } from '../document/entities/document.entity';
import { VectorSearchService } from './services/vector-search.service';
import { EmbeddingService } from './services/embedding.service';

@Module({
  imports: [TypeOrmModule.forFeature([Document]), ConfigModule],
  providers: [VectorSearchService, EmbeddingService],
  exports: [VectorSearchService, EmbeddingService],
})
export class VectorSearchModule {}
