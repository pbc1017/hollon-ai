import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsArray,
  IsObject,
  IsDate,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  IsIn,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NodeType } from '../entities/node.entity';
import { RelationshipType } from '../../../knowledge/enums/relationship-type.enum';
import {
  StorageStrategy,
  MergeStrategy,
  UpdateOperationType,
} from '../interfaces/graph.interface';

/**
 * Base Graph Query DTO
 *
 * Common query parameters for filtering graph data.
 */
export class BaseGraphQueryDto {
  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean = false;
}

/**
 * Pagination DTO
 *
 * Reusable pagination parameters.
 */
export class PaginationDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Sort DTO
 *
 * Reusable sorting parameters.
 */
export class SortDto {
  @IsString()
  field: string;

  @IsEnum(['ASC', 'DESC'])
  order: 'ASC' | 'DESC';
}

/**
 * Date Range DTO
 *
 * Date range filtering for temporal queries.
 */
export class DateRangeDto {
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;
}

/**
 * Graph Query DTO
 *
 * Advanced query parameters for searching the knowledge graph.
 */
export class GraphQueryDto extends BaseGraphQueryDto {
  @IsOptional()
  @IsArray()
  @IsEnum(NodeType, { each: true })
  nodeTypes?: NodeType[];

  @IsOptional()
  @IsArray()
  @IsEnum(RelationshipType, { each: true })
  edgeTypes?: RelationshipType[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  matchAllTags?: boolean = false;

  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;

  @IsOptional()
  @IsString()
  searchQuery?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  dateRange?: DateRangeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaginationDto)
  pagination?: PaginationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SortDto)
  sort?: SortDto;
}

/**
 * Graph Traversal Options DTO
 *
 * Configuration for graph traversal operations.
 */
export class GraphTraversalOptionsDto {
  @IsNumber()
  @Min(1)
  @Max(10)
  maxDepth: number;

  @IsEnum(['in', 'out', 'both'])
  direction: 'in' | 'out' | 'both' = 'both';

  @IsOptional()
  @IsArray()
  @IsEnum(RelationshipType, { each: true })
  edgeTypes?: RelationshipType[];

  @IsOptional()
  @IsArray()
  @IsEnum(NodeType, { each: true })
  nodeTypes?: NodeType[];

  @IsOptional()
  @IsArray()
  @IsEnum(NodeType, { each: true })
  stopAtNodeTypes?: NodeType[];

  @IsOptional()
  @IsBoolean()
  includeEdges?: boolean = false;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxNodes?: number;
}

/**
 * Bulk Create Nodes DTO
 *
 * Create multiple nodes in a single transaction.
 */
export class BulkCreateNodesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => Object) // Will be validated by CreateNodeDto
  nodes: Array<{
    name: string;
    type: NodeType;
    description?: string | null;
    organizationId: string;
    properties?: Record<string, any>;
    tags?: string[];
  }>;
}

/**
 * Bulk Create Edges DTO
 *
 * Create multiple edges in a single transaction.
 */
export class BulkCreateEdgesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => Object)
  edges: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    type: RelationshipType;
    organizationId: string;
    weight?: number;
    properties?: Record<string, any>;
  }>;
}

/**
 * Bulk Delete DTO
 *
 * Delete multiple nodes or edges by IDs.
 */
export class BulkDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsUUID('4', { each: true })
  ids: string[];
}

/**
 * Tag Management - Add Tags DTO
 */
export class AddTagsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags: string[];
}

/**
 * Tag Management - Remove Tags DTO
 */
export class RemoveTagsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tags: string[];
}

/**
 * Tag Management - Find By Tags DTO
 */
export class FindByTagsDto extends BaseGraphQueryDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tags: string[];

  @IsOptional()
  @IsBoolean()
  matchAll?: boolean = false;
}

/**
 * Property Query DTO
 *
 * Query nodes or edges by JSONB properties.
 */
export class PropertyQueryDto extends BaseGraphQueryDto {
  @IsString()
  @MaxLength(255)
  propertyKey: string;

  @IsOptional()
  propertyValue?: any;
}

/**
 * Update Node Property DTO
 *
 * Update a single property in a node's JSONB field.
 */
export class UpdateNodePropertyDto {
  @IsString()
  @MaxLength(255)
  propertyPath: string;

  value: any;
}

/**
 * Advanced Search DTO
 *
 * Combined search across nodes and edges with multiple filters.
 */
