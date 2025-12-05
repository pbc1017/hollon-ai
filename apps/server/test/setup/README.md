# Test Setup Infrastructure

This directory contains the core testing infrastructure for E2E tests.

## Files

### `jest-e2e-setup.ts`
Global Jest setup that runs once before all E2E tests.

**What it does:**
- Sets `NODE_ENV=test`
- Sets `LOG_LEVEL=error` (reduces noise in test output)
- Configures Jest timeout to 30 seconds
- Logs worker ID and schema name for debugging

**When it runs:**
Automatically loaded by Jest via `setupFilesAfterEnv` in `jest-e2e.json`.

---

### `test-database.ts`
Database utilities for E2E testing with schema isolation.

## Functions

### `getTestDatabaseConfig(configService: ConfigService)`
Returns TypeORM configuration for test environment.

**Features:**
- Automatically determines schema name based on Jest worker ID
- Schema naming: `hollon_test_worker_1`, `hollon_test_worker_2`, etc.
- Supports parallel test execution
- Uses same database as development but different schema

**Usage:**
```typescript
import { getTestDatabaseConfig } from '../setup/test-database';

TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) =>
    getTestDatabaseConfig(configService),
  inject: [ConfigService],
});
```

**Worker Isolation:**
```
Worker 1 → hollon_test_worker_1 schema
Worker 2 → hollon_test_worker_2 schema
Worker 3 → hollon_test_worker_3 schema
```

---

### `setupTestSchema(dataSource: DataSource)`
Creates test schema and runs migrations.

**What it does:**
1. Creates schema if it doesn't exist
2. Runs all migrations on the test schema
3. Logs success/failure

**Usage:**
```typescript
import { setupTestSchema } from '../setup/test-database';

beforeAll(async () => {
  const dataSource = module.get(DataSource);
  await setupTestSchema(dataSource);
});
```

**When to use:**
- If you need to ensure migrations are up to date
- When creating a new test suite that requires fresh schema
- Usually not needed if migrations were run once with `db:migrate`

---

### `cleanDatabase(dataSource: DataSource)`
Quickly removes all data from test database.

**How it works:**
1. Temporarily disables foreign key constraints
2. Truncates all tables in test schema
3. Re-enables foreign key constraints

**Performance:**
- Much faster than `DELETE FROM` (uses TRUNCATE)
- Much faster than dropping and recreating schema
- Safe because it only affects test schema

**Usage:**
```typescript
import { cleanDatabase } from '../setup/test-database';

afterEach(async () => {
  const dataSource = module.get(DataSource);
  await cleanDatabase(dataSource);
});
```

