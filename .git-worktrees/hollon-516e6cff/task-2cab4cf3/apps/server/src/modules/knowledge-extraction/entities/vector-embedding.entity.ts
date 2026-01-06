import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Organization } from '../../organization/entities/organization.entity';

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
 * Note: The 'embedding' column is typed as 'text' in TypeORM but must be
 * created as 'vector(1536)' in migrations to work with pgvector extension.
 * TypeORM doesn't natively support the pgvector 'vector' type, so we use
 * a transformer to convert between number arrays and pgvector's string format.
 */
@Entity('vector_embeddings')
@Index(['sourceType', 'sourceId'])
@Index(['organizationId'])
@Index(['createdAt'])
export class VectorEmbedding extends BaseEntity {
  /**
   * The vector embedding (1536 dimensions for OpenAI ada-002)
   *
   * Stored as pgvector's vector type in the database for efficient similarity search.
   * The transformer converts between TypeScript number arrays and pgvector's string format.
   *
   * Format: Array is stored as pgvector string '[1,2,3,...]'
   */
  @Column({
    type: 'text',
    nullable: false,
    transformer: {
      to: (value: number[] | string) => {
        // Convert array to pgvector format: [1,2,3] -> '[1,2,3]'
        if (Array.isArray(value)) {
          return `[${value.join(',')}]`;
        }
        return value;
      },
      from: (value: string) => {
        // Convert pgvector format to array: '[1,2,3]' -> [1,2,3]
        if (
          typeof value === 'string' &&
          value.startsWith('[') &&
          value.endsWith(']')
        ) {
          return value
            .slice(1, -1)
            .split(',')
            .map((x) => parseFloat(x.trim()));
        }
        return value;
      },
    },
  })
  embedding: number[] | string;

  /**
   * Type of the source entity (document, knowledge_item, message, etc.)
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
   * The text content that was embedded (for reference and debugging)
   */
  @Column({ type: 'text', nullable: true })
  content: string | null;

  /**
   * Model used for generating the embedding (e.g., 'text-embedding-ada-002', 'text-embedding-3-small')
   */
  @Column({
    name: 'model',
    type: 'varchar',
    length: 100,
    default: 'text-embedding-ada-002',
  })
  model: string;

  /**
   * Dimension of the vector embedding (typically 1536 for ada-002, 1536 for 3-small, 3072 for 3-large)
   */
  @Column({ name: 'dimensions', type: 'integer', default: 1536 })
  dimensions: number;

  /**
   * Additional metadata about the embedding (e.g., chunk index, token count, etc.)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  // Relations

  /**
   * Organization that owns this embedding
   */
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
