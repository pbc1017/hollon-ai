/**
 * Knowledge Graph Type Definitions
 *
 * This file contains type aliases, utility types, and helper types for the
 * knowledge graph system. These types complement the interfaces defined in
 * graph.interface.ts and provide additional type safety and convenience.
 *
 * @module KnowledgeGraphTypes
 */

import { NodeType } from '../entities/node.entity';
import { RelationshipType } from '../../../knowledge/enums/relationship-type.enum';
import {
  IGraphNode,
  IGraphEdge,
  IGraphStructure,
  IGraphMetadata,
  IUpdateOperation,
  UpdateOperationType,
  StorageStrategy,
  MergeStrategy,
} from '../interfaces/graph.interface';

/**
 * Type Aliases for Common Graph Types
 */

/** Unique identifier type for nodes and edges */
export type GraphEntityId = string;

/** Organization identifier for multi-tenancy */
export type OrganizationId = string;

/** Content hash for duplicate detection */
export type ContentHash = string;

/** Similarity score (0-1 range) */
export type SimilarityScore = number;

/** Confidence score (0-1 range) for inferred relationships */
export type ConfidenceScore = number;

/** Weight value for weighted graph algorithms */
export type EdgeWeight = number;

/** Vector embedding for semantic search */
export type Embedding = number[];

/** Flexible property bag for domain-specific data */
export type PropertyBag = Record<string, any>;

/** Tag collection for categorization */
export type TagCollection = string[];

/**
 * Partial Graph Types
 * Utility types for creating or updating graph entities
 */

/** Partial node type for creation (without auto-generated fields) */
export type NodeCreationData = Omit<
  IGraphNode,
  'id' | 'createdAt' | 'updatedAt' | 'contentHash'
>;

/** Partial edge type for creation (without auto-generated fields) */
export type EdgeCreationData = Omit<
  IGraphEdge,
  'id' | 'createdAt' | 'updatedAt'
>;

/** Partial node type for updates (only updateable fields) */
export type NodeUpdateData = Partial<
  Omit<IGraphNode, 'id' | 'createdAt' | 'organizationId'>
>;

/** Partial edge type for updates (only updateable fields) */
export type EdgeUpdateData = Partial<
  Omit<IGraphEdge, 'id' | 'createdAt' | 'organizationId'>
>;

/** Node with required ID for update operations */
export type IdentifiedNode = Pick<IGraphNode, 'id'> & NodeUpdateData;

/** Edge with required ID for update operations */
export type IdentifiedEdge = Pick<IGraphEdge, 'id'> & EdgeUpdateData;

/**
 * Graph Query Types
 */

/** Sort direction for queries */
export type SortDirection = 'ASC' | 'DESC';

/** Sort field name */
export type SortField = string;

/** Page number (1-based) */
export type PageNumber = number;

/** Items per page limit */
export type PageLimit = number;

/** Traversal direction */
export type TraversalDirection = 'in' | 'out' | 'both';

/** Search query string */
export type SearchQueryString = string;

/** Date range filter */
export type DateRange = {
  startDate: Date;
  endDate: Date;
};

/** Pagination configuration */
export type PaginationConfig = {
  page: PageNumber;
  limit: PageLimit;
};

/** Sort configuration */
export type SortConfig = {
  field: SortField;
  order: SortDirection;
};

/**
 * Graph Traversal Types
 */

/** Maximum traversal depth (1-10 hops) */
export type TraversalDepth = number;

/** Maximum nodes to return from traversal */
export type MaxNodesLimit = number;

/** Node type filter for traversal */
export type NodeTypeFilter = NodeType[];

/** Edge type filter for traversal */
export type EdgeTypeFilter = RelationshipType[];

/**
 * Graph Analytics Types
 */

/** Node degree (in and out) */
export type NodeDegree = {
  inDegree: number;
  outDegree: number;
};

/** Graph density score (0-1) */
export type GraphDensity = number;

/** Clustering coefficient (0-1) */
export type ClusteringCoefficient = number;

/** Path length */
export type PathLength = number;

/** Total path weight */
export type PathWeight = number;

/**
 * Update Operation Types
 */

/** Update operation ID */
export type UpdateOperationId = string;

/** Timestamp for operations */
export type OperationTimestamp = Date;

/** Operation metadata */
export type OperationMetadata = Record<string, any>;

/** Batch of update operations */
export type UpdateOperationBatch = IUpdateOperation[];

/** Rollback count (number of operations to undo) */
export type RollbackCount = number;

/**
 * Duplicate Detection Types
 */

/** Detection method identifier */
export type DetectionMethod = string;

/** Similarity threshold (0-1) */
export type SimilarityThreshold = number;

/** Auto-merge confidence threshold (0-1) */
export type AutoMergeThreshold = number;

/** Conflict resolution strategy */
export type ConflictResolution =
  | 'keep_primary'
  | 'keep_duplicate'
  | 'merge'
  | 'manual';

