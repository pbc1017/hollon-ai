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
})
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
})
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
PostgresListenerModule
```

**Purpose:**

- Database event listening and notification handling
- No special configuration in app.module.ts

### Feature Modules (Current)

The app.module.ts currently imports 28 feature modules, organized as:

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
6. **Architecture:**
   - DddProvidersModule (Global Port Providers)
7. **Knowledge & AI:**
   - KnowledgeGraphModule
   - PromptComposerModule
   - KnowledgeExtractionModule

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

## VectorSearchModule Analysis

### Current Module Structure

**Location:** `apps/server/src/modules/vector-search/vector-search.module.ts`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([VectorSearchConfig, VectorEmbedding]),
    ConfigModule,
  ],
  providers: [VectorSearchService, VectorSearchConfigService],
  exports: [VectorSearchService, VectorSearchConfigService],
})
export class VectorSearchModule {}
```

**Key Characteristics:**

- **Entities:** VectorSearchConfig, VectorEmbedding
- **Services:**
  - `VectorSearchService`: Core semantic search operations
  - `VectorSearchConfigService`: Organization-specific configuration
- **Dependencies:** TypeORM, ConfigModule
- **Exports:** Both services (available for other modules to use)

### Current Integration Status

**Important Finding:** VectorSearchModule is **NOT** directly imported in app.module.ts.

**However**, it IS indirectly available through module dependencies:

1. **PromptComposerModule** imports VectorSearchModule:

   ```typescript
   imports: [
     KnowledgeExtractionModule,
     VectorSearchModule, // ✅ Direct import
     KnowledgeGraphModule,
   ];
   ```

2. **KnowledgeExtractionModule** has its own `VectorSearchService` (different service):
   ```typescript
   providers: [KnowledgeExtractionService, VectorSearchService];
   ```

**This creates a potential issue:**

- There are TWO different VectorSearchService classes:
  1. `apps/server/src/modules/vector-search/vector-search.service.ts` (VectorSearchModule)
  2. `apps/server/src/modules/knowledge-extraction/services/vector-search.service.ts` (KnowledgeExtractionModule)

### Module Dependency Graph

```
AppModule
  ├── PromptComposerModule
  │     ├── VectorSearchModule ✅ (imports VectorSearchService)
  │     ├── KnowledgeExtractionModule (has its own VectorSearchService)
  │     └── KnowledgeGraphModule
  └── KnowledgeExtractionModule (separate import, own VectorSearchService)
```

## Integration Recommendations

### Option 1: Add to app.module.ts (Recommended for Global Availability)

If VectorSearchModule services should be available to ANY module in the application:

**Add to app.module.ts in the "Knowledge & AI" section:**

```typescript
// Knowledge & AI
KnowledgeGraphModule,
PromptComposerModule,
KnowledgeExtractionModule,
VectorSearchModule, // ⭐ Add here for global availability
```

**Pros:**

- Makes VectorSearchService globally available to all modules
- Consistent with other shared infrastructure services
- Clear declaration of system-wide capabilities

**Cons:**

- Currently only used by PromptComposerModule, so global import may be premature

### Option 2: Keep in PromptComposerModule Only (Current State)

Keep VectorSearchModule imported only in PromptComposerModule.

**Pros:**

- Follows "import only what you need" principle
- Reduces unnecessary module initialization
- Clear dependency chain

**Cons:**

- Other modules can't easily use VectorSearchService without importing VectorSearchModule
- Less discoverable as a system capability

### Option 3: Resolve VectorSearchService Naming Conflict

**Critical Issue:** Two services with the same name exist:

1. Rename `KnowledgeExtractionModule`'s `VectorSearchService` to something more specific:
   - `KnowledgeVectorService`
   - `ExtractionVectorService`
   - `KnowledgeEmbeddingService`
2. Keep `VectorSearchModule`'s `VectorSearchService` as the canonical service
3. Potentially have `KnowledgeExtractionModule` import and use `VectorSearchModule`'s service instead

## Recommended Integration Point

**Primary Recommendation:**

1. **Add VectorSearchModule to app.module.ts** in the "Knowledge & AI" section (after KnowledgeExtractionModule)
2. **Reason:**
   - Vector search is a cross-cutting concern that may be needed by multiple modules (OrchestrationModule, TaskModule, etc.)
   - ConfigService already has comprehensive vectorSearch configuration
   - Aligns with the architecture where knowledge capabilities are top-level concerns

**Placement in app.module.ts:**

```typescript
// Knowledge & AI
KnowledgeGraphModule,
PromptComposerModule,
KnowledgeExtractionModule,
VectorSearchModule, // ⭐ Add here
```

**Secondary Recommendation:**

- Resolve the naming conflict between the two VectorSearchService classes
- Consider whether KnowledgeExtractionModule should use VectorSearchModule's service instead of its own

## ConfigService Integration

VectorSearchModule already properly integrates with ConfigService:

1. **Imports ConfigModule:**
   ```typescript
   imports: [TypeOrmModule.forFeature([...]), ConfigModule];
   ```
2. **Can inject ConfigService:**
   ```typescript
   constructor(private configService: ConfigService) {
     const vectorConfig = this.configService.get('vectorSearch');
   }
   ```
3. **Configuration available at:** `configService.get('vectorSearch')`

## Next Steps

1. **Decision Required:** Choose integration strategy (Option 1, 2, or 3)
2. **If Option 1 (Add to app.module.ts):**
   - Add VectorSearchModule import to app.module.ts
   - Update module import order (place in Knowledge & AI section)
   - Test that module initializes correctly
3. **If Option 3 (Resolve naming conflict):**
   - Rename KnowledgeExtractionModule's VectorSearchService
   - Update all references in KnowledgeExtractionModule
   - Consider refactoring to use VectorSearchModule's service
4. **Remove PromptComposerModule's direct import** (if adding to app.module.ts):
   - VectorSearchModule will be available globally
   - Clean up PromptComposerModule's imports

## Summary

- **ConfigService:** Already configured with comprehensive vector search settings
- **VectorSearchModule:** Exists and is functional, but not in app.module.ts
- **Current Usage:** Only PromptComposerModule imports VectorSearchModule
- **Naming Conflict:** Two different VectorSearchService classes exist
- **Recommendation:** Add VectorSearchModule to app.module.ts for global availability and resolve naming conflict

## Files Referenced

- `apps/server/src/app.module.ts` - Main application module
- `apps/server/src/config/configuration.ts` - Configuration factory with vectorSearch config
- `apps/server/src/config/database.config.ts` - Database configuration pattern
- `apps/server/src/modules/vector-search/vector-search.module.ts` - VectorSearchModule
- `apps/server/src/modules/prompt-composer/prompt-composer.module.ts` - Current VectorSearchModule consumer
- `apps/server/src/modules/knowledge-extraction/knowledge-extraction.module.ts` - Has conflicting VectorSearchService
- `apps/server/src/modules/brain-provider/brain-provider.module.ts` - ConfigModule usage example
