# Knowledge Graph Service - Current Interface Documentation

## File Location

`apps/server/src/modules/knowledge-graph/knowledge-graph.service.ts`

## Overview

The `KnowledgeGraphService` is the core service for managing the knowledge graph functionality in the Hollon-AI system. It provides a flexible graph-based data structure for representing and querying relationships between entities.

## Update Summary (2026-01-07)

This document has been extended to include **missing utility methods** for comprehensive knowledge management:

### New Method Categories Added

1. **Bulk Operations** (4 methods)
   - Batch creation of nodes and edges
   - Bulk delete operations for efficiency
   
2. **Tag Management Operations** (4 methods)
   - Find nodes by tags with AND/OR logic
   - Add/remove tags from nodes
   - Get all available tags for autocomplete
   
3. **Property Query Operations** (4 methods)
   - Query by JSONB property key-value pairs
   - Find nodes/edges with specific property keys
   - Update individual properties without replacing entire object
   
4. **Advanced Search Operations** (3 methods)
   - Combined search across nodes and edges
   - Date range queries
   - Recently modified nodes tracking
   
5. **Graph Validation Operations** (3 methods)
   - Graph integrity validation
   - Orphaned node detection
   - Cycle detection for dependency management
   
6. **Import/Export Operations** (3 methods)
   - JSON export/import for subgraphs
   - Subgraph cloning across organizations
   - Knowledge sharing and templates
   
7. **Utility and Helper Operations** (8 methods)
   - Existence checks (lightweight validation)
   - Type-based counting
   - Node merging and duplication

### Total Methods Documented

- **Core CRUD Operations**: 18 methods (previously documented)
- **Relationship & Traversal**: 8 methods (previously documented)
- **Analytics**: 2 methods (previously documented)
- **New Utility Methods**: 29 methods (newly identified)
- **Grand Total**: 57 methods

### New DTOs Required

Added 9 new DTO categories with detailed field specifications:
- AdvancedSearchDto
- Tag Management DTOs (3 types)
- PropertyQueryDto
- Import/Export DTOs (2 types)
- Bulk Operation DTOs (3 types)
- DateRangeDto

## Current Implementation Status

**Status**: Initial setup with placeholder methods + utility methods identified
**Last Updated**: 2026-01-07

## Dependencies

### Repository Injections

- `nodeRepository: Repository<Node>` - TypeORM repository for Node entities
- `edgeRepository: Repository<Edge>` - TypeORM repository for Edge entities

### External Dependencies

- `@nestjs/common` - Injectable decorator
- `@nestjs/typeorm` - InjectRepository decorator
- `typeorm` - Repository type

### Entity Dependencies

- `Node` from `./entities/node.entity`
- `Edge` from `./entities/edge.entity`

## Current Methods

### 1. findAllNodes()

```typescript
async findAllNodes(): Promise<Node[]>
```

**Status**: Implemented (basic)
**Description**: Retrieves all nodes from the knowledge graph
**Returns**: Promise resolving to an array of all Node entities
**Usage**: Basic query without filtering or pagination

### 2. findAllEdges()

```typescript
async findAllEdges(): Promise<Edge[]>
```

**Status**: Implemented (basic)
**Description**: Retrieves all edges from the knowledge graph
**Returns**: Promise resolving to an array of all Edge entities
**Usage**: Basic query without filtering or pagination

## Entity Structures

### Node Entity

**Table**: `knowledge_graph_nodes`
**Key Fields**:

- `id` (uuid, primary key) - from BaseEntity
- `name` (string, 255) - Node name
- `type` (enum: NodeType) - Node type (person, organization, team, task, document, code, concept, goal, skill, tool, custom)
- `description` (text, nullable) - Node description
- `organizationId` (uuid) - Organization reference
- `properties` (jsonb) - Flexible JSON properties for additional data
- `tags` (text[]) - Array of tags for search and filtering
- `isActive` (boolean) - Soft delete flag
- `createdAt`, `updatedAt` (timestamps) - from BaseEntity

**Relationships**:

- `outgoingEdges: Edge[]` - OneToMany relationship (this node as source)
- `incomingEdges: Edge[]` - OneToMany relationship (this node as target)

