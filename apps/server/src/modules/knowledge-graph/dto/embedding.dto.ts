import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  IsEnum,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
  IsObject,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EmbeddingSourceType,
  EmbeddingModelType,
} from '../../../entities/vector-embedding.entity';

/**
 * DTO for creating and managing vector embeddings
 *
 * Used for:
 * - Storing pre-computed embeddings
 * - Requesting embedding generation
 * - Updating existing embeddings
 *
 * @example
 * {
 *   "embedding": [0.123, -0.456, 0.789, ...], // 1536 dimensions
 *   "sourceType": "graph_node",
 *   "sourceId": "123e4567-e89b-12d3-a456-426614174000",
 *   "modelType": "openai_small_3",
 *   "dimensions": 1536,
 *   "content": "AI and machine learning concepts for knowledge representation",
 *   "organizationId": "123e4567-e89b-12d3-a456-426614174000",
 *   "metadata": {
 *     "embeddingModelVersion": "text-embedding-3-small",
 *     "tokenCount": 12
 *   }
 * }
 */
export class EmbeddingDto {
  /**
   * Vector embedding as array of numbers
   *
   * @validation
   * - Required field
   * - Must be array of numbers
   * - Size must match declared dimensions field
   * - Common sizes: 1024, 1536, 3072
   *
   * @constraints
   * - Min size: 1024 (Cohere models)
   * - Max size: 3072 (OpenAI large models)
   * - Values typically in range [-1, 1] for normalized vectors
   * - Storage: ~4 bytes per dimension (~6KB for 1536-d vector)
   *
   * @edgeCases
   * - Empty arrays rejected
   * - Non-numeric values rejected
   * - Dimension mismatch with 'dimensions' field returns error
   * - Unnormalized vectors accepted but may affect similarity scores
   * - NaN or Infinity values should be rejected
   *
   * @format
   * Stored as PostgreSQL vector type in database
   * Format in DB: [0.1, 0.2, 0.3, ...]
   * TypeORM represents as text, actual type set in migration
   */
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1024)
  @ArrayMaxSize(3072)
  embedding: number[];

  /**
   * Type of source entity that generated this embedding
   *
   * @validation
   * - Required field
   * - Must be valid EmbeddingSourceType enum value
   *
   * @constraints
   * - Used for polymorphic relationships
   * - Must correspond to actual entity type referenced by sourceId
   *
   * @edgeCases
   * - Mismatched sourceType and sourceId leads to orphaned records
   * - CUSTOM type requires careful documentation in metadata
   *
   * @values
   * - DOCUMENT: Text documents, files, reports
   * - TASK: Task descriptions, requirements
   * - MESSAGE: Chat messages, communications
   * - KNOWLEDGE_ITEM: Extracted knowledge entities
   * - CODE_SNIPPET: Source code fragments
   * - DECISION_LOG: Decision records, meeting notes
   * - MEETING_RECORD: Meeting summaries, transcripts
   * - GRAPH_NODE: Knowledge graph nodes (THIS MODULE)
   * - CUSTOM: Custom entity types
   */
  @IsEnum(EmbeddingSourceType)
  sourceType: EmbeddingSourceType;

  /**
   * UUID of the source entity
   *
   * @validation
   * - Required field
   * - Must be valid UUID v4
   *
   * @constraints
   * - Should reference existing entity of type specified in sourceType
   * - Polymorphic reference (points to different tables)
   *
   * @edgeCases
   * - Referential integrity not enforced at DB level (polymorphic)
   * - Orphaned embeddings if source entity is deleted without CASCADE
   * - Multiple embeddings for same source allowed (different models/versions)
   */
  @IsUUID()
  sourceId: string;

  /**
   * Embedding model used for generation
   *
   * @validation
   * - Required field
   * - Must be valid EmbeddingModelType enum value
   *
   * @constraints
   * - Must match actual model used to generate embedding
   * - Critical for similarity search (don't mix different models)
   *
   * @edgeCases
   * - Mixing embeddings from different models gives invalid similarity scores
   * - CUSTOM type requires metadata.embeddingModelVersion for tracking
   *
   * @values
   * - OPENAI_ADA_002: text-embedding-ada-002 (1536-d, legacy)
   * - OPENAI_SMALL_3: text-embedding-3-small (1536-d, recommended)
   * - OPENAI_LARGE_3: text-embedding-3-large (3072-d, highest quality)
   * - COHERE_ENGLISH_V3: embed-english-v3.0 (1024-d)
   * - CUSTOM: Custom or third-party models
   *
   * @defaultValue OPENAI_ADA_002
   */
  @IsEnum(EmbeddingModelType)
  modelType: EmbeddingModelType;

  /**
   * Number of dimensions in the embedding vector
   *
   * @validation
   * - Required field
   * - Must be positive integer
   * - Must match embedding array length
   *
   * @constraints
   * - Common values: 1024, 1536, 3072
   * - Must match database vector column size
   * - Must match modelType's expected dimensions
   *
   * @edgeCases
   * - Mismatch with embedding.length returns validation error
   * - Mismatch with DB vector column size causes DB error
   * - Mismatch with model's output size indicates data corruption
   *
   * @modelDimensions
   * - OpenAI ada-002: 1536
   * - OpenAI small-3: 1536
   * - OpenAI large-3: 3072
   * - Cohere english-v3: 1024
   */
  @IsInt()
  @Min(1)
  @Max(4096)
  dimensions: number;

  /**
   * Original text content that was embedded
   *
   * @validation
   * - Optional field
   * - Must be non-empty string if provided
   *
   * @constraints
   * - Stored for reference and debugging
   * - Not used for search (use embedding vector instead)
   * - May be truncated if very long (model token limits)
   *
   * @edgeCases
   * - Null/undefined allowed (content may be stored elsewhere)
   * - Very long content may exceed text column limits
   * - Should match the text that generated the embedding
   * - Empty strings converted to null
   *
   * @storage
   * Stored as PostgreSQL TEXT type (unlimited length)
   * Consider storing elsewhere if content is very large
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string | null;

  /**
   * Organization ID for multi-tenant isolation
   *
   * @validation
   * - Required field
   * - Must be valid UUID v4
   *
   * @constraints
   * - Must reference existing organization
   * - All embeddings scoped to organization
   * - CASCADE delete on organization removal
   *
   * @edgeCases
   * - Non-existent organization ID causes FK constraint error
   * - Ensures data isolation between tenants
   */
  @IsUUID()
  organizationId: string;

  /**
   * Optional project association
   *
   * @validation
   * - Optional UUID
   *
   * @constraints
   * - Must reference existing project if provided
   * - Enables project-scoped searches
   * - CASCADE delete on project removal
   *
   * @edgeCases
   * - Null/undefined means "not associated with specific project"
   * - Non-existent project ID causes FK constraint error
   * - Project must belong to same organization
   */
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  /**
   * Optional team association
   *
   * @validation
   * - Optional UUID
   *
   * @constraints
   * - Must reference existing team if provided
   * - Enables team-scoped searches
   * - CASCADE delete on team removal
   *
   * @edgeCases
   * - Null/undefined means "not associated with specific team"
   * - Non-existent team ID causes FK constraint error
   * - Team must belong to same organization
   */
  @IsOptional()
  @IsUUID()
  teamId?: string | null;

  /**
   * Optional hollon (AI agent) association
   *
   * @validation
   * - Optional UUID
   *
   * @constraints
   * - Must reference existing hollon if provided
   * - Tracks which agent generated the embedding
   * - SET NULL on hollon deletion (preserve embedding)
   *
   * @edgeCases
   * - Null/undefined means "not generated by specific agent"
   * - Non-existent hollon ID causes FK constraint error
   * - Useful for tracking agent-generated embeddings
   */
  @IsOptional()
  @IsUUID()
  hollonId?: string | null;

  /**
   * Flexible metadata for embedding-specific information
   *
   * @validation
   * - Optional object
   * - Nested properties validated if provided
   *
   * @constraints
   * - Stored as JSONB in PostgreSQL
   * - Flexible schema for model-specific data
   *
   * @edgeCases
   * - Null/undefined allowed
   * - Large metadata objects may impact performance
   * - Avoid storing sensitive data in metadata
   *
   * @properties
   * - embeddingModelVersion: Specific model version (e.g., "text-embedding-3-small")
   * - processingTimestamp: ISO timestamp of embedding generation
   * - chunkIndex: Index if content was chunked (0-based)
   * - totalChunks: Total number of chunks for the source
   * - tokenCount: Number of tokens in embedded content
   * - sourceUrl: URL of original content source
   * - language: Language code (e.g., "en", "ko")
   * - quality: Quality score or confidence metric (0-1)
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => EmbeddingMetadataDto)
  metadata?: EmbeddingMetadataDto | null;

  /**
   * Tags for categorization and filtering
   *
   * @validation
   * - Optional array of strings
   * - Each tag must be non-empty
   *
   * @constraints
   * - Used for hybrid search (vector + tag filtering)
   * - Case-sensitive
   * - Max length per tag: 255 characters
   *
   * @edgeCases
   * - Null/undefined means "no tags"
   * - Empty array means "no tags"
   * - Duplicate tags allowed but redundant
   * - Very long tag arrays may impact index performance
   *
   * @examples
   * - ["ai", "ml", "nlp"]
   * - ["high-priority", "technical-debt"]
   * - ["concept", "architecture"]
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  tags?: string[] | null;
}

/**
 * Metadata for embedding-specific information
 */
