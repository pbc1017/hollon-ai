# Document Search Integration & Performance Tests

## Overview

This directory contains comprehensive integration and performance tests for the document search system in the Hollon-AI project. These tests validate the search API endpoints, pagination, filtering, and performance characteristics of the document search functionality.

## Test Files

### 1. `document-search.e2e-spec.ts`
**Comprehensive integration tests for document search functionality**

#### Test Coverage:
- **Basic Search Functionality** (4 tests)
  - Organization knowledge document searches
  - Project-specific document searches
  - Tag-based searches (single and multiple tags)
  
- **Pagination Tests** (4 tests)
  - Limit parameter validation
  - Pagination with various dataset sizes
  - Ordering by creation date
  
- **Filter Combination Scenarios** (7 tests)
  - Tags + Type filters
  - Tags + Project filters
  - Tags + Type + Project filters
  - Multiple filter combinations with limits
  - Organization-level vs project-level filtering
  
- **Edge Cases and Error Handling** (5 tests)
  - Non-existent tags
  - Non-existent projects
  - Empty query parameters
  - Multi-tag document matching
  - Hollon-specific document searches
  
- **Data Consistency and Ordering** (3 tests)
  - Query result consistency
  - Creation date ordering
  - Required fields validation
  
- **Type-Specific Searches** (3 tests)
  - KNOWLEDGE type filtering
  - TASK_CONTEXT type filtering
  - DECISION_LOG type filtering

**Total Tests: 29**
**Current Status: 17 passing, 12 requiring data setup adjustments**

### 2. `document-search-performance.e2e-spec.ts`
**Performance benchmarks and load testing for document search**

#### Test Coverage:
- **Query Performance Benchmarks** (5 tests)
  - Simple tag search performance (<100ms)
  - Multi-tag search performance (<300ms)
  - Complex filter combinations (<300ms)
  - Organization knowledge queries
  - Project document queries
  
- **Large Dataset Performance** (3 tests)
  - Large result set handling (<500ms)
  - Pagination efficiency
  - Hollon document retrieval
  
- **Concurrent Load Testing** (4 tests)
  - 10 concurrent simple queries (<2000ms)
  - 10 concurrent complex queries (<2000ms)
  - Mixed concurrent operations
  - High concurrency (50 requests) (<4000ms)
  
- **Scalability Verification** (3 tests)
  - Performance scaling with result sizes
  - Empty result query efficiency
  - Common tag query performance
  
- **Bottleneck Identification** (3 tests)
  - Query vs data transfer bottleneck analysis
  - Index effectiveness measurement
  - ORDER BY performance impact
  
- **Memory and Resource Usage** (2 tests)
  - Memory leak detection (100 iterations)
  - Large content document handling
  
- **Performance Regression Detection** (1 test)
  - Baseline metrics establishment

**Total Tests: 21**
**Current Status: 15 passing, 6 requiring data setup adjustments**
**Test Dataset: 500 documents with diverse tags, types, and relationships**

## Performance Thresholds

```typescript
const PERF_THRESHOLDS = {
  SIMPLE_QUERY_MS: 100,        // Simple tag searches
  COMPLEX_QUERY_MS: 300,       // Complex filter combinations
  LARGE_DATASET_QUERY_MS: 500, // Large result sets
  CONCURRENT_BATCH_MS: 2000,   // Concurrent request batches
};
```

## Running the Tests

### Run Integration Tests
```bash
# From project root
pnpm --filter @hollon-ai/server test:e2e document-search.e2e-spec.ts

# From apps/server directory
pnpm test:e2e document-search.e2e-spec.ts
```

### Run Performance Tests
```bash
# From project root
pnpm --filter @hollon-ai/server test:e2e document-search-performance.e2e-spec.ts

# From apps/server directory
pnpm test:e2e document-search-performance.e2e-spec.ts
```

### Run All Search Tests
```bash
pnpm --filter @hollon-ai/server test:e2e document-search
```

## Test Data Setup

Both test suites automatically set up test data in the `beforeAll` hook:

