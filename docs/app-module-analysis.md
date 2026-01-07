# App Module Structure and Dependencies Analysis

## Overview

This document analyzes the current `apps/server/src/app.module.ts` structure, documenting existing module imports, providers, and configuration patterns. This analysis identifies where VectorSearchModule should be integrated.

**Analysis Date:** 2026-01-07
**File Analyzed:** `apps/server/src/app.module.ts`

## Current Module Structure

### Configuration Layer

#### ConfigModule (Global)

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  load: [configuration],
  envFilePath: ['../../.env.local', '../../.env'],
});
```

**Key Characteristics:**

- **Global Scope:** `isGlobal: true` makes ConfigService available to all modules without re-importing
- **Configuration Factory:** Uses `configuration.ts` factory function
- **Environment Files:** Loads from monorepo root (`../../.env.local`, `../../.env`)
- **ConfigService:** Available for dependency injection in all modules

#### TypeOrmModule (Database)

```typescript
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => databaseConfig(configService),
  inject: [ConfigService],
});
```

**Pattern Used:**

- **Async Configuration:** Uses `forRootAsync()` for dynamic configuration
- **Factory Pattern:** `databaseConfig()` function consumes ConfigService
- **Dependency Injection:** ConfigService injected via `inject` array

### Infrastructure Modules

#### ScheduleModule (Conditional)

```typescript
...(process.env.DISABLE_SCHEDULER !== 'true' ? [ScheduleModule.forRoot()] : [])
```

**Key Points:**

- **Conditional Import:** Can be disabled via environment variable
- **Global Scheduling:** Provides cron job and interval scheduling capabilities
- **Used By:** Task scheduling, periodic jobs

#### PostgresListenerModule

```typescript
PostgresListenerModule;
```

**Purpose:**

- Database event listening and notification handling
- No special configuration in app.module.ts

### Feature Modules (Current)

The app.module.ts currently imports 23 feature modules, organized as:

1. **Core Business Modules:**
   - HealthModule
   - OrganizationModule
   - RoleModule
   - TeamModule
   - HollonModule
   - ProjectModule
   - TaskModule
2. **AI & Processing:**
   - BrainProviderModule
   - OrchestrationModule
3. **Communication:**
   - MessageModule
   - RealtimeModule
   - ChannelModule
   - MeetingModule
4. **Collaboration:**
   - CollaborationModule
   - ApprovalModule
   - CrossTeamCollaborationModule
   - IncidentModule
   - ConflictResolutionModule
5. **Goals:**
   - GoalModule
6. **Knowledge & AI:**
   - KnowledgeGraphModule ✅ **REGISTERED** (line 74)
   - PromptComposerModule
7. **Architecture:**
   - DddProvidersModule (Global Port Providers)

## ConfigService Usage Patterns

### 1. Global Configuration Object

The `configuration.ts` factory exports a structured configuration object:

```typescript
{
  nodeEnv: string,
  server: { port, host },
  database: { host, port, name, user, password, schema, url },
  brain: { claudeCodePath, timeoutMs, anthropicApiKey, openaiApiKey },
  cost: { dailyLimitCents, monthlyLimitCents, alertThresholdPercent },
  logging: { level, format },
  security: { jwtSecret, encryptionKey },
  cors: { origin },
  vectorSearch: {
    enabled: boolean,
    embedding: { provider, model, dimensions, apiKey, batchSize, maxRetries, timeoutMs },
    search: { defaultMetric, defaultMinSimilarity, defaultLimit, maxLimit, includeScoresByDefault },
    index: { name, autoCreate, lists, probes },
    performance: { enableCache, cacheTtlSeconds, poolSize }
  }
}
```

### 2. Vector Search Configuration (Already Present!)

**Important Discovery:** The configuration.ts **already includes** comprehensive vector search configuration under `vectorSearch` object:

- **Enabled Flag:** `vectorSearch.enabled` (defaults to true in dev, false in test/prod unless explicitly enabled)
- **Embedding Config:** Provider, model, dimensions, API keys, batch size, retries, timeouts
- **Search Config:** Metrics, similarity thresholds, limits, score inclusion
- **Index Config:** Index name, auto-creation, IVFFlat parameters (lists, probes)
- **Performance Config:** Caching, TTL, connection pooling

**Environment Variables:**

- `VECTOR_SEARCH_ENABLED`
- `VECTOR_EMBEDDING_PROVIDER`
- `VECTOR_EMBEDDING_MODEL`
- `VECTOR_EMBEDDING_DIMENSIONS`
- `VECTOR_EMBEDDING_API_KEY`
- `VECTOR_EMBEDDING_BATCH_SIZE`
- `VECTOR_EMBEDDING_MAX_RETRIES`
- `VECTOR_EMBEDDING_TIMEOUT_MS`
- `VECTOR_SEARCH_DEFAULT_METRIC`
- `VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY`
- `VECTOR_SEARCH_DEFAULT_LIMIT`
- `VECTOR_SEARCH_MAX_LIMIT`
- `VECTOR_SEARCH_INCLUDE_SCORES_BY_DEFAULT`
- `VECTOR_INDEX_NAME`
- `VECTOR_INDEX_AUTO_CREATE`
- `VECTOR_INDEX_LISTS`
- `VECTOR_INDEX_PROBES`
- `VECTOR_PERFORMANCE_ENABLE_CACHE`
- `VECTOR_PERFORMANCE_CACHE_TTL_SECONDS`
- `VECTOR_PERFORMANCE_POOL_SIZE`

### 3. Module-Level ConfigService Usage Example

**BrainProviderModule Pattern:**

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([BrainProviderConfig, CostRecord]),
    ConfigModule, // Import ConfigModule (even though it's global, explicit is better)
    DocumentModule,
  ],
  // ...
})
```

