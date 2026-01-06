# Knowledge Graph Module Analysis

## File Location

**Path:** `apps/server/src/modules/knowledge-graph/knowledge-graph.module.ts`

**Status:** Currently staged in git (not yet committed to the repository)

## Current Module Structure

### Module Configuration

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Node } from './entities/node.entity';
import { Edge } from './entities/edge.entity';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { KnowledgeGraphController } from './knowledge-graph.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Node, Edge])],
  controllers: [KnowledgeGraphController],
  providers: [KnowledgeGraphService],
  exports: [KnowledgeGraphService],
})
export class KnowledgeGraphModule {}
```

## Module Components

### 1. Imports Array

- **TypeOrmModule.forFeature([Node, Edge])**: Registers the Node and Edge entities with TypeORM for this module's scope
  - Enables dependency injection of these repositories in services

### 2. Controllers Array

- **KnowledgeGraphController**: REST API controller for knowledge graph endpoints
  - Currently a placeholder with no implemented endpoints
  - Decorated with `@Controller('knowledge-graph')`

### 3. Providers Array

The providers array contains the following services that can be injected:

- **KnowledgeGraphService**: Main service handling knowledge graph operations
  - Implements basic CRUD operations for nodes and edges
  - Uses `@InjectRepository` to access Node and Edge repositories

### 4. Exports Array

- **KnowledgeGraphService**: Exported for use in other modules
  - Allows other modules to import KnowledgeGraphModule and use KnowledgeGraphService

## Entity Structure

### Node Entity (`entities/node.entity.ts`)

- **Table:** `knowledge_graph_nodes`
- **Key Fields:**
  - `name`: string (max 255 characters)
  - `type`: NodeType enum (person, organization, team, task, document, code, concept, goal, skill, tool, custom)
  - `description`: nullable text
  - `organizationId`: UUID reference
  - `properties`: JSONB for flexible data storage
  - `tags`: text array for search/filtering
  - `isActive`: boolean for soft delete
- **Relations:**
  - `outgoingEdges`: OneToMany with Edge (as source)
  - `incomingEdges`: OneToMany with Edge (as target)
- **Indexes:**
  - `type`
  - `organizationId`
  - `createdAt`

### Edge Entity (`entities/edge.entity.ts`)

- **Table:** `knowledge_graph_edges`
- **Key Fields:**
  - `sourceNodeId`: UUID
  - `targetNodeId`: UUID
  - `type`: EdgeType enum (created_by, belongs_to, manages, collaborates_with, depends_on, references, implements, derives_from, related_to, child_of, part_of, custom)
  - `organizationId`: UUID reference
  - `weight`: float (default 1.0) for weighted graphs
  - `properties`: JSONB for flexible relationship data
  - `isActive`: boolean for soft delete
- **Relations:**
  - `sourceNode`: ManyToOne with Node (CASCADE delete)
  - `targetNode`: ManyToOne with Node (CASCADE delete)
- **Indexes:**
  - `type`
  - `sourceNodeId`, `targetNodeId` (composite)
  - `sourceNodeId`, `type` (composite)
  - `targetNodeId`, `type` (composite)
  - `organizationId`
  - `createdAt`

## Service Implementation

### KnowledgeGraphService Methods

Currently implements placeholder methods:

1. `findAllNodes()`: Returns all nodes from repository
2. `findAllEdges()`: Returns all edges from repository

**Note:** Service is minimal and marked for future implementation.

## Module Registration Patterns

Based on analysis of similar modules in the codebase:

### Pattern 1: Simple Module (Knowledge Extraction Module)

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeItem])],
  providers: [KnowledgeExtractionService],
  exports: [KnowledgeExtractionService],
})
```

- Single entity
- Single service
- No controller
- Export service for use in other modules

### Pattern 2: Complex Module (Task Module)

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Hollon, Project, Document]),
    DocumentModule,
  ],
  controllers: [TaskController],
  providers: [
    TaskService,
    DependencyAnalyzerService,
    ResourcePlannerService,
    PriorityRebalancerService,
    UncertaintyDecisionService,
    PivotResponseService,
  ],
  exports: [
    TaskService,
    DependencyAnalyzerService,
    ResourcePlannerService,
    PriorityRebalancerService,
    UncertaintyDecisionService,
    PivotResponseService,
  ],
})
```

- Multiple entities (some from other modules)
- Multiple specialized services
- One controller
- Imports other modules for dependencies
- Exports all services for reuse

### Knowledge Graph Module Pattern

The current knowledge-graph module follows a **hybrid pattern**:

- 2 entities (Node, Edge) - own entities only
- 1 main service - currently minimal
- 1 controller - placeholder
- Exports main service only
- No external module dependencies yet

## Recommendations for Future Enhancement

1. **Additional Services**: Consider adding specialized services as the module grows:
   - `GraphTraversalService`: For graph algorithms (BFS, DFS, shortest path)
   - `GraphQueryService`: For complex graph queries
   - `GraphAnalyticsService`: For computing graph metrics
   - `GraphVisualizationService`: For generating graph visualizations

2. **Service Registration**: When adding new services:
   - Add to `providers` array
   - Add to `exports` array if needed by other modules
   - Inject dependencies through constructor

3. **Module Dependencies**: If the module needs to interact with other modules:
   - Import required modules in `imports` array
   - Example: Import `OrganizationModule` if need to validate organizationId

4. **Controller Implementation**: Expand controller with REST endpoints:
   - CRUD operations for nodes and edges
   - Graph query endpoints
   - Graph analytics endpoints

## Directory Structure

```
apps/server/src/modules/knowledge-graph/
├── entities/
│   ├── edge.entity.ts
│   └── node.entity.ts
├── knowledge-graph.controller.ts
├── knowledge-graph.module.ts
└── knowledge-graph.service.ts
```

**Potential future structure:**

```
apps/server/src/modules/knowledge-graph/
├── entities/
│   ├── edge.entity.ts
│   └── node.entity.ts
├── services/
│   ├── knowledge-graph.service.ts
│   ├── graph-traversal.service.ts
│   ├── graph-query.service.ts
│   └── graph-analytics.service.ts
├── dto/
│   ├── create-node.dto.ts
│   ├── update-node.dto.ts
│   ├── create-edge.dto.ts
│   └── update-edge.dto.ts
├── knowledge-graph.controller.ts
└── knowledge-graph.module.ts
```

## Integration Points

The Knowledge Graph module is designed to integrate with:

- **Organization Module**: For multi-tenant organization scoping
- **Task Module**: Tasks can be represented as nodes
- **Team Module**: Teams can be represented as nodes
- **Document Module**: Documents can be represented as nodes
- **Goal Module**: Goals can be represented as nodes

## Summary

The knowledge-graph.module.ts file is currently staged and follows NestJS best practices with a clean, minimal structure ready for expansion. The providers array currently contains only `KnowledgeGraphService`, and the module is properly configured with TypeORM integration, controller, and service export for use by other modules.
