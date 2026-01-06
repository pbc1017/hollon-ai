# Test Database Setup and Migration Testing Guide

This guide documents the test database environment setup for the Hollon-AI project, including TypeORM configuration verification, migration testing procedures, and rollback testing.

## Table of Contents

- [Overview](#overview)
- [Database Architecture](#database-architecture)
- [Environment Setup](#environment-setup)
- [TypeORM Configuration](#typeorm-configuration)
- [Test Database Infrastructure](#test-database-infrastructure)
- [Migration Testing](#migration-testing)
- [Verification Scripts](#verification-scripts)
- [Troubleshooting](#troubleshooting)

## Overview

The Hollon-AI project uses PostgreSQL with TypeORM for database management. The test environment uses schema-based isolation to enable parallel test execution while maintaining data integrity.

### Key Features

- **Schema Isolation**: Each Jest worker gets its own schema (`hollon_test_worker_1`, `hollon_test_worker_2`, etc.)
- **PostgreSQL Extensions**: pgvector, uuid-ossp, pg_trgm enabled
- **TypeORM Migrations**: Full migration support with rollback capabilities
- **Parallel Testing**: Multiple Jest workers can run tests simultaneously without conflicts
- **Clean State**: Utilities for cleaning and resetting database state between tests

## Database Architecture

### Schemas

The database uses multiple schemas for different environments:

```
hollon                    # Development schema
hollon_test               # Base test schema
hollon_test_worker_1      # Test schema for Jest worker 1
hollon_test_worker_2      # Test schema for Jest worker 2
...                       # Additional worker schemas as needed
```

### Docker Setup

PostgreSQL runs in Docker with the following configuration:

```yaml
# docker/docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - '5432:5432'
    environment:
      POSTGRES_USER: hollon
      POSTGRES_PASSWORD: hollon_dev_password
      POSTGRES_DB: hollon
```

## Environment Setup

### Prerequisites

1. **Docker Desktop** - For running PostgreSQL
2. **pnpm** - Package manager (v9.x)
3. **Node.js** - v18 or higher
4. **PostgreSQL Client Tools** (optional) - For manual database inspection

### Initial Setup

1. **Start PostgreSQL**:
   ```bash
   pnpm docker:up
   ```

2. **Create Environment File**:
   ```bash
   cp .env.example .env.local
   ```

3. **Configure Database Credentials** in `.env.local`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=hollon
   DB_USER=hollon
   DB_PASSWORD=hollon_dev_password
   DB_SCHEMA=hollon
   ```

4. **Verify Configuration**:
   ```bash
   pnpm --filter @hollon-ai/server db:verify
   ```

5. **Run Migrations**:
   ```bash
   pnpm db:migrate
   ```

### Test Environment Setup

For integration/e2e tests, the configuration automatically switches to test schemas:

```bash
# Run integration tests (auto-configures test schema)
pnpm test:integration

# Run specific test file
pnpm --filter @hollon-ai/server test:integration --testPathPattern=tasks
```

## TypeORM Configuration

### Main Configuration (`apps/server/src/config/typeorm.config.ts`)

```typescript
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'hollon',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hollon',
  schema: process.env.DB_SCHEMA || 'hollon',
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
  synchronize: false,
  extra: {
    options: `-c search_path=${schema},public`,
  },
});
```

### Test Configuration (`apps/server/test/setup/test-database.ts`)

The test configuration dynamically determines the schema based on Jest worker ID:

```typescript
const rawWorkerId = process.env.JEST_WORKER_ID || '1';
const workerId = rawWorkerId.replace(/\D/g, '') || '1';
const schemaName = `hollon_test_worker_${workerId}`;
```

## Test Database Infrastructure

### Available Utilities

Located in `apps/server/test/setup/test-database.ts`:

#### 1. `getTestDatabaseConfig(configService: ConfigService)`

Returns TypeORM configuration for test environment with automatic schema isolation.

**Usage**:
```typescript
import { getTestDatabaseConfig } from '../setup/test-database';

TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => 
    getTestDatabaseConfig(configService),
  inject: [ConfigService],
});
```

#### 2. `setupTestSchema(dataSource: DataSource)`

Creates test schema and runs all migrations.

**Usage**:
```typescript
beforeAll(async () => {
  const dataSource = module.get(DataSource);
  await setupTestSchema(dataSource);
});
```

#### 3. `cleanDatabase(dataSource: DataSource)`

Truncates all tables in the test schema (fast cleanup between tests).

**Usage**:
```typescript
afterEach(async () => {
  const dataSource = module.get(DataSource);
  await cleanDatabase(dataSource);
});
```

#### 4. `teardownTestSchema(dataSource: DataSource)`

Completely drops the test schema (full cleanup after tests).

**Usage**:
```typescript
afterAll(async () => {
  const dataSource = module.get(DataSource);
  await teardownTestSchema(dataSource);
  await module.close();
});
```

#### 5. `verifyConnection(dataSource: DataSource)`

Verifies database connection is working.

**Usage**:
```typescript
beforeAll(async () => {
  const dataSource = module.get(DataSource);
  await verifyConnection(dataSource);
});
```

## Migration Testing

### Migration Testing Utilities

Located in `apps/server/test/setup/migration-testing.ts`:

#### Available Functions

1. **`runMigrations(dataSource: DataSource)`** - Run all pending migrations
2. **`revertLastMigration(dataSource: DataSource)`** - Revert the most recent migration
3. **`revertMigrations(dataSource: DataSource, count: number)`** - Revert multiple migrations
4. **`testMigrationCycle(dataSource: DataSource)`** - Test migration up/down cycle
5. **`getPendingMigrations(dataSource: DataSource)`** - Get list of pending migrations
6. **`getExecutedMigrations(dataSource: DataSource)`** - Get list of executed migrations
7. **`verifyMigrationState(dataSource: DataSource)`** - Check migration status
8. **`resetMigrations(dataSource: DataSource)`** - Revert all migrations
9. **`verifySchemaStructure(dataSource: DataSource, expectedTables: string[])`** - Verify table structure

### Testing Migration Rollback

Here's a complete example of testing migration rollback:

```typescript
import { DataSource } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import {
  setupTestSchema,
  teardownTestSchema,
  getTestDatabaseConfig,
} from '../setup/test-database';
import {
  runMigrations,
  revertLastMigration,
  testMigrationCycle,
  getExecutedMigrations,
} from '../setup/migration-testing';

describe('Migration Rollback Testing', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    // Create test module with test database config
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: (configService: ConfigService) =>
            getTestDatabaseConfig(configService),
          inject: [ConfigService],
        }),
      ],
    }).compile();

    dataSource = module.get(DataSource);
    
    // Setup test schema with migrations
    await setupTestSchema(dataSource);
  });

  afterAll(async () => {
    // Clean up test schema
    await teardownTestSchema(dataSource);
    await dataSource.destroy();
  });

  describe('Migration Up/Down Cycle', () => {
    it('should successfully run and revert migrations', async () => {
      // Test that migrations can be applied and reverted
      const success = await testMigrationCycle(dataSource);
      expect(success).toBe(true);
    });
  });

  describe('Specific Migration Rollback', () => {
    it('should revert last migration and restore previous state', async () => {
      // Get current migration count
      const beforeMigrations = await getExecutedMigrations(dataSource);
      const initialCount = beforeMigrations.length;

      // Revert last migration
      await revertLastMigration(dataSource);

      // Verify migration was reverted
      const afterMigrations = await getExecutedMigrations(dataSource);
      expect(afterMigrations.length).toBe(initialCount - 1);

      // Re-run migration
      await runMigrations(dataSource);

      // Verify migration was re-applied
      const finalMigrations = await getExecutedMigrations(dataSource);
      expect(finalMigrations.length).toBe(initialCount);
    });
  });

  describe('Multiple Migration Rollback', () => {
    it('should revert multiple migrations in order', async () => {
      const executed = await getExecutedMigrations(dataSource);
      const initialCount = executed.length;
      const revertCount = Math.min(3, initialCount);

      // Revert multiple migrations
      await revertMigrations(dataSource, revertCount);

      // Verify migrations were reverted
      const afterRevert = await getExecutedMigrations(dataSource);
      expect(afterRevert.length).toBe(initialCount - revertCount);

      // Re-run migrations
      await runMigrations(dataSource);

      // Verify migrations were re-applied
      const afterRerun = await getExecutedMigrations(dataSource);
      expect(afterRerun.length).toBe(initialCount);
    });
  });
});
```

### Manual Migration Testing

You can also test migrations manually using the CLI:

```bash
# Run migrations on development schema
pnpm db:migrate

