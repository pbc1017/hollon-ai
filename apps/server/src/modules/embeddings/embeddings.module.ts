import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../document/entities/document.entity';
import { CostRecord } from '../cost-tracking/entities/cost-record.entity';
import { EmbeddingsService } from './embeddings.service';
import { EmbeddingsController } from './embeddings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Document, CostRecord])],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
  controllers: [EmbeddingsController],
})
export class EmbeddingsModule {}
