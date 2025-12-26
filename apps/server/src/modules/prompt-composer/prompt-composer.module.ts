import { Module } from '@nestjs/common';
import { PromptComposerService } from './prompt-composer.service';
import { PromptComposerController } from './prompt-composer.controller';
import { KnowledgeExtractionModule } from '../knowledge-extraction/knowledge-extraction.module';
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module';
import { VectorSearchModule } from '../vector-search/vector-search.module';

@Module({
  imports: [
    KnowledgeExtractionModule,
    KnowledgeGraphModule,
    VectorSearchModule,
  ],
  controllers: [PromptComposerController],
  providers: [PromptComposerService],
  exports: [PromptComposerService],
})
export class PromptComposerModule {}
