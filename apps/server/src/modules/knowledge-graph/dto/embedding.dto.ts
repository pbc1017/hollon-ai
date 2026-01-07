import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  IsInt,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Enum defining common embedding model providers
 */
export enum EmbeddingProvider {
  OPENAI = 'openai',
  COHERE = 'cohere',
  HUGGINGFACE = 'huggingface',
  CUSTOM = 'custom',
}

/**
 * Enum defining normalization methods for embeddings
 */
export enum NormalizationMethod {
  /** L2 normalization (unit vector) */
  L2 = 'l2',
  /** Min-max normalization */
  MIN_MAX = 'min_max',
  /** No normalization */
  NONE = 'none',
}

/**
 * DTO for embedding metadata
 * Contains information about the embedding model and generation process
 */
export class EmbeddingMetadataDto {
  @IsOptional()
  @IsEnum(EmbeddingProvider)
  provider?: EmbeddingProvider;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  modelName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  modelVersion?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4096)
  dimension?: number;

  @IsOptional()
  @IsEnum(NormalizationMethod)
  normalization?: NormalizationMethod;

  @IsOptional()
  @Type(() => Date)
  generatedAt?: Date;

  @IsOptional()
  additionalMetadata?: Record<string, any>;
}

/**
 * DTO for embedding vectors
 * Represents a single embedding with its vector data and metadata
 */
export class EmbeddingDto {
  /**
   * The embedding vector as an array of floating-point numbers
   * Typical dimensions: 384, 768, 1536, 3072, 4096
   */
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(4096)
  vector: number[];

  /**
   * Dimension of the embedding vector
   * Must match the length of the vector array
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4096)
  dimension: number;

  /**
   * Optional text that was embedded to generate this vector
   */
  @IsOptional()
  @IsString()
  sourceText?: string;

  /**
   * Optional identifier for the source document/node
   */
  @IsOptional()
  @IsString()
  sourceId?: string;

  /**
   * Metadata about the embedding model and generation process
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => EmbeddingMetadataDto)
  metadata?: EmbeddingMetadataDto;

  /**
   * Whether the embedding vector is normalized
   */
  @IsOptional()
  @IsEnum(NormalizationMethod)
  normalization?: NormalizationMethod = NormalizationMethod.NONE;
}

/**
 * DTO for batch embedding operations
 * Used when generating or storing multiple embeddings at once
 */
export class BatchEmbeddingDto {
  /**
   * Array of embeddings to process
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmbeddingDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(100) // Limit batch size to prevent overwhelming the system
  embeddings: EmbeddingDto[];

  /**
   * Optional batch identifier for tracking
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  batchId?: string;

  /**
   * Shared metadata that applies to all embeddings in the batch
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => EmbeddingMetadataDto)
  sharedMetadata?: EmbeddingMetadataDto;
}

/**
 * DTO for requesting embedding generation
 * Used when client requests the system to generate embeddings
 */
export class GenerateEmbeddingDto {
  /**
   * Text to be embedded
   */
  @IsString()
  text: string;

  /**
   * Optional embedding provider to use
   * If not specified, uses the default configured provider
   */
  @IsOptional()
  @IsEnum(EmbeddingProvider)
  provider?: EmbeddingProvider;

  /**
   * Optional model name to use
   * If not specified, uses the default model for the provider
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  modelName?: string;

  /**
   * Optional normalization method to apply
   */
  @IsOptional()
  @IsEnum(NormalizationMethod)
  normalization?: NormalizationMethod = NormalizationMethod.L2;

  /**
   * Optional source identifier for tracking
   */
  @IsOptional()
  @IsString()
  sourceId?: string;
}

/**
 * DTO for batch embedding generation requests
 */
export class BatchGenerateEmbeddingDto {
  /**
   * Array of texts to be embedded
   */
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  texts: string[];

  /**
   * Optional embedding provider to use
   */
  @IsOptional()
  @IsEnum(EmbeddingProvider)
  provider?: EmbeddingProvider;

  /**
   * Optional model name to use
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  modelName?: string;

  /**
   * Optional normalization method to apply
   */
  @IsOptional()
  @IsEnum(NormalizationMethod)
  normalization?: NormalizationMethod = NormalizationMethod.L2;

  /**
   * Optional batch identifier for tracking
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  batchId?: string;
}
