import { NodeType } from '../entities/node.entity';
import { RelationshipType } from '../../../knowledge/enums/relationship-type.enum';

/**
 * Storage Strategy Enumeration
 *
 * Defines the available storage backends for the knowledge graph.
 * This allows for flexible storage configuration and hybrid approaches.
 */
export enum StorageStrategy {
  /** PostgreSQL with TypeORM - full persistence with ACID guarantees */
  PERSISTENT = 'persistent',
  /** In-memory storage - fast but volatile, useful for temporary graphs */
  IN_MEMORY = 'in_memory',
  /** Hybrid approach - hot data in memory with periodic persistence */
  HYBRID = 'hybrid',
}

/**
 * Merge Strategy Enumeration
 *
 * Defines how duplicate nodes should be merged when detected.
 */
export enum MergeStrategy {
  /** Keep the most recently updated node */
  KEEP_NEWEST = 'keep_newest',
  /** Keep the node with more connections */
  KEEP_MOST_CONNECTED = 'keep_most_connected',
  /** Merge properties, combining all unique values */
  MERGE_PROPERTIES = 'merge_properties',
  /** Manual merge - requires user intervention */
  MANUAL = 'manual',
}

/**
 * Update Operation Type
 *
 * Defines the type of incremental update being performed.
 */
export enum UpdateOperationType {
  /** Add new node to the graph */
  ADD_NODE = 'add_node',
  /** Update existing node properties */
  UPDATE_NODE = 'update_node',
  /** Remove node from the graph */
  REMOVE_NODE = 'remove_node',
  /** Add new edge to the graph */
  ADD_EDGE = 'add_edge',
  /** Update existing edge properties */
  UPDATE_EDGE = 'update_edge',
  /** Remove edge from the graph */
  REMOVE_EDGE = 'remove_edge',
  /** Merge two nodes into one */
  MERGE_NODES = 'merge_nodes',
}

/**
 * Graph Node Interface
 *
 * Core interface representing a node in the knowledge graph.
 * This provides a unified view across different storage strategies.
 */
export interface IGraphNode {
  /** Unique identifier for the node */
  id: string;
  /** Human-readable name/label for the node */
  name: string;
  /** Type/category of the node */
  type: NodeType;
  /** Optional detailed description */
  description?: string | null;
  /** Organization context for multi-tenancy */
  organizationId: string;
  /** Flexible properties for domain-specific data */
  properties: Record<string, any>;
  /** Tags for categorization and search */
  tags: string[];
  /** Soft delete flag */
  isActive: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Optional vector embedding for semantic search */
  embedding?: number[];
  /** Computed hash for duplicate detection */
  contentHash?: string;
}

/**
 * Graph Edge Interface
 *
 * Core interface representing a relationship edge in the knowledge graph.
 */
export interface IGraphEdge {
  /** Unique identifier for the edge */
  id: string;
  /** Source node identifier */
  sourceNodeId: string;
  /** Target node identifier */
  targetNodeId: string;
  /** Type of relationship */
  type: RelationshipType;
  /** Organization context for multi-tenancy */
  organizationId: string;
  /** Weight for weighted graph algorithms (default: 1.0) */
  weight: number;
  /** Flexible properties for relationship-specific data */
  properties: Record<string, any>;
  /** Soft delete flag */
  isActive: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Confidence score for inferred relationships (0-1) */
  confidence?: number;
}

/**
 * Graph Structure Interface
 *
 * Represents a complete graph or subgraph structure.
 */
export interface IGraphStructure {
  /** All nodes in the graph */
  nodes: IGraphNode[];
  /** All edges in the graph */
  edges: IGraphEdge[];
  /** Metadata about the graph */
  metadata: IGraphMetadata;
}

/**
 * Graph Metadata Interface
 *
 * Contains metadata about a graph or subgraph.
 */
export interface IGraphMetadata {
  /** Total number of nodes */
  nodeCount: number;
  /** Total number of edges */
  edgeCount: number;
  /** Organization context */
  organizationId: string;
  /** Timestamp of graph creation/export */
  createdAt: Date;
  /** Timestamp of last modification */
  updatedAt: Date;
  /** Node type distribution */
  nodeTypeDistribution: Record<NodeType, number>;
  /** Edge type distribution */
  edgeTypeDistribution: Record<RelationshipType, number>;
  /** Optional: root node ID for subgraphs */
  rootNodeId?: string;
  /** Optional: maximum depth for subgraphs */
  maxDepth?: number;
  /** Version of the graph schema */
  schemaVersion: string;
}