**Indexes**:

- `type`
- `organizationId`
- `createdAt`

### Edge Entity

**Table**: `knowledge_graph_edges`
**Key Fields**:

- `id` (uuid, primary key) - from BaseEntity
- `sourceNodeId` (uuid) - Source node reference
- `targetNodeId` (uuid) - Target node reference
- `type` (enum: EdgeType) - Edge type (created_by, belongs_to, manages, collaborates_with, depends_on, references, implements, derives_from, related_to, child_of, part_of, custom)
- `organizationId` (uuid) - Organization reference
- `weight` (float, default: 1.0) - Optional weight for weighted graphs
- `properties` (jsonb) - Flexible JSON properties for relationship data
- `isActive` (boolean) - Soft delete flag
- `createdAt`, `updatedAt` (timestamps) - from BaseEntity

**Relationships**:

- `sourceNode: Node` - ManyToOne relationship (CASCADE delete)
- `targetNode: Node` - ManyToOne relationship (CASCADE delete)

**Indexes**:

- `type`
- `sourceNodeId, targetNodeId` (composite)
- `sourceNodeId, type` (composite)
- `targetNodeId, type` (composite)
- `organizationId`
- `createdAt`

## Required Placeholder Methods

Based on typical knowledge graph operations and the entity structure, the following methods should be added as placeholders:

### Node Operations

#### Create Operations

```typescript
async createNode(data: CreateNodeDto): Promise<Node>
```

- Create a new node in the knowledge graph
- Validate organization context
- Return created node entity

#### Read Operations

```typescript
async findNodeById(id: string): Promise<Node>
```

- Find a specific node by ID
- Include relations if needed
- Throw NotFoundException if not found

```typescript
async findNodesByType(type: NodeType, organizationId: string): Promise<Node[]>
```

- Find all nodes of a specific type within an organization
- Support filtering by isActive

```typescript
async findNodesByOrganization(organizationId: string): Promise<Node[]>
```

- Find all nodes belonging to an organization
- Support filtering and pagination

```typescript
async searchNodes(searchDto: SearchNodesDto): Promise<Node[]>
```

- Search nodes by name, description, tags, or properties
- Support full-text search and filtering
- Return paginated results

#### Update Operations

```typescript
async updateNode(id: string, data: UpdateNodeDto): Promise<Node>
```

- Update an existing node
- Validate organization context
- Return updated node entity

```typescript
async updateNodeProperties(id: string, properties: Record<string, any>): Promise<Node>
```

- Update only the properties field (JSONB)
- Merge with existing properties
- Return updated node entity

#### Delete Operations

```typescript
async deleteNode(id: string): Promise<void>
```

- Hard delete a node
- Cascade delete edges (handled by database)

```typescript
async softDeleteNode(id: string): Promise<Node>
```

- Soft delete by setting isActive to false
- Preserve data for recovery
- Return updated node entity

### Edge Operations

#### Create Operations

```typescript
async createEdge(data: CreateEdgeDto): Promise<Edge>
```

- Create a new edge between nodes
- Validate source and target nodes exist
- Validate organization context
- Return created edge entity

#### Read Operations

```typescript
async findEdgeById(id: string): Promise<Edge>
```

- Find a specific edge by ID
- Include relations if needed
- Throw NotFoundException if not found

```typescript
async findEdgesBySourceNode(sourceNodeId: string): Promise<Edge[]>
```

- Find all outgoing edges from a node
- Support filtering by type and isActive

```typescript
async findEdgesByTargetNode(targetNodeId: string): Promise<Edge[]>
```

- Find all incoming edges to a node
- Support filtering by type and isActive

```typescript
async findEdgesBetweenNodes(sourceNodeId: string, targetNodeId: string): Promise<Edge[]>
```

- Find all edges connecting two specific nodes
- Support bidirectional search option

```typescript
async findEdgesByType(type: EdgeType, organizationId: string): Promise<Edge[]>
```

- Find all edges of a specific type within an organization

#### Update Operations

```typescript
async updateEdge(id: string, data: UpdateEdgeDto): Promise<Edge>
```

