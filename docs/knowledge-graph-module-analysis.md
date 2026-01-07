# KnowledgeGraphModule - Complete Structure and Dependencies Analysis

## Executive Summary

The `KnowledgeGraphModule` is a self-contained NestJS module that provides graph-based data structures for representing and querying relationships between entities in the Hollon-AI system. This document provides a comprehensive analysis of its structure, dependencies, configuration requirements, and integration points.

**Key Findings:**
- **Status:** Fully implemented with basic CRUD operations
- **Controller:** Defined but not yet implemented (placeholder)
- **Dependencies:** Standalone module with one external dependency (RelationshipType enum)
- **Database:** Requires PostgreSQL with migrations applied
- **Environment Variables:** Inherits from app-level database configuration

---

## Table of Contents

1. [Module Location](#module-location)
2. [Module Structure](#module-structure)
3. [Dependencies](#dependencies)
4. [Data Models](#data-models)
5. [Public API](#public-api)
6. [Configuration Requirements](#configuration-requirements)
7. [Database Schema](#database-schema)
8. [Integration Points](#integration-points)
9. [Registration Requirements](#registration-requirements)
10. [Testing](#testing)

---

## Module Location

**Primary File:** `apps/server/src/modules/knowledge-graph/knowledge-graph.module.ts`

**Directory Structure:**
```
apps/server/src/modules/knowledge-graph/
├── dto/                                    # Data Transfer Objects
│   ├── create-edge.dto.ts
│   ├── create-node.dto.ts
│   ├── embedding.dto.ts
│   ├── pagination-query.dto.ts
│   ├── search-query.dto.ts
│   ├── update-edge.dto.ts
│   └── update-node.dto.ts
├── entities/                              # TypeORM Entities
│   ├── edge.entity.ts                    # Edge entity (legacy naming)
│   ├── graph-edge.entity.ts              # Current edge implementation
│   ├── graph-node.entity.ts              # Current node implementation
│   ├── index.ts
│   └── node.entity.ts                    # Node entity (legacy naming)
├── services/                              # Service layer (future)
│   └── index.ts
├── INDEXING_ANALYSIS.md                   # Database indexing documentation
├── INTERFACE_DOCUMENTATION.md             # API documentation
├── index.ts                               # Public exports
├── knowledge-graph.controller.ts          # HTTP controller (placeholder)
├── knowledge-graph.module.ts              # Module definition
├── knowledge-graph.service.spec.ts        # Service unit tests
└── knowledge-graph.service.ts             # Core business logic
```

---

## Module Structure

### Module Definition

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([GraphNode, GraphEdge])],
  providers: [KnowledgeGraphService],
  exports: [KnowledgeGraphService],
})
export class KnowledgeGraphModule {}
```

### Breakdown

#### 1. Imports Array
- **TypeOrmModule.forFeature([GraphNode, GraphEdge])**
  - Registers `GraphNode` and `GraphEdge` entities for dependency injection
  - Makes `Repository<GraphNode>` and `Repository<GraphEdge>` available for injection
  - Scoped to this module only

#### 2. Providers Array
- **KnowledgeGraphService**
  - Core business logic for graph operations
  - Injectable service with repository dependencies
  - Currently implements: createNode, createEdge, findNodeById, findNodesByOrganization, findEdgesByNode, deleteNode, deleteEdge

#### 3. Exports Array
- **KnowledgeGraphService**
  - Exposed as public API for other modules
  - Enables cross-module integration
  - Follows NestJS module boundaries pattern

#### 4. Controllers
- **Note:** The module definition does NOT include the controller in its decorator
  - `knowledge-graph.controller.ts` exists but is a placeholder
  - Will need to be added to module when endpoints are implemented

---

## Dependencies

### External NPM Dependencies

| Package | Version | Purpose | Scope |
|---------|---------|---------|-------|
| `@nestjs/common` | ^10.4.15 | Core NestJS decorators (@Module, @Injectable) | Required |
| `@nestjs/typeorm` | ^10.0.2 | TypeORM integration with NestJS | Required |
| `@nestjs/config` | ^3.3.0 | Configuration management (indirect) | Required |
| `typeorm` | ^0.3.20 | ORM and database abstraction | Required |
| `pg` | ^8.13.1 | PostgreSQL driver | Required |
| `class-validator` | ^0.14.1 | DTO validation decorators | Required |
| `class-transformer` | ^0.5.1 | DTO transformation | Required |
| `uuid` | ^11.0.3 | UUID generation and validation | Required |
| `reflect-metadata` | ^0.2.2 | TypeScript metadata reflection | Required |

### Internal Dependencies

#### From Common Layer
- `apps/server/src/common/entities/base.entity.ts` - BaseEntity class
  - Provides: id (UUID), createdAt, updatedAt fields
  - Used by: GraphNode, GraphEdge entities

#### From Knowledge Module
- `apps/server/src/knowledge/enums/relationship-type.enum.ts` - RelationshipType enum
  - **Critical Dependency:** Used by Edge entity and CreateEdgeDto
  - Contains comprehensive relationship types (RELATES_TO, DERIVED_FROM, CONTRADICTS, etc.)
  - This is the **only cross-module dependency** in the KnowledgeGraphModule

#### Local Dependencies
- `entities/graph-node.entity.ts` - GraphNode entity
- `entities/graph-edge.entity.ts` - GraphEdge entity
- `knowledge-graph.service.ts` - Core service
- `knowledge-graph.controller.ts` - HTTP controller (placeholder)
- `dto/*.dto.ts` - Various DTOs for validation

### Legacy vs Current Entity Names

**⚠️ Important Note:** There are two sets of entity files:

1. **Current Implementation (used in module):**
   - `GraphNode` from `entities/graph-node.entity.ts`
   - `GraphEdge` from `entities/graph-edge.entity.ts`
   - Table names: `graph_nodes`, `graph_edges`

2. **Legacy Implementation (exported in index.ts):**
   - `Node` from `entities/node.entity.ts`
   - `Edge` from `entities/edge.entity.ts`
   - Table names: `knowledge_graph_nodes`, `knowledge_graph_edges`

**Status:** The module is currently using GraphNode/GraphEdge, but both sets of entities exist in the codebase.

---

## Data Models

### GraphNode Entity

**Table:** `graph_nodes`

**Schema:**
```typescript
{
  // From BaseEntity
  id: string (UUID, PK)
  createdAt: Date
  updatedAt: Date

  // GraphNode-specific
  organizationId: string (UUID, indexed)
  nodeType: NodeType (enum, indexed)
  label: string (max 255 chars, indexed)
  description: string | null
  properties: Record<string, any> | null (JSONB)
  externalId: string | null (UUID)
  externalType: string | null (varchar 100)

  // Relations
  outgoingEdges: GraphEdge[]
  incomingEdges: GraphEdge[]
}
```

**NodeType Enum:**
```typescript
enum NodeType {
  CONCEPT = 'concept',
  ENTITY = 'entity',
  EVENT = 'event',
  ATTRIBUTE = 'attribute',
  TASK = 'task',
  HOLLON = 'hollon',
  DOCUMENT = 'document',
}
```

**Indexes:**
- `[organizationId, nodeType]` (composite)
- `[organizationId, label]` (composite)

### GraphEdge Entity

**Table:** `graph_edges`

**Schema:**
```typescript
{
  // From BaseEntity
  id: string (UUID, PK)
  createdAt: Date
  updatedAt: Date

  // GraphEdge-specific
  organizationId: string (UUID, indexed)
  sourceNodeId: string (UUID, FK, indexed)
  targetNodeId: string (UUID, FK, indexed)
  edgeType: EdgeType (enum, indexed)
  weight: number | null (float)
  properties: Record<string, any> | null (JSONB)

  // Relations
  sourceNode: GraphNode (CASCADE DELETE)
  targetNode: GraphNode (CASCADE DELETE)
}
```

**EdgeType Enum:**
```typescript
enum EdgeType {
  RELATED_TO = 'related_to',
  DEPENDS_ON = 'depends_on',
  PART_OF = 'part_of',
  CAUSES = 'causes',
  ASSIGNED_TO = 'assigned_to',
  CREATED_BY = 'created_by',
  REFERENCES = 'references',
  FOLLOWS = 'follows',
}
```

**Note:** `EdgeType` is an alias for `RelationshipType` enum from the knowledge module. The actual RelationshipType enum contains many more values (23 total).

**Indexes:**
- `[organizationId, edgeType]` (composite)
- `[sourceNodeId, targetNodeId]` (composite)

**Foreign Keys:**
- `sourceNodeId` → `graph_nodes.id` (CASCADE DELETE)
- `targetNodeId` → `graph_nodes.id` (CASCADE DELETE)

---

## Public API

### KnowledgeGraphService Methods

The service exposes the following methods:

#### Node Operations

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `createNode()` | `Partial<GraphNode>` | `Promise<GraphNode>` | Create a new graph node |
| `findNodeById()` | `id: string` | `Promise<GraphNode \| null>` | Find node by UUID |
| `findNodesByOrganization()` | `organizationId: string` | `Promise<GraphNode[]>` | Find all nodes for an organization (sorted by createdAt DESC) |
| `deleteNode()` | `id: string` | `Promise<void>` | Delete node (CASCADE deletes edges) |

#### Edge Operations

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `createEdge()` | `Partial<GraphEdge>` | `Promise<GraphEdge>` | Create a new graph edge |
| `findEdgesByNode()` | `nodeId: string` | `Promise<GraphEdge[]>` | Find all edges connected to a node (includes relations) |
| `deleteEdge()` | `id: string` | `Promise<void>` | Delete edge |

### DTOs

#### CreateNodeDto
```typescript
{
  name: string (max 255 chars, required)
  type: NodeType (enum, required)
  description?: string | null
  organizationId: string (UUID, required)
  properties?: Record<string, any>
  tags?: string[]
  isActive?: boolean
}
```

#### CreateEdgeDto
```typescript
{
  sourceNodeId: string (UUID, required)
  targetNodeId: string (UUID, required)
  type: RelationshipType (enum, required)
  organizationId: string (UUID, required)
  weight?: number
  properties?: Record<string, any>
  isActive?: boolean
}
```

**Note:** Additional DTOs exist (UpdateNodeDto, UpdateEdgeDto, PaginationQueryDto, SearchQueryDto, EmbeddingDto) but are not yet used by the service.

---

## Configuration Requirements

### 1. Environment Variables

The module **does not directly consume** environment variables. It inherits database configuration from the app-level setup.

**Required (via AppModule):**

From `.env.example`:
```bash
# Database Connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hollon
DB_USER=hollon
DB_PASSWORD=your_secure_password_here

# Database URL (composite)
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# Database Configuration
DB_SCHEMA=public
DB_POOL_SIZE=10
DB_IDLE_TIMEOUT_MS=30000
DB_CONNECTION_TIMEOUT_MS=10000
DB_MAX_LIFETIME_MS=1800000

# pgvector Configuration (optional, for future use)
PGVECTOR_ENABLED=true
PGVECTOR_HNSW_M=16
PGVECTOR_HNSW_EF_CONSTRUCTION=64
PGVECTOR_HNSW_EF_SEARCH=40
PGVECTOR_IVFFLAT_LISTS=100
PGVECTOR_IVFFLAT_PROBES=10
```

### 2. TypeORM Configuration

**Location:** `apps/server/src/config/database.config.ts`

**Requirements:**
- PostgreSQL database (type: 'postgres')
- Entity auto-loading: `entities: [__dirname + '/../**/*.entity.{ts,js}']`
- Migration support: `migrations: [__dirname + '/../database/migrations/*.{ts,js}']`
- Schema support: Configurable via `DB_SCHEMA` (default: 'hollon')
- Synchronize: **false** (migrations-only approach)
- SSL: Enabled in production

**TypeORM Module Registration (in AppModule):**
```typescript
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) =>
    databaseConfig(configService),
  inject: [ConfigService],
})
```

### 3. Migration Requirements

**Migration File:** `apps/server/src/database/migrations/1735100000001-AddKnowledgeGraph.ts`

**Creates:**
1. **Enums:**
   - `node_type_enum` (7 values: concept, entity, event, attribute, task, hollon, document)
   - `edge_type_enum` (8 values: related_to, depends_on, part_of, causes, assigned_to, created_by, references, follows)

2. **Tables:**
   - `graph_nodes` (with all columns and timestamps)
   - `graph_edges` (with foreign keys and CASCADE DELETE)

3. **Indexes:**
   - `IDX_graph_nodes_organization_node_type`
   - `IDX_graph_nodes_organization_label`
   - `IDX_graph_edges_organization_edge_type`
   - `IDX_graph_edges_source_target`

**Running Migrations:**
```bash
# Development
npm run db:migrate

# Test
npm run db:migrate:test

# Show migration status
npm run db:migrate:show

# Revert last migration
npm run db:migrate:revert
```

### 4. No Special Configuration Required

The module does **NOT** require:
- ❌ Custom configuration providers
- ❌ Feature flags
- ❌ External service connections (yet)
- ❌ API keys or secrets
- ❌ Custom middleware
- ❌ Special startup initialization

---

## Database Schema

### Tables Created by Migration

#### `graph_nodes` Table
```sql
CREATE TABLE "graph_nodes" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organization_id" uuid NOT NULL,
  "node_type" node_type_enum NOT NULL,
  "label" varchar(255) NOT NULL,
  "description" text,
  "properties" jsonb,
  "external_id" uuid,
  "external_type" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
```

#### `graph_edges` Table
```sql
CREATE TABLE "graph_edges" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organization_id" uuid NOT NULL,
  "source_node_id" uuid NOT NULL,
  "target_node_id" uuid NOT NULL,
  "edge_type" edge_type_enum NOT NULL,
  "weight" float,
  "properties" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "FK_graph_edges_source_node"
    FOREIGN KEY ("source_node_id") REFERENCES "graph_nodes"("id")
    ON DELETE CASCADE,
  CONSTRAINT "FK_graph_edges_target_node"
    FOREIGN KEY ("target_node_id") REFERENCES "graph_nodes"("id")
    ON DELETE CASCADE
);
```

### Indexing Strategy

**Multi-tenancy Support:**
- All indexes include `organization_id` for efficient tenant isolation
- Composite indexes optimize common query patterns

**Query Optimization:**
- Type-based filtering: `[organizationId, nodeType]`, `[organizationId, edgeType]`
- Graph traversal: `[sourceNodeId, targetNodeId]`
- Label search: `[organizationId, label]`

**See:** `INDEXING_ANALYSIS.md` for detailed performance analysis

---

## Integration Points

### Current Integration

**AppModule Registration:**

File: `apps/server/src/app.module.ts`

```typescript
import { KnowledgeGraphModule } from './modules/knowledge-graph/knowledge-graph.module';

@Module({
  imports: [
    // ... other imports
    KnowledgeGraphModule,
    // ... more imports
  ],
})
export class AppModule {}
```

**Status:** The module is imported but not yet used by other modules.

### How to Use in Other Modules

To integrate the KnowledgeGraphModule into another module:

```typescript
import { Module } from '@nestjs/common';
import { KnowledgeGraphModule } from '../knowledge-graph/knowledge-graph.module';
import { MyService } from './my.service';

@Module({
  imports: [KnowledgeGraphModule],  // Import the module
  providers: [MyService],
})
export class MyModule {}
```

Then inject the service:

```typescript
import { Injectable } from '@nestjs/common';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';

@Injectable()
export class MyService {
  constructor(
    private readonly knowledgeGraphService: KnowledgeGraphService,
  ) {}

  async myMethod() {
    const nodes = await this.knowledgeGraphService.findNodesByOrganization('org-id');
    // ... use nodes
  }
}
```

### Potential Future Integrations

Based on the module's design:

1. **KnowledgeExtractionModule** (if exists)
   - Store extracted knowledge as graph nodes
   - Create edges representing relationships between knowledge items

2. **TaskModule**
   - Represent task dependencies as edges
   - Track task relationships and hierarchies

3. **HollonModule**
   - Model hollon structures and relationships
   - Represent organizational hierarchies

4. **OrchestrationModule** (if exists)
   - Query graph for decision-making
   - Analyze relationship patterns

---

## Registration Requirements

### For Proper Module Initialization

✅ **Already Done:**
1. Import `KnowledgeGraphModule` in `AppModule`
2. TypeORM configured at app level
3. Entities registered via `TypeOrmModule.forFeature()`
4. Service exported for cross-module usage
5. Migration file created

⚠️ **Not Yet Done:**
1. Controller not added to module decorator (placeholder exists)
2. No HTTP endpoints implemented yet
3. DTOs defined but not all used by service

### Required Steps for New Environment

To set up the KnowledgeGraphModule in a new environment:

1. **Set Environment Variables**
   ```bash
   DB_HOST=your_host
   DB_PORT=5432
   DB_NAME=your_db
   DB_USER=your_user
   DB_PASSWORD=your_password
   DB_SCHEMA=public  # or custom schema
   ```

2. **Create Database**
   ```bash
   createdb your_db
   ```

3. **Run Migrations**
   ```bash
   npm run db:migrate
   ```

4. **Verify Setup**
   ```bash
   npm run db:migrate:show
   ```

5. **Start Application**
   ```bash
   npm run start:dev
   ```

### No Additional Configuration Needed

The module is designed to work out-of-the-box once:
- Database connection is configured
- Migrations are run
- AppModule is properly set up

---

## Testing

### Test Files

**Unit Tests:**
- `knowledge-graph.service.spec.ts` - Service unit tests (exists)

**Integration Tests:**
- Not yet created

**E2E Tests:**
- Not yet created (controller not implemented)

### Running Tests

```bash
# Unit tests
npm test knowledge-graph.service.spec.ts

# All tests
npm run test

# E2E tests (future)
npm run test:e2e

# Test coverage
npm run test:cov
```

### Test Dependencies

Tests use:
- `@nestjs/testing` for test module creation
- `jest` for test runner
- TypeORM repository mocks for service tests

---

## Summary

### Module Characteristics

✅ **Strengths:**
- Self-contained with minimal external dependencies
- Clear separation of concerns (entities, service, DTOs)
- Proper use of TypeORM patterns
- Multi-tenant ready (organizationId indexed everywhere)
- CASCADE delete for referential integrity
- Migration-based schema management

⚠️ **Limitations:**
- Controller not yet implemented (no HTTP endpoints)
- Service API is basic (only essential CRUD operations)
- No pagination support in service (DTOs exist)
- No advanced graph operations (traversal, queries, analytics)
- Legacy entity files create confusion

🔧 **Configuration Needs:**
- **Environment:** Database connection variables (inherited from app)
- **Database:** PostgreSQL with migrations applied
- **External Deps:** One cross-module dependency (RelationshipType enum)
- **Infrastructure:** Standard NestJS + TypeORM stack

### Key Takeaways for Registration

1. **No special configuration** required beyond standard NestJS + TypeORM setup
2. **Database migrations must be run** before using the module
3. **Exports KnowledgeGraphService** for use in other modules
4. **Multi-tenant aware** - all operations require organizationId
5. **Ready to use** once database is set up and migrations applied

---

## Related Documentation

- `INTERFACE_DOCUMENTATION.md` - API endpoint documentation (future)
- `INDEXING_ANALYSIS.md` - Database performance analysis
- `entities/node.entity.ts` - Legacy node entity (knowledge_graph_nodes table)
- `entities/edge.entity.ts` - Legacy edge entity (knowledge_graph_edges table)
- Migration: `apps/server/src/database/migrations/1735100000001-AddKnowledgeGraph.ts`

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
**Author:** Claude (Hollon-AI Analysis Task)
