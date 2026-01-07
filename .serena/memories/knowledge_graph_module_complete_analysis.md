# KnowledgeGraphModule - Complete Structure and Dependencies Analysis

## Overview

The `KnowledgeGraphModule` is a NestJS module that provides graph-based data structures for representing and querying relationships between entities in the Hollon-AI system. It is a standalone module with no dependencies on other feature modules like KnowledgeExtractionModule or ExtractionOrchestratorModule.

**File Location:** `apps/server/src/modules/knowledge-graph/knowledge-graph.module.ts`

## Module Dependencies

### External Dependencies

The module depends on the following external packages:

1. **@nestjs/common** - Core NestJS framework
   - `Module` decorator
   - `Injectable` decorator
   - `NotFoundException` exception

2. **@nestjs/typeorm** - TypeORM integration
   - `TypeOrmModule` for entity registration
   - `InjectRepository` decorator for repository injection

3. **TypeORM** - ORM and database abstraction
   - `Repository<T>` for database operations
   - Entity decorators and types

4. **class-validator** - DTO validation
   - `IsString`, `IsEnum`, `IsOptional`, `IsUUID`, `MaxLength`, `IsArray`, `IsBoolean`, `IsNumber`

### Internal Dependencies

The module imports the following internal components:

1. **Entities:**
   - `apps/server/src/modules/knowledge-graph/entities/node.entity.ts` - Graph nodes
   - `apps/server/src/modules/knowledge-graph/entities/edge.entity.ts` - Graph edges

2. **Services:**
   - `apps/server/src/modules/knowledge-graph/knowledge-graph.service.ts` - Core business logic

3. **Controllers:**
   - `apps/server/src/modules/knowledge-graph/knowledge-graph.controller.ts` - HTTP endpoints (currently empty)

4. **DTOs:**
   - `dto/create-node.dto.ts` - Node creation validation
   - `dto/update-node.dto.ts` - Node update validation
   - `dto/create-edge.dto.ts` - Edge creation validation
   - `dto/update-edge.dto.ts` - Edge update validation
   - `dto/pagination-query.dto.ts` - Pagination parameters

5. **Base Entity:**
   - `apps/server/src/common/entities/base.entity.ts` - Shared entity base class

### Infrastructure Dependencies

The module relies on the following infrastructure configured at the app level:

1. **Database Configuration:**
   - PostgreSQL database connection (configured in `AppModule`)
   - TypeORM setup with async configuration
   - Database migrations for creating tables

2. **Global Modules:**
   - `ConfigModule` (global) - Environment configuration
   - TypeORM connection pool and entity management

## Module Structure

