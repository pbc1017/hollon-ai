# Configuration Patterns and Module Structure

## Overview

This document outlines the configuration patterns, module registration approaches, and architectural patterns used in the Hollon-AI NestJS application. It serves as a reference guide for maintaining consistency when adding new modules or services.

---

## Table of Contents

1. [Configuration Architecture](#configuration-architecture)
2. [Module Registration Patterns](#module-registration-patterns)
3. [Database Configuration](#database-configuration)
4. [Environment-Specific Settings](#environment-specific-settings)
5. [ConfigService Usage Patterns](#configservice-usage-patterns)
6. [Best Practices](#best-practices)

---

## Configuration Architecture

### Configuration Files Structure

The application uses a centralized configuration approach with three main files:

```
apps/server/src/config/
├── configuration.ts        # Main configuration factory
├── database.config.ts      # Database-specific configuration
└── typeorm.config.ts       # TypeORM CLI configuration
```

### Main Configuration (`configuration.ts`)

Location: `apps/server/src/config/configuration.ts`

The main configuration file exports a factory function that returns a structured configuration object. It:

- **Detects environment** (`NODE_ENV`) to determine runtime context (test, production, development)
- **Provides typed configuration sections** organized by domain:
  - `server`: Port and host settings
  - `database`: Database connection parameters
  - `brain`: Brain provider settings (Claude Code, API keys)
  - `cost`: Cost tracking and limits
  - `logging`: Log level and format
  - `security`: JWT and encryption keys
  - `cors`: CORS configuration

**Key Features:**

1. **Environment-aware defaults**: Different defaults for test, production, and development
2. **Type-safe access**: Integer parsing for numeric values
3. **Test mode handling**: Special handling for test environments (mock API keys, isolated schemas)
4. **Worker isolation**: Automatic schema suffixing for Jest parallel workers

**Example:**

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
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      name: process.env.DB_NAME || 'hollon',
      user: process.env.DB_USER || 'hollon',
      password: process.env.DB_PASSWORD || '',
      schema: /* ... dynamic schema logic ... */,
    },
    // ... other sections
  };
};
```

---

## Module Registration Patterns

### Root Module (`app.module.ts`)

Location: `apps/server/src/app.module.ts`

The application uses a structured approach to module registration:

#### 1. Global Configuration Module

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  load: [configuration],
  envFilePath: ['../../.env.local', '../../.env'],
})
```

**Key points:**
- `isGlobal: true` - Makes ConfigService available to all modules without re-importing
- `load: [configuration]` - Loads the configuration factory
- `envFilePath` - Specifies environment file locations (monorepo root)

#### 2. Async Database Configuration

```typescript
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => databaseConfig(configService),
  inject: [ConfigService],
})
```

**Pattern: `forRootAsync` with factory function**
- Allows dependency injection of ConfigService
- Defers configuration until runtime
- Enables dynamic configuration based on environment

#### 3. Conditional Module Loading

```typescript
...(process.env.DISABLE_SCHEDULER !== 'true'
  ? [ScheduleModule.forRoot()]
  : [])
```

**Pattern: Spread operator with conditional array**
- Allows runtime toggling of modules
- Useful for testing or feature flags

#### 4. Module Organization

Modules are organized into three categories:

```typescript
@Module({
  imports: [
    // 1. Configuration
    ConfigModule.forRoot({ /* ... */ }),

    // 2. Infrastructure modules (Global)
    TypeOrmModule.forRootAsync({ /* ... */ }),
    ScheduleModule.forRoot(),
    PostgresListenerModule,

    // 3. Feature modules
    HealthModule,
    OrganizationModule,
    // ... other feature modules

    // 4. DDD Pattern modules
    DddProvidersModule,

    // 5. Domain-specific modules
    KnowledgeGraphModule,
    PromptComposerModule,
    KnowledgeExtractionModule,
  ],
})
```

### Feature Module Patterns

#### Simple Feature Module

**Example:** `KnowledgeGraphModule`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Node, Edge]),
  ],
  controllers: [KnowledgeGraphController],
  providers: [KnowledgeGraphService],
  exports: [KnowledgeGraphService],
})
export class KnowledgeGraphModule {}
```

**Pattern characteristics:**
- Imports entities via `TypeOrmModule.forFeature()`
- Declares controllers and providers
- Exports services needed by other modules
- No ConfigModule import needed (global)

#### Module with Dependencies

**Example:** `PromptComposerModule`

```typescript
@Module({
  imports: [
    KnowledgeExtractionModule,
    VectorSearchModule,
    KnowledgeGraphModule,
  ],
  controllers: [PromptComposerController],
  providers: [PromptComposerService],
  exports: [PromptComposerService],
})
export class PromptComposerModule {}
```

**Pattern characteristics:**
- Imports other feature modules for service dependencies
- Clear dependency hierarchy
- Service exports enable cross-module communication

#### Global Module Pattern

**Example:** `PostgresListenerModule`

```typescript
@Global()
@Module({
  providers: [PostgresListenerService],
  exports: [PostgresListenerService],
})
export class PostgresListenerModule {}
```

**When to use `@Global()`:**
- Infrastructure services needed everywhere
- Event buses or message brokers
- Shared utilities that shouldn't be re-imported

#### DDD Provider Pattern

**Example:** `DddProvidersModule`

```typescript
@Global()
@Module({
  imports: [HollonModule, CollaborationModule, MessageModule],
  providers: [
    {
      provide: 'IHollonService',
      useExisting: HollonService,
    },
    {
      provide: 'ICodeReviewService',
      useExisting: CodeReviewService,
    },
  ],
  exports: ['IHollonService', 'ICodeReviewService'],
})
export class DddProvidersModule {}
```

**Pattern characteristics:**
- Uses string tokens for interface-based injection
- Imports concrete implementation modules
- Re-exports as abstraction tokens
- Enables dependency inversion principle

---

## Database Configuration

### Database Configuration Factory

Location: `apps/server/src/config/database.config.ts`

The database configuration uses a factory function that receives ConfigService:

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

    synchronize: false,           // Always use migrations
    migrationsRun: isTest,        // Auto-run in tests
    dropSchema: false,            // Preserve data
    logging: !isProduction && !isTest,
    ssl: isProduction ? { rejectUnauthorized: false } : false,

    extra: {
      options: `-c search_path=${schema},public`,
    },
  };
};
```

