import { NodeType } from '../entities/node.entity';
import { RelationshipType } from '../../../knowledge/enums/relationship-type.enum';

/**
 * Graph Storage Schema
 *
 * Defines the storage format and validation schemas for knowledge graph data.
 * These schemas ensure data integrity across different storage strategies
 * (persistent, in-memory, hybrid) and provide a consistent format for
 * export/import operations.
 */

/**
 * JSON Schema for Node Storage
 *
 * Defines the complete structure for storing a node in JSON format.
 * Used for export/import, caching, and in-memory storage.
 *
 * @remarks
 * This schema is compatible with JSON Schema Draft 7 specification.
 */
export const NodeStorageSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'hollon-ai://schemas/graph-node-storage.json',
  title: 'Graph Node Storage Schema',
  description: 'Schema for storing knowledge graph nodes',
  type: 'object',
  required: [
    'id',
    'name',
    'type',
    'organizationId',
    'properties',
    'tags',
    'isActive',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the node',
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      description: 'Human-readable name/label for the node',
    },
    type: {
      type: 'string',
      enum: Object.values(NodeType),
      description: 'Type/category of the node',
    },
    description: {
      type: ['string', 'null'],
      description: 'Optional detailed description',
    },
    organizationId: {
      type: 'string',
      format: 'uuid',
      description: 'Organization context for multi-tenancy',
    },
    properties: {
      type: 'object',
      description: 'Flexible properties for domain-specific data',
      additionalProperties: true,
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
      },
      description: 'Tags for categorization and search',
    },
    isActive: {
      type: 'boolean',
      description: 'Soft delete flag',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'Creation timestamp',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'Last update timestamp',
    },
    embedding: {
      type: 'array',
      items: {
        type: 'number',
      },
      minItems: 128,
      maxItems: 3072,
      description: 'Optional vector embedding for semantic search',
    },
    contentHash: {
      type: 'string',
      pattern: '^[a-f0-9]{64}$',
      description: 'SHA-256 hash for duplicate detection',
    },
  },
  additionalProperties: false,
} as const;

/**
 * JSON Schema for Edge Storage
 *
 * Defines the complete structure for storing an edge in JSON format.
 * Used for export/import, caching, and in-memory storage.
 */
export const EdgeStorageSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'hollon-ai://schemas/graph-edge-storage.json',
  title: 'Graph Edge Storage Schema',
  description: 'Schema for storing knowledge graph edges',
  type: 'object',
  required: [
    'id',
    'sourceNodeId',
    'targetNodeId',
    'type',
    'organizationId',
    'weight',
    'properties',
    'isActive',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the edge',
    },
    sourceNodeId: {
      type: 'string',
      format: 'uuid',
      description: 'Source node identifier',
    },
    targetNodeId: {
      type: 'string',
      format: 'uuid',
      description: 'Target node identifier',
    },
    type: {
      type: 'string',
      enum: Object.values(RelationshipType),
      description: 'Type of relationship',
    },
    organizationId: {
      type: 'string',
      format: 'uuid',
      description: 'Organization context for multi-tenancy',
    },
    weight: {
      type: 'number',
      minimum: 0,
      description: 'Weight for weighted graph algorithms',
    },
    properties: {
      type: 'object',
      description: 'Flexible properties for relationship-specific data',
      additionalProperties: true,
    },
    isActive: {
      type: 'boolean',
      description: 'Soft delete flag',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'Creation timestamp',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'Last update timestamp',
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Confidence score for inferred relationships',
    },
  },
  additionalProperties: false,
} as const;

/**
 * JSON Schema for Graph Structure Storage
 *
 * Defines the complete structure for storing a graph or subgraph.
 * Used for export/import operations and graph serialization.
 */