export class EmbeddingMetadataDto {
  /**
   * Specific version of the embedding model
   *
   * @validation
   * - Optional string
   *
   * @examples
   * - "text-embedding-3-small"
   * - "text-embedding-3-large"
   * - "embed-english-v3.0"
   */
  @IsOptional()
  @IsString()
  embeddingModelVersion?: string;

  /**
   * ISO timestamp of embedding generation
   *
   * @validation
   * - Optional string in ISO 8601 format
   *
   * @example
   * "2024-01-07T12:00:00Z"
   */
  @IsOptional()
  @IsString()
  processingTimestamp?: string;

  /**
   * Index if content was chunked (0-based)
   *
   * @validation
   * - Optional non-negative integer
   *
   * @constraints
   * - 0-based indexing
   * - Must be < totalChunks if totalChunks is set
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  chunkIndex?: number;

  /**
   * Total number of chunks for the source
   *
   * @validation
   * - Optional positive integer
   *
   * @constraints
   * - Must be >= 1 if set
   * - Should match number of embeddings for same source
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  totalChunks?: number;

  /**
   * Number of tokens in embedded content
   *
   * @validation
   * - Optional positive integer
   *
   * @constraints
   * - Model-specific token limits
   * - OpenAI: ~8000 tokens max
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  tokenCount?: number;

  /**
   * URL of original content source
   *
   * @validation
   * - Optional string
   *
   * @example
   * "https://docs.example.com/page.html"
   */
  @IsOptional()
  @IsString()
  sourceUrl?: string;