**Key decisions:**

1. **Never use `synchronize: true` in production** - Always use migrations
2. **Auto-run migrations in tests** - Ensures test schema is current
3. **Schema isolation** - Uses PostgreSQL schemas for multi-tenancy
4. **Search path configuration** - Sets default schema via `extra.options`

### TypeORM CLI Configuration

Location: `apps/server/src/config/typeorm.config.ts`

Separate configuration for TypeORM CLI (migrations, schema operations):

```typescript
export default new DataSource({
  type: 'postgres',
  // ... connection settings from env vars
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
  synchronize: false,
});
```

**Usage:**
- Migration generation: `npm run migration:generate`
- Migration execution: `npm run migration:run`

### Entity Pattern

**Example:** `Node` entity from Knowledge Graph

```typescript
@Entity('knowledge_graph_nodes')
@Index(['type'])
@Index(['organizationId'])
@Index(['createdAt'])
export class Node extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: NodeType,
    default: NodeType.CUSTOM,
  })
  type: NodeType;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ type: 'jsonb', default: {} })
  properties: Record<string, any>;

  @OneToMany(() => Edge, (edge) => edge.sourceNode)
  outgoingEdges: Edge[];
}
```

**Conventions:**
- Extend `BaseEntity` for common fields (id, createdAt, updatedAt)
- Use explicit table names: `@Entity('table_name')`
- Add indexes for frequently queried fields
- Use snake_case for database column names: `@Column({ name: 'organization_id' })`
- Use TypeScript types for type safety

---

## Environment-Specific Settings

### Environment Variables

Location: `.env.example` (template), `.env.local` / `.env` (runtime)

#### Environment Detection

The application determines its environment via `NODE_ENV`:
- `test` - Testing environment (Jest)
- `production` - Production deployment
- `development` - Default development environment

#### Configuration Sections

**1. Database Configuration**

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hollon
DB_USER=hollon
DB_PASSWORD=your_secure_password_here
DB_SCHEMA=hollon  # Optional, defaults to 'hollon'
```

**2. Server Configuration**

```bash
SERVER_PORT=3001
SERVER_HOST=0.0.0.0
```

**3. Brain Provider Configuration**

```bash
CLAUDE_CODE_PATH=claude
BRAIN_TIMEOUT_MS=300000
ANTHROPIC_API_KEY=your_key
OPENAI_API_KEY=your_key
```

**4. Cost Tracking**

```bash
DEFAULT_DAILY_COST_LIMIT_CENTS=10000
DEFAULT_MONTHLY_COST_LIMIT_CENTS=100000
COST_ALERT_THRESHOLD_PERCENT=80
```

**5. Logging**

```bash
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