# Run migrations on specific test schema
DB_SCHEMA=hollon_test_worker_1 pnpm db:migrate:test

# Generate a new migration
pnpm db:migrate:generate src/database/migrations/YourMigrationName

# Manually revert last migration (careful!)
# Note: TypeORM CLI doesn't have a built-in revert command for DataSource
# Use the test utilities or psql directly
```

## Verification Scripts

### Database Configuration Verification

Run the verification script to check your database setup:

```bash
pnpm --filter @hollon-ai/server db:verify
```

This script checks:

1. ✓ Environment variables are set
2. ✓ Database connection is working
3. ✓ Required schema exists
4. ✓ PostgreSQL extensions are installed (uuid-ossp, vector, pg_trgm)
5. ✓ Migration status (pending/executed)
6. ✓ Table count in schema

**Example Output**:

```
============================================================
Database Configuration Verification
============================================================

✓ Environment Variables
  All required environment variables are set
  Details: {
    "DB_HOST": "localhost",
    "DB_PORT": "5432",
    "DB_NAME": "hollon",
    "DB_USER": "hollon",
    "DB_SCHEMA": "hollon",
    "NODE_ENV": "development"
  }

✓ Database Connection
  Database connection successful
  Details: {
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "database": "hollon",
    "schema": "hollon"
  }