- Update an existing edge
- Validate organization context
- Return updated edge entity

```typescript
async updateEdgeWeight(id: string, weight: number): Promise<Edge>
```

- Update edge weight for weighted graph algorithms
- Return updated edge entity

#### Delete Operations

```typescript
async deleteEdge(id: string): Promise<void>
```

- Hard delete an edge

```typescript
async softDeleteEdge(id: string): Promise<Edge>
```

- Soft delete by setting isActive to false
- Return updated edge entity

### Relationship Management Operations

```typescript
async getNodeRelationships(nodeId: string): Promise<{
  outgoing: Edge[];
  incoming: Edge[];
}>
```

- Get all relationships for a node
- Return both outgoing and incoming edges
- Support filtering by type and isActive

```typescript
async getConnectedNodes(nodeId: string, depth?: number): Promise<Node[]>
```

- Get all nodes connected to a given node
- Support depth parameter for multi-hop traversal
- Default depth: 1 (immediate neighbors)

```typescript
async getNodeNeighbors(nodeId: string, direction?: 'in' | 'out' | 'both'): Promise<Node[]>
```

- Get neighboring nodes (1-hop)
- Support direction filtering
- Default: 'both'

### Graph Traversal Operations

```typescript
async findPath(sourceNodeId: string, targetNodeId: string): Promise<Node[]>
```

- Find shortest path between two nodes
- Return array of nodes in path
- Return empty array if no path exists

```typescript
async findAllPaths(sourceNodeId: string, targetNodeId: string, maxDepth?: number): Promise<Node[][]>
```

- Find all paths between two nodes
- Limit by maximum depth to prevent infinite loops
- Return array of paths

```typescript
async getSubgraph(nodeId: string, depth: number): Promise<{
  nodes: Node[];
  edges: Edge[];
}>
```

- Extract a subgraph centered on a node
- Include all nodes and edges within specified depth
- Return both nodes and edges

### Analytics Operations

```typescript
async getNodeDegree(nodeId: string): Promise<{
  inDegree: number;
  outDegree: number;
  totalDegree: number;
}>
```

- Calculate node degree (number of connections)
- Return in-degree, out-degree, and total

```typescript
async getGraphStatistics(organizationId: string): Promise<{
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<NodeType, number>;
  edgesByType: Record<EdgeType, number>;
}>
```

- Get high-level statistics about the knowledge graph
- Group by types
- Filter by organization

### Bulk Operations

```typescript
async createNodesInBatch(nodes: CreateNodeDto[]): Promise<Node[]>
```

- Create multiple nodes in a single transaction
- Improve performance for large-scale knowledge import
- Return array of created nodes
- Rollback all on any validation failure

```typescript
async createEdgesInBatch(edges: CreateEdgeDto[]): Promise<Edge[]>
```

- Create multiple edges in a single transaction
- Validate all source and target nodes exist before insertion
- Return array of created edges
- Rollback all on any validation failure

```typescript
async deleteNodesByIds(ids: string[]): Promise<void>
```

- Hard delete multiple nodes by IDs
- Cascade delete all associated edges
- Execute in transaction for atomicity

```typescript
async softDeleteNodesByIds(ids: string[]): Promise<Node[]>
```

- Soft delete multiple nodes by setting isActive to false
- Return array of updated nodes
- Execute in transaction for atomicity

### Tag Management Operations

```typescript
async findNodesByTags(tags: string[], organizationId: string, matchAll?: boolean): Promise<Node[]>
```

- Find nodes by tags with AND/OR logic
- `matchAll: true` - node must have ALL specified tags (AND)
- `matchAll: false` - node must have ANY specified tag (OR, default)
- Filter by organization and isActive

```typescript
async addTagsToNode(nodeId: string, tags: string[]): Promise<Node>
```

- Add tags to a node (merge with existing)
- Deduplicate tags automatically
- Return updated node entity

```typescript
async removeTagsFromNode(nodeId: string, tags: string[]): Promise<Node>
```

- Remove specified tags from a node
- Return updated node entity
- Ignore tags that don't exist

```typescript
async getAllTags(organizationId: string): Promise<string[]>
```

