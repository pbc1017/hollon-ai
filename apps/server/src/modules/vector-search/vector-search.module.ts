import { Module } from '@nestjs/common';
import { VectorSearchService } from './services/vector-search.service';

@Module({
  providers: [VectorSearchService],
  exports: [VectorSearchService],
})
export class VectorSearchModule {}
