<<<<<<< HEAD
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VectorEmbedding } from '../../entities/vector-embedding.entity';
import {
  EmbeddingSourceType,
  EmbeddingModelType,
} from '../../entities/vector-embedding.entity';
import { VectorSearchConfigService } from './services/vector-search-config.service';
import { VectorSearchConfig } from './entities/vector-search-config.entity';

/**
 * Search result interface
 */
export interface VectorSearchResult {
  /** Source ID of the matching document/entity */
  sourceId: string;
  /** Source type of the matching document/entity */
  sourceType: EmbeddingSourceType;
  /** Similarity score (0-1, higher is more similar) */
  similarity: number;
  /** Original content that was embedded */
  content: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Search options interface
 */
export interface VectorSearchOptions {
  /** Organization ID for multi-tenant filtering */
  organizationId?: string;
  /** Project ID for project-scoped search */
  projectId?: string;
  /** Team ID for team-scoped search */
  teamId?: string;
  /** Filter by source types */
  sourceTypes?: EmbeddingSourceType[];
  /** Minimum similarity threshold (0-1) */
  similarityThreshold?: number;
  /** Maximum number of results */
  limit?: number;
  /** Tags to filter by */
  tags?: string[];
}

/**
 * VectorSearchService
 *
 * Core service for vector search and embedding operations.
 * Integrates with OpenAI (or other providers) for embedding generation
 * and pgvector for efficient similarity search.
 *
 * Key features:
 * - Generate embeddings for text content
 * - Search for similar vectors using cosine similarity
 * - Index and manage vector embeddings in PostgreSQL with pgvector
 * - Support multi-tenant isolation and scoped searches
 * - Configurable via VectorSearchConfig entity
 */
@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(
    @InjectRepository(VectorEmbedding)
    private readonly embeddingRepo: Repository<VectorEmbedding>,
    private readonly vectorConfigService: VectorSearchConfigService,
  ) {}

  /**
   * Search for similar vectors based on a query string
   *
   * Generates an embedding for the query and finds similar vectors
   * using pgvector's cosine similarity operator.
   *
   * @param query - The search query text
   * @param options - Search options and filters
   * @returns Array of similar documents with relevance scores
   */
  async searchSimilarVectors(
    query: string,
    options: VectorSearchOptions = {},
  ): Promise<VectorSearchResult[]> {
    // Get configuration
    const config = options.organizationId
      ? await this.vectorConfigService.getOrCreateConfig(options.organizationId)
      : await this.vectorConfigService.getDefaultConfig();

    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(query, config);

    // Build search query
    const qb = this.embeddingRepo
      .createQueryBuilder('embedding')
      .select([
        'embedding.sourceId',
        'embedding.sourceType',
        'embedding.content',
        'embedding.metadata',
      ])
      .addSelect(
        `1 - (embedding.embedding <=> '[${queryEmbedding.join(',')}]')`,
        'similarity',
      );

    // Apply filters
    if (options.organizationId) {
      qb.andWhere('embedding.organizationId = :organizationId', {
        organizationId: options.organizationId,
      });
    }

    if (options.projectId) {
      qb.andWhere('embedding.projectId = :projectId', {
        projectId: options.projectId,
      });
    }

    if (options.teamId) {
      qb.andWhere('embedding.teamId = :teamId', { teamId: options.teamId });
    }

    if (options.sourceTypes && options.sourceTypes.length > 0) {
      qb.andWhere('embedding.sourceType IN (:...sourceTypes)', {
        sourceTypes: options.sourceTypes,
      });
    }

    if (options.tags && options.tags.length > 0) {
      qb.andWhere('embedding.tags && :tags', { tags: options.tags });
    }

    // Apply similarity threshold
    const threshold =
      options.similarityThreshold ??
      config.searchConfig.similarityThreshold ??
      0.7;
    qb.andWhere(
      `1 - (embedding.embedding <=> '[${queryEmbedding.join(',')}]') >= :threshold`,
      { threshold },
    );

    // Apply limit
    const limit = options.limit ?? config.searchConfig.defaultLimit ?? 10;
    qb.orderBy('similarity', 'DESC').limit(limit);

    // Execute query
    const results = await qb.getRawMany();

    return results.map((result) => ({
      sourceId: result.embedding_source_id,
      sourceType: result.embedding_source_type,
      similarity: parseFloat(result.similarity),
      content: result.embedding_content,
      metadata: result.embedding_metadata,
    }));
  }

