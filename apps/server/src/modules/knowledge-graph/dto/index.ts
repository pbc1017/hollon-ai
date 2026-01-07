/**
 * Knowledge Graph DTOs (Data Transfer Objects)
 *
 * Barrel export for all DTOs used in the knowledge graph module.
 *
 * Organized into categories:
 * - Request DTOs: Input validation for API endpoints
 * - Response DTOs: Output format for API responses
 * - Query DTOs: Search and filtering parameters
 * - Operation DTOs: Bulk operations and transactions
 */

// Request/Input DTOs
export { CreateNodeDto } from './create-node.dto';
export { CreateEdgeDto } from './create-edge.dto';
export { UpdateNodeDto } from './update-node.dto';
export { UpdateEdgeDto } from './update-edge.dto';

// Search and Filtering DTOs
export { SearchQueryDto } from './search-query.dto';
export { PaginationQueryDto } from './pagination-query.dto';

// Embedding DTO
export { EmbeddingDto } from './embedding.dto';

// Graph DTOs - Base and Query
export {
  BaseGraphQueryDto,
  PaginationDto,
  SortDto,
  DateRangeDto,
  GraphQueryDto,
  GraphTraversalOptionsDto,
} from './graph.dto';

// Bulk Operation DTOs
export {
  BulkCreateNodesDto,
  BulkCreateEdgesDto,
  BulkDeleteDto,
} from './graph.dto';

// Tag Management DTOs
export { AddTagsDto, RemoveTagsDto, FindByTagsDto } from './graph.dto';

// Property Query DTOs
export { PropertyQueryDto, UpdateNodePropertyDto } from './graph.dto';

// Advanced Search DTOs
export { AdvancedSearchDto, RecentlyModifiedDto } from './graph.dto';

// Export/Import DTOs
export {
  ExportSubgraphDto,
  ImportNodeDto,
  ImportEdgeDto,
  ImportSubgraphDto,
  CloneSubgraphDto,
} from './graph.dto';

// Duplicate Detection DTOs
export {
  DetectDuplicatesDto,
  AutoMergeDuplicatesDto,
  MergeNodesDto,
  DuplicateNodeDto,
} from './graph.dto';

// Update Operation DTOs
export {
  UpdateOperationDto,
  BatchUpdateOperationsDto,
  RollbackOperationsDto,
  UpdateHistoryQueryDto,
} from './graph.dto';

// Configuration DTOs
export {
  GraphConfigurationUpdateDto,
  RegisterIntegrationDto,
} from './graph.dto';

// Utility Query DTOs
export {
  GraphStatisticsQueryDto,
  FindPathDto,
  NodeDegreeQueryDto,
  SubgraphQueryDto,
  ValidateGraphIntegrityDto,
  CalculateSimilarityDto,
  ConnectedComponentsQueryDto,
} from './graph.dto';

// Response DTOs
export {
  NodeResponseDto,
  EdgeResponseDto,
  PaginatedNodesResponseDto,
  PaginatedEdgesResponseDto,
  GraphStatisticsResponseDto,
  NodeDegreeResponseDto,
  SubgraphResponseDto,
  PathResponseDto,
  BulkOperationResultDto,
  GraphIntegrityReportDto,
  DuplicateDetectionResultDto,
  ExportSubgraphResponseDto,
  ImportResultDto,
  TagListResponseDto,
  PropertyKeyResponseDto,
  UpdateOperationResponseDto,
  HealthCheckResponseDto,
} from './graph.dto';