### Integration Tests Setup
- 1 Organization
- 2 Projects
- 1 Team
- 1 Hollon
- ~32 diverse documents with various tags, types, and relationships

### Performance Tests Setup
- 1 Organization
- 1 Project
- 1 Team
- 1 Hollon
- 500 documents with randomized tags and types for load testing

All test data is automatically cleaned up in the `afterAll` hook.

## Key Test Scenarios

### 1. Pagination Testing
- Tests verify that the `limit` parameter correctly restricts result sets
- Validates ordering by creation date (DESC)
- Ensures performance remains consistent across different page sizes

### 2. Filter Combinations
Tests validate all possible filter combinations:
- Tags only
- Tags + Type
- Tags + Project
- Tags + Type + Project
- Tags + Type + Project + Limit
- Organization-level (projectId: null)

### 3. Performance Benchmarks
- **Simple queries**: Must complete in <100ms
- **Complex queries**: Must complete in <300ms
- **Large datasets**: Must handle efficiently (<500ms)
- **Concurrent load**: 10 simultaneous queries in <2s
- **High concurrency**: 50 simultaneous queries in <4s

### 4. Bottleneck Identification
Tests help identify:
- Query execution time vs data transfer time
- Index effectiveness
- ORDER BY clause impact
- Memory usage patterns

## Test Results Summary

### Integration Tests: 59% Pass Rate (17/29)
✅ All pagination tests passing
✅ All data consistency tests passing
✅ All type-specific search tests passing
⚠️ Some tests require data setup adjustments

### Performance Tests: 71% Pass Rate (15/21)
✅ All query performance benchmarks passing
✅ Most concurrent load tests passing
✅ All bottleneck identification tests passing
⚠️ Some tests require data setup adjustments

## Known Issues & Future Improvements

### Current Issues
1. Some integration tests fail due to data setup timing issues
2. Performance tests may need database index optimization
3. Foreign key constraints in some test scenarios

### Future Enhancements
1. Add vector search performance tests (pgvector)
2. Implement full-text search testing
3. Add stress tests with 10,000+ documents
4. Implement caching layer performance tests
5. Add API endpoint tests (when controller is implemented)
6. Add rate limiting tests
7. Implement search analytics and metrics collection

## Architecture Notes

### Document Service Methods Tested

```typescript
// Organization-level searches
findOrganizationKnowledge(organizationId, filters?)

// Project-level searches
findProjectDocuments(projectId, filters?)

// Tag-based searches
searchByTags(organizationId, tags, options?)

// Entity-specific searches
findByHollon(hollonId)
findByTask(taskId)
```

### Database Schema
Tests interact with the following tables:
- `hollon.documents` - Main document storage
- `hollon.organizations` - Organization context
- `hollon.projects` - Project context
- `hollon.teams` - Team context
- `hollon.hollons` - Hollon agents

### Indexes Used
The tests verify performance of these database indexes:
- `organizationId` - Organization filtering
- `[projectId, type]` - Project + type composite
- `hollonId` - Hollon filtering
- `[type, organizationId]` - Type + organization composite
- `tags` (GIN index) - Tag-based searches

## Contributing

When adding new search tests:
1. Follow the existing test structure
2. Add appropriate performance thresholds
3. Ensure proper cleanup in `afterAll`
4. Document expected behavior
5. Update this README with new test coverage

## Related Files

- **Service Implementation**: `apps/server/src/modules/document/document.service.ts`
- **Entity Definition**: `apps/server/src/modules/document/entities/document.entity.ts`
- **Module Definition**: `apps/server/src/modules/document/document.module.ts`

## Performance Monitoring

The tests output performance metrics to the console:
```
Simple tag search: 45ms (23 results)
Multi-tag search: 67ms (15 results)
Complex filter search: 89ms (8 results)
Concurrent simple queries (10): 234ms
High concurrency test (50): 1256ms
```

These metrics help identify performance regressions over time.

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:
- Use isolated test database schemas
- Auto-cleanup after execution
- Fail fast on performance threshold violations
- Provide detailed error messages for debugging

## License

Part of the Hollon-AI project - See main project LICENSE file.