export const GraphStructureSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'hollon-ai://schemas/graph-structure-storage.json',
  title: 'Graph Structure Storage Schema',
  description: 'Schema for storing complete graph structures',
  type: 'object',
  required: ['nodes', 'edges', 'metadata'],
  properties: {
    nodes: {
      type: 'array',
      items: NodeStorageSchema,
      description: 'All nodes in the graph',
    },
    edges: {
      type: 'array',
      items: EdgeStorageSchema,
      description: 'All edges in the graph',
    },
    metadata: {
      type: 'object',
      required: [
        'nodeCount',
        'edgeCount',
        'organizationId',
        'createdAt',
        'updatedAt',
        'nodeTypeDistribution',
        'edgeTypeDistribution',
        'schemaVersion',
      ],
      properties: {
        nodeCount: {
          type: 'integer',
          minimum: 0,
          description: 'Total number of nodes',
        },
        edgeCount: {
          type: 'integer',
          minimum: 0,
          description: 'Total number of edges',
        },
        organizationId: {
          type: 'string',
          format: 'uuid',
          description: 'Organization context',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp of graph creation/export',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp of last modification',
        },
        nodeTypeDistribution: {
          type: 'object',
          description: 'Node type distribution',
          additionalProperties: {
            type: 'integer',
            minimum: 0,
          },
        },
        edgeTypeDistribution: {
          type: 'object',
          description: 'Edge type distribution',
          additionalProperties: {
            type: 'integer',
            minimum: 0,
          },
        },
        rootNodeId: {
          type: 'string',
          format: 'uuid',
          description: 'Optional root node ID for subgraphs',
        },
        maxDepth: {
          type: 'integer',
          minimum: 1,
          description: 'Optional maximum depth for subgraphs',
        },
        schemaVersion: {
          type: 'string',
          pattern: '^\\d+\\.\\d+\\.\\d+$',
          description: 'Version of the graph schema (semver format)',
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

/**
 * JSON Schema for Update Operations
 *
 * Defines the structure for incremental update operations.
 * Used for change tracking, audit trails, and rollback operations.
 */
export const UpdateOperationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'hollon-ai://schemas/update-operation-storage.json',
  title: 'Update Operation Storage Schema',
  description: 'Schema for storing graph update operations',
  type: 'object',
  required: ['id', 'type', 'timestamp', 'organizationId'],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the operation',
    },
    type: {
      type: 'string',
      enum: [
        'add_node',
        'update_node',
        'remove_node',
        'add_edge',
        'update_edge',
        'remove_edge',
        'merge_nodes',
      ],
      description: 'Type of update operation',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Timestamp of the operation',
    },
    organizationId: {
      type: 'string',
      format: 'uuid',
      description: 'Organization context',
    },
    node: {
      type: 'object',
      description: 'Node data for node operations',
      additionalProperties: true,
    },
    edge: {
      type: 'object',
      description: 'Edge data for edge operations',
      additionalProperties: true,
    },
    sourceNodeId: {
      type: 'string',
      format: 'uuid',
      description: 'Source node ID for merge operations',
    },
    targetNodeId: {
      type: 'string',
      format: 'uuid',
      description: 'Target node ID for merge operations',
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata about the operation',
      additionalProperties: true,
    },
  },
  additionalProperties: false,
} as const;

/**
 * Storage Format Version
 *
 * Current version of the graph storage format.
 * Update this when making breaking changes to the schema.
 *
 * Format: MAJOR.MINOR.PATCH (semver)
 * - MAJOR: Breaking changes (incompatible with previous versions)
 * - MINOR: New features (backward compatible)
 * - PATCH: Bug fixes (backward compatible)
 */
export const GRAPH_SCHEMA_VERSION = '1.0.0';

/**
 * Database Table Schema Definitions
 *
 * SQL DDL statements for creating the database schema.
 * These are used for migrations and schema documentation.
 */
export const DatabaseSchema = {
  /**
   * Nodes Table Schema
   *
   * PostgreSQL table definition for storing graph nodes.
   */
  nodesTable: `
    CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      description TEXT,
      organization_id UUID NOT NULL,
      properties JSONB DEFAULT '{}'::jsonb,
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      -- Indexes for performance
      CONSTRAINT fk_organization FOREIGN KEY (organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE
    );

    -- Standard indexes
    CREATE INDEX IF NOT EXISTS idx_nodes_type ON knowledge_graph_nodes(type);
    CREATE INDEX IF NOT EXISTS idx_nodes_organization ON knowledge_graph_nodes(organization_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_created_at ON knowledge_graph_nodes(created_at);
    CREATE INDEX IF NOT EXISTS idx_nodes_tags ON knowledge_graph_nodes USING GIN(tags);

    -- Composite indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_nodes_org_type
      ON knowledge_graph_nodes(organization_id, type);
    CREATE INDEX IF NOT EXISTS idx_nodes_org_active
      ON knowledge_graph_nodes(organization_id, is_active);

    -- JSONB indexes for property queries
    CREATE INDEX IF NOT EXISTS idx_nodes_properties
      ON knowledge_graph_nodes USING GIN(properties);

    -- Full-text search index on name and description
    CREATE INDEX IF NOT EXISTS idx_nodes_fulltext
      ON knowledge_graph_nodes USING GIN(
        to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, ''))
      );
  `,

  /**
   * Edges Table Schema
   *
   * PostgreSQL table definition for storing graph edges.
   */
  edgesTable: `
    CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_node_id UUID NOT NULL,
      target_node_id UUID NOT NULL,
      type VARCHAR(50) NOT NULL,
      organization_id UUID NOT NULL,
      weight FLOAT DEFAULT 1.0,
      properties JSONB DEFAULT '{}'::jsonb,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      -- Foreign key constraints
      CONSTRAINT fk_source_node FOREIGN KEY (source_node_id)
        REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
      CONSTRAINT fk_target_node FOREIGN KEY (target_node_id)
        REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
      CONSTRAINT fk_organization FOREIGN KEY (organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE,

      -- Prevent self-loops (optional)
      CONSTRAINT chk_no_self_loops CHECK (source_node_id != target_node_id)
    );

    -- Standard indexes
    CREATE INDEX IF NOT EXISTS idx_edges_type ON knowledge_graph_edges(type);
    CREATE INDEX IF NOT EXISTS idx_edges_organization ON knowledge_graph_edges(organization_id);
    CREATE INDEX IF NOT EXISTS idx_edges_created_at ON knowledge_graph_edges(created_at);

    -- Relationship indexes for graph traversal
    CREATE INDEX IF NOT EXISTS idx_edges_source_target
      ON knowledge_graph_edges(source_node_id, target_node_id);
    CREATE INDEX IF NOT EXISTS idx_edges_source_type
      ON knowledge_graph_edges(source_node_id, type);
    CREATE INDEX IF NOT EXISTS idx_edges_target_type
      ON knowledge_graph_edges(target_node_id, type);

    -- Composite indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_edges_org_type
      ON knowledge_graph_edges(organization_id, type);
    CREATE INDEX IF NOT EXISTS idx_edges_org_active
      ON knowledge_graph_edges(organization_id, is_active);

    -- JSONB indexes for property queries
    CREATE INDEX IF NOT EXISTS idx_edges_properties
      ON knowledge_graph_edges USING GIN(properties);
  `,

  /**
   * Update History Table Schema
   *
   * PostgreSQL table for tracking incremental updates.
   */
  updateHistoryTable: `
    CREATE TABLE IF NOT EXISTS knowledge_graph_update_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operation_type VARCHAR(50) NOT NULL,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      organization_id UUID NOT NULL,
      node_data JSONB,
      edge_data JSONB,
      source_node_id UUID,
      target_node_id UUID,
      metadata JSONB,

      CONSTRAINT fk_organization FOREIGN KEY (organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE
    );

    -- Indexes for querying update history
    CREATE INDEX IF NOT EXISTS idx_update_history_org
      ON knowledge_graph_update_history(organization_id);
    CREATE INDEX IF NOT EXISTS idx_update_history_timestamp
      ON knowledge_graph_update_history(timestamp);
    CREATE INDEX IF NOT EXISTS idx_update_history_operation
      ON knowledge_graph_update_history(operation_type);
    CREATE INDEX IF NOT EXISTS idx_update_history_org_timestamp
      ON knowledge_graph_update_history(organization_id, timestamp DESC);
  `,

  /**
   * Vector Embeddings Extension
   *
   * SQL for enabling pgvector extension for semantic search.
   * This is optional and only needed if embeddings are enabled.
   */
  vectorExtension: `
    -- Enable pgvector extension
    CREATE EXTENSION IF NOT EXISTS vector;

    -- Add embedding column to nodes table
    ALTER TABLE knowledge_graph_nodes
      ADD COLUMN IF NOT EXISTS embedding vector(1536);

    -- Add vector similarity index (using HNSW for fast approximate search)
    CREATE INDEX IF NOT EXISTS idx_nodes_embedding_hnsw
      ON knowledge_graph_nodes USING hnsw (embedding vector_cosine_ops);

    -- Alternative: IVFFlat index (faster insert, slower search)
    -- CREATE INDEX idx_nodes_embedding_ivfflat
    --   ON knowledge_graph_nodes USING ivfflat (embedding vector_cosine_ops)
    --   WITH (lists = 100);
  `,

  /**
   * Content Hash Column for Duplicate Detection
   *
   * SQL for adding content hash column for efficient duplicate detection.
   */
  duplicateDetection: `
    -- Add content hash column
    ALTER TABLE knowledge_graph_nodes
      ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

    -- Index for fast duplicate detection
    CREATE INDEX IF NOT EXISTS idx_nodes_content_hash
      ON knowledge_graph_nodes(content_hash)
      WHERE content_hash IS NOT NULL;

    -- Composite index for org-scoped duplicate detection
    CREATE INDEX IF NOT EXISTS idx_nodes_org_hash
      ON knowledge_graph_nodes(organization_id, content_hash)
      WHERE content_hash IS NOT NULL;
  `,

  /**
   * Triggers for Automatic Timestamp Updates
   *
   * SQL for creating triggers that automatically update the updated_at column.
   */
  timestampTriggers: `
    -- Create trigger function
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Apply to nodes table
    DROP TRIGGER IF EXISTS trigger_update_nodes_timestamp
      ON knowledge_graph_nodes;
    CREATE TRIGGER trigger_update_nodes_timestamp
      BEFORE UPDATE ON knowledge_graph_nodes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- Apply to edges table
    DROP TRIGGER IF EXISTS trigger_update_edges_timestamp
      ON knowledge_graph_edges;
    CREATE TRIGGER trigger_update_edges_timestamp
      BEFORE UPDATE ON knowledge_graph_edges
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `,
};

/**
 * Index Strategy Configuration
 *
 * Defines different indexing strategies based on workload patterns.
 */
export const IndexStrategies = {
  /**
   * Read-Heavy Workload Strategy
   *
   * Optimized for frequent queries with fewer writes.
   * Includes more indexes for faster lookups.
   */
  readHeavy: {
    description: 'Optimized for read-heavy workloads with complex queries',
    indexes: [
      'idx_nodes_type',
      'idx_nodes_organization',
      'idx_nodes_created_at',
      'idx_nodes_tags',
      'idx_nodes_org_type',
      'idx_nodes_org_active',
      'idx_nodes_properties',
      'idx_nodes_fulltext',
      'idx_edges_type',
      'idx_edges_organization',
      'idx_edges_created_at',
      'idx_edges_source_target',
      'idx_edges_source_type',
      'idx_edges_target_type',
      'idx_edges_org_type',
      'idx_edges_org_active',
      'idx_edges_properties',
    ],
  },

  /**
   * Write-Heavy Workload Strategy
   *
   * Optimized for frequent writes with fewer queries.
   * Includes only essential indexes to minimize write overhead.
   */
  writeHeavy: {
    description: 'Optimized for write-heavy workloads with minimal overhead',
    indexes: [
      'idx_nodes_organization',
      'idx_nodes_org_type',
      'idx_edges_organization',
      'idx_edges_source_target',
    ],
  },

  /**
   * Balanced Workload Strategy
   *
   * Balanced between read and write performance.
   * Default strategy for most use cases.
   */
  balanced: {
    description: 'Balanced performance for mixed read/write workloads',
    indexes: [
      'idx_nodes_type',
      'idx_nodes_organization',
      'idx_nodes_org_type',
      'idx_nodes_org_active',
      'idx_edges_type',
      'idx_edges_organization',
      'idx_edges_source_target',
      'idx_edges_source_type',
      'idx_edges_target_type',
    ],
  },

  /**
   * Analytics Workload Strategy
   *
   * Optimized for complex analytical queries and graph algorithms.
   * Includes indexes for graph traversal and aggregations.
   */
  analytics: {
    description: 'Optimized for analytical queries and graph algorithms',
    indexes: [
      'idx_nodes_type',
      'idx_nodes_organization',
      'idx_nodes_created_at',
      'idx_nodes_org_type',
      'idx_edges_type',
      'idx_edges_organization',
      'idx_edges_source_target',
      'idx_edges_source_type',
      'idx_edges_target_type',
      'idx_edges_org_type',
    ],
  },
};

/**
 * Storage Constraints and Limits
 *
 * Defines constraints and recommended limits for graph storage.
 */
export const StorageConstraints = {
  /** Maximum length for node names */
  maxNodeNameLength: 255,

  /** Maximum length for tag values */
  maxTagLength: 255,

  /** Maximum number of tags per node */
  maxTagsPerNode: 100,

  /** Maximum size for properties JSONB (in bytes) */
  maxPropertiesSize: 1048576, // 1 MB

  /** Maximum number of nodes per organization (soft limit) */
  recommendedMaxNodes: 1000000,

  /** Maximum number of edges per organization (soft limit) */
  recommendedMaxEdges: 10000000,

  /** Maximum embedding dimension */
  maxEmbeddingDimension: 3072,

  /** Minimum embedding dimension */
  minEmbeddingDimension: 128,

  /** Maximum depth for graph traversal */
  maxTraversalDepth: 10,

  /** Maximum nodes in a single query result (without pagination) */
  maxQueryResultSize: 10000,

  /** Maximum batch size for bulk operations */
  maxBatchSize: 1000,

  /** Maximum update history records to maintain per organization */
  maxUpdateHistory: 100000,
};

/**
 * Type Guards for Schema Validation
 *
 * Runtime type checking functions for graph data structures.
 */
export const SchemaValidators = {
  /**
   * Validate node data against storage schema
   */
  isValidNode: (data: unknown): boolean => {
    if (typeof data !== 'object' || data === null) return false;
    const node = data as Record<string, unknown>;

    return (
      typeof node.id === 'string' &&
      typeof node.name === 'string' &&
      node.name.length > 0 &&
      node.name.length <= StorageConstraints.maxNodeNameLength &&
      Object.values(NodeType).includes(node.type as NodeType) &&
      typeof node.organizationId === 'string' &&
      typeof node.properties === 'object' &&
      Array.isArray(node.tags) &&
      typeof node.isActive === 'boolean' &&
      (node.createdAt instanceof Date || typeof node.createdAt === 'string') &&
      (node.updatedAt instanceof Date || typeof node.updatedAt === 'string')
    );
  },

  /**
   * Validate edge data against storage schema
   */
  isValidEdge: (data: unknown): boolean => {
    if (typeof data !== 'object' || data === null) return false;
    const edge = data as Record<string, unknown>;

    return (
      typeof edge.id === 'string' &&
      typeof edge.sourceNodeId === 'string' &&
      typeof edge.targetNodeId === 'string' &&
      edge.sourceNodeId !== edge.targetNodeId && // No self-loops
      Object.values(RelationshipType).includes(edge.type as RelationshipType) &&
      typeof edge.organizationId === 'string' &&
      typeof edge.weight === 'number' &&
      edge.weight >= 0 &&
      typeof edge.properties === 'object' &&
      typeof edge.isActive === 'boolean' &&
      (edge.createdAt instanceof Date || typeof edge.createdAt === 'string') &&
      (edge.updatedAt instanceof Date || typeof edge.updatedAt === 'string')
    );
  },

  /**
   * Validate graph structure data
   */
  isValidGraphStructure: (data: unknown): boolean => {
    if (typeof data !== 'object' || data === null) return false;
    const structure = data as Record<string, unknown>;

    return (
      Array.isArray(structure.nodes) &&
      Array.isArray(structure.edges) &&
      typeof structure.metadata === 'object' &&
      structure.metadata !== null
    );
  },
};

/**
 * Migration Utilities
 *
 * Helper functions for schema migrations and version upgrades.
 */
export const MigrationUtils = {
  /**
   * Get the current schema version
   */
  getCurrentVersion: (): string => GRAPH_SCHEMA_VERSION,

  /**
   * Check if a schema version is compatible
   */
  isCompatibleVersion: (version: string): boolean => {
    const [major] = version.split('.').map(Number);
    const [currentMajor] = GRAPH_SCHEMA_VERSION.split('.').map(Number);
    return major === currentMajor;
  },

  /**
   * Migrate data from old schema version to current version
   */
  migrateData: (data: unknown, fromVersion: string): unknown => {
    // Future: Implement migration logic for different versions
    // For now, just pass through if compatible
    if (MigrationUtils.isCompatibleVersion(fromVersion)) {
      return data;
    }
    throw new Error(
      `Incompatible schema version: ${fromVersion}. Current version: ${GRAPH_SCHEMA_VERSION}`,
    );
  },
};
