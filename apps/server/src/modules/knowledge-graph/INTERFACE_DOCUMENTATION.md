# Knowledge Graph Service - Current Interface Documentation

## File Location

`apps/server/src/modules/knowledge-graph/knowledge-graph.service.ts`

## Overview

The `KnowledgeGraphService` is the core service for managing the knowledge graph functionality in the Hollon-AI system. It provides a flexible graph-based data structure for representing and querying relationships between entities.

## Current Implementation Status

**Status**: Initial setup with placeholder methods
**Last Updated**: 2026-01-06

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

## DTOs Required

Based on the methods above, the following DTOs should be created in a `dto/` directory:

### Node DTOs
- `CreateNodeDto` - Validation for creating nodes
- `UpdateNodeDto` - Validation for updating nodes
- `SearchNodesDto` - Search parameters with pagination

### Edge DTOs
- `CreateEdgeDto` - Validation for creating edges
- `UpdateEdgeDto` - Validation for updating edges

### Common DTOs
- `PaginationDto` - Reusable pagination parameters
- `FilterDto` - Reusable filter parameters

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

1. Create DTO directory and files with class-validator decorators
2. Add placeholder methods to KnowledgeGraphService with JSDoc comments
3. Create corresponding controller endpoints
4. Add unit tests for the service
5. Update this documentation as implementation progresses

## References

- TypeORM Documentation: https://typeorm.io/
- NestJS Documentation: https://docs.nestjs.com/
- class-validator: https://github.com/typestack/class-validator
- Project standards: `/apps/server/src/modules/task/task.service.ts` (reference implementation)
