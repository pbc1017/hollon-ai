# Knowledge Graph Module Structure Analysis

## File Location
`apps/server/src/modules/knowledge-graph/knowledge-graph.module.ts`

## Current Module Configuration

### Module Decorator Structure

The `KnowledgeGraphModule` follows NestJS best practices with comprehensive documentation:

#### 1. **Imports Array**
```typescript
imports: [
  TypeOrmModule.forFeature([
    Node,  // Graph nodes representing entities/concepts
    Edge,  // Graph edges representing relationships between nodes
  ]),
]
```
- Registers TypeORM entities for dependency injection
- Enables repository pattern for database operations
- Imports: `Node` and `Edge` entities from `./entities/`

#### 2. **Controllers Array**
```typescript
controllers: [KnowledgeGraphController]
```
- Single controller: `KnowledgeGraphController`
- Handles REST endpoints for graph operations (CRUD, queries, traversal)
- Imported from `./knowledge-graph.controller`

#### 3. **Providers Array**
```typescript
providers: [
  KnowledgeGraphService,
  // Additional services will be added here as the module grows
]
```
- Currently contains only `KnowledgeGraphService`
- Well-documented with future service plans:
  - GraphQueryService (advanced graph query and pattern matching)
  - GraphTraversalService (specialized graph traversal algorithms)
  - RelationshipInferenceService (ML-based relationship discovery)
  - GraphAnalyticsService (graph metrics and analysis)
- Imported from `./knowledge-graph.service`

#### 4. **Exports Array**
```typescript
exports: [
  KnowledgeGraphService,
  // Additional services may be exported as needed
]
```
- Exposes `KnowledgeGraphService` to other modules
- Enables integration with: knowledge-extraction, task, orchestration modules
- Follows public API pattern for module boundaries

## Module Directory Structure
```
apps/server/src/modules/knowledge-graph/
├── entities/
│   ├── node.entity.ts
│   └── edge.entity.ts
├── knowledge-graph.module.ts
├── knowledge-graph.service.ts
└── knowledge-graph.controller.ts
```

## Service Registration Pattern

### Standard Service Registration
The module uses the standard NestJS provider pattern:
1. Service class decorated with `@Injectable()`
2. Added to `providers` array in module
3. Optionally added to `exports` array for public API
4. Injected via constructor in controllers/services

### KnowledgeGraphService Details
- Constructor injection with TypeORM repositories:
  - `nodeRepository` (Repository<Node>)
  - `edgeRepository` (Repository<Edge>)
- Current methods:
  - `findAllNodes()` - Query all graph nodes
  - `findAllEdges()` - Query all graph edges

## Documentation Pattern

The module file includes extensive inline documentation:
- Module-level JSDoc explaining responsibilities
- Section comments for each decorator property
- Future roadmap annotations
- Clear separation of concerns

## Dependencies

### External Dependencies
- `@nestjs/common` - Module, Injectable decorators
- `@nestjs/typeorm` - TypeOrmModule for database integration

### Internal Dependencies
- `./entities/node.entity` - Node entity
- `./entities/edge.entity` - Edge entity
- `./knowledge-graph.service` - Core service
- `./knowledge-graph.controller` - HTTP controller

## Integration Points

The module is designed to integrate with:
- **knowledge-extraction** module (leverages graph for data storage)
- **task** module (may use graph for task relationships)
- **orchestration** module (may query graph for decision-making)

## Notes for Future Development

1. **Adding New Services**: Add to `providers` array and optionally to `exports`
2. **Service Scope**: Default singleton scope (one instance per application)
3. **Repository Access**: Services needing DB access should use repository pattern
4. **Testing**: Each service should have corresponding `.spec.ts` file
5. **DTO Pattern**: Use DTOs with class-validator for input validation