  /**
   * Language code of embedded content
   *
   * @validation
   * - Optional string (ISO 639-1 recommended)
   *
   * @examples
   * - "en" (English)
   * - "ko" (Korean)
   * - "es" (Spanish)
   */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  /**
   * Quality score or confidence metric
   *
   * @validation
   * - Optional number between 0 and 1
   *
   * @constraints
   * - 0.0 = lowest quality
   * - 1.0 = highest quality
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  quality?: number;

  /**
   * Additional custom properties
   * Allows for model-specific or application-specific metadata
   */
  [key: string]: unknown;
}

/**
 * DTO for requesting embedding generation from text
 *
 * @example
 * {
 *   "content": "AI and machine learning concepts",
 *   "modelType": "openai_small_3",
 *   "sourceType": "graph_node",
 *   "sourceId": "123e4567-e89b-12d3-a456-426614174000",
 *   "organizationId": "123e4567-e89b-12d3-a456-426614174000"
 * }
 */
export class GenerateEmbeddingDto {
  /**
   * Text content to generate embedding for
   *
   * @validation
   * - Required field
   * - Must be non-empty string
   *
   * @constraints
   * - Token limits vary by model (~8000 tokens for OpenAI)
   * - Very long text may be truncated
   *
   * @edgeCases
   * - Empty strings rejected
   * - Whitespace-only strings rejected
   * - Special characters and unicode supported
   */
  @IsString()
  @IsNotEmpty()
  content: string;

  /**
   * Embedding model to use for generation
   *
   * @validation
   * - Optional (defaults to OPENAI_ADA_002)
   * - Must be valid EmbeddingModelType enum value
   *
   * @defaultValue OPENAI_ADA_002
   */
  @IsOptional()
  @IsEnum(EmbeddingModelType)
  modelType?: EmbeddingModelType = EmbeddingModelType.OPENAI_ADA_002;

  /**
   * Type of source entity
   *
   * @validation
   * - Required field
   * - Must be valid EmbeddingSourceType enum value
   */
  @IsEnum(EmbeddingSourceType)
  sourceType: EmbeddingSourceType;

  /**
   * UUID of the source entity
   *
   * @validation
   * - Required field
   * - Must be valid UUID v4
   */
  @IsUUID()
  sourceId: string;

  /**
   * Organization ID for multi-tenant isolation
   *
   * @validation
   * - Required field
   * - Must be valid UUID v4
   */
  @IsUUID()
  organizationId: string;

  /**
   * Optional project association
   *
   * @validation
   * - Optional UUID
   */
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  /**
   * Optional team association
   *
   * @validation
   * - Optional UUID
   */
  @IsOptional()
  @IsUUID()
  teamId?: string | null;

  /**
   * Optional hollon (AI agent) association
   *
   * @validation
   * - Optional UUID
   */
  @IsOptional()
  @IsUUID()
  hollonId?: string | null;

  /**
   * Optional tags for categorization
   *
   * @validation
   * - Optional array of strings
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  tags?: string[] | null;

  /**
   * Optional metadata
   *
   * @validation
   * - Optional object
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
