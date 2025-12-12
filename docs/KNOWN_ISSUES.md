# Known Issues & Technical Debt

**Last Updated**: 2025-12-12

This document tracks known issues, limitations, and technical debt items in the Hollon-AI project.

## Table of Contents

- [Critical Issues](#critical-issues)
- [Testing Issues](#testing-issues)
- [Infrastructure Issues](#infrastructure-issues)
- [Performance Issues](#performance-issues)
- [Technical Debt](#technical-debt)
- [Documentation Gaps](#documentation-gaps)

## Critical Issues

### None Currently

No critical production-blocking issues identified.

## Testing Issues

### 1. Low Unit Test Coverage

**Status**: 🔴 High Priority
**Affected Modules**: Task Services, Orchestration, Collaboration
**Impact**: Increased risk of regressions, harder to refactor

**Details**:
Current overall coverage is 31.78%, significantly below the 80% target.

Specific modules with critical gaps:
- `task/services/dependency-analyzer.service.ts` - 0% coverage
- `task/services/pivot-response.service.ts` - 0% coverage
- `task/services/priority-rebalancer.service.ts` - 0% coverage
- `task/services/uncertainty-decision.service.ts` - 0% coverage
- `orchestration/*.service.ts` - ~15% coverage
- `collaboration/*.service.ts` - ~10% coverage

**Workaround**: Integration tests provide some coverage, but not granular
**Resolution Plan**: See TESTING_STRATEGY.md - 6-week plan to reach 80%
**Timeline**: Target completion Q1 2025

### 2. E2E Tests Cost Money

**Status**: 🟡 By Design
**Impact**: Developer experience, CI cost

**Details**:
E2E tests make real LLM API calls, costing ~$0.50 per full test run. This can add up during development and in CI.

**Current State**:
- E2E tests not run in CI by default
- Manual execution only
- ~3-5 minute execution time

**Workaround**: Use integration tests with mocked LLM responses for fast feedback
**Future Improvement**: Consider dedicated test API quota or mock mode toggle

### 3. Test Database Schema Pollution

**Status**: 🟡 Medium Priority
**Impact**: Test reliability, cleanup complexity

**Details**:
Some integration tests may leave behind data if they fail mid-execution, causing subsequent test failures.

**Example**:
```typescript
// If this throws, cleanup never runs
await someOperation();
await cleanup(); // ❌ Never reached
```

**Mitigation**:
- Use try/finally blocks
- Implement proper afterEach/afterAll hooks
- Use `cleanDatabase()` utility regularly

**Resolution**: Audit all integration tests for proper cleanup (Issue #TBD)

### 4. Flaky Tests on Slow Machines

**Status**: 🟢 Low Priority
**Impact**: CI reliability on resource-constrained runners

**Details**:
Some tests have tight timeouts (30s) that may fail on slower CI runners or under high load.

**Affected Tests**:
- Some orchestration integration tests
- Tests with multiple async operations

**Workaround**:
```typescript
it('test name', async () => {
  // Test implementation
}, 60000); // Increased timeout
```

**Resolution**: Review timeout values, optimize slow operations

## Infrastructure Issues

### 1. PostgreSQL Schema Management

**Status**: 🟡 Medium Priority
**Impact**: Test setup complexity

**Details**:
Test schema creation is semi-manual. Developers must remember to run migrations on test schema:

```bash
DB_SCHEMA=hollon_test_worker_1 pnpm db:migrate
```

**Problem**: Easy to forget, causes confusing test failures
**Impact**: New developer onboarding friction

**Potential Solution**:
- Auto-create/migrate test schema in test setup
- Add pre-test hook to verify schema state
- Better error messages when schema is missing

**Tracked In**: Issue #TBD

### 2. Docker Compose Environment Variables

**Status**: 🟢 Low Priority
**Impact**: Development setup

**Details**:
Multiple `.env` files (`.env`, `.env.local`) can cause confusion about which values are used.

**Current Setup**:
```bash
# .env - committed defaults
# .env.local - local overrides (gitignored)
# .env.example - template
```

**Issues**:
- Not always clear which takes precedence
- Some scripts use `-e ../../.env.local -e ../../.env` ordering

**Workaround**: Document the precedence clearly in README
**Resolution**: Standardize environment variable loading

### 3. Migration File Naming Conflicts

**Status**: 🟢 Low Priority
**Impact**: Rare merge conflicts

**Details**:
TypeORM generates migration files with timestamps. If two developers generate migrations simultaneously, merge conflicts can occur.

**Example**:
```
1702000000000-AddUserTable.ts
1702000000000-AddTeamTable.ts  // Conflict!
```

**Workaround**: Coordinate migration generation, manually rename if needed
**Best Practice**: One migration per feature branch when possible

## Performance Issues

### 1. Slow Integration Test Suite

**Status**: 🟡 Medium Priority
**Impact**: Developer productivity

**Details**:
Integration test suite takes ~53 seconds, which can slow down development iteration.

**Current State**:
- 17 test files
- 212 test cases
- 53.6s execution time

**Contributing Factors**:
- Real database operations
- Sequential execution (maxWorkers: 1)
- Multiple test modules with setup/teardown

**Future Optimization**:
- Enable parallel test execution with multiple schemas
- Optimize database seeding
- Consider test grouping strategies

**Note**: This is acceptable for now, but will become problematic as test count grows

### 2. Large Test Data Factories

**Status**: 🟢 Low Priority
**Impact**: Test execution speed

**Details**:
Some factories create complex object graphs with many related entities, slowing down test setup.

**Example**:
```typescript
// Creates org + team + 5 hollons + 10 tasks
const fullSetup = await CompleteWorkflowFactory.create();
```

**Best Practice**: Create minimal test data, only what's needed for specific test
**Resolution**: Audit factories, provide lightweight alternatives

## Technical Debt

### 1. DTO Validation Not Tested

**Status**: 🟡 Accepted Debt
**Impact**: API contract validation

**Details**:
DTOs use `class-validator` decorators but have 0% test coverage.

**Rationale for Accepting**:
- DTOs are validated at runtime by NestJS
- Validation is declarative (decorators)
- High test count for minimal value
- Integration tests cover validation indirectly

**Risk**: Breaking changes to validation rules may not be caught in tests

**Mitigation**: Integration/E2E tests exercise validation in practice

### 2. Controller Tests Missing

**Status**: 🔴 High Priority
**Impact**: API contract testing

**Details**:
Controllers have 0% unit test coverage.

**Affected**:
- `task.controller.ts`
- `team.controller.ts`
- `collaboration.controller.ts`
- All other controllers

**What's Missing**:
- Request validation testing
- Response formatting testing
- Authorization testing
- Error handling testing

**Current Mitigation**: E2E tests exercise controllers, but not comprehensively
**Resolution Plan**: Part of coverage improvement plan (see TESTING_STRATEGY.md)

### 3. Scripts Not Tested

**Status**: 🟢 Accepted Debt
**Impact**: Utility script reliability

**Details**:
Scripts in `src/scripts/` have 0% coverage:
- `assign-dogfooding-task.ts`
- `load-backlog.ts`
- `task-cli.ts`
- `trigger-concurrent-execution.ts`
- Others

**Rationale**:
- Scripts are utilities, not core application logic
- Manual testing is sufficient
- Test complexity would be high for limited value

**Risk**: Script bugs not caught until runtime
**Mitigation**: Thorough manual testing before use, error handling

### 4. Hardcoded Test Timeouts

**Status**: 🟢 Low Priority
**Impact**: Test maintainability

**Details**:
Test timeouts are hardcoded in multiple places:
- Jest config: `testTimeout: 30000`
- Individual tests: `it('test', async () => {}, 60000)`
- Setup files

**Issue**: Difficult to adjust globally, inconsistent values

**Better Approach**:
```typescript
// test/config/timeouts.ts
export const TEST_TIMEOUTS = {
  UNIT: 5000,
  INTEGRATION: 30000,
  E2E: 60000
};
```

**Resolution**: Centralize timeout configuration (Issue #TBD)

### 5. Mock Provider Inconsistency

**Status**: 🟡 Medium Priority
**Impact**: Test maintainability

**Details**:
Different tests mock the same services in different ways, leading to duplication.

**Example**:
```typescript
// Test A
const mockBrain = { chat: jest.fn().mockResolvedValue({...}) };

// Test B
const mockBrain = {
  chat: jest.fn(),
  getUsage: jest.fn()
};

// Test C
jest.mock('@/modules/brain/brain-provider.service');
```

**Better Approach**: Create shared mock factories:
```typescript
// test/mocks/brain-provider.mock.ts
export function createMockBrainProvider() {
  return {
    chat: jest.fn().mockResolvedValue(defaultResponse),
    // ...
  };
}
```

**Resolution**: Refactor to shared mock utilities (Issue #TBD)

## Documentation Gaps

### 1. API Documentation

**Status**: 🟡 Medium Priority
**Impact**: Developer experience, external integrations

**Details**:
No Swagger/OpenAPI documentation for REST endpoints.

**Current State**:
- Endpoints documented in README (basic)
- No interactive API explorer
- No request/response schemas published

**Workaround**: Read controller source code, use Postman collections
**Future**: Add Swagger decorators, generate OpenAPI spec

### 2. Architecture Decision Records (ADRs)

**Status**: 🟡 Medium Priority
**Impact**: Understanding design rationale

**Details**:
No formal ADRs documenting key architectural decisions:
- Why schema-based test isolation vs separate DB?
- Why NestJS over Express?
- Why TypeORM over Prisma?
- Hollon pattern design decisions

**Impact**: Hard for new team members to understand "why" behind choices
**Resolution**: Start creating ADRs for future major decisions

### 3. Database Schema Documentation

**Status**: 🟢 Low Priority
**Impact**: Onboarding, database understanding

**Details**:
No visual ER diagram or comprehensive schema documentation.

**Current State**:
- Entities documented via TypeScript
- Migrations tell the story of changes
- No high-level overview

**Workaround**: Generate diagram from entities using tools
**Future**: Add schema diagram to docs

### 4. Testing Patterns Guide

**Status**: ✅ Resolved
**Impact**: N/A

**Details**:
Previously missing comprehensive testing documentation.

**Resolution**: Created `TESTING_STRATEGY.md` (2025-12-12)

## Monitoring & Observability Gaps

### 1. No Automated Test Metrics Dashboard

**Status**: 🟡 Medium Priority
**Impact**: Test health visibility

**Details**:
No centralized dashboard showing:
- Coverage trends over time
- Test execution time trends
- Flakiness metrics
- Test count by module

**Current State**: Must check Codecov manually
**Future**: Integrate with dashboard tool (Grafana, custom)

### 2. No Performance Regression Testing

**Status**: 🟢 Low Priority
**Impact**: Performance monitoring

**Details**:
No automated tests for performance regressions (response time, memory usage, query performance).

**Risk**: Slow queries or memory leaks may not be caught
**Mitigation**: Manual performance testing, production monitoring
**Future**: Add performance benchmarks

## Issue Triage Process

### Priority Levels

- 🔴 **Critical**: Must fix before production release
- 🔴 **High**: Should fix in next sprint
- 🟡 **Medium**: Fix in next 1-2 months
- 🟢 **Low**: Fix when convenient
- 🟢 **Accepted Debt**: Conscious decision not to fix

### Reporting New Issues

When you discover a new issue:

1. Check if it's already documented here
2. Add to appropriate section with:
   - Status and priority
   - Impact description
   - Workaround if available
   - Resolution plan
3. Create GitHub issue for tracking (if needed)
4. Link to this document from the issue

### Review Cycle

This document is reviewed and updated:
- **Weekly**: During sprint planning
- **Monthly**: Comprehensive review
- **Ad-hoc**: When new issues discovered

## References

- [Testing Strategy](./TESTING_STRATEGY.md)
- [Test Maintenance Guidelines](./TEST_MAINTENANCE.md) (to be created)
- [GitHub Issues](https://github.com/your-org/hollon-ai/issues)

## Changelog

- **2025-12-12**: Initial known issues document created
- **2025-12-12**: Documented testing coverage gaps and technical debt