- Get all unique tags used across nodes in an organization
- Return sorted array of tag strings
- Useful for tag autocomplete/suggestions

### Property Query Operations

```typescript
async findNodesByProperty(organizationId: string, propertyKey: string, propertyValue: any): Promise<Node[]>
```

- Query nodes by JSONB property key-value pair
- Use PostgreSQL JSONB operators for efficient querying
- Support exact match and nested property paths (e.g., "metadata.author")

```typescript
async findEdgesByProperty(organizationId: string, propertyKey: string, propertyValue: any): Promise<Edge[]>
```

- Query edges by JSONB property key-value pair
- Use PostgreSQL JSONB operators for efficient querying
- Support exact match and nested property paths

```typescript
async findNodesWithPropertyKey(organizationId: string, propertyKey: string): Promise<Node[]>
```

- Find all nodes that have a specific property key (regardless of value)
- Useful for finding nodes with certain metadata fields

```typescript
async updateNodeProperty(nodeId: string, propertyPath: string, value: any): Promise<Node>
```

- Update a single property within the JSONB field
- Support nested property paths (e.g., "metadata.lastModified")
- Merge with existing properties without replacing entire object

### Advanced Search Operations

```typescript
async advancedSearch(searchDto: AdvancedSearchDto): Promise<{
  nodes: Node[];
  edges: Edge[];
  total: number;
}>
```

- Combined search across nodes and edges
- Support multiple filters: type, tags, properties, date ranges
- Full-text search on name and description
- Pagination and sorting
- Return both matching nodes and edges

```typescript
async findNodesByDateRange(organizationId: string, startDate: Date, endDate: Date): Promise<Node[]>
```

- Find nodes created within a date range
- Support filtering by node type
- Useful for temporal queries and analytics

```typescript
async findRecentlyModifiedNodes(organizationId: string, limit?: number): Promise<Node[]>
```

- Find most recently updated nodes
- Default limit: 50
- Useful for activity feeds and recent changes

### Graph Validation Operations

```typescript
async validateGraphIntegrity(organizationId: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}>
```

- Check for orphaned edges (edges with missing source or target nodes)
- Identify circular dependencies if applicable
- Validate edge types match node types (e.g., MANAGES edge between appropriate node types)
- Return validation report with errors and warnings

```typescript
async findOrphanedNodes(organizationId: string): Promise<Node[]>
```

- Find nodes with no incoming or outgoing edges
- Useful for cleanup and maintenance
- Return isolated nodes

```typescript
async detectCycles(organizationId: string): Promise<Node[][]>
```

- Detect circular dependencies in the graph
- Return array of cycles (each cycle is an array of nodes)
- Important for dependency management

### Import/Export Operations

```typescript
async exportSubgraphAsJson(nodeId: string, depth: number): Promise<{
  nodes: Node[];
  edges: Edge[];
  metadata: {
    exportedAt: Date;
    rootNodeId: string;
    depth: number;
  };
}>
```

- Export a subgraph centered on a node as JSON
- Include metadata for import validation
- Useful for knowledge sharing and backup

```typescript
async importSubgraphFromJson(data: {
  nodes: CreateNodeDto[];
  edges: CreateEdgeDto[];
  organizationId: string;
}): Promise<{
  importedNodes: Node[];
  importedEdges: Edge[];
}>
```

- Import nodes and edges from JSON structure
- Create nodes first, then edges
- Map old IDs to new IDs for edges
- Return imported entities
- Execute in transaction for atomicity

```typescript
async cloneSubgraph(sourceNodeId: string, targetOrganizationId: string, depth: number): Promise<Node>
```

- Clone a subgraph to another organization
- Create copies of nodes and edges
- Return root node of cloned subgraph
- Useful for templates and knowledge reuse

### Utility and Helper Operations

```typescript
async nodeExists(id: string): Promise<boolean>
```

- Check if a node exists by ID
- Return boolean
- Lightweight query for validation

```typescript
async edgeExists(sourceNodeId: string, targetNodeId: string, type?: EdgeType): Promise<boolean>
```

- Check if an edge exists between two nodes
- Optionally check for specific edge type
- Return boolean

