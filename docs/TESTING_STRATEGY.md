# Testing Strategy & Coverage Report

## Executive Summary

This document provides a comprehensive overview of the Hollon-AI testing strategy, current coverage status, and guidelines for maintaining and improving test quality.

**Last Updated**: 2025-12-12

## Current Test Coverage Status

### Overall Metrics (as of 2025-12-12)

| Metric | Coverage | Target | Status |
|--------|----------|--------|--------|
| **Statements** | 31.78% | 80% | ❌ Below Target |
| **Branches** | 28.25% | 80% | ❌ Below Target |
| **Functions** | 27.31% | 80% | ❌ Below Target |
| **Lines** | 31.74% | 80% | ❌ Below Target |

### Test Suite Statistics

- **Unit Tests**: 25 test files, 428 test cases - ✅ All Passing
- **Integration Tests**: 17 test files, 212 test cases - ✅ All Passing
- **E2E Tests**: 9 test files - ✅ All Passing
- **Total Test Execution Time**: ~67 seconds (unit + integration)

## Testing Philosophy

The Hollon-AI project follows a **multi-layered testing approach** based on the Testing Pyramid:

```
        /\
       /E2E\         (Few) - Real LLM calls, expensive, full workflows
      /------\
     /Integr-\      (Some) - Database integration, mocked external APIs
    /----------\
   /   Unit     \   (Many) - Fast, isolated, business logic focused
  /--------------\
```

### Key Principles

1. **Test Isolation**: Each test is independent and can run in any order
2. **Database Schema Isolation**: Integration/E2E tests use dedicated PostgreSQL schemas
3. **Mock External Dependencies**: LLM APIs are mocked except in E2E tests
4. **Fast Feedback**: Unit tests complete in ~13 seconds
5. **Real Database Testing**: Integration tests use PostgreSQL, not in-memory DB

## Test Types & Structure

### 1. Unit Tests (`.spec.ts`)

**Location**: Co-located with source files in `src/`
**Purpose**: Test individual components, services, and business logic in isolation
**Execution**: `pnpm test` or `pnpm test:watch`

**Configuration**: `apps/server/package.json` (jest section)
```json
{
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "collectCoverageFrom": [
    "**/*.ts",
    "!**/*.spec.ts",
    "!**/*.e2e-spec.ts",
    "!**/*.integration-spec.ts",
    "!**/config/**",
    "!**/database/**",
    "!**/migrations/**",
    "!**/main.ts"
  ]
}
```

**Coverage Exclusions**:
- Test files themselves
- Database migrations
- Configuration files
- Application entry point (`main.ts`)

### 2. Integration Tests (`.integration-spec.ts`)

**Location**: `apps/server/test/integration/`
**Purpose**: Test interactions between modules with real PostgreSQL database
**Execution**: `pnpm test:integration`

**Configuration**: `test/jest-integration.json`
```json
{
  "testRegex": ".integration-spec.ts$",
  "testTimeout": 30000,
  "maxWorkers": 1,
  "setupFilesAfterEnv": ["<rootDir>/setup/jest-integration-setup.ts"]
}
```

**Key Features**:
- Uses PostgreSQL schema `hollon_test_worker_1` for isolation
- Mocks external LLM API calls (BrainProvider)
- Tests orchestration workflows, delegation, collaboration
- Validates business rules across module boundaries

**Test Categories**:
- Orchestration scenarios (happy path, quality retry, budget exceeded)
- Collaboration workflows
- Task assignment and distribution
- Team dynamics
- Autonomous execution patterns

### 3. E2E Tests (`.e2e-spec.ts`)

**Location**: `apps/server/test/e2e/`
**Purpose**: Full end-to-end validation with **REAL LLM API calls**
**Execution**: `pnpm test:e2e` (⚠️ Costs ~$0.50 per run)

**Configuration**: `test/jest-e2e.json`
```json
{
  "testRegex": "e2e/.+\\.e2e-spec\\.ts$",
  "testTimeout": 60000,
  "maxWorkers": 1
}
```

**Important Notes**:
- Makes actual API calls to Claude/LLM providers
- Validates true autonomous behavior
- Used sparingly due to cost and execution time
- Tests complex multi-agent workflows

## Test Infrastructure

### Database Testing Setup

#### Schema-Based Isolation

Integration and E2E tests use PostgreSQL schema isolation to prevent conflicts:

```typescript
// Each test worker gets its own schema
const workerId = process.env.JEST_WORKER_ID || '1';
const schema = `hollon_test_worker_${workerId}`;
```

