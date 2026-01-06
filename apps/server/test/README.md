# Testing Guide

This directory contains the E2E (End-to-End) test suite for the Hollon-AI server application.

## Table of Contents

- [Overview](#overview)
- [Test Organization](#test-organization)
- [Running Tests](#running-tests)
- [Test Infrastructure](#test-infrastructure)
- [Writing New Tests](#writing-new-tests)
- [Troubleshooting](#troubleshooting)

## Overview

The Hollon-AI testing strategy follows NestJS best practices:

- **Unit Tests**: Co-located with source files (`.spec.ts` next to `.ts`)
- **E2E Tests**: Located in this `test/` directory (`.e2e-spec.ts`)

### Test Database Isolation

E2E tests use **PostgreSQL schema-based isolation**:

- Tests run in separate schema: `hollon_test_worker_1`
- Development data remains untouched in `hollon` schema
- Supports parallel test execution with multiple Jest workers
- Each worker gets its own schema: `hollon_test_worker_N`

## Test Organization

```
test/
├── jest-e2e.json              # Jest E2E configuration
├── setup/                     # Test infrastructure
│   ├── test-database.ts       # Database utilities
│   ├── jest-e2e-setup.ts      # Global test setup
│   └── README.md              # Setup documentation
├── fixtures/                  # Test data factories
│   ├── organization.factory.ts
│   └── team.factory.ts
├── orchestration/             # Orchestration E2E tests
│   └── orchestration.e2e-spec.ts
└── README.md                  # This file
```

## Running Tests

### Prerequisites

1. **Database must be running**:

   ```bash
   docker compose up -d
   ```

2. **Test schema must exist** (automatically created by Docker init script):

   ```bash
   # Verify schema exists
   docker exec -i hollon-postgres psql -U hollon -d hollon -c "\\dn"
   ```

3. **Run migrations on test schema**:
   ```bash
   DB_SCHEMA=hollon_test pnpm --filter=@hollon-ai/server db:migrate
   ```

### Run E2E Tests

```bash
# Run all E2E tests (REAL LLM calls, costs ~$0.50)
pnpm --filter=@hollon-ai/server test:e2e

# Run specific E2E test
pnpm --filter=@hollon-ai/server test:e2e phase3.5

# Run with watch mode
pnpm --filter=@hollon-ai/server test:e2e:watch

# Run with debug output (detect hanging tests)
pnpm --filter=@hollon-ai/server test:e2e:debug

# Run all tests (unit + E2E)
pnpm --filter=@hollon-ai/server test:all
```

**Note**: E2E tests make REAL LLM API calls for true end-to-end validation. This incurs API costs (~$0.50 per full run) and takes 3-5 minutes. For fast, free testing during development, use Integration tests instead.

### Run Unit Tests

```bash
# Run unit tests
pnpm --filter=@hollon-ai/server test

# Watch mode
pnpm --filter=@hollon-ai/server test:watch

# With coverage
pnpm --filter=@hollon-ai/server test:cov
```

## Test Infrastructure

### Database Configuration

E2E tests use the test database utilities (`test/setup/test-database.ts`):

```typescript
import { getTestDatabaseConfig } from '../setup/test-database';

TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) =>
    getTestDatabaseConfig(configService),
  inject: [ConfigService],
});
```

Key functions:

- `getTestDatabaseConfig()` - Returns TypeORM config with test schema
- `setupTestSchema()` - Creates schema and runs migrations
- `cleanDatabase()` - Truncates all tables (fast cleanup)
- `teardownTestSchema()` - Drops test schema completely
- `verifyConnection()` - Checks database connectivity

### Test Data Factories

Use factories to create test data with unique names:

```typescript
import { OrganizationFactory } from '../fixtures/organization.factory';
import { TeamFactory } from '../fixtures/team.factory';

// Create organization with factory
const org = await OrganizationFactory.createPersisted(organizationRepo, {
  description: 'Custom description',
});

// Create team for that organization
const team = await TeamFactory.createPersisted(teamRepo, org.id);
```

Factories automatically generate unique names using UUID to prevent conflicts.

### Global Setup

The `test/setup/jest-e2e-setup.ts` file runs before all tests:

- Sets `NODE_ENV=test`
- Configures test timeout (30 seconds)
- Logs worker ID and schema name

## Writing New Tests

### Creating a New E2E Test

1. **Create test file** in appropriate subdirectory:

   ```
   test/your-module/your-feature.e2e-spec.ts
   ```

2. **Import test infrastructure**:

   ```typescript
   import { Test, TestingModule } from '@nestjs/testing';
   import { ConfigModule, ConfigService } from '@nestjs/config';
   import { TypeOrmModule } from '@nestjs/typeorm';
   import { DataSource } from 'typeorm';
   import configuration from '../../src/config/configuration';
   import { getTestDatabaseConfig } from '../setup/test-database';
   ```

3. **Set up test module** with test database:

   ```typescript
   beforeAll(async () => {
     const module: TestingModule = await Test.createTestingModule({
       imports: [
         ConfigModule.forRoot({
           isGlobal: true,
           load: [configuration],
         }),
         TypeOrmModule.forRootAsync({
           imports: [ConfigModule],
           useFactory: (configService: ConfigService) =>
             getTestDatabaseConfig(configService),
           inject: [ConfigService],
         }),
         TypeOrmModule.forFeature([
           /* your entities */
         ]),
       ],
       providers: [
         /* your services */
       ],
     }).compile();
   });
   ```

4. **Use factories for test data**:

   ```typescript
   const org = await OrganizationFactory.createPersisted(organizationRepo);
   const team = await TeamFactory.createPersisted(teamRepo, org.id);
   ```

5. **Clean up after tests**:
   ```typescript
   afterAll(async () => {
     // Delete test data in correct order (children first)
     await teamRepo.delete(team.id);
     await organizationRepo.delete(org.id);
     await module.close();
   });
   ```

### Best Practices

1. **Test Isolation**: Each test should be independent
2. **Unique Names**: Use factories to avoid name conflicts
3. **Cleanup Order**: Delete children before parents (FK constraints)
4. **Mock External APIs**: Mock services like `BrainProviderService`
5. **Test Real Database**: E2E tests should use real PostgreSQL
6. **Descriptive Names**: Use clear, descriptive test and describe block names

### Example Test Structure

```typescript
describe('Feature E2E', () => {
  let module: TestingModule;
  let service: YourService;
  let repo: Repository<YourEntity>;
  let testData: YourEntity;

  beforeAll(async () => {
    // Set up test module
  });

  afterAll(async () => {
    // Clean up test data
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Main Workflow', () => {
    it('should perform the main workflow successfully', async () => {
      // Arrange: Create test data
      testData = await Factory.createPersisted(repo);

      // Act: Execute the feature
      const result = await service.someMethod(testData.id);

      // Assert: Verify results
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });
});
```

## Troubleshooting

### Common Issues

#### 1. "column 'type' does not exist"

**Cause**: Database schema out of sync with entities

**Solution**:

```bash
DB_SCHEMA=hollon_test pnpm --filter=@hollon-ai/server db:migrate
```

#### 2. "Jest did not exit one second after the test run has completed"

**Cause**: Unclosed database connections or async operations

**Solution**:

- Ensure `module.close()` is called in `afterAll`
- Use `--detectOpenHandles` flag to identify the issue:
  ```bash
  pnpm --filter=@hollon-ai/server test:e2e:debug
  ```

#### 3. "foreign key constraint violation"

**Cause**: Incorrect cleanup order

**Solution**: Delete entities in reverse dependency order (children before parents)

#### 4. "schema 'hollon_test_worker_1' does not exist"

**Cause**: Test schema not created or migrations not run

**Solution**:

```bash
# Create schema manually
docker exec -i hollon-postgres psql -U hollon -d hollon -c \
  "CREATE SCHEMA IF NOT EXISTS hollon_test; GRANT ALL ON SCHEMA hollon_test TO hollon;"

# Run migrations
DB_SCHEMA=hollon_test pnpm --filter=@hollon-ai/server db:migrate
```

#### 5. "Test timeout exceeded"

**Cause**: Test taking longer than 30 seconds

**Solution**:

- Optimize test (reduce data, simplify operations)
- Or increase timeout in specific test:
  ```typescript
  it('slow test', async () => {
    // ...
  }, 60000); // 60 second timeout
  ```

### Debug Tips

1. **Enable detailed logging**:

   ```bash
   LOG_LEVEL=debug pnpm --filter=@hollon-ai/server test:e2e:debug
   ```

2. **Run single test file**:

   ```bash
   pnpm --filter=@hollon-ai/server test:e2e -- orchestration
   ```

3. **Inspect test database**:
   ```bash
   docker exec -it hollon-postgres psql -U hollon -d hollon
   \c hollon
   SET search_path TO hollon_test_worker_1;
   \dt
   SELECT * FROM organizations;
   ```

## Additional Resources

- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [TypeORM Testing Guide](https://typeorm.io/testing)
- [Test Setup Documentation](./setup/README.md)
