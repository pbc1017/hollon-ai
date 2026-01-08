/**
 * Knowledge Graph Schema Definition
 *
 * This file defines the comprehensive schema for the knowledge graph,
 * including data models, constraints, validation rules, and storage strategies.
 * It serves as the single source of truth for the knowledge graph structure.
 */

import { NodeType } from '../entities/node.entity';
import { RelationshipType } from '../../../knowledge/enums/relationship-type.enum';

/**
 * Node Type Constraints
 *
 * Defines validation rules and constraints for each node type.
 */
export const NODE_TYPE_CONSTRAINTS = {
  [NodeType.PERSON]: {
    requiredProperties: ['firstName', 'lastName'],
    optionalProperties: ['email', 'phone', 'department', 'skills'],
    description: 'Represents an individual person',
    maxConnections: 1000,
  },
  [NodeType.ORGANIZATION]: {
    requiredProperties: ['name'],
    optionalProperties: ['industry', 'foundedDate', 'headquarters', 'website'],
    description: 'Represents an organization or company',
    maxConnections: 5000,
  },
  [NodeType.TEAM]: {
    requiredProperties: ['name', 'organizationId'],
    optionalProperties: ['manager', 'budget', 'headcount', 'projects'],
    description: 'Represents a team within an organization',
    maxConnections: 500,
  },
  [NodeType.TASK]: {
    requiredProperties: ['title', 'status'],
    optionalProperties: ['description', 'priority', 'dueDate', 'assignee'],
    description: 'Represents a task or work item',
    maxConnections: 200,
  },
  [NodeType.DOCUMENT]: {
    requiredProperties: ['title', 'contentHash'],
    optionalProperties: ['content', 'mimeType', 'size', 'language'],
    description: 'Represents a document or knowledge artifact',
    maxConnections: 500,
  },
  [NodeType.CODE]: {
    requiredProperties: ['name', 'language'],
    optionalProperties: ['repository', 'filePath', 'lineCount', 'version'],
    description: 'Represents a code artifact',
    maxConnections: 300,
  },
  [NodeType.CONCEPT]: {
    requiredProperties: ['name'],
    optionalProperties: ['definition', 'category', 'relatedConcepts'],
    description: 'Represents an abstract concept or idea',
    maxConnections: 1000,
  },
  [NodeType.GOAL]: {
    requiredProperties: ['name', 'status'],
    optionalProperties: ['description', 'targetDate', 'owner', 'metrics'],
    description: 'Represents a strategic goal or objective',
    maxConnections: 500,
  },
  [NodeType.SKILL]: {
    requiredProperties: ['name', 'category'],
    optionalProperties: ['description', 'proficiencyLevels', 'certifications'],
    description: 'Represents a skill or competency',
    maxConnections: 2000,
  },
  [NodeType.TOOL]: {
    requiredProperties: ['name', 'category'],
    optionalProperties: ['version', 'vendor', 'licenseType', 'homepage'],
    description: 'Represents a tool, software, or technology',
    maxConnections: 1000,
  },
  [NodeType.CUSTOM]: {
    requiredProperties: ['name'],
    optionalProperties: [],
    description: 'Custom node type for domain-specific data',
    maxConnections: 1000,
  },
};

/**
 * Edge Type Constraints
 *
 * Defines validation rules and constraints for each relationship type.
 */
