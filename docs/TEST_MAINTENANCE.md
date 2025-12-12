# Test Maintenance Guidelines

**Last Updated**: 2025-12-12

This document provides comprehensive guidelines for maintaining, writing, and improving tests in the Hollon-AI project.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Writing Standards](#test-writing-standards)
- [Test Maintenance Workflows](#test-maintenance-workflows)
- [Code Review Guidelines](#code-review-guidelines)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Performance Optimization](#performance-optimization)
- [Continuous Improvement](#continuous-improvement)

## Quick Start

### For New Developers

**Before writing your first test**:
1. Read [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) for overview
2. Review existing tests in similar module
3. Set up local test environment:
   ```bash
   pnpm docker:up           # Start PostgreSQL
   pnpm test                # Run unit tests
   pnpm test:integration    # Run integration tests
   ```

### Test Type Decision Tree

```
Need to test new code?
│
├─ Is it isolated business logic?
│  └─ YES → Write Unit Test (.spec.ts)
│
├─ Does it interact with database?
│  └─ YES → Write Integration Test (.integration-spec.ts)
│
├─ Does it need real LLM calls?
│  └─ YES → Write E2E Test (.e2e-spec.ts)
│
└─ Is it a DTO or config?
   └─ Usually no test needed (validated at runtime)
```

## Test Writing Standards

### Naming Conventions

#### Test Files

```typescript
// ✅ Good
user.service.spec.ts              // Unit test
task-assignment.integration-spec.ts   // Integration test
workflow.e2e-spec.ts              // E2E test

// ❌ Bad
userTest.ts
user.test.ts
user-spec.ts
```

#### Test Suites and Cases

```typescript
// ✅ Good - Descriptive, behavior-focused
describe('TaskService', () => {
  describe('assignToTeam', () => {
    it('should assign task to team when team has capacity', async () => {
      // Test implementation
    });

    it('should throw error when team is at full capacity', async () => {
      // Test implementation
    });
  });
});

// ❌ Bad - Vague, implementation-focused
describe('TaskService', () => {
  it('test1', async () => { });
  it('should work', async () => { });
  it('should call repository.save', async () => { }); // Testing implementation
});
```

### Test Structure: AAA Pattern

**Always use Arrange-Act-Assert pattern**:

```typescript
it('should calculate task priority correctly', async () => {
  // ========== ARRANGE ==========
  // Set up test data and mocks
  const task = TaskFactory.create({
    importance: 'high',
    urgency: 'medium',
  });
  const mockCalculator = createMockPriorityCalculator();

  // ========== ACT ==========
  // Execute the code under test
  const result = await service.calculatePriority(task);

  // ========== ASSERT ==========
  // Verify the results
  expect(result.score).toBe(85);
  expect(result.level).toBe('high');
});
```

**Why AAA?**
- Makes test structure obvious
- Easy to identify what's being tested
- Clear separation of concerns
- Easier to debug when tests fail

### Unit Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { YourService } from './your.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { YourEntity } from './entities/your.entity';

describe('YourService', () => {
  let service: YourService;
  let repository: jest.Mocked<Repository<YourEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YourService,
        {
          provide: getRepositoryToken(YourEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<YourService>(YourService);
    repository = module.get(getRepositoryToken(YourEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange
      const input = { /* test data */ };
      repository.findOne.mockResolvedValue({ id: 1, /* ... */ });

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(result).toBeDefined();
      expect(repository.findOne).toHaveBeenCalledWith({ where: { /* ... */ } });
    });

    it('should handle error case', async () => {
      // Arrange
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.methodName({ id: 999 }))
        .rejects
        .toThrow('Entity not found');
    });
  });
});
```

### Integration Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { getTestDatabaseConfig, cleanDatabase } from '../setup/test-database';
import configuration from '@/config/configuration';
import { YourModule } from '@/modules/your/your.module';
import { YourService } from '@/modules/your/your.service';
import { YourEntity } from '@/modules/your/entities/your.entity';
import { YourFactory } from '../fixtures/your.factory';

describe('Your Feature Integration', () => {
  let module: TestingModule;
  let service: YourService;
  let repository: Repository<YourEntity>;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
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
        YourModule,
      ],
    }).compile();

    service = module.get<YourService>(YourService);
    repository = module.get('YourEntityRepository');
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await cleanDatabase(dataSource);
    await module.close();
  });

  beforeEach(async () => {
    // Clean between tests if needed
    await repository.clear();
  });

  describe('Feature Workflow', () => {
    it('should complete workflow successfully', async () => {
      // Arrange
      const entity = await YourFactory.createPersisted(repository, {
        name: 'Test Entity',
      });

      // Act
      const result = await service.processWorkflow(entity.id);

      // Assert
      expect(result.status).toBe('completed');

      // Verify database state
      const updated = await repository.findOne({ where: { id: entity.id } });
      expect(updated.processedAt).toBeDefined();
    });
  });
});
```

### Mocking Best Practices

#### ✅ DO: Mock External Dependencies

```typescript
// Mock LLM provider
const mockBrainProvider = {
  chat: jest.fn().mockResolvedValue({
    content: 'Mocked LLM response',
    usage: { tokens: 100 },
  }),
};

// Mock HTTP client
const mockHttpService = {
  get: jest.fn().mockReturnValue(of({ data: 'mocked' })),
};
```

#### ❌ DON'T: Mock Database in Integration Tests

```typescript
// ❌ Bad - defeats purpose of integration test
const mockRepository = {
  find: jest.fn().mockResolvedValue([]),
};

// ✅ Good - use real database
const repository = module.get<Repository<Task>>(getRepositoryToken(Task));
```

#### ✅ DO: Create Reusable Mock Factories

```typescript
// test/mocks/brain-provider.mock.ts
export function createMockBrainProvider(overrides = {}) {
  return {
    chat: jest.fn().mockResolvedValue({
      content: 'Default response',
      usage: { tokens: 100 },
    }),
    ...overrides,
  };
}

// In tests
const mockBrain = createMockBrainProvider({
  chat: jest.fn().mockResolvedValue({ content: 'Custom response' }),
});
```

## Test Maintenance Workflows

### When Adding New Features

**Checklist**:
- [ ] Write unit tests for new service methods
- [ ] Write integration tests for cross-module interactions
- [ ] Update existing tests if behavior changed
- [ ] Verify coverage increased (not decreased)
- [ ] All tests pass locally
- [ ] All tests pass in CI

**Process**:
1. Write test first (TDD) or immediately after implementation
2. Run `pnpm test:cov` to check coverage
3. Aim for 80%+ coverage on new code
4. Run full test suite before committing

### When Fixing Bugs

**Process**:
1. **Write failing test** that reproduces the bug
2. Fix the bug
3. Verify test now passes
4. Check for similar bugs (if pattern found)
5. Add regression test

**Example**:
```typescript
// Bug: Task assignment fails when team is null
it('should handle null team gracefully', async () => {
  // This test fails initially (reproduces bug)
  const task = await TaskFactory.create();

  await expect(service.assignToTeam(task.id, null))
    .rejects
    .toThrow('Team cannot be null');

  // After fix, test passes
});
```

### When Refactoring

**Golden Rule**: Tests should pass before and after refactoring (behavior unchanged)

**Process**:
1. Run all tests before refactoring (establish baseline)
2. Refactor code
3. Run tests again - should all pass
4. If tests fail, either:
   - Bug in refactoring (fix it)
   - Tests were too coupled to implementation (update tests)

**Warning Signs**:
- Many tests fail after refactoring → Tests too brittle
- No tests exist → Risky refactoring, write tests first

### When Removing Features

**Process**:
1. Mark feature as deprecated first (if possible)
2. Remove or skip tests for deprecated feature
3. Remove feature code
4. Remove test files
5. Verify no other tests broke

**Cleanup Checklist**:
- [ ] Remove test files
- [ ] Remove test fixtures/factories
- [ ] Remove mocks specific to feature
- [ ] Update documentation
- [ ] Check for orphaned test data in DB

## Code Review Guidelines

### For Test Authors

Before submitting PR:
- [ ] All tests pass locally
- [ ] Tests follow AAA pattern
- [ ] Descriptive test names
- [ ] No hardcoded values (use factories)
- [ ] Proper cleanup (afterEach/afterAll)
- [ ] Coverage meets threshold (80%+ on new code)
- [ ] Tests are fast (unit tests < 100ms each)
- [ ] No console.log or debug statements left in

### For Reviewers

**What to check**:

#### 1. Test Quality
- [ ] Tests are readable and well-organized
- [ ] Tests are focused (one assertion per test ideal)
- [ ] Tests are deterministic (no random values, no timing dependencies)

#### 2. Test Coverage
- [ ] Critical paths are tested
- [ ] Error cases are tested
- [ ] Edge cases are considered
- [ ] Not just "happy path" testing

#### 3. Test Independence
- [ ] Tests can run in any order
- [ ] Tests don't depend on each other
- [ ] Proper setup/teardown

#### 4. Performance
- [ ] Tests are reasonably fast
- [ ] No unnecessary database operations
- [ ] Minimal test data created

#### 5. Maintainability
- [ ] Tests will be easy to update
- [ ] Clear what's being tested
- [ ] Not overly coupled to implementation

### Common Review Feedback

**Too Many Assertions**:
```typescript
// ❌ Hard to debug when fails
it('should do everything', () => {
  expect(result.name).toBe('Test');
  expect(result.status).toBe('active');
  expect(result.createdAt).toBeDefined();
  expect(result.team).toBeDefined();
  expect(result.team.name).toBe('Team A');
  // ... 10 more assertions
});

// ✅ Split into focused tests
it('should set correct name', () => {
  expect(result.name).toBe('Test');
});

it('should set status to active', () => {
  expect(result.status).toBe('active');
});
```

**Testing Implementation Details**:
```typescript
// ❌ Coupled to implementation
it('should call repository.save with correct params', () => {
  service.create(data);
  expect(repository.save).toHaveBeenCalledWith({ ...data });
});

// ✅ Test behavior
it('should create task with given data', async () => {
  const result = await service.create(data);
  expect(result.title).toBe(data.title);
});
```

## Troubleshooting Guide

### Test Failures

#### Failure: "Jest did not exit one second after test run"

**Cause**: Unclosed connections or event listeners

**Solutions**:
```typescript
// 1. Ensure module.close() is called
afterAll(async () => {
  await module.close();
});

// 2. Close database connection explicitly
afterAll(async () => {
  await dataSource.destroy();
  await module.close();
});

// 3. Add forceExit to jest config (last resort)
// jest.config.json
{
  "forceExit": true  // ⚠️ Masks the problem
}
```

**Debug**:
```bash
pnpm test:integration:debug
# or
pnpm test -- --detectOpenHandles
```

#### Failure: "Foreign key constraint violation"

**Cause**: Deleting parent before child

**Solution**:
```typescript
// ❌ Wrong order
afterAll(async () => {
  await orgRepo.delete(org.id);    // FAILS - has teams
  await teamRepo.delete(team.id);
});

// ✅ Correct order
afterAll(async () => {
  await teamRepo.delete(team.id);  // Delete children first
  await orgRepo.delete(org.id);    // Then parent
});
```

#### Failure: "Timeout exceeded"

**Causes**:
1. Test is genuinely slow
2. Infinite loop or deadlock
3. Async operation not awaited
4. Database connection issues

**Solutions**:
```typescript
// 1. Increase timeout for specific test
it('slow operation', async () => {
  // test
}, 60000); // 60 second timeout

// 2. Find the slow operation
console.time('operation');
await slowOperation();
console.timeEnd('operation');

// 3. Check for missing await
// ❌ Bad
it('should work', async () => {
  service.asyncMethod(); // Missing await!
  expect(result).toBeDefined();
});

// ✅ Good
it('should work', async () => {
  await service.asyncMethod();
  expect(result).toBeDefined();
});
```

#### Failure: "Cannot find module" or "Unexpected token"

**Cause**: TypeScript path mapping issues

**Solution**:
```typescript
// Check jest.config.json or test config
{
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/../src/$1"  // Ensure this is correct
  }
}

// Or use relative imports in tests
import { Service } from '../../src/modules/service'; // Works always
```

### Flaky Tests

**Definition**: Tests that sometimes pass, sometimes fail

#### Common Causes

1. **Timing Dependencies**
   ```typescript
   // ❌ Flaky - race condition
   service.startProcess();
   expect(service.isComplete()).toBe(true); // Might not be done yet

   // ✅ Reliable - wait for completion
   await service.startProcess();
   expect(service.isComplete()).toBe(true);
   ```

2. **Shared State**
   ```typescript
   // ❌ Flaky - tests affect each other
   let sharedUser;

   it('test 1', () => {
     sharedUser = { name: 'Alice' };
   });

   it('test 2', () => {
     expect(sharedUser.name).toBe('Bob'); // Depends on execution order
   });

   // ✅ Reliable - isolated state
   it('test 1', () => {
     const user = { name: 'Alice' };
   });
   ```

3. **Date/Time Sensitivity**
   ```typescript
   // ❌ Flaky - depends on current time
   expect(task.dueDate).toBe(new Date());

   // ✅ Reliable - freeze time or use relative checks
   jest.useFakeTimers();
   jest.setSystemTime(new Date('2025-01-01'));
   expect(task.dueDate).toEqual(new Date('2025-01-01'));
   ```

4. **Non-Deterministic Order**
   ```typescript
   // ❌ Flaky - database order not guaranteed
   const results = await repo.find();
   expect(results[0].name).toBe('Alice');

   // ✅ Reliable - explicit sorting or find specific item
   const results = await repo.find({ order: { name: 'ASC' } });
   expect(results[0].name).toBe('Alice');
   ```

### Coverage Issues

#### Coverage Dropped After Change

**Check**:
1. Did you remove tests? (Bad)
2. Did you add uncovered code? (Needs tests)
3. Coverage calculation changed? (Config issue)

**Fix**:
```bash
# See what's not covered
pnpm test:cov
open coverage/lcov-report/index.html

# Find specific uncovered lines
# They're highlighted in red in the HTML report
```

#### Coverage Not Updating

**Causes**:
- Jest cache corruption
- Coverage files not regenerated

**Solutions**:
```bash
# Clear Jest cache
pnpm test -- --clearCache

# Remove old coverage
rm -rf coverage/

# Regenerate
pnpm test:cov
```

## Performance Optimization

### Making Tests Faster

#### 1. Minimize Database Operations

```typescript
// ❌ Slow - creates full object graph
beforeEach(async () => {
  org = await OrganizationFactory.createWithTeams(5);
  // Creates org + 5 teams + 25 hollons + 100 tasks
});

// ✅ Fast - minimal setup
beforeEach(async () => {
  org = await OrganizationFactory.create();
  // Creates just the org
});
```

#### 2. Use Transactions for Cleanup

```typescript
// ✅ Fast cleanup with transaction rollback
let queryRunner: QueryRunner;

beforeEach(async () => {
  queryRunner = dataSource.createQueryRunner();
  await queryRunner.startTransaction();
});

afterEach(async () => {
  await queryRunner.rollbackTransaction();
  await queryRunner.release();
});
```

#### 3. Batch Operations

```typescript
// ❌ Slow - N+1 saves
for (const task of tasks) {
  await repo.save(task);
}

// ✅ Fast - bulk save
await repo.save(tasks);
```

#### 4. Mock Expensive Operations

```typescript
// ❌ Slow - real encryption in unit test
const hash = await bcrypt.hash(password, 10);

// ✅ Fast - mock it
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}));
```

### Test Suite Optimization Goals

| Test Type | Target Speed | Current |
|-----------|--------------|---------|
| Unit (all) | < 30s | 13.5s ✅ |
| Integration (all) | < 120s | 53.6s ✅ |
| Single unit test | < 100ms | Varies |
| Single integration test | < 5s | Varies |

## Continuous Improvement

### Monthly Test Health Review

**Metrics to track**:
- Overall coverage percentage
- Test count (unit, integration, E2E)
- Total execution time
- Flaky test count
- Test failure rate in CI

**Review Process**:
1. Run full coverage report
2. Identify modules below 80% coverage
3. Prioritize modules for improvement
4. Assign ownership for coverage increase
5. Set targets for next month

### Quarterly Test Architecture Review

**Questions to ask**:
- Are tests still fast enough?
- Do we have the right test mix?
- Are integration tests testing the right things?
- Can we improve test utilities/factories?
- Should we refactor common patterns?

### Adding New Test Patterns

When you discover a better testing pattern:

1. **Document it** in this guide
2. **Create an example** test
3. **Share with team** in code review
4. **Refactor existing tests** gradually

**Example**:
```typescript
// New pattern: Test builder for complex setups
class TaskTestBuilder {
  private task = TaskFactory.create();

  withHighPriority() {
    this.task.priority = 'high';
    return this;
  }

  withTeam(teamId: string) {
    this.task.teamId = teamId;
    return this;
  }

  async build() {
    return await repo.save(this.task);
  }
}

// Usage
const task = await new TaskTestBuilder()
  .withHighPriority()
  .withTeam(team.id)
  .build();
```

## Testing Checklist for PRs

Before submitting PR:

### Code
- [ ] New code has tests
- [ ] Tests follow established patterns
- [ ] Tests are properly organized (unit vs integration)

### Quality
- [ ] All tests pass locally
- [ ] No failing tests skipped or commented out
- [ ] No console.log/debug statements
- [ ] Test names are descriptive

### Coverage
- [ ] Coverage not decreased
- [ ] New code coverage ≥ 80%
- [ ] Critical paths tested

### Performance
- [ ] Tests are reasonably fast
- [ ] No unnecessary setup/teardown
- [ ] Database operations minimized

### Documentation
- [ ] Complex test logic has comments
- [ ] New test patterns documented
- [ ] README updated if needed

## Resources

### Internal Documentation
- [Testing Strategy](./TESTING_STRATEGY.md) - Overview and current state
- [Known Issues](./KNOWN_ISSUES.md) - Known test problems
- [Test README](../apps/server/test/README.md) - E2E test guide

### External Resources
- [NestJS Testing Docs](https://docs.nestjs.com/fundamentals/testing)
- [Jest Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [TypeORM Testing](https://typeorm.io/testing)

### Tools
- Jest: Test runner
- Codecov: Coverage tracking
- Istanbul: Coverage reporting

## Getting Help

### When Stuck on Testing

1. Check this guide
2. Look at similar existing tests
3. Review test setup in `test/setup/`
4. Ask in team chat
5. Pair program with experienced developer

### Updating This Guide

This is a living document. If you find:
- Missing information
- Outdated patterns
- Better approaches

Please update this guide and share with the team!

## Changelog

- **2025-12-12**: Initial test maintenance guidelines created
- **2025-12-12**: Added templates, best practices, and troubleshooting guide