/**
 * Storage Provider Interface
 *
 * Defines the contract for different storage backends.
 * Implementations can provide persistent, in-memory, or hybrid storage.
 */
export interface IStorageProvider {
  /** Storage strategy type */
  readonly strategy: StorageStrategy;

  /** Initialize the storage provider */
  initialize(): Promise<void>;

  /** Shutdown and cleanup resources */
  shutdown(): Promise<void>;

  /** Save a node to storage */
  saveNode(node: IGraphNode): Promise<IGraphNode>;

  /** Retrieve a node by ID */
  getNode(id: string): Promise<IGraphNode | null>;

  /** Save an edge to storage */
  saveEdge(edge: IGraphEdge): Promise<IGraphEdge>;

  /** Retrieve an edge by ID */
  getEdge(id: string): Promise<IGraphEdge | null>;

  /** Delete a node from storage */
  deleteNode(id: string): Promise<void>;

  /** Delete an edge from storage */
  deleteEdge(id: string): Promise<void>;

  /** Get all nodes for an organization */
  getNodesByOrganization(organizationId: string): Promise<IGraphNode[]>;

  /** Get all edges for an organization */
  getEdgesByOrganization(organizationId: string): Promise<IGraphEdge[]>;

  /** Execute a batch operation atomically */
  executeBatch(operations: IUpdateOperation[]): Promise<void>;

  /** Check if storage is healthy and accessible */
  healthCheck(): Promise<boolean>;
}

/**
 * Update Operation Interface
 *
 * Represents a single incremental update to the graph.
 */
export interface IUpdateOperation {
  /** Unique identifier for the operation */
  id: string;
  /** Type of update operation */
  type: UpdateOperationType;
  /** Timestamp of the operation */
  timestamp: Date;
  /** Organization context */
  organizationId: string;
  /** Node data for node operations */
  node?: Partial<IGraphNode>;
  /** Edge data for edge operations */
  edge?: Partial<IGraphEdge>;
  /** Source node ID for merge operations */
  sourceNodeId?: string;
  /** Target node ID for merge operations */
  targetNodeId?: string;
  /** Additional metadata about the operation */
  metadata?: Record<string, any>;
}

/**
 * Incremental Update Strategy Interface
 *
 * Manages incremental updates to the knowledge graph.
 */
export interface IIncrementalUpdateStrategy {
  /** Apply a single update operation */
  applyUpdate(operation: IUpdateOperation): Promise<void>;

  /** Apply multiple updates in sequence */
  applyBatchUpdates(operations: IUpdateOperation[]): Promise<void>;

  /** Validate an update operation before applying */
  validateUpdate(operation: IUpdateOperation): Promise<boolean>;

  /** Rollback the last N operations */
  rollback(count: number): Promise<void>;

  /** Get update history for audit trail */
  getUpdateHistory(
    organizationId: string,
    limit?: number,
  ): Promise<IUpdateOperation[]>;

  /** Replay updates from a specific point in time */
  replayUpdates(fromTimestamp: Date): Promise<void>;
}

/**
 * Duplicate Detection Result Interface
 *
 * Contains information about detected duplicate nodes.
 */
export interface IDuplicateDetectionResult {
  /** The primary/canonical node */
  primaryNode: IGraphNode;
  /** Potential duplicate nodes */
  duplicates: IGraphNode[];
  /** Similarity scores (0-1) for each duplicate */
  similarityScores: number[];
  /** Detection method used */
  detectionMethod: string;
  /** Confidence in duplicate detection (0-1) */
  confidence: number;
  /** Suggested merge strategy */
  suggestedStrategy: MergeStrategy;
}

/**
 * Duplicate Merge Result Interface
 *
 * Contains the result of merging duplicate nodes.
 */
export interface IDuplicateMergeResult {
  /** The merged/surviving node */
  mergedNode: IGraphNode;
  /** IDs of nodes that were merged and removed */
  removedNodeIds: string[];
  /** Number of edges that were redirected */
  redirectedEdgeCount: number;
  /** Merge strategy that was used */
  strategyUsed: MergeStrategy;
  /** Any conflicts that occurred during merge */
  conflicts: IMergeConflict[];
}

/**
 * Merge Conflict Interface
 *
 * Represents a conflict that occurred during node merging.
 */