export const EDGE_TYPE_CONSTRAINTS = {
  [RelationshipType.CREATED_BY]: {
    description: 'Represents creation relationship',
    allowedSourceTypes: [
      NodeType.DOCUMENT,
      NodeType.CODE,
      NodeType.TASK,
      NodeType.CUSTOM,
    ],
    allowedTargetTypes: [NodeType.PERSON, NodeType.ORGANIZATION, NodeType.TOOL],
    directionality: 'directed',
    isWeighted: false,
  },
  [RelationshipType.BELONGS_TO]: {
    description: 'Represents membership or ownership',
    allowedSourceTypes: [
      NodeType.PERSON,
      NodeType.TASK,
      NodeType.TEAM,
      NodeType.CUSTOM,
    ],
    allowedTargetTypes: [NodeType.ORGANIZATION, NodeType.TEAM, NodeType.GOAL],
    directionality: 'directed',
    isWeighted: true,
  },
  [RelationshipType.MANAGES]: {
    description: 'Represents management relationship',
    allowedSourceTypes: [NodeType.PERSON, NodeType.TEAM],
    allowedTargetTypes: [NodeType.PERSON, NodeType.TEAM, NodeType.TASK],
    directionality: 'directed',
    isWeighted: false,
  },
  [RelationshipType.COLLABORATES_WITH]: {
    description: 'Represents collaboration',
    allowedSourceTypes: [NodeType.PERSON, NodeType.TEAM, NodeType.ORGANIZATION],
    allowedTargetTypes: [NodeType.PERSON, NodeType.TEAM, NodeType.ORGANIZATION],
    directionality: 'undirected',
    isWeighted: true,
  },
  [RelationshipType.DEPENDS_ON]: {
    description: 'Represents dependency',
    allowedSourceTypes: [
      NodeType.TASK,
      NodeType.GOAL,
      NodeType.CODE,
      NodeType.CUSTOM,
    ],
    allowedTargetTypes: [
      NodeType.TASK,
      NodeType.GOAL,
      NodeType.CODE,
      NodeType.SKILL,
    ],
    directionality: 'directed',
    isWeighted: false,
  },
  [RelationshipType.REFERENCES]: {
    description: 'Represents reference relationship',
    allowedSourceTypes: [NodeType.DOCUMENT, NodeType.CODE, NodeType.CUSTOM],
    allowedTargetTypes: [
      NodeType.DOCUMENT,
      NodeType.CODE,
      NodeType.CONCEPT,
      NodeType.TOOL,
    ],
    directionality: 'directed',
    isWeighted: false,
  },
  [RelationshipType.IMPLEMENTS]: {
    description: 'Represents implementation relationship',
    allowedSourceTypes: [NodeType.CODE, NodeType.TOOL],
    allowedTargetTypes: [NodeType.CONCEPT, NodeType.GOAL, NodeType.SKILL],
    directionality: 'directed',
    isWeighted: false,
  },
  [RelationshipType.DERIVES_FROM]: {
    description: 'Represents derivation or inheritance',
    allowedSourceTypes: [NodeType.CONCEPT, NodeType.CODE, NodeType.CUSTOM],
    allowedTargetTypes: [NodeType.CONCEPT, NodeType.CODE, NodeType.SKILL],
    directionality: 'directed',
    isWeighted: false,
  },
  [RelationshipType.RELATES_TO]: {
    description: 'Generic relationship for any connection',
    allowedSourceTypes: Object.values(NodeType),
    allowedTargetTypes: Object.values(NodeType),
    directionality: 'undirected',
    isWeighted: true,
  },
  [RelationshipType.CHILD_OF]: {
    description: 'Represents parent-child relationship',
    allowedSourceTypes: [
      NodeType.TASK,
      NodeType.GOAL,
      NodeType.CONCEPT,
      NodeType.CUSTOM,
    ],
    allowedTargetTypes: [NodeType.TASK, NodeType.GOAL, NodeType.CONCEPT],
    directionality: 'directed',
    isWeighted: false,
  },
  [RelationshipType.PART_OF]: {
    description: 'Represents composition relationship',
    allowedSourceTypes: [NodeType.CODE, NodeType.DOCUMENT, NodeType.CUSTOM],
    allowedTargetTypes: [NodeType.CODE, NodeType.DOCUMENT, NodeType.TOOL],
    directionality: 'directed',
    isWeighted: false,
  },
};

/**
 * Index Strategy Definition
 *
 * Defines indexing strategy for query optimization.
 */
