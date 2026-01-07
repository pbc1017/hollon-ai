import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * VectorSearchConfig entity
 * Stores configuration for vector search and embedding generation
 *
 * This entity manages organization-specific settings for vector search operations,
 * including API credentials, model selection, and operational parameters.
 */
@Entity('vector_search_configs')
@Index(['organizationId'])
export class VectorSearchConfig extends BaseEntity {
  /**
   * Organization ID for multi-tenant isolation
   */
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /**
   * Display name for this configuration
   */
  @Column({ name: 'display_name', length: 255 })
  displayName: string;

  /**
   * Provider type (e.g., 'openai', 'anthropic', 'cohere')
   */
  @Column({ name: 'provider', length: 50, default: 'openai' })
  provider: string;

  /**
   * Embedding model name
   * Examples: 'text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large'
   */
  @Column({
    name: 'embedding_model',
    length: 100,
    default: 'text-embedding-3-small',
  })
  embeddingModel: string;

  /**
   * Number of dimensions in the embedding vector
   * Must match the model's output dimensions
   * Common values: 1536 (ada-002, 3-small), 3072 (3-large)
   */
  @Column({ name: 'dimensions', type: 'integer', default: 1536 })
  dimensions: number;

  /**
   * Configuration object for provider-specific settings
   */
  @Column({ type: 'jsonb', default: {} })
  config: {
    apiKey?: string;
    apiEndpoint?: string;
    maxTokens?: number;
    batchSize?: number;
    [key: string]: unknown;
  };

  /**
   * Similarity search configuration
   */
  @Column({ name: 'search_config', type: 'jsonb', default: {} })
  searchConfig: {
    /** Similarity threshold (0-1) for filtering results */
    similarityThreshold?: number;
    /** Default number of results to return */
    defaultLimit?: number;
    /** Maximum allowed limit per query */
    maxLimit?: number;
    /** Distance metric: 'cosine', 'l2', 'inner_product' */
    distanceMetric?: 'cosine' | 'l2' | 'inner_product';
    [key: string]: unknown;
  };

  /**
   * Cost tracking per embedding operation
   * Cost in cents per 1000 tokens
   */
  @Column({
    name: 'cost_per_1k_tokens_cents',
    type: 'decimal',
    precision: 10,
    scale: 6,
    default: 0.00002, // $0.0002 per 1K tokens for text-embedding-3-small
  })
  costPer1kTokensCents: number;

  /**
   * Whether this configuration is enabled
   */
  @Column({ default: true })
  enabled: boolean;

  /**
   * Request timeout in seconds
   */
  @Column({ name: 'timeout_seconds', default: 30 })
  timeoutSeconds: number;

  /**
   * Maximum number of retries for failed requests
   */
  @Column({ name: 'max_retries', default: 3 })
  maxRetries: number;

  /**
   * Rate limiting configuration
   */
  @Column({ name: 'rate_limit_config', type: 'jsonb', nullable: true })
  rateLimitConfig?: {
    /** Maximum requests per minute */
    maxRequestsPerMinute?: number;
    /** Maximum tokens per minute */
    maxTokensPerMinute?: number;
    [key: string]: unknown;
  };
}