export interface IMergeConflict {
  /** Property key that has conflicting values */
  propertyKey: string;
  /** Value from the primary node */
  primaryValue: any;
  /** Value from the duplicate node */
  duplicateValue: any;
  /** Resolution strategy applied */
  resolution: 'keep_primary' | 'keep_duplicate' | 'merge' | 'manual';
}

/**
 * Duplicate Merging Strategy Interface
 *
 * Handles detection and merging of duplicate nodes.
 */
export interface IDuplicateMergingStrategy {
  /** Detect potential duplicates for a given node */
  detectDuplicates(
    node: IGraphNode,
    threshold?: number,
  ): Promise<IDuplicateDetectionResult[]>;

  /** Scan entire graph for duplicates */
  scanForDuplicates(
    organizationId: string,
    threshold?: number,
  ): Promise<IDuplicateDetectionResult[]>;

  /** Merge duplicate nodes using specified strategy */
  mergeDuplicates(
    primaryNodeId: string,
    duplicateNodeIds: string[],
    strategy: MergeStrategy,
  ): Promise<IDuplicateMergeResult>;

  /** Auto-merge duplicates with high confidence */
  autoMergeDuplicates(
    organizationId: string,
    confidenceThreshold?: number,
  ): Promise<IDuplicateMergeResult[]>;

  /** Calculate similarity between two nodes */
  calculateSimilarity(node1: IGraphNode, node2: IGraphNode): Promise<number>;
}

/**
 * Graph Query Interface
 *
 * Provides advanced query capabilities for the knowledge graph.
 */
export interface IGraphQuery {
  /** Organization context for the query */
  organizationId: string;
  /** Node type filters */
  nodeTypes?: NodeType[];
  /** Edge type filters */
  edgeTypes?: RelationshipType[];
  /** Tag filters (AND/OR logic) */
  tags?: string[];
  /** Match all tags (AND) or any tag (OR) */
  matchAllTags?: boolean;
  /** Property filters */
  properties?: Record<string, any>;
  /** Full-text search query */
  searchQuery?: string;
  /** Date range filter */
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  /** Include inactive nodes/edges */
  includeInactive?: boolean;
  /** Pagination */
  pagination?: {
    page: number;
    limit: number;
  };
  /** Sorting */
  sort?: {
    field: string;
    order: 'ASC' | 'DESC';
  };
}

/**
 * Graph Query Result Interface
 *
 * Contains the results of a graph query.
 */
export interface IGraphQueryResult {
  /** Matching nodes */
  nodes: IGraphNode[];
  /** Matching edges */
  edges: IGraphEdge[];
  /** Total count (for pagination) */
  total: number;
  /** Current page */
  page: number;
  /** Items per page */
  limit: number;
  /** Query execution time in milliseconds */
  executionTime: number;
}

/**
 * Graph Traversal Options Interface
 *
 * Configuration for graph traversal operations.
 */
export interface IGraphTraversalOptions {
  /** Maximum depth for traversal */
  maxDepth: number;
  /** Direction of traversal */
  direction: 'in' | 'out' | 'both';
  /** Filter by edge types */
  edgeTypes?: RelationshipType[];
  /** Filter by node types */
  nodeTypes?: NodeType[];
  /** Stop traversal on certain node types */
  stopAtNodeTypes?: NodeType[];
  /** Include edge information in results */
  includeEdges?: boolean;
  /** Maximum number of nodes to return */
  maxNodes?: number;
}

/**
 * Graph Path Interface
 *
 * Represents a path between two nodes in the graph.
 */
export interface IGraphPath {
  /** Nodes in the path (ordered) */
  nodes: IGraphNode[];
  /** Edges in the path (ordered) */
  edges: IGraphEdge[];
  /** Total path length */
  length: number;
  /** Total weight (sum of edge weights) */
  totalWeight: number;
}

/**
 * Graph Analytics Interface
 *
 * Contains various analytics about the graph structure.
 */
export interface IGraphAnalytics {
  /** Node degree statistics */
  nodeDegrees: Record<string, { inDegree: number; outDegree: number }>;
  /** Most connected nodes */
  hubs: IGraphNode[];
  /** Isolated nodes (no connections) */
  isolatedNodes: IGraphNode[];
  /** Detected cycles in the graph */
  cycles: string[][];
  /** Graph density (edges / possible edges) */
  density: number;
  /** Average clustering coefficient */
  averageClustering: number;
  /** Connected components */
  components: string[][];
}

/**
 * Graph Integration Point Interface
 *
 * Defines how the knowledge graph integrates with other modules.
 */