**When to use:**
- Between tests in the same file (if tests aren't isolated)
- When you want to reset database state but keep schema structure
- Faster than manual deletion of test data

---

### `teardownTestSchema(dataSource: DataSource)`
Completely drops the test schema.

**What it does:**
1. Drops entire test schema with CASCADE
2. Removes all tables, data, functions, etc.
3. Logs success/failure

**Usage:**
```typescript
import { teardownTestSchema } from '../setup/test-database';

afterAll(async () => {
  const dataSource = module.get(DataSource);
  await teardownTestSchema(dataSource);
  await module.close();
});
```

**When to use:**
- After all tests complete (in `afterAll`)
- When you want complete cleanup
- Before creating fresh schema with `setupTestSchema`

**Warning:** This is destructive! Only use on test schemas.

---

### `verifyConnection(dataSource: DataSource)`
Verifies database connection is working.

**Usage:**
```typescript
import { verifyConnection } from '../setup/test-database';

beforeAll(async () => {
  const dataSource = module.get(DataSource);
  await verifyConnection(dataSource);
});
```

**When to use:**
- At start of test suite to ensure database is accessible
- For debugging connection issues
- Before running expensive setup operations

---

## Schema Isolation Strategy

### Why Schema-Based Isolation?

**Advantages:**
1. **Fast**: No need to create separate databases
2. **Scalable**: Supports parallel Jest workers
3. **Isolated**: Each worker has its own schema
4. **Clean**: Easy to drop and recreate
5. **Efficient**: Shares database connection pool

**vs Separate Database:**
- ❌ Slower to create/destroy
- ❌ More complex connection management
- ❌ Higher resource usage

**vs In-Memory Database:**
- ❌ Different behavior from production
- ❌ Doesn't test real PostgreSQL features
- ❌ Doesn't test migrations

### Schema Lifecycle

```
1. Test Suite Starts
   ↓
2. Jest Worker Gets ID (process.env.JEST_WORKER_ID)
   ↓
3. Schema Name Determined (hollon_test_worker_1)
   ↓
4. Schema Created (if not exists)
   ↓
5. Migrations Run (table structure created)
   ↓
6. Tests Execute
   ↓
7. Data Created/Modified
   ↓
8. Tests Complete
   ↓
9. Schema Dropped (afterAll)
```

### Parallel Execution

Jest can run tests in parallel using multiple workers:

```bash
# Single worker (sequential)
pnpm test:e2e --maxWorkers=1

# Multiple workers (parallel)
pnpm test:e2e --maxWorkers=4
```

Each worker automatically gets its own schema, preventing conflicts.

---

## Environment Variables

E2E tests use environment variables from `.env.test` at project root:

```bash
NODE_ENV=test
DB_HOST=localhost
DB_PORT=5434
DB_NAME=hollon
DB_USER=hollon
DB_PASSWORD=hollon_dev_password
DB_SCHEMA=hollon_test  # Overridden by worker ID
LOG_LEVEL=error
TEST_TIMEOUT=30000
```

The `DB_SCHEMA` is overridden at runtime based on Jest worker ID.

---

## Debugging

### View Current Schema
```bash
docker exec -it hollon-postgres psql -U hollon -d hollon
\c hollon
\dn  # List all schemas
```

### Switch to Test Schema
```sql
SET search_path TO hollon_test_worker_1;
\dt  -- List tables in schema
```

### Inspect Test Data
```sql
SET search_path TO hollon_test_worker_1;
SELECT * FROM organizations;
SELECT * FROM teams;
```

### Manually Clean Schema
```sql
DROP SCHEMA hollon_test_worker_1 CASCADE;
CREATE SCHEMA hollon_test_worker_1;
GRANT ALL ON SCHEMA hollon_test_worker_1 TO hollon;
```

---

## Advanced Usage

### Custom Schema Names

For manual testing or debugging:

```typescript
process.env.JEST_WORKER_ID = 'debug';
// Schema will be: hollon_test_worker_debug

const config = getTestDatabaseConfig(configService);
console.log(config.schema); // hollon_test_worker_debug
```

### Running Migrations Manually

```bash
# On specific test schema
DB_SCHEMA=hollon_test_worker_1 pnpm --filter=@hollon-ai/server db:migrate

# Generate new migration (use dev schema)
DB_SCHEMA=hollon pnpm --filter=@hollon-ai/server db:migrate:generate src/database/migrations/YourMigrationName
```

### Multiple Test Suites

If you have multiple test files, they will automatically share the same schema within a worker:

```
Worker 1:
  - test/orchestration/orchestration.e2e-spec.ts  → hollon_test_worker_1
  - test/auth/auth.e2e-spec.ts                    → hollon_test_worker_1

Worker 2:
  - test/tasks/tasks.e2e-spec.ts                  → hollon_test_worker_2
  - test/hollons/hollons.e2e-spec.ts              → hollon_test_worker_2
```

Use `cleanDatabase()` between test files if needed, or ensure each test cleans its own data.

---

## Troubleshooting

### Schema Already Exists Error
**Cause**: Previous test run didn't clean up

**Solution**:
```sql
DROP SCHEMA hollon_test_worker_1 CASCADE;
```

### Migrations Not Applied
**Cause**: Migrations were run on `hollon` schema but not test schema

**Solution**:
```bash
DB_SCHEMA=hollon_test_worker_1 pnpm --filter=@hollon-ai/server db:migrate
```

### Foreign Key Constraint Violations
**Cause**: `cleanDatabase()` disabled FK constraints but they weren't re-enabled

**Solution**: Restart test or manually:
```sql
SET session_replication_role = DEFAULT;
```

### Connection Pool Exhausted
**Cause**: Too many parallel workers or unclosed connections

**Solution**:
- Reduce `--maxWorkers`
- Ensure `module.close()` is called in `afterAll`
- Check for lingering database queries

---

## Best Practices

1. **Always close modules**: Call `module.close()` in `afterAll`
2. **Use factories**: Create test data with UUID-based unique names
3. **Clean up properly**: Delete data in reverse dependency order
4. **Mock external APIs**: Don't make real API calls in tests
5. **One schema per worker**: Don't try to override schema name manually
6. **Trust the utilities**: These functions are tested and optimized