  /**
   * Index a document for vector search
   *
   * Generates an embedding for the document content and stores it
   * in the vector_embeddings table.
   *
   * @param id - Unique identifier for the document
   * @param content - The text content to be indexed
   * @param sourceType - Type of the source entity
   * @param metadata - Additional metadata associated with the document
   * @param options - Indexing options including organization/project/team IDs
   * @returns The created embedding entity
   */
  async indexDocument(
    id: string,
    content: string,
    sourceType: EmbeddingSourceType,
    metadata: Record<string, unknown> = {},
    options: {
      organizationId: string;
      projectId?: string;
      teamId?: string;
      hollonId?: string;
      tags?: string[];
    },
  ): Promise<VectorEmbedding> {
    // Get configuration
    const config = await this.vectorConfigService.getOrCreateConfig(
      options.organizationId,
    );

    // Generate embedding
    const embeddingVector = await this.generateEmbedding(content, config);

    // Determine model type from config
    const modelType = this.getModelTypeFromConfig(config);

    // Create embedding entity
    const embedding = this.embeddingRepo.create({
      embedding: `[${embeddingVector.join(',')}]`,
      sourceType,
      sourceId: id,
      modelType,
      dimensions: config.dimensions,
      content,
      metadata: {
        embeddingModelVersion: config.embeddingModel,
        processingTimestamp: new Date().toISOString(),
        ...metadata,
      },
      tags: options.tags,
      organizationId: options.organizationId,
      projectId: options.projectId,
      teamId: options.teamId,
      hollonId: options.hollonId,
    });

    return await this.embeddingRepo.save(embedding);
  }

  /**
   * Update an existing document's embedding
   *
   * Regenerates the embedding with new content.
   *
   * @param id - Source ID of the document
   * @param sourceType - Source type of the document
   * @param content - Updated text content
   * @param organizationId - Organization ID for filtering
   * @returns Updated embedding entity
   */
  async updateDocument(
    id: string,
    sourceType: EmbeddingSourceType,
    content: string,
    organizationId: string,
  ): Promise<VectorEmbedding> {
    // Find existing embedding
    const existing = await this.embeddingRepo.findOne({
      where: {
        sourceId: id,
        sourceType,
        organizationId,
      },
    });

    if (!existing) {
      throw new Error(
        `Embedding not found for sourceId: ${id}, sourceType: ${sourceType}`,
      );
    }

    // Get configuration
    const config =
      await this.vectorConfigService.getOrCreateConfig(organizationId);

    // Generate new embedding
    const embeddingVector = await this.generateEmbedding(content, config);

    // Update embedding
    existing.embedding = `[${embeddingVector.join(',')}]`;
    existing.content = content;
    existing.metadata = {
      ...existing.metadata,
      embeddingModelVersion: config.embeddingModel,
      processingTimestamp: new Date().toISOString(),
    };

    return await this.embeddingRepo.save(existing);
  }

  /**
   * Delete a document from the vector index
   *
   * Removes the embedding for the specified document.
   *
   * @param id - Source ID of the document to delete
   * @param sourceType - Source type of the document
   * @param organizationId - Organization ID for filtering
   * @returns void
   */
  async deleteDocument(
    id: string,
    sourceType: EmbeddingSourceType,
    organizationId: string,
  ): Promise<void> {
    await this.embeddingRepo.delete({
      sourceId: id,
      sourceType,
      organizationId,
    });
  }

