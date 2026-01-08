import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsArray,
  IsNotEmpty,
} from 'class-validator';
import { EmbeddingSourceType } from '../../../entities/vector-embedding.entity';

/**
 * DTO for indexing a document for vector search
 */
export class IndexDocumentDto {
  /**
   * Unique identifier for the document
   */
  @IsUUID()
  id: string;

  /**
   * The text content to be indexed
   */
  @IsString()
  @IsNotEmpty()
  content: string;

  /**
   * Type of the source entity
   */
  @IsEnum(EmbeddingSourceType)
  sourceType: EmbeddingSourceType;

  /**
   * Organization ID for multi-tenant isolation
   */
  @IsUUID()
  organizationId: string;

  /**
   * Optional project ID
   */
  @IsOptional()
  @IsUUID()
  projectId?: string;

  /**
   * Optional team ID
   */
  @IsOptional()
  @IsUUID()
  teamId?: string;

  /**
   * Optional hollon ID
   */
  @IsOptional()
  @IsUUID()
  hollonId?: string;

  /**
   * Optional tags for categorization
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /**
   * Additional metadata
   */
  @IsOptional()
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating an existing document's embedding
 */
export class UpdateDocumentDto {
  /**
   * Updated text content
   */
  @IsString()
  @IsNotEmpty()
  content: string;
}

/**
 * DTO for batch indexing documents
 */
export class BatchIndexDocumentDto {
  /**
   * Array of documents to index
   */
  @IsArray()
  documents: Array<{
    id: string;
    content: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }>;

  /**
   * Type of the source entities
   */
  @IsEnum(EmbeddingSourceType)
  sourceType: EmbeddingSourceType;

  /**
   * Organization ID for multi-tenant isolation
   */
  @IsUUID()
  organizationId: string;

  /**
   * Optional project ID
   */
  @IsOptional()
  @IsUUID()
  projectId?: string;

  /**
   * Optional team ID
   */
  @IsOptional()
  @IsUUID()
  teamId?: string;

  /**
   * Optional hollon ID
   */
  @IsOptional()
  @IsUUID()
  hollonId?: string;
}
