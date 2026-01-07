# Configuration Patterns and VectorSearchModule Analysis

**Date**: 2026-01-07
**Purpose**: Document existing configuration patterns, module registration approach, and VectorSearchModule structure for implementing similar modules in the hollon-ai project.

---

## Table of Contents

1. [Configuration Patterns](#configuration-patterns)
2. [Module Registration in app.module.ts](#module-registration-in-appmodulets)
3. [VectorSearchModule Structure](#vectorsearchmodule-structure)
4. [Environment Variables](#environment-variables)
5. [Integration Patterns](#integration-patterns)
6. [Best Practices and Conventions](#best-practices-and-conventions)

---

## Configuration Patterns

### Global ConfigModule Setup

The application uses NestJS's `@nestjs/config` package with a global configuration setup in `app.module.ts`:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  load: [configuration],
  envFilePath: ['../../.env.local', '../../.env'],
})
```

**Key Points:**
- `isGlobal: true` - Makes ConfigService available throughout the entire application without re-importing
- Uses a centralized configuration factory function (`configuration`)
- Supports environment-specific files (.env.local takes precedence over .env)
- Configuration factory is located at `apps/server/src/config/configuration.ts`

### Configuration Factory Pattern

The `configuration.ts` file exports a factory function that:

1. Reads environment variables
2. Provides type-safe defaults
3. Performs environment-aware transformations (test, development, production)
4. Returns a structured configuration object

**Example Structure** (from `configuration.ts`):

```typescript
export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isTest = nodeEnv === 'test';
  const isProd = nodeEnv === 'production';

  return {
    nodeEnv,
    server: {
      port: parseInt(process.env.SERVER_PORT || '3001', 10),
      host: process.env.SERVER_HOST || '0.0.0.0',
    },
    database: { /* ... */ },
    brain: { /* ... */ },
    vectorSearch: {
      enabled: process.env.VECTOR_SEARCH_ENABLED === 'true' || (!isTest && !isProd),
      embedding: { /* ... */ },
      search: { /* ... */ },
      index: { /* ... */ },
      performance: { /* ... */ },
    },
    // ... other sections
  };
};
```

### ConfigService Usage Patterns

#### Pattern 1: Direct Environment Variable Access

Used in simple services that need direct access to environment variables:

```typescript
@Injectable()
export class PostgresListenerService {
  constructor(private readonly configService: ConfigService) {}

  private async connect(): Promise<void> {
    this.client = new pg.Client({
      host: this.configService.get<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT'),
      database: this.configService.get<string>('DB_NAME'),
      user: this.configService.get<string>('DB_USER'),
      password: this.configService.get<string>('DB_PASSWORD'),
    });
  }
}
```

**Location**: `apps/server/src/modules/postgres-listener/postgres-listener.service.ts:22`

#### Pattern 2: Database Configuration with ConfigService

Used in database setup with factory pattern:

```typescript
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => databaseConfig(configService),
  inject: [ConfigService],
})
```

The factory function in `apps/server/src/config/database.config.ts`:

```typescript
export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isProduction = configService.get('nodeEnv') === 'production';
  const isTest = configService.get('nodeEnv') === 'test';
  const schema = configService.get<string>('database.schema', 'hollon');

  return {
    type: 'postgres',
    host: configService.get<string>('database.host'),
    port: configService.get<number>('database.port'),
    username: configService.get<string>('database.user'),
    password: configService.get<string>('database.password'),
    database: configService.get<string>('database.name'),
    schema: schema,
    entities: [__dirname + '/../**/*.entity.{ts,js}'],
    migrations: [__dirname + '/../database/migrations/*.{ts,js}'],
    synchronize: false,
    migrationsRun: isTest,
    dropSchema: false,
    logging: !isProduction && !isTest,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    extra: {
      options: `-c search_path=${schema},public`,
    },
  };
};
```

#### Pattern 3: Configuration Service Pattern

For modules with complex configuration needs, a dedicated configuration service pattern is used:

**Example 1: VectorSearchConfigService**

```typescript
@Injectable()
export class VectorSearchConfigService {
  constructor(
    @InjectRepository(VectorSearchConfig)
    private readonly configRepo: Repository<VectorSearchConfig>,
  ) {}

  async getOrCreateConfig(organizationId: string): Promise<VectorSearchConfig> {
    try {
      return await this.getConfig(organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return await this.createDefaultConfig(organizationId);
      }
      throw error;
    }
  }

