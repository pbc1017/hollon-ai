import { Module } from '@nestjs/common';
import { PromptComposerService } from './prompt-composer.service';
import { PromptComposerController } from './prompt-composer.controller';
import { KnowledgeExtractionModule } from '../knowledge-extraction/knowledge-extraction.module';
import { VectorSearchModule } from '../vector-search/vector-search.module';
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module';

/**
 * PromptComposerModule
 *
 * This module manages prompt composition functionality, orchestrating
 * knowledge extraction, vector search, and knowledge graph services
 * to build context-aware prompts for AI interactions.
 *
 * Key responsibilities:
 * - Composing prompts with relevant context from multiple sources
 * - Integrating knowledge extraction, vector search, and graph data
 * - Providing prompt templates and assembly logic
 */
@Module({
  /**
   * Module imports
   *
   * Dependencies required for prompt composition:
   * - KnowledgeExtractionModule: Provides KnowledgeExtractionService for extracting relevant knowledge
   * - VectorSearchModule: Provides VectorSearchService for semantic search capabilities
   * - KnowledgeGraphModule: Provides KnowledgeGraphService for graph-based context retrieval
   */
  imports: [
    KnowledgeExtractionModule,
    VectorSearchModule,
    KnowledgeGraphModule,
  ],

  /**
   * Controllers
   *
   * HTTP endpoint handlers for prompt composition:
   * - PromptComposerController: REST endpoints for prompt composition operations
   */
  controllers: [PromptComposerController],

  /**
   * Providers (Services)
   *
   * Internal services available within this module:
   * - PromptComposerService: Core business logic for prompt composition and assembly
   */
  providers: [PromptComposerService],

  /**
   * Exports (Public API)
   *
   * Services exposed to other modules:
   * - PromptComposerService: Allows other modules to compose prompts with integrated context
   */
  exports: [PromptComposerService],
})
export class PromptComposerModule {}
