import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { VectorSearchService } from './vector-search.service';
import { VectorSearchConfigService } from './services/vector-search-config.service';
import { EmbeddingApiClientService } from './services/embedding-api-client.service';
import { VectorSearchConfig } from './entities/vector-search-config.entity';
import { VectorEmbedding } from '../../entities/vector-embedding.entity';

/**
 * VectorSearchModule
 *
 * This module provides vector-based semantic search capabilities for the application,
 * enabling similarity searches across documents, messages, and knowledge base content.
 *
 * Features:
 * - Semantic search using pgvector
 * - Embedding generation via OpenAI or other providers
 * - Multi-tenant configuration management
 * - Document indexing and similarity search
 *
 * Key Responsibilities:
 * - Performing semantic similarity searches using vector embeddings
 * - Managing vector storage and retrieval operations
 * - Providing vector search services to other modules (knowledge-extraction, prompt-composer, etc.)
 *
 * Services:
 * - VectorSearchService: Core business logic for vector-based semantic search operations
 * - VectorSearchConfigService: Organization-specific configuration management
 *
 * Entities:
 * - VectorSearchConfig: Organization-specific vector search settings
 * - VectorEmbedding: Stored vector embeddings with metadata
 *
 * Used by modules such as:
 * - PromptComposerModule: For retrieving semantically relevant context
 * - KnowledgeExtractionModule: For finding related knowledge entries
 * - OrchestrationModule: For context-aware decision making
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([VectorSearchConfig, VectorEmbedding]),
    ConfigModule,
  ],
  providers: [
    VectorSearchService,
    VectorSearchConfigService,
    EmbeddingApiClientService,
  ],
  exports: [
    VectorSearchService,
    VectorSearchConfigService,
    EmbeddingApiClientService,
  ],
})
export class VectorSearchModule {}
