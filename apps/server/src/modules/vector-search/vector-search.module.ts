import { Module } from '@nestjs/common';
import { VectorSearchService } from './vector-search.service';

/**
 * VectorSearchModule
 *
 * This module provides vector-based semantic search capabilities for the application,
 * enabling similarity searches across documents, messages, and knowledge base content.
 *
 * Key responsibilities:
 * - Performing semantic similarity searches using vector embeddings
 * - Managing vector storage and retrieval operations
 * - Providing vector search services to other modules (knowledge-extraction, prompt-composer, etc.)
 */
@Module({
  /**
   * Providers (Services)
   *
   * Internal services available within this module:
   * - VectorSearchService: Core business logic for vector-based semantic search operations
   *
   * Future services may include:
   * - VectorIndexService: Managing vector index optimization and maintenance
   * - EmbeddingService: Generating and managing vector embeddings
   * - SimilarityService: Advanced similarity scoring and ranking algorithms
   */
  providers: [VectorSearchService],

  /**
   * Exports (Public API)
   *
   * Services exposed to other modules:
   * - VectorSearchService: Enables other modules to perform semantic searches
   *
   * Used by modules such as:
   * - PromptComposerModule: For retrieving semantically relevant context
   * - KnowledgeExtractionModule: For finding related knowledge entries
   * - OrchestrationModule: For context-aware decision making
   */
  exports: [VectorSearchService],
})
export class VectorSearchModule {}