  private async createDefaultConfig(
    organizationId: string,
  ): Promise<VectorSearchConfig> {
    const config = this.configRepo.create({
      organizationId,
      displayName: 'Default Vector Search Config',
      provider: 'openai',
      embeddingModel: 'text-embedding-3-small',
      dimensions: 1536,
      config: {
        apiKey: process.env.OPENAI_API_KEY,
        apiEndpoint: 'https://api.openai.com/v1',
        batchSize: 100,
      },
      searchConfig: {
        similarityThreshold: 0.7,
        defaultLimit: 10,
        maxLimit: 100,
        distanceMetric: 'cosine',
      },
      costPer1kTokensCents: 0.00002,
      timeoutSeconds: 30,
      maxRetries: 3,
      rateLimitConfig: {
        maxRequestsPerMinute: 60,
        maxTokensPerMinute: 1000000,
      },
      enabled: true,
    });

    return await this.configRepo.save(config);
  }

  async validateConfig(config: VectorSearchConfig): Promise<void> {
    // Validation logic here
  }
}
```

**Location**: `apps/server/src/modules/vector-search/services/vector-search-config.service.ts`

**Example 2: BrainProviderConfigService**

Similar pattern used in `apps/server/src/modules/brain-provider/services/brain-provider-config.service.ts`:

```typescript
@Injectable()
export class BrainProviderConfigService {
  constructor(
    @InjectRepository(BrainProviderConfig)
    private readonly configRepo: Repository<BrainProviderConfig>,
  ) {}

  async getConfig(organizationId: string): Promise<BrainProviderConfig> { /* ... */ }
  async getDefaultConfig(): Promise<BrainProviderConfig> { /* ... */ }
  async validateConfig(config: BrainProviderConfig): Promise<void> { /* ... */ }
}
```

**Key Pattern Characteristics:**
- Database-backed configuration (entity + repository)
- Organization-scoped configuration for multi-tenancy
- Default configuration fallback from environment variables
- Validation methods for configuration integrity
- getOrCreateConfig pattern for automatic setup

---

## Module Registration in app.module.ts

### Module Organization Structure

Modules in `app.module.ts` are organized into logical groups:

```typescript
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({ /* ... */ }),

    // Database
    TypeOrmModule.forRootAsync({ /* ... */ }),

    // Infrastructure modules (Global)
    ...(process.env.DISABLE_SCHEDULER !== 'true'
      ? [ScheduleModule.forRoot()]
      : []),
    PostgresListenerModule,

    // Feature modules
    HealthModule,
    OrganizationModule,
    RoleModule,
    TeamModule,
    HollonModule,
    ProjectModule,
    TaskModule,
    BrainProviderModule,
    OrchestrationModule,
    MessageModule,
    RealtimeModule,
    ChannelModule,
    MeetingModule,
    CollaborationModule,
    ApprovalModule,
    CrossTeamCollaborationModule,
    IncidentModule,
    ConflictResolutionModule,
    GoalModule,

    // ✅ DDD: Global Port Providers Module
    DddProvidersModule,

    // Knowledge Graph & Prompt Composer
    KnowledgeGraphModule,
    PromptComposerModule,
    KnowledgeExtractionModule,
  ],
})
export class AppModule {}
```

**Location**: `apps/server/src/app.module.ts`

### Module Import Patterns

#### Simple Feature Module

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Entity])],
  controllers: [EntityController],
  providers: [EntityService],
  exports: [EntityService],
})
export class EntityModule {}
```

#### Module with Dependencies

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Entity1, Entity2]),
    ConfigModule,  // Already global, but can be explicitly imported
    OtherFeatureModule,
  ],
  controllers: [EntityController],
  providers: [EntityService, ConfigService],
  exports: [EntityService],
})
export class EntityModule {}
```

#### Conditional Module Registration

```typescript
...(process.env.DISABLE_SCHEDULER !== 'true'
  ? [ScheduleModule.forRoot()]
  : [])
