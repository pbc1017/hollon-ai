# Knowledge Graph Architecture Design

## Overview

The Knowledge Graph module provides a flexible, scalable graph database system for representing and querying relationships between entities in the Hollon-AI system. This document describes the complete architecture including data structures, storage strategies, and API contracts.

**Status**: ✅ Architecture Design Complete (2026-01-07)  
**Files**:

- `interfaces/graph.interface.ts` - Core interfaces and types
- `dto/graph.dto.ts` - Data Transfer Objects with validation

## Architecture Principles

### 1. Multi-Tenancy

- All operations are scoped by `organizationId`
- Ensures data isolation between organizations
- Composite indexes optimize organization-level queries

### 2. Flexible Storage Strategy

- **Persistent**: PostgreSQL with TypeORM (ACID guarantees)
- **In-Memory**: Fast, volatile storage for temporary graphs
- **Hybrid**: Hot data in memory with periodic persistence

### 3. Soft Delete Pattern

- `isActive` flag enables soft deletes
- Preserves data for recovery and audit trails
- All queries filter by active status by default

### 4. Type Safety

- TypeScript interfaces for all data structures
- Enum-based type systems for nodes and edges
- Comprehensive validation via class-validator

## Core Data Structures

### Node Schema

```typescript
interface IGraphNode {
  // Identity
  id: string; // UUID
  organizationId: string; // Multi-tenancy

  // Core Properties
  name: string; // Human-readable label
  type: NodeType; // Entity category
  description?: string | null; // Detailed description

  // Flexible Data
  properties: Record<string, any>; // Domain-specific JSONB data
  tags: string[]; // Categorization/search

  // Metadata
  isActive: boolean; // Soft delete flag
  createdAt: Date;
  updatedAt: Date;

  // Optional Features
  embedding?: number[]; // Vector embeddings for semantic search
  contentHash?: string; // For duplicate detection
}
```

### Edge Schema

```typescript
interface IGraphEdge {
  // Identity
  id: string; // UUID
  organizationId: string; // Multi-tenancy

  // Relationship
  sourceNodeId: string; // Source node reference
  targetNodeId: string; // Target node reference
  type: RelationshipType; // Relationship category

  // Graph Features
  weight: number; // For weighted algorithms (default: 1.0)
  properties: Record<string, any>; // Relationship-specific JSONB data

  // Metadata
  isActive: boolean; // Soft delete flag
  createdAt: Date;
  updatedAt: Date;

  // Optional Features
  confidence?: number; // For inferred relationships (0-1)
}
```

### Node Types

```typescript
enum NodeType {
  PERSON = 'person',
  ORGANIZATION = 'organization',
  TEAM = 'team',
  TASK = 'task',
  DOCUMENT = 'document',
  CODE = 'code',
  CONCEPT = 'concept',
  GOAL = 'goal',
  SKILL = 'skill',
  TOOL = 'tool',
  CUSTOM = 'custom',
}
```

### Relationship Types

```typescript
enum RelationshipType {
  RELATES_TO = 'relates_to',
  DERIVES_FROM = 'derives_from',
  SUPERSEDES = 'supersedes',
  REFERENCES = 'references',
  CONTRADICTS = 'contradicts',
  SUPPORTS = 'supports',
  DEPENDS_ON = 'depends_on',
  FOLLOWS = 'follows',
  PRECEDES = 'precedes',
  IMPLEMENTS = 'implements',
  DOCUMENTS = 'documents',
  EXPLAINS = 'explains',
  EXEMPLIFIES = 'exemplifies',
}
```

## Storage Strategy

### Storage Provider Interface

```typescript
interface IStorageProvider {
  strategy: StorageStrategy;

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<boolean>;

  // CRUD Operations
  saveNode(node: IGraphNode): Promise<IGraphNode>;
  getNode(id: string): Promise<IGraphNode | null>;
  saveEdge(edge: IGraphEdge): Promise<IGraphEdge>;
  getEdge(id: string): Promise<IGraphEdge | null>;
  deleteNode(id: string): Promise<void>;
  deleteEdge(id: string): Promise<void>;

  // Bulk Queries
  getNodesByOrganization(organizationId: string): Promise<IGraphNode[]>;
  getEdgesByOrganization(organizationId: string): Promise<IGraphEdge[]>;

  // Batch Operations
  executeBatch(operations: IUpdateOperation[]): Promise<void>;
}
```