### @Module Decorator Configuration

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Node, Edge])
  ],
  controllers: [KnowledgeGraphController],
  providers: [KnowledgeGraphService],
  exports: [KnowledgeGraphService]
})
```

### 1. Imports Array

**Purpose:** Register TypeORM entities for dependency injection

- **Node** entity - Represents graph nodes (entities/concepts)
- **Edge** entity - Represents graph edges (relationships between nodes)

**Effect:** Makes `Repository<Node>` and `Repository<Edge>` available for injection into services

### 2. Controllers Array

**Purpose:** Define HTTP endpoints

- **KnowledgeGraphController** - REST API controller
  - Route prefix: `/knowledge-graph`
  - **Status:** Currently empty (endpoints to be implemented in future tasks)

### 3. Providers Array

**Purpose:** Define services available within the module

- **KnowledgeGraphService** - Core business logic for graph operations

**Planned Future Providers:**

- GraphQueryService - Advanced graph query and pattern matching
- GraphTraversalService - Specialized graph traversal algorithms
- RelationshipInferenceService - ML-based relationship discovery
- GraphAnalyticsService - Graph metrics and analysis

### 4. Exports Array

**Purpose:** Define the module's public API

- **KnowledgeGraphService** - Exposed to other modules

**Integration Points:**

- knowledge-extraction module (can leverage graph for data storage)
- task module (can use graph for task relationships)
- orchestration module (can query graph for decision-making)

## Public API - KnowledgeGraphService

The `KnowledgeGraphService` is the primary public interface of the module. It provides the following methods:

### Node Operations

| Method                    | Parameters                  | Returns                    | Description                            |
| ------------------------- | --------------------------- | -------------------------- | -------------------------------------- |
| `createNode()`            | `CreateNodeDto`             | `Promise<Node>`            | Create a new graph node                |
| `findAllNodes()`          | -                           | `Promise<Node[]>`          | Retrieve all nodes                     |
| `findAllNodesPaginated()` | `PaginationQueryDto`        | `Promise<PaginatedResult>` | Retrieve nodes with pagination         |
| `findOneNode()`           | `id: string`                | `Promise<Node>`            | Find node by UUID (includes relations) |
| `updateNode()`            | `id: string, UpdateNodeDto` | `Promise<Node>`            | Update existing node                   |
| `deleteNode()`            | `id: string`                | `Promise<void>`            | Delete node (CASCADE deletes edges)    |

### Edge Operations

| Method                    | Parameters                  | Returns                    | Description                                      |
| ------------------------- | --------------------------- | -------------------------- | ------------------------------------------------ |
| `createEdge()`            | `CreateEdgeDto`             | `Promise<Edge>`            | Create a new graph edge                          |
| `findAllEdges()`          | -                           | `Promise<Edge[]>`          | Retrieve all edges                               |
| `findAllEdgesPaginated()` | `PaginationQueryDto`        | `Promise<PaginatedResult>` | Retrieve edges with pagination                   |
| `findOneEdge()`           | `id: string`                | `Promise<Edge>`            | Find edge by UUID (includes source/target nodes) |
| `updateEdge()`            | `id: string, UpdateEdgeDto` | `Promise<Edge>`            | Update existing edge                             |
| `deleteEdge()`            | `id: string`                | `Promise<void>`            | Delete edge                                      |

### Service Features

- **Validation:** Automatically validates DTOs using class-validator
- **Error Handling:** Throws `NotFoundException` for missing entities
- **Relations:** Automatically loads related entities where appropriate
- **Pagination:** Supports pagination with metadata (total, page, limit, totalPages)
- **Soft Delete Support:** Entities have `isActive` flag for soft deletes

## Data Models

### Node Entity

**Table:** `knowledge_graph_nodes`

**Schema:**

```typescript
{
  // From BaseEntity
  id: string (UUID, primary key)
  createdAt: Date
  updatedAt: Date

  // Node-specific fields
  name: string (max 255 chars)
  type: NodeType (enum)
  description: string | null
  organizationId: string (UUID)
  properties: Record<string, any> (JSONB)
  tags: string[] (array)
  isActive: boolean

  // Relations
  outgoingEdges: Edge[]
  incomingEdges: Edge[]
}
```

**Indexes:**

- `type`
- `organizationId`
- `createdAt`

**NodeType Enum:**

- PERSON, ORGANIZATION, TEAM, TASK, DOCUMENT, CODE, CONCEPT, GOAL, SKILL, TOOL, CUSTOM

### Edge Entity

**Table:** `knowledge_graph_edges`

**Schema:**

```typescript
{
  // From BaseEntity
  id: string (UUID, primary key)
  createdAt: Date
  updatedAt: Date

  // Edge-specific fields
  sourceNodeId: string (UUID)
  targetNodeId: string (UUID)
  type: EdgeType (enum)
  organizationId: string (UUID)
  weight: number (float, default 1.0)
  properties: Record<string, any> (JSONB)
  isActive: boolean

  // Relations
  sourceNode: Node (CASCADE delete)
  targetNode: Node (CASCADE delete)
}
```

**Indexes:**

- `type`
- `[sourceNodeId, targetNodeId]` (composite)
- `[sourceNodeId, type]` (composite)
- `[targetNodeId, type]` (composite)
- `organizationId`
- `createdAt`

**EdgeType Enum:**

- CREATED_BY, BELONGS_TO, MANAGES, COLLABORATES_WITH, DEPENDS_ON, REFERENCES, IMPLEMENTS, DERIVES_FROM, RELATED_TO, CHILD_OF, PART_OF, CUSTOM

## Configuration Requirements

### 1. Environment Variables

The module does not directly consume environment variables. It inherits database configuration from the app-level setup.

**Required (via AppModule):**

- Database connection settings (host, port, username, password, database name)

### 2. TypeORM Configuration

The module requires TypeORM to be configured at the application level with:

- PostgreSQL driver
- Entity auto-loading or explicit entity registration
- Migration support for table creation

**Tables Created:**

- `knowledge_graph_nodes`
- `knowledge_graph_edges`

### 3. Migration Requirements

The module requires database migrations to create:

- Node and Edge tables with proper schema
- Indexes for performance optimization
- Foreign key constraints for relationships
- CASCADE delete rules for edge cleanup

### 4. No Special Configuration

The module uses standard NestJS patterns and does not require:

- Custom configuration providers
- Feature flags
- External service connections
- API keys or secrets
- Custom middleware

## Integration with Other Modules

### Current Integration

**AppModule (apps/server/src/app.module.ts):**

- Imports `KnowledgeGraphModule` as a feature module
- No cross-module dependencies currently implemented

### Potential Future Integrations

Based on the module's design and documentation:

1. **KnowledgeExtractionModule**
   - Could use `KnowledgeGraphService` to store extracted knowledge as graph nodes
   - Could create edges representing relationships between knowledge items

2. **TaskModule**
   - Could use graph to represent task dependencies
   - Could track task relationships and hierarchies

3. **OrchestrationModule**
   - Could query graph for decision-making
   - Could analyze relationship patterns for orchestration logic

4. **TeamModule / HollonModule**
   - Could represent organizational structures in the graph
   - Could model collaboration patterns

**Note:** As of the current implementation, there is **NO ExtractionOrchestratorModule** in the codebase. The task description may refer to a planned or future module.

## Module Design Patterns

### 1. Repository Pattern

- Services use injected TypeORM repositories
- Abstracts database operations from business logic

### 2. DTO Pattern

- Input validation with class-validator
- Type-safe data transfer objects
- Separation of API contracts from entity models

### 3. Service Layer Pattern

- Business logic encapsulated in services
- Controllers delegate to services
- Services exported for cross-module usage

### 4. Entity Relations

- Bidirectional relationships (outgoing/incoming edges)
- Cascade deletes for referential integrity
- Lazy loading with explicit relation loading

### 5. Soft Delete Support

- `isActive` flag on entities
- Allows logical deletion without data loss

## File Structure

```
apps/server/src/modules/knowledge-graph/
├── dto/
│   ├── create-edge.dto.ts
│   ├── create-node.dto.ts
│   ├── pagination-query.dto.ts
│   ├── update-edge.dto.ts
│   └── update-node.dto.ts
├── entities/
│   ├── edge.entity.ts
│   └── node.entity.ts
├── knowledge-graph.controller.ts
├── knowledge-graph.module.ts
└── knowledge-graph.service.ts
```

## Testing Requirements

Expected test files (to be created):

- `knowledge-graph.service.spec.ts` - Unit tests for service
- `knowledge-graph.controller.spec.ts` - Controller tests
- `knowledge-graph.module.spec.ts` - Module configuration tests
- Integration tests for database operations

## Future Enhancements

As documented in the code:

### Service Layer

- GraphQueryService - Advanced pattern matching
- GraphTraversalService - Pathfinding algorithms
- RelationshipInferenceService - ML-based discovery
- GraphAnalyticsService - Metrics and analysis

### Features

- Advanced graph queries (pattern matching, path finding)
- Graph analytics (centrality, clustering, community detection)
- ML-based relationship inference
- Graph visualization data preparation
- Performance optimization for large graphs
- Full-text search on node properties
- Graph versioning and history

### API Enhancements

- Filtering by type, organization, tags
- Advanced sorting options
- Query builder for complex graph queries
- Bulk operations
- Graph export/import

## Summary

The `KnowledgeGraphModule` is a **self-contained, standalone module** with:

- **Zero dependencies** on other feature modules (KnowledgeExtractionModule, TaskModule, etc.)
- **Clear public API** through `KnowledgeGraphService`
- **Database-only infrastructure dependency** (PostgreSQL + TypeORM)
- **Well-structured entities** with proper indexing and relationships
- **Complete CRUD operations** for both nodes and edges
- **Pagination support** for scalability
- **Extensible design** ready for future enhancements

The module can be used by other modules by:

1. Importing `KnowledgeGraphModule` in their module's `imports` array
2. Injecting `KnowledgeGraphService` in their services/controllers
3. Using the service methods to manage graph data