✓ Schema Verification
  Schema 'hollon' exists
  
✓ PostgreSQL Extensions
  All required PostgreSQL extensions are installed
  Details: {
    "extensions": ["pg_trgm", "uuid-ossp", "vector"]
  }

✓ Migrations Status
  All migrations are up to date
  Details: {
    "total": 30,
    "executed": 30,
    "pending": 0,
    "upToDate": true
  }

✓ Database Tables
  Found 25 table(s) in schema 'hollon'

============================================================
✓ All checks passed (6/6)

Your database configuration is ready for use!
```

## Troubleshooting

### Database Connection Issues

**Problem**: "Database connection failed"

**Solutions**:
1. Ensure PostgreSQL is running: `pnpm docker:up`
2. Check credentials in `.env.local`
3. Verify port 5432 is not in use: `lsof -i :5432`
4. Check Docker logs: `docker logs hollon-postgres`

### Schema Not Found

**Problem**: "Schema 'hollon_test_worker_1' does not exist"

**Solution**:
```bash
# The schema should be auto-created, but you can create manually:
docker exec -it hollon-postgres psql -U hollon -d hollon -c "CREATE SCHEMA hollon_test_worker_1; GRANT ALL ON SCHEMA hollon_test_worker_1 TO hollon;"
```

### Migration Failures

**Problem**: "Migration failed to run"

**Solutions**:
1. Check migration syntax for errors
2. Verify schema has proper permissions
3. Check for conflicting table/column names
4. Review migration order (timestamp-based)
5. Check TypeORM logs for detailed error

### Foreign Key Constraint Violations

**Problem**: "Foreign key constraint violations during cleanup"

**Solution**:
The `cleanDatabase()` utility handles this automatically by disabling FK constraints temporarily. If you encounter this manually:

```sql
SET session_replication_role = replica;
TRUNCATE TABLE schema_name.table_name CASCADE;
SET session_replication_role = DEFAULT;
```

### Test Database Hangs

**Problem**: Tests hang or don't complete

**Solutions**:
1. Ensure `module.close()` is called in `afterAll`
2. Check for open database connections
3. Use `forceExit: true` in Jest config
4. Reduce `maxWorkers` to 1 for debugging

### Extension Not Available

**Problem**: "Extension 'vector' does not exist"

**Solution**:
```bash
# Recreate container with pgvector image
docker-compose -f docker/docker-compose.yml down -v
pnpm docker:up
```

## Best Practices

### For Test Writers

1. **Always clean up**: Use `teardownTestSchema()` in `afterAll`
2. **Isolate tests**: Each test should create its own test data
3. **Use factories**: Create reusable data factories for entities
4. **Test migrations**: Write tests for critical schema changes
5. **Verify rollback**: Ensure migrations can be safely reverted

### For Migration Authors

1. **Test locally first**: Run migration on dev database before committing
2. **Write reversible migrations**: Always implement `down()` method
3. **Handle data carefully**: Consider existing data when modifying schemas
4. **Use transactions**: TypeORM wraps migrations in transactions by default
5. **Document changes**: Add comments explaining complex migrations

### For CI/CD

1. **Use schema isolation**: Enable parallel test execution with `--maxWorkers`
2. **Clean up afterward**: Ensure test schemas are dropped after tests
3. **Set timeouts**: Configure appropriate timeouts for migration tests
4. **Monitor resources**: Watch database connection pool usage

## Additional Resources

- [TypeORM Migrations Documentation](https://typeorm.io/migrations)
- [PostgreSQL Schema Documentation](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [Jest Configuration](https://jestjs.io/docs/configuration)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)

## Quick Reference

### Common Commands

```bash
# Start database
pnpm docker:up

# Stop database
pnpm docker:down

# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Verify configuration
pnpm --filter @hollon-ai/server db:verify

# Run integration tests
pnpm test:integration

# Run tests with debugging
pnpm test:integration:debug

# Access database
docker exec -it hollon-postgres psql -U hollon -d hollon
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_NAME` | hollon | Database name |
| `DB_USER` | hollon | Database user |
| `DB_PASSWORD` | - | Database password |
| `DB_SCHEMA` | hollon | Default schema name |
| `NODE_ENV` | development | Environment (test/development/production) |
| `JEST_WORKER_ID` | 1 | Jest worker ID (auto-set) |

---

**Last Updated**: 2026-01-06  
**Maintainer**: Hollon-AI Team