### Storage Strategies

1. **Persistent (PostgreSQL)**
   - Full ACID guarantees
   - Complex queries via TypeORM
   - Automatic cascade deletes
   - JSONB support for properties
   - Comprehensive indexing

2. **In-Memory**
   - Ultra-fast operations
   - Suitable for temporary graphs
   - No persistence between restarts
   - Memory-efficient caching

3. **Hybrid**
   - Hot data cached in memory
   - Periodic persistence to database
   - Best of both worlds
   - Configurable cache size

## Graph Operations API

### Query Operations

```typescript
interface IGraphQuery {
  organizationId: string;
  nodeTypes?: NodeType[];
  edgeTypes?: RelationshipType[];
  tags?: string[];
  matchAllTags?: boolean;
  properties?: Record<string, any>;
  searchQuery?: string; // Full-text search
  dateRange?: { startDate: Date; endDate: Date };
  includeInactive?: boolean;
  pagination?: { page: number; limit: number };
  sort?: { field: string; order: 'ASC' | 'DESC' };
}
```

**Supported Queries:**

- Filter by node/edge types
- Tag-based search (AND/OR logic)
- JSONB property queries
- Full-text search
- Date range filtering
- Pagination and sorting

### Traversal Operations

```typescript
interface IGraphTraversalOptions {
  maxDepth: number; // 1-10 hops
  direction: 'in' | 'out' | 'both';
  edgeTypes?: RelationshipType[];
  nodeTypes?: NodeType[];
  stopAtNodeTypes?: NodeType[]; // Early termination
  includeEdges?: boolean;
  maxNodes?: number; // Result limit
}
```

**Traversal Algorithms:**

- Breadth-first search (BFS)
- Depth-first search (DFS)
- Shortest path finding
- Multi-path discovery
- Subgraph extraction

### Analytics Operations

```typescript
interface IGraphAnalytics {
  nodeDegrees: Map<string, { inDegree: number; outDegree: number }>;
  hubs: IGraphNode[]; // Most connected nodes
  isolatedNodes: IGraphNode[]; // No connections
  cycles: string[][]; // Circular dependencies
  density: number; // Edge/node ratio
  averageClustering: number; // Graph connectivity
  components: string[][]; // Connected components
}
```

**Metrics:**

- Node degree analysis
- Hub identification
- Isolated node detection
- Cycle detection
- Graph density
- Clustering coefficient
- Connected components

## Incremental Updates

### Update Operations

```typescript
enum UpdateOperationType {
  ADD_NODE = 'add_node',
  UPDATE_NODE = 'update_node',
  REMOVE_NODE = 'remove_node',
  ADD_EDGE = 'add_edge',
  UPDATE_EDGE = 'update_edge',
  REMOVE_EDGE = 'remove_edge',
  MERGE_NODES = 'merge_nodes',
}

interface IUpdateOperation {
  id: string;
  type: UpdateOperationType;
  timestamp: Date;
  organizationId: string;
  node?: Partial<IGraphNode>;
  edge?: Partial<IGraphEdge>;
  sourceNodeId?: string; // For merge operations
  targetNodeId?: string;
  metadata?: Record<string, any>;
}
```

### Update Strategy

```typescript
interface IIncrementalUpdateStrategy {
  applyUpdate(operation: IUpdateOperation): Promise<void>;
  applyBatchUpdates(operations: IUpdateOperation[]): Promise<void>;
  validateUpdate(operation: IUpdateOperation): Promise<boolean>;
  rollback(count: number): Promise<void>;
  getUpdateHistory(
    organizationId: string,
    limit?: number,
  ): Promise<IUpdateOperation[]>;
  replayUpdates(fromTimestamp: Date): Promise<void>;
}
```

**Features:**

- Single and batch updates
- Validation before apply
- Rollback support
- Update history audit trail
- Replay from timestamp

## Duplicate Detection & Merging

### Detection

