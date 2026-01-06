import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Organization } from '../modules/organization/entities/organization.entity';
import { Project } from '../modules/project/entities/project.entity';
import { Team } from '../modules/team/entities/team.entity';
import { Hollon } from '../modules/hollon/entities/hollon.entity';

/**
 * Embedding source type enumeration
 * Defines the type of entity or content that generated the embedding
 */
export enum EmbeddingSourceType {
  DOCUMENT = 'document',
  TASK = 'task',
  MESSAGE = 'message',
  KNOWLEDGE_ITEM = 'knowledge_item',
  CODE_SNIPPET = 'code_snippet',
  DECISION_LOG = 'decision_log',
  MEETING_RECORD = 'meeting_record',
  GRAPH_NODE = 'graph_node',
  CUSTOM = 'custom',
}

/**
 * Embedding model type enumeration
 * Tracks which embedding model was used for generation
 */
export enum EmbeddingModelType {
  OPENAI_ADA_002 = 'openai_ada_002', // 1536 dimensions
  OPENAI_SMALL_3 = 'openai_small_3', // 1536 dimensions
  OPENAI_LARGE_3 = 'openai_large_3', // 3072 dimensions
  COHERE_ENGLISH_V3 = 'cohere_english_v3', // 1024 dimensions
  CUSTOM = 'custom',
}

/**
 * VectorEmbedding entity
 * Stores vector embeddings for semantic search and similarity matching
 * Supports pgvector extension for efficient vector operations
 *
 * @param embedding - Vector representation stored as text (actual vector type set in migration)
 * @param sourceType - Type of entity that generated this embedding
 * @param sourceId - ID of the source entity
 * @param modelType - Embedding model used for generation
 * @param dimensions - Number of dimensions in the vector
 * @param content - Original text content that was embedded
 * @param metadata - Flexible JSONB field for model-specific metadata
 * @param tags - Array of tags for filtering and categorization
 * @param organizationId - Organization scope for multi-tenancy
 * @param projectId - Optional project association
 * @param teamId - Optional team association
 * @param hollonId - Optional hollon (agent) association
 */
@Entity('vector_embeddings')
@Index(['organizationId'])
@Index(['sourceType', 'sourceId'])
@Index(['modelType', 'dimensions'])
@Index(['projectId'])
@Index(['teamId'])
@Index(['hollonId'])
@Index(['tags'], { unique: false })
export class VectorEmbedding extends BaseEntity {
  /**
   * Vector embedding stored as text type in TypeScript
   * Actual vector type (e.g., vector(1536)) is set in migration
   * This is a workaround for TypeORM's lack of native pgvector support
   *
   * The vector will be stored in PostgreSQL as vector type with specific dimensions
   * Format in database: [0.1, 0.2, 0.3, ...]
   */
  @Column({ type: 'text', nullable: false })
  embedding: string;

  /**
   * Type of source entity that generated this embedding
   * Used for polymorphic relationships and filtering
   */
  @Column({
    name: 'source_type',
    type: 'enum',
    enum: EmbeddingSourceType,
  })
  sourceType: EmbeddingSourceType;

  /**
   * ID of the source entity (polymorphic reference)
   * References different tables based on sourceType
   */
  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  /**
   * Embedding model used to generate this vector
   * Important for compatibility when querying similar vectors
   */
  @Column({
    name: 'model_type',
    type: 'enum',
    enum: EmbeddingModelType,
    default: EmbeddingModelType.OPENAI_ADA_002,
  })
  modelType: EmbeddingModelType;

  /**
   * Number of dimensions in the vector
   * Must match the vector column dimension in database
   * Common values: 1536 (OpenAI), 3072 (OpenAI large), 1024 (Cohere)
   */
  @Column({ type: 'integer' })
  dimensions: number;

  /**
   * Original text content that was embedded
   * Stored for reference and debugging
   * Nullable for cases where content is stored elsewhere
   */
  @Column({ type: 'text', nullable: true })
  content: string | null;

  /**
   * Flexible metadata for embedding-specific information
   *
   * @property embeddingModelVersion - Specific version of the embedding model
   * @property processingTimestamp - When the embedding was generated
   * @property chunkIndex - Index if content was chunked
   * @property totalChunks - Total number of chunks
   * @property tokenCount - Number of tokens in the embedded content
   * @property sourceUrl - URL of the original content source
   * @property language - Language of the embedded content
   * @property quality - Quality score or confidence metric
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    embeddingModelVersion?: string;
    processingTimestamp?: string;
    chunkIndex?: number;
    totalChunks?: number;
    tokenCount?: number;
    sourceUrl?: string;
    language?: string;
    quality?: number;
    [key: string]: unknown;
  } | null;

  /**
   * Tags for categorization and filtering
   * Useful for hybrid search combining vector similarity with tag matching
   */
  @Column({ type: 'text', array: true, nullable: true })
  tags: string[] | null;

  /**
   * Organization ID for multi-tenant isolation
   * All vector searches should be scoped to organization
   */
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /**
   * Optional project association
   * Enables project-scoped vector searches
   */
  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  /**
   * Optional team association
   * Enables team-scoped vector searches
   */
  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  /**
   * Optional hollon (AI agent) association
   * Tracks which agent generated or is responsible for this embedding
   */
  @Column({ name: 'hollon_id', type: 'uuid', nullable: true })
  hollonId: string | null;

  // Relations

  /**
   * Organization relation
   * CASCADE delete ensures embeddings are removed when organization is deleted
   */
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /**
   * Project relation
   * CASCADE delete ensures embeddings are removed when project is deleted
   */
  @ManyToOne(() => Project, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  /**
   * Team relation
   * CASCADE delete ensures embeddings are removed when team is deleted
   */
  @ManyToOne(() => Team, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  /**
   * Hollon relation
   * SET NULL on delete preserves embedding when agent is removed
   */
  @ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hollon_id' })
  hollon: Hollon | null;
}