```

This pattern allows environment-based conditional module inclusion.

---

## VectorSearchModule Structure

### Module Definition

**Location**: `apps/server/src/modules/vector-search/vector-search.module.ts`

```typescript
/**
 * VectorSearchModule
 *
 * This module provides vector-based semantic search capabilities for the application,
 * enabling similarity searches across documents, messages, and knowledge base content.
 *
 * Features:
 * - Semantic search using pgvector
 * - Embedding generation via OpenAI or other providers
 * - Multi-tenant configuration management
 * - Document indexing and similarity search
 *
 * Key Responsibilities:
 * - Performing semantic similarity searches using vector embeddings
 * - Managing vector storage and retrieval operations
 * - Providing vector search services to other modules (knowledge-extraction, prompt-composer, etc.)
 *
 * Services:
 * - VectorSearchService: Core business logic for vector-based semantic search operations
 * - VectorSearchConfigService: Organization-specific configuration management
 *
 * Entities:
 * - VectorSearchConfig: Organization-specific vector search settings
 * - VectorEmbedding: Stored vector embeddings with metadata
 *
 * Used by modules such as:
 * - PromptComposerModule: For retrieving semantically relevant context
 * - KnowledgeExtractionModule: For finding related knowledge entries
 * - OrchestrationModule: For context-aware decision making
 */
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

### Core Components

#### 1. VectorSearchService

**Location**: `apps/server/src/modules/vector-search/vector-search.service.ts`

**Key Methods:**
- `searchSimilarVectors(query, options)` - Semantic search using pgvector
- `indexDocument(id, content, sourceType, metadata, options)` - Index a document
- `updateDocument(id, sourceType, content, organizationId)` - Update embedding
- `deleteDocument(id, sourceType, organizationId)` - Remove embedding
- `batchIndexDocuments(documents, sourceType, options)` - Batch indexing
- `generateEmbedding(text, config)` - Private: Generate embeddings via provider
- `generateOpenAIEmbedding(text, config)` - Private: OpenAI-specific implementation

**Constructor Pattern:**

```typescript
@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(
    @InjectRepository(VectorEmbedding)
    private readonly embeddingRepo: Repository<VectorEmbedding>,
    private readonly vectorConfigService: VectorSearchConfigService,
  ) {}
}
```

**Usage Pattern:**

```typescript
const config = options.organizationId
  ? await this.vectorConfigService.getOrCreateConfig(options.organizationId)
  : await this.vectorConfigService.getDefaultConfig();
```

#### 2. VectorSearchConfigService

**Location**: `apps/server/src/modules/vector-search/services/vector-search-config.service.ts`

**Key Methods:**
- `getConfig(organizationId)` - Get organization-specific configuration
- `getDefaultConfig()` - Get default configuration
- `validateConfig(config)` - Validate configuration parameters
- `getOrCreateConfig(organizationId)` - Get or create default configuration

#### 3. VectorSearchConfig Entity

**Location**: `apps/server/src/modules/vector-search/entities/vector-search-config.entity.ts`

**Structure:**

```typescript
@Entity('vector_search_configs')
@Index(['organizationId'])
export class VectorSearchConfig extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'display_name', length: 255 })
  displayName: string;

  @Column({ name: 'provider', length: 50, default: 'openai' })
  provider: string;

  @Column({ name: 'embedding_model', length: 100, default: 'text-embedding-3-small' })
  embeddingModel: string;

  @Column({ name: 'dimensions', type: 'integer', default: 1536 })
  dimensions: number;

  @Column({ type: 'jsonb', default: {} })
  config: {
    apiKey?: string;
    apiEndpoint?: string;
    maxTokens?: number;
    batchSize?: number;
    [key: string]: unknown;
  };

  @Column({ name: 'search_config', type: 'jsonb', default: {} })
  searchConfig: {
    similarityThreshold?: number;
    defaultLimit?: number;
    maxLimit?: number;
    distanceMetric?: 'cosine' | 'l2' | 'inner_product';
    [key: string]: unknown;
  };

  @Column({ name: 'cost_per_1k_tokens_cents', type: 'decimal', precision: 10, scale: 6, default: 0.00002 })
  costPer1kTokensCents: number;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'timeout_seconds', default: 30 })
  timeoutSeconds: number;

  @Column({ name: 'max_retries', default: 3 })
  maxRetries: number;

  @Column({ name: 'rate_limit_config', type: 'jsonb', nullable: true })
  rateLimitConfig?: {
    maxRequestsPerMinute?: number;
    maxTokensPerMinute?: number;
    [key: string]: unknown;
  };
}
```

**Key Features:**
- Extends `BaseEntity` (provides id, createdAt, updatedAt)
- Organization-scoped configuration
- JSONB fields for flexible configuration storage
- Default values for all critical fields
- Indexed on organizationId for performance

#### 4. VectorEmbedding Entity