export const INDEX_STRATEGY = {
  // Single column indexes on Node table
  nodeIndexes: [
    {
      name: 'idx_nodes_type',
      columns: ['type'],
      purpose: 'Filter nodes by type',
      estimatedCardinality: 'low',
    },
    {
      name: 'idx_nodes_organization_id',
      columns: ['organization_id'],
      purpose: 'Multi-tenancy isolation and filtering',
      estimatedCardinality: 'medium',
    },
    {
      name: 'idx_nodes_created_at',
      columns: ['created_at'],
      purpose: 'Time-based queries and sorting',
      estimatedCardinality: 'high',
    },
    {
      name: 'idx_nodes_is_active',
      columns: ['is_active'],
      purpose: 'Soft delete filtering',
      estimatedCardinality: 'low',
    },
    {
      name: 'idx_nodes_name_trgm',
      columns: ['name'],
      indexType: 'GIN', // Trigram index for full-text search
      purpose: 'Full-text search on node names',
      estimatedCardinality: 'high',
    },
  ],
  // Composite indexes on Node table
  nodeCompositeIndexes: [
    {
      name: 'idx_nodes_org_type',
      columns: ['organization_id', 'type'],
      purpose: 'Multi-tenancy with type filtering',
      priority: 'high',
    },
    {
      name: 'idx_nodes_org_active',
      columns: ['organization_id', 'is_active'],
      purpose: 'Multi-tenancy with soft delete filtering',
      priority: 'high',
    },
    {
      name: 'idx_nodes_org_created',
      columns: ['organization_id', 'created_at'],
      purpose: 'Multi-tenancy with time-based filtering',
      priority: 'medium',
    },
    {
      name: 'idx_nodes_type_org',
      columns: ['type', 'organization_id'],
      purpose: 'Type-first filtering then by organization',
      priority: 'medium',
    },
  ],
  // Single column indexes on Edge table
  edgeIndexes: [
    {
      name: 'idx_edges_type',
      columns: ['type'],
      purpose: 'Filter edges by relationship type',
      estimatedCardinality: 'low',
    },
    {
      name: 'idx_edges_source_node_id',
      columns: ['source_node_id'],
      purpose: 'Find outgoing edges from a node',
      estimatedCardinality: 'high',
    },
    {
      name: 'idx_edges_target_node_id',
      columns: ['target_node_id'],
      purpose: 'Find incoming edges to a node',
      estimatedCardinality: 'high',
    },
    {
      name: 'idx_edges_organization_id',
      columns: ['organization_id'],
      purpose: 'Multi-tenancy isolation',
      estimatedCardinality: 'medium',
    },
    {
      name: 'idx_edges_created_at',
      columns: ['created_at'],
      purpose: 'Time-based queries',
      estimatedCardinality: 'high',
    },
    {
      name: 'idx_edges_is_active',
      columns: ['is_active'],
      purpose: 'Soft delete filtering',
      estimatedCardinality: 'low',
    },
  ],
  // Composite indexes on Edge table
  edgeCompositeIndexes: [
    {
      name: 'idx_edges_source_target',
      columns: ['source_node_id', 'target_node_id'],
      purpose: 'Direct edge lookup and existence checks',
      priority: 'critical',
    },
    {
      name: 'idx_edges_source_type',
      columns: ['source_node_id', 'type'],
      purpose: 'Find specific outgoing edge types from a node',
      priority: 'high',
    },
    {
      name: 'idx_edges_target_type',
      columns: ['target_node_id', 'type'],
      purpose: 'Find specific incoming edge types to a node',
      priority: 'high',
    },
    {
      name: 'idx_edges_org_type',
      columns: ['organization_id', 'type'],
      purpose: 'Multi-tenancy with type filtering',
      priority: 'high',
    },
    {
      name: 'idx_edges_org_active',
      columns: ['organization_id', 'is_active'],
      purpose: 'Multi-tenancy with soft delete filtering',
      priority: 'high',
    },
    {
      name: 'idx_edges_source_org',
      columns: ['source_node_id', 'organization_id'],
      purpose: 'Multi-tenancy aware outgoing edge queries',
      priority: 'medium',
    },
    {
      name: 'idx_edges_target_org',
      columns: ['target_node_id', 'organization_id'],
      purpose: 'Multi-tenancy aware incoming edge queries',
      priority: 'medium',
    },
  ],
};