```typescript
async countNodesByType(organizationId: string, type: NodeType): Promise<number>
```

- Get count of nodes of a specific type
- More efficient than findNodesByType when only count is needed
- Useful for statistics and quotas

```typescript
async countEdgesByType(organizationId: string, type: EdgeType): Promise<number>
```

- Get count of edges of a specific type
- More efficient than findEdgesByType when only count is needed
- Useful for statistics

```typescript
async mergeNodes(sourceNodeId: string, targetNodeId: string): Promise<Node>
```

- Merge two nodes into one
- Redirect all edges from source to target
- Combine properties and tags
- Delete source node after merge
- Return merged target node

```typescript
async duplicateNode(nodeId: string, options?: { includeTags?: boolean; includeProperties?: boolean }): Promise<Node>
```

- Create a duplicate of a node
- Optionally include tags and properties
- Do NOT duplicate edges (edges are relationships, not attributes)
- Return new node with name suffix "(copy)"

## DTOs Required

Based on the methods above, the following DTOs should be created in a `dto/` directory:

### Node DTOs

- `CreateNodeDto` - Validation for creating nodes
  - `name: string` (required, max 255 chars)
  - `type: NodeType` (required)
  - `description?: string` (optional)
  - `organizationId: string` (required, UUID)
  - `properties?: Record<string, any>` (optional, default: {})
  - `tags?: string[]` (optional, default: [])
- `UpdateNodeDto` - Validation for updating nodes
  - All fields optional (partial update)
  - Same fields as CreateNodeDto except organizationId
- `SearchNodesDto` - Search parameters with pagination
  - `query?: string` (search in name/description)
  - `type?: NodeType` (filter by type)
  - `tags?: string[]` (filter by tags)
  - `organizationId: string` (required)
  - `isActive?: boolean` (filter by active status)
  - `page?: number` (default: 1)
  - `limit?: number` (default: 20, max: 100)
  - `sortBy?: string` (default: 'createdAt')
  - `sortOrder?: 'ASC' | 'DESC'` (default: 'DESC')

### Edge DTOs

- `CreateEdgeDto` - Validation for creating edges
  - `sourceNodeId: string` (required, UUID)
  - `targetNodeId: string` (required, UUID)
  - `type: EdgeType` (required)
  - `organizationId: string` (required, UUID)
  - `weight?: number` (optional, default: 1.0)
  - `properties?: Record<string, any>` (optional, default: {})
- `UpdateEdgeDto` - Validation for updating edges
  - All fields optional except IDs
  - `type?: EdgeType`
  - `weight?: number`
  - `properties?: Record<string, any>`
  - `isActive?: boolean`

### Advanced Search DTOs

- `AdvancedSearchDto` - Combined search across nodes and edges
  - `query?: string` (full-text search)
  - `nodeTypes?: NodeType[]` (filter nodes)
  - `edgeTypes?: EdgeType[]` (filter edges)
  - `tags?: string[]` (filter by tags)
  - `properties?: Record<string, any>` (filter by properties)
  - `startDate?: Date` (created after)
  - `endDate?: Date` (created before)
  - `organizationId: string` (required)
  - `includeNodes?: boolean` (default: true)
  - `includeEdges?: boolean` (default: true)
  - `page?: number` (default: 1)
  - `limit?: number` (default: 20, max: 100)

### Tag Management DTOs

- `AddTagsDto`
  - `tags: string[]` (required, min: 1)
- `RemoveTagsDto`
  - `tags: string[]` (required, min: 1)
- `FindByTagsDto`
  - `tags: string[]` (required, min: 1)
  - `organizationId: string` (required)
  - `matchAll?: boolean` (default: false)

### Property Query DTOs

- `PropertyQueryDto`
  - `propertyKey: string` (required, supports nested paths)
  - `propertyValue?: any` (optional, if omitted checks for key existence)
  - `organizationId: string` (required)

### Import/Export DTOs

- `ImportSubgraphDto`
  - `nodes: CreateNodeDto[]` (required)
  - `edges: CreateEdgeDto[]` (required)
  - `organizationId: string` (required)
  - `preserveIds?: boolean` (default: false, if true attempts to use original IDs)