**Location**: `apps/server/src/entities/vector-embedding.entity.ts`

**Structure:**

```typescript
@Entity('vector_embeddings')
@Index(['organizationId'])
@Index(['sourceType', 'sourceId'])
@Index(['modelType', 'dimensions'])
@Index(['projectId'])
@Index(['teamId'])
@Index(['hollonId'])
@Index(['tags'], { unique: false })
export class VectorEmbedding extends BaseEntity {
  @Column({ type: 'text', nullable: false })
  embedding: string;  // Stored as text, actual vector type set in migration

  @Column({ name: 'source_type', type: 'enum', enum: EmbeddingSourceType })
  sourceType: EmbeddingSourceType;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  @Column({ name: 'model_type', type: 'enum', enum: EmbeddingModelType, default: EmbeddingModelType.OPENAI_ADA_002 })
  modelType: EmbeddingModelType;

  @Column({ type: 'integer' })
  dimensions: number;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: { /* ... */ } | null;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[] | null;

  // Multi-tenancy fields
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ name: 'hollon_id', type: 'uuid', nullable: true })
  hollonId: string | null;

  // Relations with CASCADE delete
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // ... other relations
}
```

**Key Features:**
- Polymorphic reference pattern (sourceType + sourceId)
- Multi-tenancy support (organization, project, team, hollon)
- Comprehensive indexing strategy
- CASCADE delete for data consistency
- JSONB metadata for flexibility
- Array field for tags

**Enums:**

```typescript
export enum EmbeddingSourceType {
  DOCUMENT = 'document',
  TASK = 'task',
  MESSAGE = 'message',
  KNOWLEDGE_ITEM = 'knowledge_item',
  CODE_SNIPPET = 'code_snippet',
  DECISION_LOG = 'decision_log',
  MEETING_RECORD = 'meeting_record',
  GRAPH_NODE = 'graph_node',
  CUSTOM = 'custom',
}

export enum EmbeddingModelType {
  OPENAI_ADA_002 = 'openai_ada_002',     // 1536 dimensions
  OPENAI_SMALL_3 = 'openai_small_3',     // 1536 dimensions
  OPENAI_LARGE_3 = 'openai_large_3',     // 3072 dimensions
  COHERE_ENGLISH_V3 = 'cohere_english_v3', // 1024 dimensions
  CUSTOM = 'custom',
}
```

### BaseEntity Pattern

**Location**: `apps/server/src/common/entities/base.entity.ts`

All entities extend this base class:

```typescript
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

**Convention**: All entities inherit id, createdAt, and updatedAt fields.

---

## Environment Variables

### Vector Search Configuration Variables

From `.env.example`:

```bash
# ===========================================
# Vector Search Configuration
# ===========================================
# Enable/disable vector search functionality
VECTOR_SEARCH_ENABLED=true

# Embedding provider configuration
VECTOR_EMBEDDING_PROVIDER=openai
VECTOR_EMBEDDING_MODEL=text-embedding-3-small
VECTOR_EMBEDDING_DIMENSIONS=1536
VECTOR_EMBEDDING_API_KEY=  # Optional: uses OPENAI_API_KEY by default for OpenAI provider
VECTOR_EMBEDDING_BATCH_SIZE=100
VECTOR_EMBEDDING_MAX_RETRIES=3
VECTOR_EMBEDDING_TIMEOUT_MS=30000

# Search configuration
VECTOR_SEARCH_DEFAULT_METRIC=cosine
VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY=0.7
VECTOR_SEARCH_DEFAULT_LIMIT=10
VECTOR_SEARCH_MAX_LIMIT=100
VECTOR_SEARCH_INCLUDE_SCORES_BY_DEFAULT=true

# Index configuration
VECTOR_INDEX_NAME=vector_embeddings
VECTOR_INDEX_AUTO_CREATE=true
VECTOR_INDEX_LISTS=100
VECTOR_INDEX_PROBES=10