  /**
   * Generate embeddings for a given text
   *
   * Calls the configured embedding provider (e.g., OpenAI) to generate
   * vector embeddings for the input text.
   *
   * @param text - The text to generate embeddings for
   * @param config - Vector search configuration
   * @returns The embedding vector as an array of numbers
   * @private
   */
  private async generateEmbedding(
    text: string,
    config: VectorSearchConfig,
  ): Promise<number[]> {
    // TODO: Implement actual API call to embedding provider
    // For now, return a placeholder implementation

    this.logger.debug(
      `Generating embedding for text (${text.length} chars) using ${config.embeddingModel}`,
    );

    if (config.provider === 'openai') {
      return await this.generateOpenAIEmbedding(text, config);
    }

    throw new Error(`Unsupported provider: ${config.provider}`);
  }

  /**
   * Generate embedding using OpenAI API
   *
   * @param text - Text to embed
   * @param config - Configuration with API key and model
   * @returns Embedding vector
   * @private
   */
  private async generateOpenAIEmbedding(
    _text: string,
    config: VectorSearchConfig,
  ): Promise<number[]> {
    // TODO: Implement actual OpenAI API call
    // This is a placeholder that should be implemented when integrating with OpenAI SDK

    this.logger.warn(
      'OpenAI embedding generation not yet implemented - returning placeholder',
    );

    // Return placeholder vector of correct dimensions
    return new Array(config.dimensions).fill(0);
  }

  /**
   * Map config embedding model to EmbeddingModelType enum
   *
   * @param config - Vector search configuration
   * @returns EmbeddingModelType
   * @private
   */
  private getModelTypeFromConfig(
    config: VectorSearchConfig,
  ): EmbeddingModelType {
    if (config.embeddingModel.includes('openai')) {
      return EmbeddingModelType.OPENAI_ADA_002;
    }
    if (config.embeddingModel.includes('ada-002')) {
      return EmbeddingModelType.OPENAI_ADA_002;
    }
    if (config.embeddingModel.includes('text-embedding-3-small')) {
      return EmbeddingModelType.OPENAI_SMALL_3;
    }
    if (config.embeddingModel.includes('text-embedding-3-large')) {
      return EmbeddingModelType.OPENAI_LARGE_3;
    }

    // Default to ada-002
    return EmbeddingModelType.OPENAI_ADA_002;
  }

  /**
   * Batch index multiple documents
   *
   * Efficiently indexes multiple documents in a batch operation.
   *
   * @param documents - Array of documents to index
   * @param sourceType - Type of the source entities
   * @param options - Indexing options
   * @returns Array of created embeddings
   */
  async batchIndexDocuments(
    documents: Array<{
      id: string;
      content: string;
      metadata?: Record<string, unknown>;
      tags?: string[];
    }>,
    sourceType: EmbeddingSourceType,
    options: {
      organizationId: string;
      projectId?: string;
      teamId?: string;
      hollonId?: string;
    },
  ): Promise<VectorEmbedding[]> {
    const results: VectorEmbedding[] = [];

    // Get configuration
    const config = await this.vectorConfigService.getOrCreateConfig(
      options.organizationId,
    );

    const batchSize = config.config.batchSize || 100;

    // Process in batches
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);

      const batchPromises = batch.map((doc) =>
        this.indexDocument(doc.id, doc.content, sourceType, doc.metadata, {
          ...options,
          tags: doc.tags,
        }),
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
=======
import { Injectable } from '@nestjs/common';

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class VectorSearchService {
  constructor() {}

  /**
   * Placeholder: Search for similar vectors
   * To be implemented when vector storage is available
   */
  async searchSimilar(
    _query: string,
    _options?: { limit?: number; threshold?: number },
  ): Promise<VectorSearchResult[]> {
    // TODO: Implement vector search logic
    return [];
  }

  /**
   * Placeholder: Store a vector embedding
   * To be implemented when vector storage is available
   */
  async storeEmbedding(
    _id: string,
    _embedding: number[],
    _metadata?: Record<string, unknown>,
  ): Promise<void> {
    // TODO: Implement vector storage logic
>>>>>>> 054d77b (feat: Add VectorSearchService dependency to PromptComposerService)
  }
}