```typescript
interface IDuplicateDetectionResult {
  primaryNode: IGraphNode;
  duplicates: IGraphNode[];
  similarityScores: number[]; // 0-1 for each duplicate
  detectionMethod: string; // Algorithm used
  confidence: number; // 0-1 overall confidence
  suggestedStrategy: MergeStrategy;
}
```

**Detection Methods:**

- Content hash comparison
- Name similarity (Levenshtein, fuzzy matching)
- Property overlap analysis
- Vector embedding similarity
- Tag overlap

### Merge Strategies

```typescript
enum MergeStrategy {
  KEEP_NEWEST = 'keep_newest',
  KEEP_MOST_CONNECTED = 'keep_most_connected',
  MERGE_PROPERTIES = 'merge_properties',
  MANUAL = 'manual',
}

interface IDuplicateMergeResult {
  mergedNode: IGraphNode;
  removedNodeIds: string[];
  redirectedEdgeCount: number;
  strategyUsed: MergeStrategy;
  conflicts: IMergeConflict[];
}
```

**Merge Process:**

1. Identify primary node (based on strategy)
2. Redirect edges from duplicates to primary
3. Merge properties (conflict resolution)
4. Combine tags (deduplicate)
5. Soft-delete duplicate nodes
6. Return merge result

### Conflict Resolution

```typescript
interface IMergeConflict {
  propertyKey: string;
  primaryValue: any;
  duplicateValue: any;
  resolution: 'keep_primary' | 'keep_duplicate' | 'merge' | 'manual';
}
```

## Data Transfer Objects (DTOs)

### Query DTOs

- `GraphQueryDto` - Advanced filtering and search
- `GraphTraversalOptionsDto` - Traversal configuration
- `SubgraphQueryDto` - Subgraph extraction
- `FindPathDto` - Path finding
- `AdvancedSearchDto` - Combined node/edge search

### Operation DTOs

- `CreateNodeDto` / `CreateEdgeDto` - Creation with validation
- `UpdateNodeDto` / `UpdateEdgeDto` - Partial updates
- `BulkCreateNodesDto` / `BulkCreateEdgesDto` - Batch operations
- `BulkDeleteDto` - Bulk deletion

### Tag & Property DTOs

- `AddTagsDto` / `RemoveTagsDto` - Tag management
- `FindByTagsDto` - Tag-based queries
- `PropertyQueryDto` - JSONB property queries
- `UpdateNodePropertyDto` - Single property updates

### Import/Export DTOs

- `ImportSubgraphDto` - Subgraph import
- `ExportSubgraphDto` - Subgraph export
- `CloneSubgraphDto` - Cross-organization clone

### Duplicate DTOs

- `DetectDuplicatesDto` - Duplicate detection parameters
- `MergeNodesDto` - Manual merge
- `AutoMergeDuplicatesDto` - Automatic merge configuration

### Configuration DTOs

- `GraphConfigurationUpdateDto` - Update graph settings
- `RegisterIntegrationDto` - Register integration points

### Validation Features

All DTOs use `class-validator` decorators:

- Type validation (`@IsString()`, `@IsUUID()`, etc.)
- Range validation (`@Min()`, `@Max()`)
- Array validation (`@ArrayMinSize()`, `@ArrayMaxSize()`)
- Nested object validation (`@ValidateNested()`)
- Enum validation (`@IsEnum()`)
- Custom constraints

## Integration Architecture

### Integration Points

```typescript
interface IGraphIntegrationPoint {
  moduleName: string;
  integrationType: 'read' | 'write' | 'bidirectional';
  onGraphUpdate?: (operation: IUpdateOperation) => Promise<void>;
  onGraphQuery?: (query: IGraphQuery) => Promise<IGraphQueryResult>;
  supportedNodeTypes: NodeType[];
  supportedEdgeTypes: RelationshipType[];
}
```

**Planned Integrations:**

- **Knowledge Extraction** - Populate graph from extracted data
- **Task Management** - Task dependencies and relationships
- **Orchestration** - Decision-making based on graph queries

## Configuration