/**
 * Query Optimization Patterns
 *
 * Defines recommended query patterns for optimal performance.
 */
export const QUERY_OPTIMIZATION_PATTERNS = {
  findNodeById: {
    description: 'Get a single node by ID with all relationships',
    indexes: ['PRIMARY KEY'],
    estimatedTime: '< 1ms',
    query:
      'SELECT n.* FROM knowledge_graph_nodes n WHERE n.id = $1 AND n.is_active = true',
  },
  findNodesByOrganization: {
    description: 'Find all nodes for an organization with pagination',
    indexes: ['idx_nodes_org_active'],
    estimatedTime: '< 10ms',
    query:
      'SELECT n.* FROM knowledge_graph_nodes n WHERE n.organization_id = $1 AND n.is_active = true ORDER BY n.created_at DESC LIMIT $2 OFFSET $3',
  },
  findNodesByType: {
    description: 'Find all nodes of a specific type',
    indexes: ['idx_nodes_org_type'],
    estimatedTime: '< 50ms',
    query:
      'SELECT n.* FROM knowledge_graph_nodes n WHERE n.organization_id = $1 AND n.type = $2 AND n.is_active = true',
  },
  searchNodesByName: {
    description: 'Full-text search on node names',
    indexes: ['idx_nodes_name_trgm'],
    estimatedTime: '< 100ms',
    query:
      'SELECT n.* FROM knowledge_graph_nodes n WHERE n.organization_id = $1 AND n.name ILIKE $2 AND n.is_active = true',
  },
  getOutgoingEdges: {
    description: 'Get all outgoing edges from a node',
    indexes: ['idx_edges_source_type'],
    estimatedTime: '< 5ms',
    query:
      'SELECT e.* FROM knowledge_graph_edges e WHERE e.source_node_id = $1 AND e.is_active = true',
  },
  getIncomingEdges: {
    description: 'Get all incoming edges to a node',
    indexes: ['idx_edges_target_type'],
    estimatedTime: '< 5ms',
    query:
      'SELECT e.* FROM knowledge_graph_edges e WHERE e.target_node_id = $1 AND e.is_active = true',
  },
  getEdgesBetweenNodes: {
    description: 'Check if an edge exists between two nodes',
    indexes: ['idx_edges_source_target'],
    estimatedTime: '< 1ms',
    query:
      'SELECT e.* FROM knowledge_graph_edges e WHERE e.source_node_id = $1 AND e.target_node_id = $2 AND e.is_active = true',
  },
  traverseGraph: {
    description: 'Recursive traversal of graph (BFS/DFS)',
    indexes: ['idx_edges_source_type', 'idx_edges_target_type'],
    estimatedTime: '< 1s (depends on depth and branching)',
    query: `
      WITH RECURSIVE graph_traversal AS (
        SELECT e.id, e.source_node_id, e.target_node_id, 1 as depth
        FROM knowledge_graph_edges e
        WHERE e.source_node_id = $1 AND e.is_active = true
        UNION ALL
        SELECT e.id, e.source_node_id, e.target_node_id, gt.depth + 1
        FROM knowledge_graph_edges e
        INNER JOIN graph_traversal gt ON e.source_node_id = gt.target_node_id
        WHERE gt.depth < $2 AND e.is_active = true
      )
      SELECT DISTINCT target_node_id FROM graph_traversal
    `,
  },
  findPathBetweenNodes: {
    description: 'Find shortest path between two nodes',
    indexes: ['idx_edges_source_target'],
    estimatedTime: '< 500ms (for reasonable paths)',
    query: `
      WITH RECURSIVE path_search AS (
        SELECT source_node_id, target_node_id, ARRAY[source_node_id, target_node_id] as path, 1 as depth
        FROM knowledge_graph_edges
        WHERE source_node_id = $1 AND is_active = true
        UNION ALL
        SELECT e.source_node_id, e.target_node_id, path || e.target_node_id, ps.depth + 1
        FROM knowledge_graph_edges e
        INNER JOIN path_search ps ON e.source_node_id = ps.target_node_id
        WHERE NOT e.target_node_id = ANY(ps.path) AND ps.depth < 10 AND e.is_active = true
      )
      SELECT path FROM path_search WHERE target_node_id = $2 LIMIT 1
    `,
  },
  getGraphAnalytics: {
    description: 'Calculate graph statistics and metrics',
    indexes: ['PRIMARY KEY', 'idx_edges_source_type'],
    estimatedTime: '< 5s (for large graphs)',
    query: `
      SELECT
        COUNT(DISTINCT n.id) as node_count,
        COUNT(DISTINCT e.id) as edge_count,
        AVG(out_degree.out_count) as avg_out_degree,
        AVG(in_degree.in_count) as avg_in_degree
      FROM knowledge_graph_nodes n
      LEFT JOIN knowledge_graph_edges e ON n.id = e.source_node_id AND e.is_active = true
      LEFT JOIN (
        SELECT source_node_id, COUNT(*) as out_count
        FROM knowledge_graph_edges
        WHERE is_active = true
        GROUP BY source_node_id
      ) out_degree ON n.id = out_degree.source_node_id
      LEFT JOIN (
        SELECT target_node_id, COUNT(*) as in_count
        FROM knowledge_graph_edges
        WHERE is_active = true
        GROUP BY target_node_id
      ) in_degree ON n.id = in_degree.target_node_id
      WHERE n.organization_id = $1 AND n.is_active = true
    `,
  },
};