# Performance configuration
VECTOR_PERFORMANCE_ENABLE_CACHE=true
VECTOR_PERFORMANCE_CACHE_TTL_SECONDS=3600
VECTOR_PERFORMANCE_POOL_SIZE=10
```

### Configuration Object Structure

From `configuration.ts`:

```typescript
vectorSearch: {
  enabled: process.env.VECTOR_SEARCH_ENABLED === 'true' || (!isTest && !isProd),
  embedding: {
    provider: process.env.VECTOR_EMBEDDING_PROVIDER || 'openai',
    model: process.env.VECTOR_EMBEDDING_MODEL,
    dimensions: process.env.VECTOR_EMBEDDING_DIMENSIONS
      ? parseInt(process.env.VECTOR_EMBEDDING_DIMENSIONS, 10)
      : undefined,
    apiKey: process.env.VECTOR_EMBEDDING_API_KEY,
    batchSize: process.env.VECTOR_EMBEDDING_BATCH_SIZE
      ? parseInt(process.env.VECTOR_EMBEDDING_BATCH_SIZE, 10)
      : undefined,
    maxRetries: process.env.VECTOR_EMBEDDING_MAX_RETRIES
      ? parseInt(process.env.VECTOR_EMBEDDING_MAX_RETRIES, 10)
      : undefined,
    timeoutMs: process.env.VECTOR_EMBEDDING_TIMEOUT_MS
      ? parseInt(process.env.VECTOR_EMBEDDING_TIMEOUT_MS, 10)
      : undefined,
  },
  search: {
    defaultMetric: process.env.VECTOR_SEARCH_DEFAULT_METRIC,
    defaultMinSimilarity: process.env.VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY
      ? parseFloat(process.env.VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY)
      : undefined,
    defaultLimit: process.env.VECTOR_SEARCH_DEFAULT_LIMIT
      ? parseInt(process.env.VECTOR_SEARCH_DEFAULT_LIMIT, 10)
      : undefined,
    maxLimit: process.env.VECTOR_SEARCH_MAX_LIMIT
      ? parseInt(process.env.VECTOR_SEARCH_MAX_LIMIT, 10)
      : undefined,
    includeScoresByDefault:
      process.env.VECTOR_SEARCH_INCLUDE_SCORES_BY_DEFAULT === 'true',
  },
  index: {
    name: process.env.VECTOR_INDEX_NAME,
    autoCreate: process.env.VECTOR_INDEX_AUTO_CREATE === 'true',
    lists: process.env.VECTOR_INDEX_LISTS
      ? parseInt(process.env.VECTOR_INDEX_LISTS, 10)
      : undefined,
    probes: process.env.VECTOR_INDEX_PROBES
      ? parseInt(process.env.VECTOR_INDEX_PROBES, 10)
      : undefined,
  },
  performance: {
    enableCache: process.env.VECTOR_PERFORMANCE_ENABLE_CACHE === 'true',
    cacheTtlSeconds: process.env.VECTOR_PERFORMANCE_CACHE_TTL_SECONDS
      ? parseInt(process.env.VECTOR_PERFORMANCE_CACHE_TTL_SECONDS, 10)
      : undefined,
    poolSize: process.env.VECTOR_PERFORMANCE_POOL_SIZE
      ? parseInt(process.env.VECTOR_PERFORMANCE_POOL_SIZE, 10)
      : undefined,
  },
}
```

### Environment Variable Naming Conventions

**Pattern**: `{CATEGORY}_{SUBCATEGORY}_{PARAMETER}`

Examples:
- `VECTOR_SEARCH_ENABLED` - Top-level feature flag
- `VECTOR_EMBEDDING_PROVIDER` - Embedding subcategory
- `VECTOR_SEARCH_DEFAULT_LIMIT` - Search subcategory
- `VECTOR_PERFORMANCE_ENABLE_CACHE` - Performance subcategory

### Configuration Hierarchy

1. **Environment Variables** (`.env.local` or `.env`) - Highest priority
2. **Configuration Factory Defaults** (`configuration.ts`) - Second priority
3. **Database Configuration** (per-organization) - Runtime overrides
4. **Service Defaults** (hardcoded in config services) - Fallback defaults

---

## Integration Patterns

### Pattern 1: Module Dependency Import

**Example**: PromptComposerModule using VectorSearchModule

**Location**: `apps/server/src/modules/prompt-composer/prompt-composer.module.ts`

```typescript
@Module({
  imports: [
    KnowledgeExtractionModule,
    VectorSearchModule,  // Import the module
    KnowledgeGraphModule,
  ],
  controllers: [PromptComposerController],
  providers: [PromptComposerService],
  exports: [PromptComposerService],
})
export class PromptComposerModule {}
```

Then in the service:

```typescript
@Injectable()
export class PromptComposerService {
  constructor(
    private readonly vectorSearchService: VectorSearchService,  // Inject the exported service
    // ... other services
  ) {}
}
```

### Pattern 2: TypeOrmModule.forFeature Usage

Every module that uses entities must register them:

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Entity1, Entity2, Entity3]),
    // ... other imports
  ],
  // ...
})
```