- `ExportSubgraphDto`
  - `nodeId: string` (required, root node)
  - `depth: number` (required, min: 1, max: 10)
  - `includeMetadata?: boolean` (default: true)

### Bulk Operation DTOs

- `BulkCreateNodesDto`
  - `nodes: CreateNodeDto[]` (required, min: 1, max: 1000)
- `BulkCreateEdgesDto`
  - `edges: CreateEdgeDto[]` (required, min: 1, max: 1000)
- `BulkDeleteDto`
  - `ids: string[]` (required, min: 1, max: 1000, all UUIDs)

### Common DTOs

- `PaginationDto` - Reusable pagination parameters
  - `page?: number` (default: 1, min: 1)
  - `limit?: number` (default: 20, min: 1, max: 100)
- `FilterDto` - Reusable filter parameters
  - `organizationId: string` (required)
  - `isActive?: boolean` (optional, default: true)
- `DateRangeDto` - Date range filtering
  - `startDate: Date` (required)
  - `endDate: Date` (required)
  - `organizationId: string` (required)

## Module Configuration

**File**: `apps/server/src/modules/knowledge-graph/knowledge-graph.module.ts`

**Imports**: TypeOrmModule.forFeature([Node, Edge])
**Controllers**: KnowledgeGraphController
**Providers**: KnowledgeGraphService
**Exports**: KnowledgeGraphService

**Future Providers** (documented in module):

- GraphQueryService - Advanced graph query and pattern matching
- GraphTraversalService - Specialized graph traversal algorithms
- RelationshipInferenceService - ML-based relationship discovery
- GraphAnalyticsService - Graph metrics and analysis

## Controller Status

**File**: `apps/server/src/modules/knowledge-graph/knowledge-graph.controller.ts`

**Status**: Empty placeholder
**Note**: "Endpoints to be implemented in future tasks"

## Implementation Patterns (from Project Standards)

Based on the project's TypeScript patterns observed in similar services:

1. **Error Handling**: Use `NotFoundException` from `@nestjs/common` for not found errors
2. **Validation**: Use `class-validator` decorators in DTOs
3. **Naming**:
   - Database columns: snake_case (via TypeORM decorators)
   - TypeScript properties: camelCase
4. **Repository Pattern**: Use TypeORM repositories for database operations
5. **Soft Delete**: Use `isActive` flag for soft deletes
6. **Organization Scoping**: Most operations should filter by `organizationId`
7. **Async/Await**: All database operations return Promises
8. **JSDoc Comments**: Document method purpose, parameters, and return values

## Testing Requirements

Following project standards, each method should have:

- Unit tests in `knowledge-graph.service.spec.ts`
- Test coverage for success and error cases
- Mock repositories using Jest

## Next Steps

### Phase 1: Core Infrastructure (Priority 1)
1. Create `dto/` directory with base DTOs (CreateNodeDto, UpdateNodeDto, CreateEdgeDto, UpdateEdgeDto)
2. Implement core CRUD methods in KnowledgeGraphService (18 methods)
3. Add corresponding controller endpoints
4. Write unit tests for core operations

### Phase 2: Search and Query (Priority 2)
5. Implement SearchNodesDto and AdvancedSearchDto
6. Add search and query methods (7 methods)
7. Implement tag management operations (4 methods)
8. Implement property query operations (4 methods)

### Phase 3: Advanced Features (Priority 3)
9. Add bulk operation methods (4 methods)
10. Implement graph validation operations (3 methods)
11. Add utility and helper methods (8 methods)

### Phase 4: Import/Export (Priority 4)
12. Implement import/export operations (3 methods)
13. Add JSON schema validation for import data
14. Create export format documentation

### Continuous
- Update this documentation as implementation progresses
- Add integration tests for complex graph operations
- Performance optimization for large graphs

## References

- TypeORM Documentation: https://typeorm.io/
- NestJS Documentation: https://docs.nestjs.com/
- class-validator: https://github.com/typestack/class-validator
- Project standards: `/apps/server/src/modules/task/task.service.ts` (reference implementation)