**Benefits**:
- No data conflicts between parallel tests
- Clean state for each test run
- Supports future parallel test execution
- Development data remains untouched

#### Test Database Utilities

Located in `test/setup/test-database.ts`:

| Function | Purpose |
|----------|---------|
| `getTestDatabaseConfig()` | Returns TypeORM config for test schema |
| `setupTestSchema()` | Creates schema and runs migrations |
| `cleanDatabase()` | Fast table truncation (keeps schema) |
| `teardownTestSchema()` | Drops entire test schema |
| `verifyConnection()` | Health check for database connectivity |

### Test Data Factories

Located in `test/fixtures/`:

- `organization.factory.ts` - Creates test organizations
- `team.factory.ts` - Creates test teams
- `task.factory.ts` - Creates test tasks
- `hollon.factory.ts` - Creates test hollons

**Usage**:
```typescript
import { OrganizationFactory } from '../fixtures/organization.factory';

const org = await OrganizationFactory.createPersisted(repo, {
  description: 'Custom test org'
});
```

**Features**:
- Automatic unique naming (UUID-based)
- Prevents test data conflicts
- Supports custom attribute overrides
- Handles entity relationships

## CI/CD Integration

### GitHub Actions Workflow

**File**: `.github/workflows/ci.yml`

#### Pipeline Jobs

1. **Setup** - Install dependencies, cache node_modules
2. **Lint** - ESLint validation
3. **Format** - Prettier formatting check
4. **Type Check** - TypeScript compiler validation
5. **Build** - Build application artifacts
6. **Unit Tests** - Run unit tests with coverage
7. **Integration Tests** - Run integration tests with PostgreSQL
8. **Security Audit** - pnpm security audit
9. **CI Success** - Final status gate

#### Test Execution in CI

**Unit Tests**:
```yaml
- name: Run unit tests
  run: pnpm --filter @hollon-ai/server test -- --coverage

- name: Upload coverage reports
  uses: codecov/codecov-action@v4
  with:
    files: ./apps/server/coverage/lcov.info
    flags: unit
```

**Integration Tests**:
```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    env:
      POSTGRES_USER: hollon
      POSTGRES_PASSWORD: hollon_test_password
      POSTGRES_DB: hollon

- name: Run integration tests
  env:
    DB_SCHEMA: hollon_test_worker_1
  run: pnpm --filter @hollon-ai/server test:integration
```

#### Coverage Reporting

- Coverage reports uploaded to Codecov
- LCOV format for detailed line coverage
- Artifact retention for historical tracking
- No CI failure on coverage (informational only)

## Coverage Analysis by Module

### High Coverage Modules (>70%)

| Module | Coverage | Status |
|--------|----------|--------|
| `tech-debt/services` | 72.57% | ✅ Good |
| `task/entities` | 79.59% | ✅ Good |
| `execution` | 87.50% | ✅ Excellent |

### Medium Coverage Modules (30-70%)

| Module | Coverage | Notes |
|--------|----------|-------|
| `auth` | ~60% | Guards and strategies tested |
| `common/filters` | ~55% | Exception handling tested |
| `team/entities` | 63.63% | Entity logic covered |

### Low Coverage Modules (<30%)

| Module | Coverage | Priority |
|--------|----------|----------|
| `task/services` | 0.96% | 🔴 Critical |
| `collaboration` | ~10% | 🔴 High |
| `orchestration` | ~15% | 🔴 High |
| `team/controllers` | 0% | 🟡 Medium |
| `task/controllers` | 0% | 🟡 Medium |
| `messaging` | ~8% | 🟡 Medium |

### Uncovered Areas (0%)

The following modules have **no unit test coverage** (integration tests may exist):

- All DTOs (excluded from coverage by design)
- Scripts in `src/scripts/` (utility scripts, not production code)
- Database migrations (excluded from coverage)
- Configuration files (excluded from coverage)

## Testing Best Practices

### 1. Writing Unit Tests

✅ **DO**:
```typescript
describe('TaskService', () => {
  let service: TaskService;
  let mockRepository: jest.Mocked<Repository<Task>>;

  beforeEach(() => {
    mockRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as any;

    service = new TaskService(mockRepository);
  });

  it('should create a task with valid data', async () => {
    // Arrange
    const taskData = { title: 'Test', description: 'Test desc' };
    mockRepository.save.mockResolvedValue({ id: 1, ...taskData });

    // Act
    const result = await service.create(taskData);

    // Assert
    expect(result.id).toBe(1);
    expect(mockRepository.save).toHaveBeenCalledWith(taskData);
  });
});
```