**6. Security**

```bash
JWT_SECRET=your_secret
ENCRYPTION_KEY=your_32_byte_hex_key
```

#### Environment-Specific Behavior

**Test Environment:**
- Uses mock API keys: `test-key-not-used`
- Auto-runs migrations: `migrationsRun: true`
- Uses isolated schemas: `hollon_test_worker_1`, `hollon_test_worker_2`, etc.
- Error-level logging only: `level: 'error'`
- Disables TypeORM logging

**Production Environment:**
- Requires real API keys
- Enables SSL for database: `ssl: { rejectUnauthorized: false }`
- Info-level logging: `level: 'info'`
- No TypeORM query logging

**Development Environment:**
- Uses environment variables or defaults
- Debug-level logging: `level: 'debug'`
- Enables TypeORM query logging
- No SSL for database

---

## ConfigService Usage Patterns

### Accessing Configuration in Services

Since `ConfigModule` is registered as global, ConfigService is available in any service via dependency injection:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MyService {
  constructor(private readonly configService: ConfigService) {}

  someMethod() {
    // Dot notation for nested values
    const port = this.configService.get<number>('server.port', 3001);
    const dbHost = this.configService.get<string>('database.host');

    // Direct environment variable access
    const dbHost2 = this.configService.get<string>('DB_HOST');
  }
}
```

**Best practices:**

1. **Use typed access**: Always specify the type parameter: `get<number>('key')`
2. **Provide defaults**: Use the second parameter for fallback values
3. **Use dot notation**: Access nested config via dot notation: `'database.host'`
4. **Direct env vars**: Can also access raw env vars: `'DB_HOST'`

### Example: PostgresListenerService

Location: `apps/server/src/modules/postgres-listener/postgres-listener.service.ts:22`

```typescript
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
```

### Example: Main Bootstrap

Location: `apps/server/src/main.ts:12-14`

```typescript
const configService = app.get(ConfigService);
const port = configService.get<number>('server.port', 3001);
const host = configService.get<string>('server.host', '0.0.0.0');

app.enableCors({
  origin: configService.get<string>('cors.origin', '*'),
  credentials: true,
});
```

---

## Best Practices

### Configuration

1. **Centralize configuration** - Use `configuration.ts` for all app config
2. **Type-safe access** - Always use `get<Type>()` with type parameter
3. **Provide defaults** - Use second parameter: `get('key', defaultValue)`
4. **Environment detection** - Check `nodeEnv` for environment-specific logic
5. **Never commit secrets** - Use `.env.local` (gitignored) for secrets

### Module Registration

1. **Use `@Global()` sparingly** - Only for true infrastructure services
2. **Export what's needed** - Only export services other modules need
3. **Import entities locally** - Use `TypeOrmModule.forFeature([Entity])` in each module
4. **Organize imports logically** - Group by configuration, infrastructure, features
5. **Document module purpose** - Add JSDoc comments explaining module responsibilities

### Database

1. **Never use `synchronize: true`** - Always use migrations
2. **Use schema isolation** - Leverage PostgreSQL schemas for multi-tenancy
3. **Index strategically** - Add `@Index()` for frequently queried fields
4. **Extend BaseEntity** - Reuse common fields (id, timestamps)
5. **Use migrations** - Generate and run migrations for schema changes

### Testing

1. **Isolate test databases** - Use worker-specific schemas in tests
2. **Auto-run migrations** - Set `migrationsRun: true` in test environment
3. **Mock external APIs** - Use test keys for external services
4. **Clean up after tests** - Use `dropSchema` judiciously or clean between tests

### Module Dependencies

1. **Avoid circular dependencies** - Use DDD Providers pattern for decoupling
2. **Inject interfaces, not implementations** - Use string tokens for abstractions
3. **Keep feature modules independent** - Minimize cross-feature dependencies
4. **Use events for decoupling** - Consider event-driven architecture for loose coupling

---

## Summary

The Hollon-AI application follows a well-structured configuration and module architecture:

- **Centralized configuration** via factory function in `configuration.ts`
- **Global ConfigService** accessible without re-importing ConfigModule
- **Async database configuration** using factory pattern with dependency injection
- **Environment-aware defaults** for test, production, and development
- **Clean module boundaries** with explicit imports/exports
- **DDD patterns** for dependency inversion and interface-based injection
- **Migration-based schema management** avoiding synchronize
- **Schema isolation** for test parallelization and multi-tenancy

When adding new modules or configuration, follow these established patterns to maintain consistency and architectural integrity.