export class AdvancedSearchDto extends GraphQueryDto {
  @IsOptional()
  @IsBoolean()
  includeNodes?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeEdges?: boolean = true;
}

/**
 * Recently Modified Query DTO
 *
 * Find recently modified nodes.
 */
export class RecentlyModifiedDto extends BaseGraphQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

/**
 * Export Subgraph DTO
 *
 * Parameters for exporting a subgraph.
 */
export class ExportSubgraphDto {
  @IsUUID()
  nodeId: string;

  @IsNumber()
  @Min(1)
  @Max(10)
  depth: number;

  @IsOptional()
  @IsBoolean()
  includeMetadata?: boolean = true;
}

/**
 * Import Node DTO
 *
 * Node data for import operations (without auto-generated fields).
 */
export class ImportNodeDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsEnum(NodeType)
  type: NodeType;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Import Edge DTO
 *
 * Edge data for import operations (without auto-generated fields).
 */
export class ImportEdgeDto {
  @IsUUID()
  sourceNodeId: string;

  @IsUUID()
  targetNodeId: string;

  @IsEnum(RelationshipType)
  type: RelationshipType;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Import Subgraph DTO
 *
 * Complete subgraph data for import.
 */
export class ImportSubgraphDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportNodeDto)
  nodes: ImportNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportEdgeDto)
  edges: ImportEdgeDto[];

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsBoolean()
  preserveIds?: boolean = false;
}

/**
 * Clone Subgraph DTO
 *
 * Parameters for cloning a subgraph to another organization.
 */
export class CloneSubgraphDto {
  @IsUUID()
  sourceNodeId: string;

  @IsUUID()
  targetOrganizationId: string;

  @IsNumber()
  @Min(1)
  @Max(10)
  depth: number;
}

/**
 * Merge Nodes DTO
 *
 * Parameters for merging two nodes.
 */
export class MergeNodesDto {
  @IsUUID()
  sourceNodeId: string;

  @IsUUID()
  targetNodeId: string;

  @IsEnum(MergeStrategy)
  strategy: MergeStrategy;
}

/**
 * Duplicate Node DTO
 *
 * Parameters for duplicating a node.
 */
export class DuplicateNodeDto {
  @IsUUID()
  nodeId: string;

  @IsOptional()
  @IsBoolean()
  includeTags?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeProperties?: boolean = true;
}

/**
 * Detect Duplicates DTO
 *
 * Parameters for detecting duplicate nodes.
 */
export class DetectDuplicatesDto extends BaseGraphQueryDto {
  @IsOptional()
  @IsUUID()
  nodeId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number = 0.8;
}

/**
 * Auto Merge Duplicates DTO
 *
 * Parameters for automatically merging high-confidence duplicates.
 */
export class AutoMergeDuplicatesDto extends BaseGraphQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceThreshold?: number = 0.95;

  @IsOptional()
  @IsEnum(MergeStrategy)
  defaultStrategy?: MergeStrategy = MergeStrategy.MERGE_PROPERTIES;
}

/**
 * Graph Statistics Query DTO
 *
 * Query parameters for graph statistics.
 */
export class GraphStatisticsQueryDto extends BaseGraphQueryDto {
  @IsOptional()
  @IsArray()
  @IsEnum(NodeType, { each: true })
  nodeTypes?: NodeType[];

  @IsOptional()
  @IsArray()
  @IsEnum(RelationshipType, { each: true })
  edgeTypes?: RelationshipType[];
}

/**
 * Update Operation DTO
 *
 * Represents an incremental update operation.
 */
export class UpdateOperationDto {
  @IsEnum(UpdateOperationType)
  type: UpdateOperationType;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsObject()
  node?: Partial<{
    id: string;
    name: string;
    type: NodeType;
    description: string | null;
    properties: Record<string, any>;
    tags: string[];
    isActive: boolean;
  }>;

  @IsOptional()
  @IsObject()
  edge?: Partial<{
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    type: RelationshipType;
    weight: number;
    properties: Record<string, any>;
    isActive: boolean;
  }>;

  @IsOptional()
  @IsUUID()
  sourceNodeId?: string;

  @IsOptional()
  @IsUUID()
  targetNodeId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * Batch Update Operations DTO
 *
 * Apply multiple updates in sequence.
 */
export class BatchUpdateOperationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UpdateOperationDto)
  operations: UpdateOperationDto[];
}

