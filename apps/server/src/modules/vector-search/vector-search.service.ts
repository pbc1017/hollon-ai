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

import { ConfigService } from '@nestjs/config';

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
 * Embedding provider interface for extensibility
 */
interface EmbeddingProvider {
  /**
   * Generate embeddings for text
   * @param text Input text to embed
   * @param apiKey API key for the provider
   * @returns Promise resolving to embedding vector
   */
  generateEmbedding(text: string, apiKey: string): Promise<number[]>;

  /**
   * Batch generate embeddings for multiple texts
   * @param texts Array of texts to embed
   * @param apiKey API key for the provider
   * @returns Promise resolving to array of embedding vectors
   */
  batchGenerateEmbeddings(texts: string[], apiKey: string): Promise<number[][]>;
}

/**
 * VectorSearchService
 *
 * Core service for vector search and embedding operations.
 * Integrates with OpenAI (or other providers) for embedding generation
 * and pgvector for efficient similarity search.
 *
 * Architecture:
 * - Service uses dependency injection pattern
 * - Configuration loaded from environment via ConfigService
 * - Supports multiple embedding providers via plugin interface
 * - Multi-tenant support with organization isolation
 * - Repository pattern for database access
 *
 * Key features:
 * - Generate embeddings for text content
 * - Search for similar vectors using cosine similarity
 * - Index and manage vector embeddings in PostgreSQL with pgvector
 * - Support multi-tenant isolation and scoped searches
 * - Configurable via VectorSearchConfig entity
 * - Extensible provider interface
 */
@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);
  private embeddingProviders: Map<string, EmbeddingProvider>;

  constructor(
    @InjectRepository(VectorEmbedding)
    private readonly embeddingRepo: Repository<VectorEmbedding>,
    private readonly vectorConfigService: VectorSearchConfigService,
    private readonly configService: ConfigService,
  ) {
    this.embeddingProviders = new Map();
    this.initializeProviders();
  }

  /**
   * Initialize embedding providers based on configuration
   * @private
   */
  private initializeProviders(): void {
    // Initialize OpenAI provider
    this.embeddingProviders.set('openai', {
      generateEmbedding: (text: string, apiKey: string) =>
        this.generateOpenAIEmbedding(text, apiKey),
      batchGenerateEmbeddings: (texts: string[], apiKey: string) =>
        this.batchGenerateOpenAIEmbeddings(texts, apiKey),
    });

    // Additional providers can be registered here
    this.logger.debug('Embedding providers initialized');
  }

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
    // Validate inputs
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }

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
      config.searchConfig?.similarityThreshold ??
      0.7;
    qb.andWhere(
      `1 - (embedding.embedding <=> '[${queryEmbedding.join(',')}]') >= :threshold`,
      { threshold },
    );

    // Apply limit
    const limit = options.limit ?? config.searchConfig?.defaultLimit ?? 10;
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
    // Validate inputs
    if (!id || !content || !options.organizationId) {
      throw new Error('Missing required parameters for document indexing');
    }

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
    // Validate inputs
    if (!id || !content || !organizationId) {
      throw new Error('Missing required parameters for document update');
    }

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
    if (!id || !sourceType || !organizationId) {
      throw new Error('Missing required parameters for document deletion');
    }

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
    // Validate configuration
    if (!config.provider) {
      throw new Error('Embedding provider not configured');
    }

    if (!config.config?.apiKey) {
      throw new Error('API key not configured for embedding provider');
    }

    this.logger.debug(
      `Generating embedding for text (${text.length} chars) using ${config.embeddingModel}`,
    );

    const provider = this.embeddingProviders.get(config.provider);
    if (!provider) {
      throw new Error(`Unsupported provider: ${config.provider}`);
    }

    try {
      return await provider.generateEmbedding(text, config.config.apiKey);
    } catch (error) {
      this.logger.error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Generate embedding using OpenAI API
   *
   * @param text - Text to embed
   * @param apiKey - OpenAI API key
   * @returns Embedding vector
   * @private
   */
  private async generateOpenAIEmbedding(
    _text: string,
    _apiKey: string,
  ): Promise<number[]> {
    // TODO: Implement actual OpenAI API call
    // This is a placeholder that should be implemented when integrating with OpenAI SDK
    // See: https://platform.openai.com/docs/api-reference/embeddings

    this.logger.warn(
      'OpenAI embedding generation not yet implemented - returning placeholder',
    );

    // Return placeholder vector of correct dimensions (1536 for text-embedding-3-small)
    return new Array(1536).fill(0);
  }

  /**
   * Batch generate embeddings using OpenAI API
   *
   * @param texts - Array of texts to embed
   * @param apiKey - OpenAI API key
   * @returns Array of embedding vectors
   * @private
   */
  private async batchGenerateOpenAIEmbeddings(
    _texts: string[],
    _apiKey: string,
  ): Promise<number[][]> {
    // TODO: Implement actual batch OpenAI API call
    // This should handle multiple texts efficiently

    this.logger.warn(
      'OpenAI batch embedding generation not yet implemented - returning placeholders',
    );

    // Return array of placeholder vectors
    return _texts.map(() => new Array(1536).fill(0));
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
    const model = config.embeddingModel.toLowerCase();

    if (model.includes('text-embedding-3-large')) {
      return EmbeddingModelType.OPENAI_LARGE_3;
    }
    if (model.includes('text-embedding-3-small')) {
      return EmbeddingModelType.OPENAI_SMALL_3;
    }
    if (model.includes('ada-002') || model.includes('ada')) {
      return EmbeddingModelType.OPENAI_ADA_002;
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
    // Validate inputs
    if (!documents || documents.length === 0) {
      throw new Error('Documents array cannot be empty');
    }

    const results: VectorEmbedding[] = [];

    // Get configuration
    const config = await this.vectorConfigService.getOrCreateConfig(
      options.organizationId,
    );

    const batchSize = config.config?.batchSize ?? 100;

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
  }

  /**
   * Get configuration from ConfigService
   *
   * Retrieves vector search configuration from the application's ConfigService
   * for system-wide use.
   *
   * @returns Vector search configuration object
   */
  getVectorSearchConfig(): Record<string, unknown> {
    return this.configService.get('vectorSearch') ?? {};
  }
}
