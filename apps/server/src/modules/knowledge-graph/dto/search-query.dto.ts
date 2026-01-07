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
  ValidateNested,
  IsNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NodeType } from '../entities/node.entity';

/**
 * DTO for searching knowledge graph nodes using semantic/vector similarity
 *
 * Supports multiple search modes:
 * - Text query with automatic embedding generation
 * - Direct embedding vector search
 * - Hybrid search with filters
 *
 * @example
 * {
 *   "query": "AI and machine learning concepts",
 *   "organizationId": "123e4567-e89b-12d3-a456-426614174000",
 *   "filters": {
 *     "types": ["concept", "document"],
 *     "tags": ["ai", "ml"]
 *   },
 *   "pagination": {
 *     "limit": 10,
 *     "offset": 0
 *   },
 *   "similarityThreshold": 0.7
 * }
 */
export class SearchQueryDto {
  /**
   * Text query for semantic search
   * Will be converted to embedding vector for similarity matching
   *
   * @validation
   * - Required unless embedding is provided
   * - Must be non-empty string
   * - Trimmed automatically
   *
   * @constraints
   * - Maximum length limited by embedding model token limits
   *   (typically ~8000 tokens for OpenAI models)
   *
   * @edgeCases
   * - Empty strings are rejected
   * - Very long queries may be truncated by embedding service
   * - Non-English text supported but quality varies by model
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  query?: string;

  /**
   * Pre-computed embedding vector for direct similarity search
   * Alternative to text query when embedding is already available
   *
   * @validation
   * - Optional (use query OR embedding, not both)
   * - Must be array of numbers
   * - Length must match model dimensions (1536 for OpenAI ada-002/small-3)
   *
   * @constraints
   * - Array size: 1024-3072 dimensions (model-dependent)
   * - Values typically normalized to [-1, 1] range for cosine similarity
   *
   * @edgeCases
   * - Empty arrays are rejected
   * - Dimension mismatch returns validation error
   * - Non-normalized vectors may produce unexpected similarity scores
   */
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1024)
  @ArrayMaxSize(3072)
  embedding?: number[];

  /**
   * Organization ID for multi-tenant isolation
   * All searches are scoped to a single organization
   *
   * @validation
   * - Required field
   * - Must be valid UUID v4
   *
   * @constraints
   * - Must reference existing organization
   *
   * @edgeCases
   * - Non-existent organization IDs return empty results
   * - Ensures data isolation between tenants
   */
  @IsUUID()
  organizationId: string;

  /**
   * Optional filters for hybrid search
   * Combines vector similarity with traditional filtering
   *
   * @validation
   * - Optional object
   * - Nested properties validated individually
   *
   * @constraints
   * - All filter conditions are AND-ed together
   * - Empty filters object is allowed (no filtering)
   *
   * @edgeCases
   * - Overly restrictive filters may return no results
   * - Null/undefined treated as "no filters applied"
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => SearchFiltersDto)
  filters?: SearchFiltersDto;

  /**
   * Pagination options for result limiting and offset
   *
   * @validation
   * - Optional (defaults applied if omitted)
   * - Nested properties validated individually
   *
   * @constraints
   * - Limit: 1-100 results per request
   * - Offset: 0 to total_results - 1
   *
   * @edgeCases
   * - Large offsets may impact performance (use cursor-based pagination for production)
   * - Offset beyond total results returns empty array
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => PaginationOptionsDto)
  pagination?: PaginationOptionsDto;

  /**
   * Minimum similarity threshold for results
   * Uses cosine similarity metric (higher = more similar)
   *
   * @validation
   * - Optional (defaults to 0 if omitted)
   * - Must be number between 0 and 1
   *
   * @constraints
   * - Range: 0.0 (no similarity) to 1.0 (identical)
   * - Typical useful range: 0.5-0.9
   * - Values below 0.5 often return semantically unrelated results
   *
   * @edgeCases
   * - 0.0: Returns all results (no filtering by similarity)
   * - 1.0: Only exact/near-exact matches (very restrictive)
   * - 0.7-0.8: Recommended default for semantic search
   *
   * @formula
   * Cosine Similarity = (A · B) / (||A|| × ||B||)
   * where A and B are embedding vectors
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  similarityThreshold?: number = 0.0;
}

/**
 * Search filters for hybrid search combining vector similarity with traditional filters
 */
export class SearchFiltersDto {
  /**
   * Filter by node types
   *
   * @validation
   * - Optional array
   * - Each element must be valid NodeType enum value
   *
   * @constraints
   * - Empty array returns no results (too restrictive)
   * - Null/undefined means "all types"
   *
   * @edgeCases
   * - Duplicate types are allowed but redundant
   * - Invalid enum values rejected by validator
   */
  @IsOptional()
  @IsArray()
  @IsEnum(NodeType, { each: true })
  types?: NodeType[];

  /**
   * Filter by tags (exact match, case-sensitive)
   *
   * @validation
   * - Optional array of strings
   * - Each tag must be non-empty
   *
   * @constraints
   * - Tags are AND-ed (node must have ALL specified tags)
   * - Case-sensitive matching
   *
   * @edgeCases
   * - Empty array or null/undefined means "no tag filtering"
   * - Nodes without any tags excluded if tags filter is specified
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /**
   * Filter by project ID
   *
   * @validation
   * - Optional UUID
   *
   * @constraints
   * - Must reference existing project
   *
   * @edgeCases
   * - Non-existent project IDs return empty results
   * - Null/undefined means "all projects"
   */
  @IsOptional()
  @IsUUID()
  projectId?: string;

  /**
   * Filter by team ID
   *
   * @validation
   * - Optional UUID
   *
   * @constraints
   * - Must reference existing team
   *
   * @edgeCases
   * - Non-existent team IDs return empty results
   * - Null/undefined means "all teams"
   */
  @IsOptional()
  @IsUUID()
  teamId?: string;

  /**
   * Filter by active status
   *
   * @validation
   * - Optional boolean
   *
   * @constraints
   * - true: Only active nodes
   * - false: Only inactive nodes
   * - undefined: Both active and inactive
   *
   * @edgeCases
   * - Soft-deleted nodes (isActive=false) excluded by default
   */
  @IsOptional()
  isActive?: boolean;
}

/**
 * Pagination options for search results
 */
export class PaginationOptionsDto {
  /**
   * Maximum number of results to return
   *
   * @validation
   * - Optional (defaults to 10)
   * - Must be integer between 1 and 100
   *
   * @constraints
   * - Max 100 to prevent excessive memory usage
   * - Min 1 (must return at least one result if available)
   *
   * @edgeCases
   * - Values > 100 rejected by validator
   * - Large limits may impact performance
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  /**
   * Number of results to skip (for pagination)
   *
   * @validation
   * - Optional (defaults to 0)
   * - Must be non-negative integer
   *
   * @constraints
   * - Min 0 (start from beginning)
   * - No max limit (but large offsets are inefficient)
   *
   * @edgeCases
   * - Offset >= total_results returns empty array
   * - Large offsets (>1000) may have performance issues
   * - Consider cursor-based pagination for large datasets
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}