/**
 * Rollback Operations DTO
 *
 * Rollback the last N operations.
 */
export class RollbackOperationsDto extends BaseGraphQueryDto {
  @IsNumber()
  @Min(1)
  @Max(100)
  count: number;
}

/**
 * Update History Query DTO
 *
 * Query parameters for update history.
 */
export class UpdateHistoryQueryDto extends BaseGraphQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 100;

  @IsOptional()
  @IsEnum(UpdateOperationType)
  operationType?: UpdateOperationType;

  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  dateRange?: DateRangeDto;
}

/**
 * Graph Configuration Update DTO
 *
 * Parameters for updating graph configuration.
 */
export class GraphConfigurationUpdateDto {
  @IsOptional()
  @IsEnum(StorageStrategy)
  storageStrategy?: StorageStrategy;

  @IsOptional()
  @IsBoolean()
  enableDuplicateDetection?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  duplicateThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  autoMergeThreshold?: number;

  @IsOptional()
  @IsEnum(MergeStrategy)
  defaultMergeStrategy?: MergeStrategy;

  @IsOptional()
  @IsBoolean()
  enableIncrementalUpdates?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxUpdateHistory?: number;

  @IsOptional()
  @IsBoolean()
  enableEmbeddings?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(128)
  @Max(2048)
  embeddingDimension?: number;

  @IsOptional()
  @IsNumber()
  @Min(100)
  cacheSize?: number;

  @IsOptional()
  @IsBoolean()
  enableAnalytics?: boolean;
}

/**
 * Register Integration Point DTO
 *
 * Register a new integration point with the knowledge graph.
 */
export class RegisterIntegrationDto {
  @IsString()
  @MaxLength(100)
  moduleName: string;

  @IsEnum(['read', 'write', 'bidirectional'])
  integrationType: 'read' | 'write' | 'bidirectional';

  @IsArray()
  @IsEnum(NodeType, { each: true })
  supportedNodeTypes: NodeType[];

  @IsArray()
  @IsEnum(RelationshipType, { each: true })
  supportedEdgeTypes: RelationshipType[];
}

/**
 * Find Path DTO
 *
 * Parameters for finding a path between two nodes.
 */
export class FindPathDto {
  @IsUUID()
  sourceNodeId: string;

  @IsUUID()
  targetNodeId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxDepth?: number = 5;

  @IsOptional()
  @IsArray()
  @IsEnum(RelationshipType, { each: true })
  allowedEdgeTypes?: RelationshipType[];
}

/**
 * Node Degree Query DTO
 *
 * Parameters for querying node degree.
 */
export class NodeDegreeQueryDto {
  @IsUUID()
  nodeId: string;

  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean = false;
}

/**
 * Subgraph Query DTO
 *
 * Parameters for extracting a subgraph.
 */
export class SubgraphQueryDto {
  @IsUUID()
  nodeId: string;

  @IsNumber()
  @Min(1)
  @Max(10)
  depth: number;

  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean = false;
}

/**
 * Validate Graph Integrity DTO
 *
 * Parameters for validating graph integrity.
 */
export class ValidateGraphIntegrityDto extends BaseGraphQueryDto {
  @IsOptional()
  @IsBoolean()
  checkOrphanedEdges?: boolean = true;

  @IsOptional()
  @IsBoolean()
  checkCycles?: boolean = true;

  @IsOptional()
  @IsBoolean()
  checkTypeConstraints?: boolean = true;
}

/**
 * Calculate Similarity DTO
 *
 * Parameters for calculating similarity between nodes.
 */
export class CalculateSimilarityDto {
  @IsUUID()
  node1Id: string;

  @IsUUID()
  node2Id: string;

  @IsOptional()
  @IsArray()
  @IsIn(['name', 'type', 'tags', 'properties', 'description'], { each: true })
  compareFields?: ('name' | 'type' | 'tags' | 'properties' | 'description')[];
}

/**
 * Connected Components Query DTO
 *
 * Query parameters for finding connected components.
 */
export class ConnectedComponentsQueryDto extends BaseGraphQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(2)
  minComponentSize?: number = 2;
}

/**
 * ==========================================
 * RESPONSE DTOs (for API responses)
 * ==========================================
 */

/**
 * Node Response DTO
 *
 * Returned when a single node is fetched.
 */
