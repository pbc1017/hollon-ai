# NestJS Module Patterns in Hollon-AI

This document describes the module organization patterns, conventions, and best practices observed in the Hollon-AI codebase based on analysis of 28 existing modules.

## Table of Contents

1. [Module Categories](#module-categories)
2. [Import Patterns](#import-patterns)
3. [Provider Patterns](#provider-patterns)
4. [Export Patterns](#export-patterns)
5. [Circular Dependency Handling](#circular-dependency-handling)
6. [Global Module Pattern](#global-module-pattern)
7. [DDD Architecture Pattern](#ddd-architecture-pattern)
8. [Module File Structure](#module-file-structure)
9. [Best Practices Summary](#best-practices-summary)

---

## Module Categories

The project has **28 modules** organized into several categories:

### 1. Root Module

- **AppModule** (`app.module.ts`): Application entry point that imports all feature and infrastructure modules

### 2. Infrastructure Modules

- **ConfigModule**: Global configuration (from `@nestjs/config`)
- **TypeOrmModule**: Database connection and entity management
- **ScheduleModule**: Scheduled tasks (conditionally loaded)
- **PostgresListenerModule**: Database event listener (Global)

### 3. Feature Modules (23 modules)

Core business logic modules including:

- **HealthModule**: Health check endpoints
- **OrganizationModule**, **TeamModule**, **RoleModule**: Organizational structure
- **HollonModule**: AI agent management
- **TaskModule**, **ProjectModule**: Work management
- **BrainProviderModule**: AI provider integration
- **OrchestrationModule**: Task orchestration and execution
- **MessageModule**, **ChannelModule**: Communication
- **CollaborationModule**: Code review and collaboration
- **KnowledgeGraphModule**, **KnowledgeExtractionModule**: Knowledge management
- **RealtimeModule**: WebSocket communication
- And more...

### 4. Special Purpose Modules

- **DddProvidersModule**: Global DDD port bindings (Global)

---

## Import Patterns

### Pattern 1: TypeORM Entity Registration

**Most Common Pattern** - Register entities for repository injection:

```typescript
imports: [
  TypeOrmModule.forFeature([Entity1, Entity2, ...])
]
```

**Examples:**

- **Simple**: `KnowledgeGraphModule` registers `Node` and `Edge`
- **Multiple entities**: `TaskModule` registers `Task`, `Hollon`, `Project`, `Document`
- **Cross-module entities**: `OrchestrationModule` registers 11 entities from different modules

**When to use:**

- Any module that needs database access via repositories
- Include all entities the module will query, even from other modules

### Pattern 2: Feature Module Dependencies

Import other feature modules to use their exported services:

```typescript
imports: [
  DocumentModule,
  BrainProviderModule,
  // ...
];
```

**Examples:**

- **TaskModule** imports `DocumentModule`
- **BrainProviderModule** imports `ConfigModule` and `DocumentModule`
- **MessageModule** imports `CollaborationModule` and `TaskModule`

**When to use:**

- When you need services exported by another module
- Prefer this over direct service imports to maintain proper DI boundaries

### Pattern 3: Global Module Imports

Some modules are marked `@Global()` and automatically available:

```typescript
// No need to import these explicitly in feature modules
- ConfigModule (configured as global in AppModule)
- PostgresListenerModule (marked @Global)
- DddProvidersModule (marked @Global)
```

**When to use:**

- For truly cross-cutting concerns (config, logging, etc.)
- Use sparingly - only 2 custom modules are global in this project

### Pattern 4: forRoot/forRootAsync Configuration

Dynamic module configuration in root module:

```typescript
// AppModule only
ConfigModule.forRoot({
  isGlobal: true,
  load: [configuration],
  envFilePath: ['../../.env.local', '../../.env'],
});

TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => databaseConfig(configService),
  inject: [ConfigService],
});
```

**When to use:**

- Only in `AppModule` for global infrastructure setup
- Never in feature modules (use `forFeature` instead)

### Pattern 5: Conditional Imports

Conditional module loading based on environment:

```typescript
imports: [
  ...(process.env.DISABLE_SCHEDULER !== 'true'
    ? [ScheduleModule.forRoot()]
    : []),
];
```

**When to use:**

- When a module should only load in certain environments
- Rare - only used for scheduler in this project

---

## Provider Patterns

### Pattern 1: Simple Service Registration

**Most Common Pattern** - Standard service providers:

```typescript
providers: [
  ServiceA,
  ServiceB,
  // ...
];
```

**Examples:**

- **HealthModule**: `[HealthService]`
- **DocumentModule**: `[DocumentService]`
- **TaskModule**: `[TaskService, DependencyAnalyzerService, ...]` (6 services)

**When to use:**

- Default pattern for all `@Injectable()` services
- Services are automatically singleton-scoped

### Pattern 2: Multiple Related Services

Group related services together:

```typescript
providers: [
  // Main service
  TaskService,

  // Supporting services
  DependencyAnalyzerService,
  ResourcePlannerService,
  PriorityRebalancerService,
  UncertaintyDecisionService,
  PivotResponseService,
];
```

**Examples:**

- **TaskModule**: Main service + 5 supporting services
- **BrainProviderModule**: Services organized by concern (process, cost, response, config) + providers
- **OrchestrationModule**: 14 application services + DDD adapters

**When to use:**

- Complex modules with multiple service layers
- Use comments to group services by responsibility

### Pattern 3: Custom Provider with Interface Binding

**DDD Pattern** - Bind interfaces to implementations:

```typescript
providers: [
  {
    provide: 'IServicePort',
    useExisting: ConcreteService,
  },
  {
    provide: 'IRepositoryPort',
    useClass: RepositoryAdapter,
  },
];
```

**Examples:**

- **DddProvidersModule**:
  ```typescript
  {
    provide: 'IHollonService',
    useExisting: HollonService,
  }
  ```
- **OrchestrationModule**:
  ```typescript
  {
    provide: 'IHollonManagementPort',
    useClass: HollonManagementAdapter,
  }
  ```

**When to use:**

- Implementing DDD ports and adapters
- Decoupling modules via interfaces
- Testing (swap implementations)

**Types:**

- `useExisting`: Alias to another provider (shares instance)
- `useClass`: Creates new instance of the class
- `useFactory`: Dynamic provider creation
- `useValue`: Provide a constant value

### Pattern 4: Mixed Service Registration

Combine standard and custom providers:

```typescript
providers: [
  // Standard services
  PromptComposerService,
  TaskPoolService,

  // Interface binding
  {
    provide: 'GoalDecompositionService',
    useExisting: GoalDecompositionService,
  },

  // DDD adapters
  {
    provide: 'IHollonManagementPort',
    useClass: HollonManagementAdapter,
  },
];
```

**Example:** **OrchestrationModule** (most complex module)

**When to use:**

- Modules implementing DDD patterns
- Modules with both internal services and port adapters

### Pattern 5: Listeners and Guards

Include event listeners and guards as providers:

```typescript
providers: [
  MessageService,
  MessageListener, // Event listener
];

providers: [
  RealtimeGateway,
  WsAuthGuard, // WebSocket guard
];
```

**Examples:**

- **MessageModule**: `MessageListener`
- **HollonModule**: `HollonCleanupListener`
- **RealtimeModule**: `WsAuthGuard`

**When to use:**

- Event listeners that respond to domain events
- Guards for route/gateway protection

---

## Export Patterns

### Pattern 1: Export Main Service Only

**Common Pattern** - Export only the primary service:

```typescript
exports: [MainService];
```

**Examples:**

- **DocumentModule**: `[DocumentService]`
- **MessageModule**: `[MessageService]`
- **KnowledgeGraphModule**: `[KnowledgeGraphService]`
- **HollonModule**: `[HollonService]`

**When to use:**

- Simple modules with one main service
- Hide implementation details (other services stay private)

### Pattern 2: Export Multiple Services

Export multiple services for external use:

```typescript
exports: [ServiceA, ServiceB, ServiceC];
```

**Examples:**

- **TaskModule**: Exports 6 services (all providers)
- **BrainProviderModule**: `[BrainProviderService, ClaudeCodeProvider, ProcessManagerService]`
- **CollaborationModule**: Exports 5 services (all providers)

**When to use:**

- When multiple services form the module's public API
- Supporting services are needed by other modules

### Pattern 3: Export Subset of Providers

Export some but not all providers:

```typescript
providers: [
  ServiceA,
  ServiceB,
  ServiceC,
  InternalHelper,
],
exports: [
  ServiceA,
  ServiceB,
  // ServiceC and InternalHelper remain private
]
```

**Example:**

- **OrchestrationModule**:
  - Provides 14 services + 3 adapters
  - Exports only 7 services (hides internal details)

**When to use:**

- To hide internal implementation services
- To maintain a clean public API

### Pattern 4: Export Interface Bindings

Export DDD port interfaces:

```typescript
providers: [
  {
    provide: 'IServicePort',
    useExisting: ConcreteService,
  },
],
exports: ['IServicePort']
```

**Example:**

- **DddProvidersModule**: Exports `'IHollonService'`, `'ICodeReviewService'`, `'IMessageService'`

**When to use:**

- Global DDD provider modules
- When consumers should depend on interfaces, not implementations

### Pattern 5: No Exports

Some modules don't export anything:

```typescript
exports: []; // or omitted entirely
```

**Examples:**

- **HealthModule**: No exports (just controllers)
- **AppModule**: No exports (root module)

**When to use:**

- Modules that only expose controllers/gateways
- Root application module
- Self-contained modules

---

## Circular Dependency Handling

### Pattern 1: forwardRef for Circular Dependencies

Use `forwardRef()` when two modules need each other:

```typescript
import { Module, forwardRef } from '@nestjs/common';

imports: [forwardRef(() => ModuleB)];
```

**Examples:**

- **MessageModule**:
  ```typescript
  imports: [forwardRef(() => CollaborationModule), TaskModule];
  ```
- **HollonModule**:
  ```typescript
  imports: [
    forwardRef(() => TeamModule),
    forwardRef(() => OrchestrationModule),
  ];
  ```
- **OrchestrationModule**:
  ```typescript
  imports: [forwardRef(() => GoalModule)];
  ```

**When to use:**

- When you get circular dependency errors
- Both modules need each other's services
- Apply to both sides of the circular dependency

**Common circular pairs:**

- Message ↔ Collaboration
- Hollon ↔ Team
- Hollon ↔ Orchestration
- Orchestration ↔ Goal

### Pattern 2: DDD Pattern to Avoid Circularity

Use global port providers to break circular dependencies:

```typescript
// Instead of:
// OrchestrationModule imports HollonModule, CollaborationModule, MessageModule
// (causing circular deps)

// Use:
// DddProvidersModule (Global) imports all modules
// OrchestrationModule injects via interfaces
@Inject('IHollonService') private hollonService: IHollonService
```

**Example:** **OrchestrationModule** uses port adapters instead of direct imports

**When to use:**

- Complex modules with many dependencies
- To maintain clean architecture boundaries
- When `forwardRef` becomes too messy

---

## Global Module Pattern

### Global Module Configuration

Mark a module as global to make its exports available everywhere:

```typescript
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  // ...
  exports: [SomeService],
})
export class SomeModule {}
```

**Examples:**

1. **PostgresListenerModule**:

   ```typescript
   @Global()
   @Module({
     providers: [PostgresListenerService],
     exports: [PostgresListenerService],
   })
   ```

2. **DddProvidersModule**:
   ```typescript
   @Global()
   @Module({
     imports: [HollonModule, CollaborationModule, MessageModule],
     providers: [
       { provide: 'IHollonService', useExisting: HollonService },
       { provide: 'ICodeReviewService', useExisting: CodeReviewService },
       { provide: 'IMessageService', useExisting: MessageService },
     ],
     exports: ['IHollonService', 'ICodeReviewService', 'IMessageService'],
   })
   ```

**When to use:**

- For cross-cutting infrastructure (listeners, loggers, etc.)
- For DDD port providers used across many modules
- **Use sparingly** - only 2 modules are global in this project

**Advantages:**

- No need to import in every module
- Cleaner import lists

**Disadvantages:**

- Hidden dependencies (less explicit)
- Can make testing harder

---

## DDD Architecture Pattern

### DDD Provider Pattern

The project uses Domain-Driven Design (DDD) with ports and adapters:

**Components:**

1. **Ports (Interfaces)**:
   - Defined in each domain module
   - Example: `IHollonService`, `ICodeReviewService`, `IMessageService`

2. **Adapters (Implementations)**:
   - Implement port interfaces
   - Located in `/infrastructure/adapters/` directory
   - Example: `HollonManagementAdapter`, `CodeReviewAdapter`, `MessagingAdapter`

3. **Global Provider Module**:
   - **DddProvidersModule** binds ports to implementations
   - Marked `@Global()` for application-wide availability

**Example Implementation:**

```typescript
// DddProvidersModule - Global provider bindings
@Global()
@Module({
  imports: [HollonModule, CollaborationModule, MessageModule],
  providers: [
    {
      provide: 'IHollonService',
      useExisting: HollonService,
    },
  ],
  exports: ['IHollonService'],
})
export class DddProvidersModule {}

// OrchestrationModule - Uses ports instead of direct imports
@Module({
  imports: [
    // ✅ No direct import of HollonModule
    // Uses DddProvidersModule instead
  ],
  providers: [
    {
      provide: 'IHollonManagementPort',
      useClass: HollonManagementAdapter,  // Adapter in infrastructure/
    },
  ],
})
export class OrchestrationModule {}

// Service injection - Depends on interface
constructor(
  @Inject('IHollonService') private hollonService: IHollonService,
) {}
```

**Benefits:**

1. Decouples modules (no direct dependencies)
2. Avoids circular dependencies
3. Easier testing (mock interfaces)
4. Clean architecture boundaries
5. Follows hexagonal architecture

**When to use:**

- Complex modules with many inter-dependencies
- When circular dependencies become problematic
- For better testability and maintainability

**Pattern Recognition:**

- Comments like `// ✅ DDD:` mark DDD-related code
- Adapters in `infrastructure/adapters/` directories
- Interface bindings with `provide: 'IServiceName'`

---

## Module File Structure

### Standard Module Structure

Each module follows this file organization:

```
modules/
└── feature-name/
    ├── entities/                  # TypeORM entities
    │   ├── entity-a.entity.ts
    │   └── entity-b.entity.ts
    ├── dto/                       # Data Transfer Objects (optional)
    │   ├── create-feature.dto.ts
    │   └── update-feature.dto.ts
    ├── services/                  # Supporting services (optional)
    │   ├── service-a.service.ts
    │   └── service-b.service.ts
    ├── listeners/                 # Event listeners (optional)
    │   └── feature.listener.ts
    ├── guards/                    # Route/gateway guards (optional)
    │   └── feature.guard.ts
    ├── infrastructure/            # DDD adapters (optional)
    │   └── adapters/
    │       └── feature.adapter.ts
    ├── feature-name.module.ts     # Module definition
    ├── feature-name.service.ts    # Main service
    ├── feature-name.controller.ts # Controller (if REST)
    ├── feature-name.gateway.ts    # Gateway (if WebSocket)
    └── feature-name.service.spec.ts # Tests
```

### Module File Naming Conventions

- **Module**: `{feature}.module.ts`
- **Service**: `{feature}.service.ts`
- **Controller**: `{feature}.controller.ts`
- **Gateway**: `{feature}.gateway.ts`
- **Entity**: `{entity}.entity.ts`
- **DTO**: `{create|update}-{feature}.dto.ts`
- **Test**: `{feature}.service.spec.ts`

### Examples:

**Simple Module (HealthModule):**

```
health/
├── health.module.ts
├── health.service.ts
└── health.controller.ts
```

**Complex Module (TaskModule):**

```
task/
├── entities/
│   └── task.entity.ts
├── services/
│   ├── dependency-analyzer.service.ts
│   ├── resource-planner.service.ts
│   ├── priority-rebalancer.service.ts
│   ├── uncertainty-decision.service.ts
│   └── pivot-response.service.ts
├── task.module.ts
├── task.service.ts
└── task.controller.ts
```

**DDD Module (OrchestrationModule):**

```
orchestration/
├── infrastructure/
│   └── adapters/
│       ├── hollon-management.adapter.ts
│       ├── code-review.adapter.ts
│       └── messaging.adapter.ts
├── services/
│   ├── prompt-composer.service.ts
│   ├── task-pool.service.ts
│   ├── hollon-orchestrator.service.ts
│   └── ... (14 services total)
└── orchestration.module.ts
```

---

## Best Practices Summary

### Import Best Practices

1. **Always import TypeOrmModule.forFeature()** for entities you need
2. **Import feature modules**, not individual services
3. **Use global modules sparingly** (only 2 in this project)
4. **Use forwardRef()** for circular dependencies
5. **Consider DDD pattern** for complex inter-dependencies
6. **Import entities from other modules** directly if needed for queries

### Provider Best Practices

1. **Use simple class providers by default** (`[ServiceName]`)
2. **Group services logically** with comments
3. **Use custom providers** for DDD patterns (`{ provide, useClass/useExisting }`)
4. **Include listeners and guards** as providers
5. **Keep providers focused** on the module's domain
6. **Document future service plans** in comments

### Export Best Practices

1. **Export the main service** at minimum
2. **Export only what other modules need** (hide internals)
3. **Be generous with exports** for supporting services if needed
4. **Export interface bindings** for DDD patterns
5. **Don't export from root module** (AppModule)
6. **Document export rationale** in module JSDoc

### Module Organization Best Practices

1. **One module per feature domain**
2. **Keep controllers/gateways thin** (delegate to services)
3. **Use service directory** for complex modules with multiple services
4. **Use infrastructure directory** for DDD adapters
5. **Follow strict naming conventions**
6. **Add comprehensive JSDoc** to module decorators (like KnowledgeGraphModule)
7. **Use comments to organize** imports/providers/exports by category

### Circular Dependency Best Practices

1. **Avoid if possible** by rethinking module boundaries
2. **Use forwardRef()** when two modules truly need each other
3. **Apply forwardRef to both sides** of the circular dependency
4. **Consider DDD pattern** for complex cases with many dependencies
5. **Extract shared logic** to a separate module if appropriate

### Testing Best Practices

1. **Each service should have `.spec.ts`** file
2. **Test modules independently** using `Test.createTestingModule()`
3. **Mock external dependencies** (repositories, services from other modules)
4. **Use custom providers** for easier testing in DDD pattern

### Documentation Best Practices

1. **Add module-level JSDoc** explaining responsibilities
2. **Document each decorator property** (imports, providers, exports)
3. **Explain export rationale** (which modules will use it)
4. **Note future plans** for additional services
5. **Use `// ✅ DDD:` comments** for DDD pattern recognition
6. **Document integration points** with other modules

---

## Module Analysis Summary

**Total Modules Analyzed**: 28

**Module Complexity Distribution:**

- **Simple** (1-2 providers): 4 modules (Health, Document, PostgresListener, Realtime)
- **Medium** (3-5 providers): 10 modules (KnowledgeGraph, Message, BrainProvider, etc.)
- **Complex** (6+ providers): 14 modules (Task, Orchestration, Collaboration, etc.)

**Most Complex Module**: **OrchestrationModule**

- 11 entities registered
- 17 providers (14 services + 3 adapters)
- 7 exports
- 2 module imports (uses DDD pattern for most dependencies)

**Global Modules**: 2

- PostgresListenerModule
- DddProvidersModule

**Modules Using forwardRef**: 4

- MessageModule
- HollonModule
- OrchestrationModule
- CollaborationModule

**Modules Using DDD Pattern**: 2

- DddProvidersModule (global provider)
- OrchestrationModule (consumer of ports)

**Common Import Combinations:**

- TypeOrmModule.forFeature + other feature modules (most common)
- ConfigModule (for configuration)
- BrainProviderModule (for AI capabilities)
- forwardRef for bidirectional dependencies

This pattern analysis provides a comprehensive guide for implementing new modules in the Hollon-AI project while maintaining consistency with existing conventions.