**Key Pattern:** Even though ConfigModule is global, modules explicitly import it for clarity.

## KnowledgeGraphModule Analysis

### Current Module Structure

**Location:** `apps/server/src/modules/knowledge-graph/knowledge-graph.module.ts`

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([GraphNode, GraphEdge])],
  providers: [KnowledgeGraphService],
  exports: [KnowledgeGraphService],
})
export class KnowledgeGraphModule {}
```

**Key Characteristics:**

- **Entities:** GraphNode, GraphEdge
- **Services:**
  - `KnowledgeGraphService`: Graph operations and knowledge management
- **Dependencies:** TypeORM
- **Exports:** KnowledgeGraphService (available for other modules to use)

### Current Integration Status

✅ **KnowledgeGraphModule is REGISTERED** in app.module.ts at line 74.

**Module Registration:**

```typescript
// Feature modules
HealthModule,
OrganizationModule,
// ... other modules ...
KnowledgeGraphModule,  // ✅ Line 74
PromptComposerModule,

// ✅ DDD: Global Port Providers Module
DddProvidersModule,
```

**Import Statement:** Line 28 in app.module.ts:
```typescript
import { KnowledgeGraphModule } from './modules/knowledge-graph/knowledge-graph.module';
```

### Module Dependency Graph

```
AppModule
  ├── KnowledgeGraphModule ✅ (direct registration at app level)
  │     └── provides: KnowledgeGraphService
  └── PromptComposerModule
        ├── imports: KnowledgeGraphModule (can use KnowledgeGraphService)
        └── imports: KnowledgeExtractionModule
```

## KnowledgeGraphModule Registration Analysis

### ✅ Current Status: FULLY REGISTERED

KnowledgeGraphModule is **already properly registered** in app.module.ts. No additional integration work is needed.

**Registration Details:**

1. **Import Statement** (line 28):
   ```typescript
   import { KnowledgeGraphModule } from './modules/knowledge-graph/knowledge-graph.module';
   ```

2. **Module Registration** (line 74):
   ```typescript
   imports: [
     // ... other modules ...
     GoalModule,
     KnowledgeGraphModule,  // ✅ REGISTERED HERE
     PromptComposerModule,
     // ...
   ]
   ```

3. **Placement:** Located in the "Knowledge & AI" section, positioned between:
   - **Before:** GoalModule
   - **After:** PromptComposerModule

### Integration Pattern

KnowledgeGraphModule follows the standard NestJS module pattern:

1. **Entities:** Registered with TypeORM via `TypeOrmModule.forFeature([GraphNode, GraphEdge])`
2. **Service:** KnowledgeGraphService is provided and exported
3. **Availability:** Because the module is registered at the app level, KnowledgeGraphService is available to:
   - Any module that imports KnowledgeGraphModule
   - Currently used by PromptComposerModule

### Module Position Rationale

The current position (line 74) is **optimal** because:

1. **Logical Grouping:** Placed with other knowledge/AI-related modules (PromptComposerModule follows it)
2. **Dependency Order:** Modules that depend on it (like PromptComposerModule) can safely import it
3. **Clean Organization:** Maintains the separation between business logic and knowledge infrastructure

## ConfigService Integration

KnowledgeGraphModule can integrate with ConfigService if needed:

1. **Module can import ConfigModule:**
   ```typescript
   imports: [TypeOrmModule.forFeature([GraphNode, GraphEdge]), ConfigModule];
   ```
2. **Services can inject ConfigService:**
   ```typescript
   constructor(private configService: ConfigService) {
     // Access configuration as needed
   }
   ```
3. **Currently:** KnowledgeGraphModule doesn't require ConfigService integration as it operates on TypeORM entities

## Summary

- **KnowledgeGraphModule:** ✅ **FULLY REGISTERED** in app.module.ts (line 74)
- **Location:** Properly placed in the "Knowledge & AI" section
- **Import Statement:** Correctly imported at line 28
- **Dependencies:** TypeORM entities (GraphNode, GraphEdge)
- **Exports:** KnowledgeGraphService (available to other modules)
- **Current Consumers:** PromptComposerModule
- **Status:** No additional integration work needed

## Files Referenced

- `apps/server/src/app.module.ts` - Main application module (KnowledgeGraphModule registered at line 74)
- `apps/server/src/config/configuration.ts` - Configuration factory
- `apps/server/src/config/database.config.ts` - Database configuration pattern
- `apps/server/src/modules/knowledge-graph/knowledge-graph.module.ts` - KnowledgeGraphModule definition
- `apps/server/src/modules/knowledge-graph/entities/graph-node.entity.ts` - GraphNode entity
- `apps/server/src/modules/knowledge-graph/entities/graph-edge.entity.ts` - GraphEdge entity
- `apps/server/src/modules/knowledge-graph/knowledge-graph.service.ts` - KnowledgeGraphService
- `apps/server/src/modules/prompt-composer/prompt-composer.module.ts` - Current KnowledgeGraphModule consumer