**Examples**:
- `VectorSearchModule`: `TypeOrmModule.forFeature([VectorSearchConfig, VectorEmbedding])`
- `KnowledgeGraphModule`: `TypeOrmModule.forFeature([Node, Edge])`
- `BrainProviderModule`: `TypeOrmModule.forFeature([BrainProviderConfig, CostRecord])`

### Pattern 3: Service Export and Import

**Export Pattern:**

```typescript
@Module({
  // ...
  providers: [MyService, MyConfigService],
  exports: [MyService, MyConfigService],  // Make available to other modules
})
export class MyModule {}
```

**Import and Inject Pattern:**

```typescript
@Module({
  imports: [MyModule],  // Import the module
  // ...
})
export class ConsumerModule {}

@Injectable()
export class ConsumerService {
  constructor(
    private readonly myService: MyService,  // Inject the exported service
  ) {}
}
```

### Pattern 4: Multi-tenant Configuration

All major services follow this pattern:

```typescript
// Organization-specific configuration
const config = await this.configService.getOrCreateConfig(organizationId);

// Use configuration for operations
const result = await this.performOperation(data, config);
```

**Key Points:**
- Organization ID is required for all operations
- Configuration is retrieved or created on-demand
- Configuration validation happens at retrieval time
- Fallback to defaults from environment variables

### Pattern 5: Module Documentation

All modules include comprehensive JSDoc comments describing:

1. **Module Purpose** - What the module does
2. **Features** - Key capabilities
3. **Responsibilities** - Core responsibilities
4. **Services** - Services provided with descriptions
5. **Entities** - Entities managed
6. **Integration** - Which modules use this module

**Example from VectorSearchModule**:

```typescript
/**
 * VectorSearchModule
 *
 * This module provides vector-based semantic search capabilities...
 *
 * Features:
 * - Semantic search using pgvector
 * - Embedding generation via OpenAI or other providers
 * ...
 *
 * Used by modules such as:
 * - PromptComposerModule: For retrieving semantically relevant context
 * - KnowledgeExtractionModule: For finding related knowledge entries
 */
```

---

## Best Practices and Conventions

### Naming Conventions

#### Files
- Module: `{feature}.module.ts`
- Service: `{feature}.service.ts`
- Controller: `{feature}.controller.ts`
- Entity: `{entity-name}.entity.ts`
- DTO: `{operation}-{entity}.dto.ts`
- Test: `{file}.spec.ts`

#### Database
- Tables: `snake_case` (e.g., `vector_search_configs`, `vector_embeddings`)
- Columns: `snake_case` (e.g., `organization_id`, `created_at`)
- TypeScript properties: `camelCase` (e.g., `organizationId`, `createdAt`)

#### Classes and Services
- Services: `{Feature}Service` (e.g., `VectorSearchService`)
- Config Services: `{Feature}ConfigService` (e.g., `VectorSearchConfigService`)
- Controllers: `{Feature}Controller`
- Modules: `{Feature}Module`

### Entity Patterns

#### Base Entity Extension

```typescript
@Entity('table_name')
@Index(['frequently_queried_field'])
export class MyEntity extends BaseEntity {
  // Custom fields
}
```

#### Column Decorators

```typescript
// UUID foreign key
@Column({ name: 'organization_id', type: 'uuid' })
organizationId: string;

// String with length
@Column({ name: 'display_name', length: 255 })
displayName: string;

// Integer with default
@Column({ name: 'timeout_seconds', default: 30 })
timeoutSeconds: number;

// JSONB for flexible data
@Column({ type: 'jsonb', nullable: true })
metadata: Record<string, unknown> | null;

// Array field
@Column({ type: 'text', array: true, nullable: true })
tags: string[] | null;

// Enum field
@Column({ name: 'source_type', type: 'enum', enum: MyEnum })
sourceType: MyEnum;
```

#### Relations

```typescript
// Cascade delete - child is deleted when parent is deleted
@ManyToOne(() => Organization, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'organization_id' })
organization: Organization;

// Set null - reference is cleared when parent is deleted
@ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
@JoinColumn({ name: 'hollon_id' })
hollon: Hollon | null;
```

### Service Patterns

#### Constructor Injection

