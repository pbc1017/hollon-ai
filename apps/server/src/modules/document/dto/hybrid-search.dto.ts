import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsEnum,
} from 'class-validator';

export enum SearchStrategy {
  VECTOR_ONLY = 'vector_only',
  GRAPH_ONLY = 'graph_only',
  HYBRID = 'hybrid',
}

export class HybridSearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  hollonId?: string;

  @IsOptional()
  @IsEnum(SearchStrategy)
  strategy?: SearchStrategy = SearchStrategy.HYBRID;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  vectorWeight?: number = 0.6;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  graphWeight?: number = 0.4;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minSimilarity?: number = 0.5;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  maxGraphDepth?: number = 3;
}

export interface RelationshipContext {
  type: string;
  entityId: string;
  entityType: string;
  distance: number;
  path: string[];
}

export interface HybridSearchResult {
  documentId: string;
  title: string;
  content: string;
  type: string;
  vectorScore: number;
  graphScore: number;
  combinedScore: number;
  relationships: RelationshipContext[];
  metadata: Record<string, unknown>;
  tags: string[];
}

export interface SearchMetrics {
  totalDocuments: number;
  vectorMatches: number;
  graphMatches: number;
  hybridMatches: number;
  avgVectorScore: number;
  avgGraphScore: number;
  avgCombinedScore: number;
  searchTimeMs: number;
}

export interface HybridSearchResponse {
  results: HybridSearchResult[];
  metrics: SearchMetrics;
  query: string;
  strategy: SearchStrategy;
}