export class NodeResponseDto {
  id: string;
  name: string;
  type: NodeType;
  description?: string | null;
  organizationId: string;
  properties: Record<string, any>;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Edge Response DTO
 *
 * Returned when a single edge is fetched.
 */
export class EdgeResponseDto {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: RelationshipType;
  organizationId: string;
  weight: number;
  properties: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  confidence?: number;
}

/**
 * Paginated Nodes Response DTO
 *
 * Returned when querying multiple nodes with pagination.
 */
export class PaginatedNodesResponseDto {
  items: NodeResponseDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated Edges Response DTO
 *
 * Returned when querying multiple edges with pagination.
 */
export class PaginatedEdgesResponseDto {
  items: EdgeResponseDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Graph Statistics Response DTO
 *
 * Returned when querying graph statistics.
 */
export class GraphStatisticsResponseDto {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<NodeType, number>;
  edgesByType: Record<RelationshipType, number>;
  averageNodeDegree: number;
  graphDensity: number;
  connectedComponentCount: number;
}

/**
 * Node Degree Response DTO
 *
 * Contains degree information for a node.
 */
export class NodeDegreeResponseDto {
  nodeId: string;
  inDegree: number;
  outDegree: number;
  totalDegree: number;
}

/**
 * Subgraph Response DTO
 *
 * Contains nodes and edges for a subgraph.
 */
export class SubgraphResponseDto {
  nodes: NodeResponseDto[];
  edges: EdgeResponseDto[];
  rootNodeId: string;
  depth: number;
  totalNodes: number;
  totalEdges: number;
}

/**
 * Path Response DTO
 *
 * Contains a path of nodes between two points.
 */
export class PathResponseDto {
  nodes: NodeResponseDto[];
  edges: EdgeResponseDto[];
  length: number;
  totalWeight: number;
}

/**
 * Bulk Operation Result Response DTO
 *
 * Results from bulk operations.
 */
export class BulkOperationResultDto<T> {
  successful: T[];
  failed: Array<{
    index: number;
    item: any;
    error: string;
  }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

/**
 * Graph Integrity Report DTO
 *
 * Results of graph validation.
 */
export class GraphIntegrityReportDto {
  valid: boolean;
  errors: Array<{
    type: string;
    message: string;
    details?: Record<string, any>;
  }>;
  warnings: Array<{
    type: string;
    message: string;
    details?: Record<string, any>;
  }>;
  checkedAt: Date;
  organizationId: string;
}

/**
 * Duplicate Detection Result DTO
 *
 * Results of duplicate detection.
 */
export class DuplicateDetectionResultDto {
  primaryNode: NodeResponseDto;
  duplicates: NodeResponseDto[];
  similarityScores: number[];
  detectionMethod: string;
  confidence: number;
  suggestedStrategy: string;
}

/**
 * Export Subgraph Response DTO
 *
 * Exported subgraph with metadata.
 */
export class ExportSubgraphResponseDto {
  nodes: NodeResponseDto[];
  edges: EdgeResponseDto[];
  metadata: {
    exportedAt: Date;
    rootNodeId: string;
    depth: number;
    nodeCount: number;
    edgeCount: number;
  };
}

/**
 * Import Result DTO
 *
 * Results of import operation.
 */
export class ImportResultDto {
  importedNodeCount: number;
  importedEdgeCount: number;
  nodeIdMapping: Record<string, string>;
  importedAt: Date;
  organizationId: string;
}

/**
 * Tag List Response DTO
 *
 * List of all tags in the graph.
 */
export class TagListResponseDto {
  tags: string[];
  totalCount: number;
  organizationId: string;
}

/**
 * Property Key Response DTO
 *
 * Information about property keys in the graph.
 */
export class PropertyKeyResponseDto {
  propertyKey: string;
  nodeCount: number;
  edgeCount: number;
  sampleValues: any[];
}

/**
 * Update Operation Response DTO
 *
 * Response when recording an update operation.
 */
export class UpdateOperationResponseDto {
  id: string;
  type: UpdateOperationType;
  timestamp: Date;
  organizationId: string;
  status: 'pending' | 'applied' | 'failed';
  errorMessage?: string;
}

/**
 * Health Check Response DTO
 *
 * Response from health check endpoint.
 */
export class HealthCheckResponseDto {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    database: boolean;
    storage: boolean;
    cache?: boolean;
  };
  uptime: number;
  version: string;
}