/**
 * Storage Types
 */

/** Cache size (number of nodes to cache) */
export type CacheSize = number;

/** Update history limit */
export type UpdateHistoryLimit = number;

/** Schema version string */
export type SchemaVersion = string;

/**
 * Integration Types
 */

/** Module name for integrations */
export type ModuleName = string;

/** Integration type */
export type IntegrationType = 'read' | 'write' | 'bidirectional';

/**
 * Utility Types for Type Guards
 */

/** Type guard result */
export type TypeGuardResult = boolean;

/** Validation result with optional error message */
export type ValidationResult = {
  isValid: boolean;
  error?: string;
};

/**
 * Composite Types
 */

/** Node with its outgoing edges */
export type NodeWithOutgoingEdges = IGraphNode & {
  outgoingEdges: IGraphEdge[];
};

/** Node with its incoming edges */
export type NodeWithIncomingEdges = IGraphNode & {
  incomingEdges: IGraphEdge[];
};

/** Node with all connected edges */
export type NodeWithEdges = IGraphNode & {
  outgoingEdges: IGraphEdge[];
  incomingEdges: IGraphEdge[];
};

/** Edge with resolved source and target nodes */
export type EdgeWithNodes = IGraphEdge & {
  sourceNode: IGraphNode;
  targetNode: IGraphNode;
};

/** Subgraph centered on a node */
export type NodeSubgraph = {
  centerNode: IGraphNode;
  connectedNodes: IGraphNode[];
  edges: IGraphEdge[];
  depth: number;
};

/**
 * Operation Result Types
 */

/** Generic success/failure result */
export type OperationResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

/** Batch operation result */
export type BatchOperationResult = {
  successful: number;
  failed: number;
  errors: Array<{ operationId: string; error: string }>;
};

/** Node creation result */
export type NodeCreationResult = OperationResult<IGraphNode>;

/** Edge creation result */
export type EdgeCreationResult = OperationResult<IGraphEdge>;

/** Bulk node creation result */
export type BulkNodeCreationResult = {
  created: IGraphNode[];
  failed: Array<{ data: NodeCreationData; error: string }>;
};

/** Bulk edge creation result */
export type BulkEdgeCreationResult = {
  created: IGraphEdge[];
  failed: Array<{ data: EdgeCreationData; error: string }>;
};

/**
 * Graph Statistics Types
 */

/** Node count by type */
export type NodeTypeDistribution = Record<NodeType, number>;

/** Edge count by type */
export type EdgeTypeDistribution = Record<RelationshipType, number>;

/** Tag usage statistics */
export type TagUsageStatistics = Record<string, number>;

/** Property usage statistics */
export type PropertyUsageStatistics = Record<string, number>;

/** Overall graph statistics */
export type GraphStatistics = {
  totalNodes: number;
  totalEdges: number;
  nodeTypeDistribution: NodeTypeDistribution;
  edgeTypeDistribution: EdgeTypeDistribution;
  averageNodeDegree: number;
  maxNodeDegree: number;
  isolatedNodeCount: number;
  mostConnectedNodes: IGraphNode[];
  tagUsage: TagUsageStatistics;
  lastUpdated: Date;
};

/**
 * Graph Export/Import Types
 */

/** Export format */
export type ExportFormat = 'json' | 'graphml' | 'gexf' | 'cypher';

/** Import source */
export type ImportSource = 'json' | 'graphml' | 'gexf';

/** Export options */
export type ExportOptions = {
  format: ExportFormat;
  includeMetadata: boolean;
  includeInactive: boolean;
  compress: boolean;
};

/** Import options */
export type ImportOptions = {
  source: ImportSource;
  validateSchema: boolean;
  mergeStrategy: MergeStrategy;
  skipDuplicates: boolean;
};

/** Exported graph data */
export type ExportedGraphData = {
  structure: IGraphStructure;
  format: ExportFormat;
  exportedAt: Date;
  version: SchemaVersion;
};

/**
 * Graph Health Types
 */

/** Health status */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/** Health check result */
export type HealthCheckResult = {
  status: HealthStatus;
  storageAvailable: boolean;
  cacheAvailable: boolean;
  lastCheckTime: Date;
  issues: string[];
};

/**
 * Graph Configuration Types
 */

/** Embedding dimension size (128-2048) */
export type EmbeddingDimension = number;

/** Configuration flag */
export type ConfigurationFlag = boolean;

/** Configuration update */
export type ConfigurationUpdate = {
  storageStrategy?: StorageStrategy;
  enableDuplicateDetection?: ConfigurationFlag;
  duplicateThreshold?: SimilarityThreshold;
  autoMergeThreshold?: AutoMergeThreshold;
  defaultMergeStrategy?: MergeStrategy;
  enableIncrementalUpdates?: ConfigurationFlag;
  maxUpdateHistory?: UpdateHistoryLimit;
  enableEmbeddings?: ConfigurationFlag;
  embeddingDimension?: EmbeddingDimension;
  cacheSize?: CacheSize;
  enableAnalytics?: ConfigurationFlag;
};