/**
 * Data Validation Rules
 *
 * Defines validation constraints for graph data.
 */
export const DATA_VALIDATION_RULES = {
  node: {
    id: {
      type: 'string',
      format: 'uuid',
      required: true,
      description: 'Unique identifier',
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      required: true,
      description: 'Node name or label',
    },
    type: {
      type: 'enum',
      enum: Object.values(NodeType),
      required: true,
      description: 'Node type classification',
    },
    description: {
      type: 'string',
      maxLength: 5000,
      required: false,
      nullable: true,
      description: 'Detailed description',
    },
    organizationId: {
      type: 'string',
      format: 'uuid',
      required: true,
      description: 'Organization context',
    },
    properties: {
      type: 'object',
      maxProperties: 1000,
      maxValueLength: 10000,
      required: false,
      description: 'Flexible properties for domain-specific data',
    },
    tags: {
      type: 'array',
      maxItems: 100,
      itemMaxLength: 100,
      required: false,
      description: 'Categorization tags',
    },
    isActive: {
      type: 'boolean',
      default: true,
      required: false,
      description: 'Soft delete flag',
    },
  },
  edge: {
    id: {
      type: 'string',
      format: 'uuid',
      required: true,
      description: 'Unique identifier',
    },
    sourceNodeId: {
      type: 'string',
      format: 'uuid',
      required: true,
      description: 'Source node reference',
    },
    targetNodeId: {
      type: 'string',
      format: 'uuid',
      required: true,
      description: 'Target node reference',
    },
    type: {
      type: 'enum',
      enum: Object.values(RelationshipType),
      required: true,
      description: 'Relationship type',
    },
    organizationId: {
      type: 'string',
      format: 'uuid',
      required: true,
      description: 'Organization context',
    },
    weight: {
      type: 'number',
      minimum: 0,
      maximum: 1000,
      default: 1.0,
      required: false,
      description: 'Edge weight for weighted algorithms',
    },
    properties: {
      type: 'object',
      maxProperties: 500,
      maxValueLength: 5000,
      required: false,
      description: 'Flexible properties for relationship-specific data',
    },
    isActive: {
      type: 'boolean',
      default: true,
      required: false,
      description: 'Soft delete flag',
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      required: false,
      description: 'Confidence score for inferred relationships',
    },
  },
};

/**
 * Storage Strategy Configuration
 *
 * Defines different storage backend options and their characteristics.
 */