export interface IGraphIntegrationPoint {
  /** Module name (e.g., 'knowledge-extraction', 'task', 'orchestration') */
  moduleName: string;
  /** Integration type */
  integrationType: 'read' | 'write' | 'bidirectional';
  /** Callback for receiving graph updates */
  onGraphUpdate?: (operation: IUpdateOperation) => Promise<void>;
  /** Callback for querying graph data */
  onGraphQuery?: (query: IGraphQuery) => Promise<IGraphQueryResult>;
  /** Supported node types for this integration */
  supportedNodeTypes: NodeType[];
  /** Supported edge types for this integration */
  supportedEdgeTypes: RelationshipType[];
}

/**
 * Graph Configuration Interface
 *
 * Configuration options for the knowledge graph system.
 */
export interface IGraphConfiguration {
  /** Storage strategy to use */
  storageStrategy: StorageStrategy;
  /** Enable duplicate detection */
  enableDuplicateDetection: boolean;
  /** Duplicate detection threshold (0-1) */
  duplicateThreshold: number;
  /** Auto-merge duplicates above this confidence */
  autoMergeThreshold: number;
  /** Merge strategy for auto-merge */
  defaultMergeStrategy: MergeStrategy;
  /** Enable incremental updates */
  enableIncrementalUpdates: boolean;
  /** Maximum update history to maintain */
  maxUpdateHistory: number;
  /** Enable vector embeddings for semantic search */
  enableEmbeddings: boolean;
  /** Embedding dimension size */
  embeddingDimension: number;
  /** Cache size for in-memory storage (number of nodes) */
  cacheSize: number;
  /** Enable graph analytics */
  enableAnalytics: boolean;
  /** Integration points with other modules */
  integrationPoints: IGraphIntegrationPoint[];
}

/**
 * API Response Wrappers
 */

/**
 * Standard API Response Wrapper Interface
 *
 * Wraps all API responses with metadata.
 */
export interface IApiResponse<T> {
  /** Response status */
  success: boolean;
  /** HTTP status code */
  statusCode: number;
  /** Response message */
  message: string;
  /** Response data */
  data?: T;
  /** Error details if applicable */
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  /** Timestamp of response */
  timestamp: Date;
}

/**
 * Paginated API Response Interface
 *
 * Wraps paginated responses.
 */
export interface IPaginatedResponse<T> {
  /** Data items for current page */
  items: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Has next page */
  hasNextPage: boolean;
  /** Has previous page */
  hasPreviousPage: boolean;
}

/**
 * Bulk Operation Result Interface
 *
 * Contains results of bulk operations.
 */
export interface IBulkOperationResult<T> {
  /** Successfully processed items */
  successful: T[];
  /** Failed operations with error details */
  failed: Array<{
    index: number;
    item: any;
    error: string;
  }>;
  /** Total processed */
  totalProcessed: number;
  /** Number of successes */
  successCount: number;
  /** Number of failures */
  failureCount: number;
}

/**
 * Graph Service Interface
 *
 * Main interface for the knowledge graph service.
 * This defines the public API for graph operations.
 */
export interface IGraphService {
  /** Get current configuration */
  getConfiguration(): IGraphConfiguration;

  /** Update configuration */
  updateConfiguration(config: Partial<IGraphConfiguration>): Promise<void>;

  /** Create a new node */
  createNode(
    node: Omit<IGraphNode, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IGraphNode>;

  /** Create a new edge */
  createEdge(
    edge: Omit<IGraphEdge, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IGraphEdge>;

  /** Query the graph */
  query(query: IGraphQuery): Promise<IGraphQueryResult>;

  /** Traverse the graph */
  traverse(
    startNodeId: string,
    options: IGraphTraversalOptions,
  ): Promise<IGraphNode[]>;

  /** Find path between nodes */
  findPath(
    sourceNodeId: string,
    targetNodeId: string,
  ): Promise<IGraphPath | null>;

  /** Get graph analytics */
  getAnalytics(organizationId: string): Promise<IGraphAnalytics>;

  /** Export graph structure */
  exportGraph(
    organizationId: string,
    nodeId?: string,
    depth?: number,
  ): Promise<IGraphStructure>;

  /** Import graph structure */
  importGraph(structure: IGraphStructure): Promise<void>;

  /** Register integration point */
  registerIntegration(integration: IGraphIntegrationPoint): Promise<void>;

  /** Health check */
  healthCheck(): Promise<boolean>;
}