/**
 * Type Predicates and Guards
 */

/** Check if a value is a valid node ID */
export function isNodeId(value: unknown): value is GraphEntityId {
  return typeof value === 'string' && value.length > 0;
}

/** Check if a value is a valid edge ID */
export function isEdgeId(value: unknown): value is GraphEntityId {
  return typeof value === 'string' && value.length > 0;
}

/** Check if a value is a valid similarity score */
export function isSimilarityScore(value: unknown): value is SimilarityScore {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

/** Check if a value is a valid confidence score */
export function isConfidenceScore(value: unknown): value is ConfidenceScore {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

/** Check if a value is a valid node type */
export function isNodeType(value: unknown): value is NodeType {
  return Object.values(NodeType).includes(value as NodeType);
}

/** Check if a value is a valid relationship type */
export function isRelationshipType(value: unknown): value is RelationshipType {
  return Object.values(RelationshipType).includes(value as RelationshipType);
}

/** Check if a value is a valid traversal direction */
export function isTraversalDirection(
  value: unknown,
): value is TraversalDirection {
  return value === 'in' || value === 'out' || value === 'both';
}

/** Check if a value is a valid storage strategy */
export function isStorageStrategy(value: unknown): value is StorageStrategy {
  return Object.values(StorageStrategy).includes(value as StorageStrategy);
}

/** Check if a value is a valid merge strategy */
export function isMergeStrategy(value: unknown): value is MergeStrategy {
  return Object.values(MergeStrategy).includes(value as MergeStrategy);
}

/** Check if a value is a valid update operation type */
export function isUpdateOperationType(
  value: unknown,
): value is UpdateOperationType {
  return Object.values(UpdateOperationType).includes(
    value as UpdateOperationType,
  );
}

/**
 * Validation Helpers
 */

/** Validate similarity threshold range */
export function validateSimilarityThreshold(
  threshold: number,
): ValidationResult {
  if (threshold < 0 || threshold > 1) {
    return {
      isValid: false,
      error: 'Similarity threshold must be between 0 and 1',
    };
  }
  return { isValid: true };
}

/** Validate traversal depth */
export function validateTraversalDepth(depth: number): ValidationResult {
  if (depth < 1 || depth > 10) {
    return {
      isValid: false,
      error: 'Traversal depth must be between 1 and 10',
    };
  }
  return { isValid: true };
}

/** Validate embedding dimension */
export function validateEmbeddingDimension(
  dimension: number,
): ValidationResult {
  if (dimension < 128 || dimension > 2048) {
    return {
      isValid: false,
      error: 'Embedding dimension must be between 128 and 2048',
    };
  }
  return { isValid: true };
}

/** Validate page number */
export function validatePageNumber(page: number): ValidationResult {
  if (page < 1) {
    return { isValid: false, error: 'Page number must be at least 1' };
  }
  return { isValid: true };
}

/** Validate page limit */
export function validatePageLimit(limit: number): ValidationResult {
  if (limit < 1 || limit > 1000) {
    return {
      isValid: false,
      error: 'Page limit must be between 1 and 1000',
    };
  }
  return { isValid: true };
}

/**
 * Constants
 */

/** Default values for graph configuration */
export const GraphDefaults = {
  /** Default similarity threshold for duplicate detection */
  SIMILARITY_THRESHOLD: 0.8,

  /** Default auto-merge threshold */
  AUTO_MERGE_THRESHOLD: 0.95,

  /** Default edge weight */
  EDGE_WEIGHT: 1.0,

  /** Default traversal depth */
  TRAVERSAL_DEPTH: 3,

  /** Default page size for pagination */
  PAGE_SIZE: 50,

  /** Maximum page size */
  MAX_PAGE_SIZE: 1000,

  /** Default cache size (number of nodes) */
  CACHE_SIZE: 10000,

  /** Default update history limit */
  UPDATE_HISTORY_LIMIT: 1000,

  /** Default embedding dimension */
  EMBEDDING_DIMENSION: 1536,

  /** Schema version */
  SCHEMA_VERSION: '1.0.0',

  /** Minimum confidence score for auto-operations */
  MIN_CONFIDENCE: 0.7,

  /** Maximum traversal depth allowed */
  MAX_TRAVERSAL_DEPTH: 10,

  /** Maximum nodes in a single query result */
  MAX_QUERY_NODES: 10000,

  /** Maximum edges in a single query result */
  MAX_QUERY_EDGES: 50000,
} as const;

/**
 * Type for graph defaults (inferred from const)
 */
export type GraphDefaultsType = typeof GraphDefaults;