```typescript
@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  constructor(
    @InjectRepository(MyEntity)
    private readonly myRepo: Repository<MyEntity>,
    private readonly configService: ConfigService,
    private readonly otherService: OtherService,
  ) {}
}
```

#### Error Handling

```typescript
// Use NestJS exceptions
throw new NotFoundException('Resource not found');
throw new BadRequestException('Invalid parameters');
throw new UnauthorizedException('Not authorized');
```

#### Validation

```typescript
async validateConfig(config: MyConfig): Promise<void> {
  if (config.value < 0 || config.value > 100) {
    throw new BadRequestException('Value must be between 0 and 100');
  }

  if (!config.requiredField) {
    throw new BadRequestException('Required field is missing');
  }
}
```

### Module Structure Best Practices

1. **Organize imports logically**: Configuration → Database → Infrastructure → Features
2. **Use descriptive comments**: Document each import group
3. **Export services needed by other modules**: Only export public API
4. **Import ConfigModule explicitly if needed**: Even though it's global
5. **Register all entities with TypeOrmModule.forFeature()**: In the module that owns them
6. **Follow the single responsibility principle**: Each module should have one clear purpose

### Configuration Best Practices

1. **Use type-safe configuration access**: `configService.get<Type>('key', defaultValue)`
2. **Provide sensible defaults**: Always have fallback values
3. **Environment-aware configuration**: Different defaults for test/dev/prod
4. **Validate configuration at startup**: Use validation schemas or services
5. **Centralize configuration**: Single configuration factory function
6. **Document environment variables**: Maintain comprehensive .env.example

### Testing Considerations

From the patterns observed:

1. **Test mode handling**: Configuration adapts to NODE_ENV='test'
2. **Test database isolation**: Uses worker-specific schemas for parallel tests
3. **Mock API keys**: Test mode uses placeholder keys to avoid real API calls
4. **Migration-based schema**: Tests run migrations automatically (migrationsRun: isTest)

---

## Summary

### Key Takeaways

1. **Configuration is centralized and hierarchical**:
   - Global ConfigModule with factory function
   - Per-organization database configuration
   - Environment variable overrides

2. **Module registration follows a consistent pattern**:
   - Import dependencies
   - Register entities with TypeOrmModule.forFeature()
   - Declare providers and controllers
   - Export services for other modules

3. **VectorSearchModule demonstrates best practices**:
   - Comprehensive documentation
   - Configuration service pattern
   - Multi-tenant support
   - Type-safe entities and enums
   - Service-based architecture

4. **Integration is straightforward**:
   - Import module → Inject exported services
   - Clear dependency chain
   - Documented integration points

5. **Conventions are consistently applied**:
   - Naming patterns
   - File organization
   - Database schema design
   - Error handling

### Next Steps for Implementation

When implementing a similar module:

1. Create module structure (module, service, entities)
2. Define entities extending BaseEntity
3. Create configuration service if needed
4. Add environment variables to configuration.ts
5. Register entities with TypeOrmModule.forFeature()
6. Export services needed by other modules
7. Add comprehensive documentation
8. Create tests following the established patterns

---

## File Locations Reference

### Configuration
- `apps/server/src/config/configuration.ts` - Configuration factory
- `apps/server/src/config/database.config.ts` - Database configuration
- `.env.example` - Environment variable documentation

### VectorSearch Module
- `apps/server/src/modules/vector-search/vector-search.module.ts` - Module definition
- `apps/server/src/modules/vector-search/vector-search.service.ts` - Core service
- `apps/server/src/modules/vector-search/services/vector-search-config.service.ts` - Configuration service
- `apps/server/src/modules/vector-search/entities/vector-search-config.entity.ts` - Configuration entity
- `apps/server/src/entities/vector-embedding.entity.ts` - Embedding entity

### Base Classes
- `apps/server/src/common/entities/base.entity.ts` - Base entity class

### App Module
- `apps/server/src/app.module.ts` - Root module with all imports

### Example Modules
- `apps/server/src/modules/knowledge-graph/knowledge-graph.module.ts` - Simple module example
- `apps/server/src/modules/prompt-composer/prompt-composer.module.ts` - Module with dependencies
- `apps/server/src/modules/brain-provider/brain-provider.module.ts` - Module with configuration service
- `apps/server/src/modules/postgres-listener/postgres-listener.service.ts` - Direct ConfigService usage

---

**End of Analysis Document**
