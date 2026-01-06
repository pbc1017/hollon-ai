import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Source types that can have vector embeddings
 */
export enum EmbeddingSourceType {
  DOCUMENT = 'document',
  KNOWLEDGE_ITEM = 'knowledge_item',
  MESSAGE = 'message',
  TASK = 'task',
  CODE_SNIPPET = 'code_snippet',
}

/**
 * VectorEmbedding entity for storing vector embeddings with pgvector
 *
 * This entity stores vector embeddings generated from various sources
 * (documents, messages, tasks, etc.) for semantic search and RAG.
 *
 * Note: The 'embedding' column is typed as 'text' in TypeORM but should be
 * created as 'vector(1536)' in migrations to work with pgvector extension.
 */
@Entity('vector_embeddings')
@Index(['sourceType', 'sourceId'])
@Index(['organizationId'])
@Index(['createdAt'])
export class VectorEmbedding extends BaseEntity {
  /**
   * The vector embedding (1536 dimensions for OpenAI ada-002)
   * Note: This is typed as 'text' in TypeORM but migrations should use vector(1536)
   */
  @Column({ type: 'text', nullable: false })
  embedding: string;

  /**
   * Type of the source entity
   */
  @Column({
    name: 'source_type',
    type: 'enum',
    enum: EmbeddingSourceType,
  })
  sourceType: EmbeddingSourceType;

  /**
   * ID of the source entity
   */
  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  /**
   * Organization ID for multi-tenancy
   */
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /**
   * The text content that was embedded (for reference)
   */
  @Column({ type: 'text', nullable: true })
  content: string | null;

  /**
   * Model used for generating the embedding
   */
  @Column({
    name: 'model',
    type: 'varchar',
    length: 100,
    default: 'text-embedding-ada-002',
  })
  model: string;

  /**
   * Dimension of the vector embedding
   */
  @Column({ name: 'dimensions', type: 'integer', default: 1536 })
  dimensions: number;

  /**
   * Additional metadata about the embedding
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
