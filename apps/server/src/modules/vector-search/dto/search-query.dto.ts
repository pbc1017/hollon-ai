import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmbeddingSourceType } from '../../../entities/vector-embedding.entity';

/**
 * DTO for vector search query requests
 *
 * Supports semantic search using text queries with automatic embedding generation.
 */
export class VectorSearchQueryDto {
  /**
   * Text query for semantic search
   * Will be converted to embedding vector for similarity matching
   */
  @IsString()
  @IsNotEmpty()
  query: string;

  /**
   * Organization ID for multi-tenant isolation
   * All searches are scoped to a single organization
   */
  @IsUUID()
  organizationId: string;

  /**
   * Optional project ID for project-scoped search
   */
  @IsOptional()
  @IsUUID()
  projectId?: string;

  /**
   * Optional team ID for team-scoped search
   */
  @IsOptional()
  @IsUUID()
  teamId?: string;

  /**
   * Filter by source types
   */
  @IsOptional()
  @IsArray()
  @IsEnum(EmbeddingSourceType, { each: true })
  sourceTypes?: EmbeddingSourceType[];

  /**
   * Minimum similarity threshold (0-1)
   * Higher values return more similar results
   * Recommended range: 0.7-0.9
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  similarityThreshold?: number;

  /**
   * Maximum number of results to return
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  /**
   * Tags to filter by
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
