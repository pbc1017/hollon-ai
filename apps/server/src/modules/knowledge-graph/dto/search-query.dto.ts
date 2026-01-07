import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  IsBoolean,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NodeType } from '../entities/node.entity';

/**
 * Enum defining the search mode for knowledge graph queries
 */
export enum SearchMode {
  /** Text-based search using query string */
  TEXT = 'text',
  /** Vector similarity search using embeddings */
  VECTOR = 'vector',
  /** Hybrid search combining text and vector approaches */
  HYBRID = 'hybrid',
}

/**
 * Enum defining similarity metrics for vector search
 */
export enum SimilarityMetric {
  /** Cosine similarity (range: -1 to 1, typically 0 to 1 for normalized vectors) */
  COSINE = 'cosine',
  /** Euclidean distance (L2 distance) */
  EUCLIDEAN = 'euclidean',
  /** Dot product similarity */
  DOT_PRODUCT = 'dot_product',
}

/**
 * DTO for pagination options in search queries
 */
export class SearchPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;
}

/**
 * DTO for filter parameters in search queries
 */
export class SearchFilterDto {
  @IsOptional()
  @IsArray()
  @IsEnum(NodeType, { each: true })
  nodeTypes?: NodeType[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  properties?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeNodeIds?: string[];
}

/**
 * DTO for knowledge graph search queries
 * Supports text search, vector similarity search, and hybrid search modes
 */
export class SearchQueryDto {
  /**
   * Text query for text-based or hybrid search
   * Required when searchMode is 'text' or 'hybrid'
   */
  @IsOptional()
  @IsString()
  query?: string;

  /**
   * Embedding vector for vector similarity search
   * Required when searchMode is 'vector' or 'hybrid'
   * Must be an array of numbers representing the embedding
   */
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(4096) // Common max dimension for embeddings (e.g., OpenAI ada-002: 1536, text-embedding-3-large: 3072)
  embedding?: number[];

  /**
   * Search mode: text, vector, or hybrid
   * Defaults to 'text' if only query is provided
   * Defaults to 'vector' if only embedding is provided
   */
  @IsOptional()
  @IsEnum(SearchMode)
  searchMode?: SearchMode = SearchMode.TEXT;

  /**
   * Similarity metric for vector search
   * Only applicable when searchMode is 'vector' or 'hybrid'
   */
  @IsOptional()
  @IsEnum(SimilarityMetric)
  similarityMetric?: SimilarityMetric = SimilarityMetric.COSINE;

  /**
   * Minimum similarity threshold for results (0.0 to 1.0)
   * Results with similarity below this threshold will be excluded
   * For cosine similarity: 0.0 (no similarity) to 1.0 (identical)
   * For euclidean distance: interpreted as max distance
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minSimilarity?: number = 0.0;

  /**
   * Maximum similarity threshold for results (0.0 to 1.0)
   * Useful for excluding exact or near-exact matches
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  maxSimilarity?: number = 1.0;

  /**
   * Filter parameters for refining search results
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => SearchFilterDto)
  filters?: SearchFilterDto;

  /**
   * Pagination options for search results
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => SearchPaginationDto)
  pagination?: SearchPaginationDto;

  /**
   * Include similarity scores in the response
   */
  @IsOptional()
  @IsBoolean()
  includeScores?: boolean = true;

  /**
   * Include node metadata (properties, tags, etc.) in the response
   */
  @IsOptional()
  @IsBoolean()
  includeMetadata?: boolean = true;

  /**
   * Weight for text search in hybrid mode (0.0 to 1.0)
   * Vector search weight = 1.0 - textWeight
   * Only applicable when searchMode is 'hybrid'
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  textWeight?: number = 0.5;
}