export const STORAGE_STRATEGIES = {
  persistent: {
    backend: 'PostgreSQL with TypeORM',
    advantages: [
      'ACID compliance',
      'Scalability',
      'Full persistence',
      'Multi-tenancy support',
    ],
    disadvantages: ['Slower than in-memory', 'Network latency'],
    bestFor: 'Production use, multi-tenant systems, large datasets',
    maxNodes: 'Millions',
    maxEdges: 'Millions',
    queryLatency: '1-100ms',
  },
  inMemory: {
    backend: 'In-memory graph structure',
    advantages: ['Fast queries', 'Low latency', 'Simple implementation'],
    disadvantages: ['Data loss on restart', 'Memory limited', 'No persistence'],
    bestFor: 'Testing, temporary graphs, real-time analysis',
    maxNodes: '100K-1M (depends on available memory)',
    maxEdges: '100K-1M',
    queryLatency: '< 1ms',
  },
  hybrid: {
    backend: 'In-memory cache with PostgreSQL persistence',
    advantages: [
      'Fast queries for hot data',
      'Persistence',
      'Scalability',
      'Flexible',
    ],
    disadvantages: ['Complexity', 'Sync overhead'],
    bestFor: 'Large datasets with frequent access patterns',
    maxNodes: 'Millions (PostgreSQL) + cache size',
    maxEdges: 'Millions',
    queryLatency: '< 10ms (cached) / 1-100ms (cold)',
  },
};

/**
 * Graph Limits and Constraints
 *
 * Defines system limits to prevent resource exhaustion.
 */
export const GRAPH_LIMITS = {
  // Node limits
  maxNodeNameLength: 255,
  maxNodeDescriptionLength: 5000,
  maxNodeProperties: 1000,
  maxNodeTags: 100,
  maxNodeTagLength: 100,
  maxNodesPerOrganization: 10000000,
  maxOutgoingEdgesPerNode: 100000,
  maxIncomingEdgesPerNode: 100000,

  // Edge limits
  maxEdgePropertyCount: 500,
  maxEdgesPerOrganization: 50000000,
  maxWeightValue: 1000,
  minWeightValue: 0,
  maxConfidenceValue: 1,
  minConfidenceValue: 0,

  // Query limits
  maxQueryResults: 10000,
  maxPageSize: 1000,
  maxSearchQueryLength: 500,
  maxTraversalDepth: 50,
  maxPathLength: 100,
  queryTimeoutMs: 30000,

  // Batch operation limits
  maxBatchOperations: 10000,
  maxBatchSize: 100000,
  maxConcurrentOperations: 100,

  // Embedding limits (if enabled)
  maxEmbeddingDimension: 4096,
  minEmbeddingDimension: 8,
  defaultEmbeddingDimension: 384,
};

/**
 * Performance Guidelines
 *
 * Recommended practices for optimal graph performance.
 */
export const PERFORMANCE_GUIDELINES = {
  indexing: [
    'Always index on frequently filtered columns (organization_id, type, is_active)',
    'Use composite indexes for multi-column WHERE clauses',
    'Maintain indexes on foreign keys (source_node_id, target_node_id)',
    'Consider trigram indexes for full-text search',
    'Review index usage with EXPLAIN ANALYZE',
  ],
  querying: [
    'Use pagination for large result sets',
    'Filter by organization_id and is_active early in WHERE clause',
    'Avoid SELECT * - specify only needed columns',
    'Use LIMIT to prevent loading too much data',
    'Consider denormalization for frequently accessed patterns',
  ],
  traversal: [
    'Limit traversal depth to prevent exponential growth',
    'Filter by edge types to reduce search space',
    'Use shortest path algorithms for pathfinding',
    'Cache frequently accessed subgraphs',
    'Implement early termination conditions',
  ],
  maintenance: [
    'Regularly analyze table statistics (ANALYZE)',
    'Monitor slow queries with pg_stat_statements',
    'Vacuum tables periodically to reclaim space',
    'Archive or delete inactive nodes/edges',
    'Review and optimize index usage',
  ],
};