```typescript
interface IGraphConfiguration {
  // Storage
  storageStrategy: StorageStrategy;
  cacheSize: number;

  // Duplicate Detection
  enableDuplicateDetection: boolean;
  duplicateThreshold: number; // 0-1
  autoMergeThreshold: number; // 0-1
  defaultMergeStrategy: MergeStrategy;

  // Updates
  enableIncrementalUpdates: boolean;
  maxUpdateHistory: number;

  // Embeddings
  enableEmbeddings: boolean;
  embeddingDimension: number; // 128-2048

  // Analytics
  enableAnalytics: boolean;

  // Integrations
  integrationPoints: IGraphIntegrationPoint[];
}
```

## Database Schema

### Node Entity

```sql
CREATE TABLE knowledge_graph_nodes (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL,
  properties JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,

  -- Indexes
  INDEX idx_nodes_type (type),
  INDEX idx_nodes_org (organization_id),
  INDEX idx_nodes_created (created_at),
  INDEX idx_nodes_org_type (organization_id, type),
  INDEX idx_nodes_org_active (organization_id, is_active)
);
```

### Edge Entity

```sql
CREATE TABLE knowledge_graph_edges (
  id UUID PRIMARY KEY,
  source_node_id UUID NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES knowledge_graph_nodes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  organization_id UUID NOT NULL,
  weight FLOAT DEFAULT 1.0,
  properties JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,

  -- Indexes
  INDEX idx_edges_type (type),
  INDEX idx_edges_source_target (source_node_id, target_node_id),
  INDEX idx_edges_source_type (source_node_id, type),
  INDEX idx_edges_target_type (target_node_id, type),
  INDEX idx_edges_org (organization_id),
  INDEX idx_edges_created (created_at),
  INDEX idx_edges_org_type (organization_id, type),
  INDEX idx_edges_org_active (organization_id, is_active)
);
```

## Performance Considerations

### Indexing Strategy

- Composite indexes for common query patterns
- JSONB GIN indexes for property queries
- Partial indexes for active records only

### Query Optimization

- Pagination for large result sets
- Lazy loading of relationships
- Query result caching (configurable)
- Batch operations for bulk updates

### Scalability

- Horizontal scaling via organization sharding
- Read replicas for query distribution
- Graph partitioning for very large graphs
- In-memory caching layer

## Security Considerations

### Multi-Tenancy

- All operations validate organization access
- No cross-organization queries allowed
- Composite indexes ensure efficient filtering

### Data Validation

- Input validation via DTOs
- Type constraints on enums
- UUID validation for references
- Property schema validation (optional)

### Audit Trail

- Update history tracking
- Soft delete for recovery
- Timestamp tracking on all entities

## Future Enhancements

### Phase 1 (Completed)

- ✅ Core data structures
- ✅ Storage strategies
- ✅ Query interfaces
- ✅ Update operations
- ✅ Duplicate detection
- ✅ DTO definitions

### Phase 2 (Planned)

- [ ] Implement storage providers
- [ ] Build query engine
- [ ] Add traversal algorithms
- [ ] Create analytics engine
- [ ] Implement duplicate detection

### Phase 3 (Future)

- [ ] Vector embeddings integration
- [ ] Machine learning for relationship inference
- [ ] Real-time graph updates via WebSockets
- [ ] Graph visualization API
- [ ] Export to graph formats (GraphML, GEXF)

## References

- TypeORM: https://typeorm.io/
- PostgreSQL JSONB: https://www.postgresql.org/docs/current/datatype-json.html
- Graph Algorithms: https://neo4j.com/docs/graph-data-science/
- NestJS: https://docs.nestjs.com/
- class-validator: https://github.com/typestack/class-validator

## Conclusion

This knowledge graph architecture provides:

- ✅ Flexible storage strategies (persistent, in-memory, hybrid)
- ✅ Comprehensive data structures for nodes and edges
- ✅ Rich query and traversal capabilities
- ✅ Incremental update support with rollback
- ✅ Intelligent duplicate detection and merging
- ✅ Full TypeScript type safety
- ✅ Extensive validation via DTOs
- ✅ Multi-tenancy support
- ✅ Scalable and performant design
- ✅ Integration-ready architecture

The design is production-ready and can be implemented incrementally.