❌ **DON'T**:
```typescript
// Don't test implementation details
expect(service['privateMethod']).toHaveBeenCalled();

// Don't create brittle tests
expect(result).toMatchSnapshot(); // Snapshots break easily

// Don't skip error cases
it('should work', async () => {
  // Only testing happy path
});
```

### 2. Writing Integration Tests

✅ **DO**:
```typescript
describe('Task Assignment Integration', () => {
  let module: TestingModule;
  let taskService: TaskService;
  let teamService: TeamService;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ load: [configuration] }),
        TypeOrmModule.forRootAsync({
          useFactory: (config) => getTestDatabaseConfig(config),
          inject: [ConfigService],
        }),
        TaskModule,
        TeamModule,
      ],
    }).compile();

    taskService = module.get(TaskService);
    teamService = module.get(TeamService);
    dataSource = module.get(DataSource);
  });

  afterAll(async () => {
    await cleanDatabase(dataSource); // Clean test data
    await module.close();
  });

  it('should assign task to team member', async () => {
    // Use factories for test data
    const team = await TeamFactory.createPersisted(teamRepo);
    const task = await TaskFactory.createPersisted(taskRepo);

    // Test the integration
    const result = await taskService.assignToTeam(task.id, team.id);

    expect(result.teamId).toBe(team.id);
  });
});
```

### 3. Test Data Management

**Use Factories**:
```typescript
// ✅ Good - uses factory
const org = await OrganizationFactory.createPersisted(repo);

// ❌ Bad - hardcoded test data
const org = await repo.save({
  name: 'Test Org', // Fails on second run (duplicate)
  code: 'TEST'
});
```

**Cleanup Order**:
```typescript
// ✅ Correct order - children first
afterAll(async () => {
  await taskRepo.delete(task.id);      // Delete task first
  await teamRepo.delete(team.id);      // Then team
  await orgRepo.delete(org.id);        // Then org
});

// ❌ Wrong order - FK constraint violation
afterAll(async () => {
  await orgRepo.delete(org.id);  // FAILS - tasks still reference it
});
```

## Known Test Limitations

### 1. External Service Mocking

**LLM Provider Mocking**:
```typescript
// In integration tests, BrainProvider is mocked
const mockBrainProvider = {
  chat: jest.fn().mockResolvedValue({
    content: 'Mocked response',
    usage: { tokens: 100 }
  })
};
```

**Limitation**: Mocked responses may not reflect real LLM behavior, especially:
- Edge cases in response formatting
- Token usage estimation accuracy
- Error conditions from the API

**Mitigation**: Run E2E tests periodically with real API calls

### 2. Async Timing Issues

Some tests may have timing dependencies:
```typescript
// Potential race condition
await service.startAsyncProcess();
const result = await service.getResult(); // May not be ready
```

**Mitigation**: Use proper async/await patterns and polling mechanisms

### 3. Database State Dependencies

Tests that modify shared reference data (roles, permissions) may affect each other.

**Mitigation**: Use schema-based isolation and proper cleanup

## Improving Test Coverage

### Priority Areas for Coverage Improvement

#### Critical Priority (Target: 80%+ by next sprint)

1. **Task Services** (currently 0.96%)
   - `dependency-analyzer.service.ts`
   - `pivot-response.service.ts`
   - `priority-rebalancer.service.ts`
   - `uncertainty-decision.service.ts`

2. **Orchestration Module** (currently ~15%)
   - `orchestration.service.ts`
   - `delegation.service.ts`
   - `quality-gate.service.ts`

3. **Collaboration Module** (currently ~10%)
   - `collaboration.service.ts`
   - `message-handler.service.ts`

#### High Priority

4. **Controllers** (currently 0%)
   - `task.controller.ts`
   - `team.controller.ts`
   - `collaboration.controller.ts`

5. **Messaging Module** (currently ~8%)
   - `message.service.ts`
   - `channel.service.ts`

### Recommended Testing Approach

**Phase 1: Core Business Logic (Weeks 1-2)**
- Focus on services with complex business rules
- Target: Task and Orchestration services to 80%

**Phase 2: Integration Points (Weeks 3-4)**
- Add controller tests (request validation, response formatting)
- Target: All controllers to 70%

**Phase 3: Edge Cases (Week 5)**
- Error handling paths
- Boundary conditions
- Concurrent operations

**Phase 4: Full Coverage (Week 6)**
- Fill remaining gaps
- Refactor brittle tests
- Document test patterns

## Test Maintenance Guidelines

### When to Write Tests

**Always write tests for**:
- New service methods
- New API endpoints
- Bug fixes (regression tests)
- Complex business logic
- Critical user workflows

**Optional tests for**:
- Simple DTOs (already validated at runtime)
- Straightforward CRUD operations
- Configuration files
- Database migrations

### When to Update Tests

- When changing business logic
- When modifying API contracts
- When refactoring (ensure behavior unchanged)
- When fixing bugs (add regression test)

### Test Review Checklist

Before merging PR with tests:

- [ ] Tests follow AAA pattern (Arrange, Act, Assert)
- [ ] Test names clearly describe what is being tested
- [ ] Both happy path and error cases covered
- [ ] No hardcoded test data (use factories)
- [ ] Proper cleanup in afterEach/afterAll
- [ ] No flaky/timing-dependent assertions
- [ ] Mocks properly reset between tests
- [ ] Tests pass in CI environment

## Running Tests Locally

### Quick Reference

```bash
# Unit tests (fast, no database needed)
pnpm test                    # Run all unit tests
pnpm test:watch             # Watch mode
pnpm test:cov               # With coverage report

# Integration tests (requires database)
pnpm docker:up              # Start PostgreSQL
pnpm test:integration       # Run integration tests

# E2E tests (requires database + real API keys)
pnpm test:e2e               # ⚠️ Costs money, makes real LLM calls

# Run all tests
pnpm test:all               # Unit + Integration
```

### Coverage Reports

After running `pnpm test:cov`, open coverage report:
```bash
open coverage/lcov-report/index.html
```

## Troubleshooting Common Issues

### Issue: "Jest did not exit"

**Cause**: Open database connections or event listeners

**Solution**:
```typescript
afterAll(async () => {
  await module.close();  // Ensure this is called
  await dataSource.destroy();
});
```

### Issue: "Foreign key constraint violation"

**Cause**: Deleting parent before children

**Solution**: Delete in reverse dependency order:
```typescript
afterAll(async () => {
  await taskRepo.delete(task.id);   // Child first
  await teamRepo.delete(team.id);   // Then parent
});
```

### Issue: "Schema does not exist"

**Cause**: Test schema not created

**Solution**:
```bash
DB_SCHEMA=hollon_test_worker_1 pnpm db:migrate
```

### Issue: Tests pass locally but fail in CI

**Possible causes**:
- Environment variable differences
- Timing/race conditions
- Database state dependencies
- Hardcoded values (ports, paths)

**Solution**: Check CI logs, ensure proper isolation, avoid absolute paths

## Metrics & Monitoring

### Test Health Metrics

Track these metrics over time:

- **Coverage Trend**: Should increase toward 80%
- **Test Count**: Should grow with codebase
- **Execution Time**: Should stay under 2 minutes for unit tests
- **Flakiness Rate**: Should be 0% (no intermittent failures)
- **PR Test Pass Rate**: Should be >95%

### Current Baseline (2025-12-12)

- Unit Test Execution: 13.5s
- Integration Test Execution: 53.6s
- E2E Test Execution: ~5 minutes
- Total Test Cases: 640+
- Flaky Tests: 0

## Additional Resources

- [Test Setup Documentation](../apps/server/test/setup/README.md)
- [NestJS Testing Docs](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/)
- [TypeORM Testing](https://typeorm.io/testing)

## Acceptance Criteria Review

### Mobile Responsiveness: N/A ✅

This is a **backend-only project** (NestJS API server). There is no frontend UI component, therefore mobile responsiveness criteria do not apply.

### Test Coverage: 31.78% ❌

**Current**: 31.78%
**Target**: 80%
**Gap**: 48.22 percentage points

**Status**: Below target. See "Improving Test Coverage" section for remediation plan.

### CI/CD Integration: ✅

**Status**: Fully integrated

- ✅ GitHub Actions workflow configured
- ✅ Automated testing on PR and push to main
- ✅ Linting, formatting, type checking
- ✅ Unit and integration tests in CI
- ✅ PostgreSQL service container for integration tests
- ✅ Security auditing
- ✅ Coverage reporting to Codecov
- ✅ Build artifact caching

## Conclusion

The Hollon-AI project has a **solid testing foundation** with comprehensive integration and E2E test suites. The main gap is **unit test coverage** for business logic services.

**Next Steps**:
1. Follow the priority plan to increase coverage to 80%
2. Maintain test quality as new features are added
3. Monitor test health metrics regularly
4. Keep documentation updated with new patterns

**Maintainer**: Development Team
**Review Cycle**: Monthly
**Last Review**: 2025-12-12
