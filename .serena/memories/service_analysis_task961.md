# Service Analysis: VectorSearchService, KnowledgeGraphService, KnowledgeExtractionService

## Task 961EA332 Summary
Analysis of existing service implementations and test infrastructure for knowledge-related services.

## Key Findings

### 1. Services Analysis

#### VectorSearchService (Not Implemented)
- **Status**: Referenced in tests, not yet implemented
- **Expected Purpose**: Vector similarity search functionality
- **Referenced In**:
  - `apps/server/test/integration/team-task-distribution.integration-spec.ts` (line 171)
  - `apps/server/test/integration/team-task-distribution.integration-spec.ts` (line 186)
  - Seed data mentions pgvector and vector-search capabilities

**Dependencies Required**:
- PostgreSQL with pgvector extension
- Vector embedding API (likely OpenAI Embeddings API)
- Similarity search algorithms (cosine similarity, etc.)

#### KnowledgeExtractionService (Not Implemented)
- **Status**: Referenced in tests, not yet implemented
- **Expected Purpose**: Extract knowledge from code and documents
- **Referenced In**:
  - `apps/server/test/integration/team-task-distribution.integration-spec.ts` (line 162)
  - Seed data indicates requirement for knowledge extraction capabilities

**Dependencies Required**:
- LLM integration (Claude/GPT for extraction)
- Document processing
- Code analysis tools

#### KnowledgeGraphService (Referenced But Not Implemented)
- **Status**: Mentioned in seed.ts but no explicit references found
- **Expected Purpose**: Graph-based knowledge representation and traversal
- **Dependencies Required**:
  - PostgreSQL with graph support
  - Graph traversal algorithms
  - TypeORM for ORM layer

### 2. Test Infrastructure Analysis

#### Unit Test Patterns
Location: `apps/server/src/modules/orchestration/services/team-task-distribution.service.spec.ts`

**Structure**:
```typescript
- Test module setup with mocks
- Mock repositories (getRepositoryToken)
- Mock services (BrainProviderService, SubtaskCreationService)
- Describe blocks for major methods
- Mocks for Brain Provider responses
```

**Mock Strategy**:
- Repository mocks: Simple objects with jest.fn() for CRUD operations
- Service mocks: Jest mock implementations
- Brain Provider mocks: Return structured JSON responses

#### Integration Test Pattern
Location: `apps/server/test/integration/team-task-distribution.integration-spec.ts`

**Structure**:
- Full AppModule import (real dependencies)
- Real database via DataSource
- Real service instances
- Setup/teardown with cleanupTestData utility

**Key Components**:
- Entity creation (Organization, Team, Role, Hollon, Task)
- Brain Provider response mocking
- Task distribution flow testing
- Hierarchical structure verification

### 3. External API Calls Analysis

#### Brain Provider Service
- **File**: `apps/server/src/modules/brain-provider/brain-provider.service.ts`
- **Purpose**: Wrapper around Claude Code provider
- **Key Methods**:
  - `executeWithTracking()`: Executes brain provider and logs costs
- **External Dependencies**:
  - Claude Code CLI binary
  - Process manager for execution
  - Cost calculation service

#### Document Service
- **File**: `apps/server/src/modules/document/document.service.ts`
- **Purpose**: Document management and CRUD operations
- **Related to**: Knowledge extraction and retrieval

#### Team Task Distribution Service
- **File**: `apps/server/src/modules/orchestration/services/team-task-distribution.service.ts`
- **Uses Brain Provider**: Yes, for creating distribution plans
- **Flow**: 
  1. Manager uses Brain Provider to create plan
  2. Plan validation (check assignees, circular dependencies)
  3. Subtask creation
  4. Task assignment

### 4. Components Requiring Mocks

#### For VectorSearchService:
- [ ] OpenAI Embeddings API
- [ ] PostgreSQL pgvector interface
- [ ] Document repository
- [ ] Vector similarity calculation

#### For KnowledgeExtractionService:
- [ ] LLM API (Claude/OpenAI)
- [ ] Document processor
- [ ] Code analyzer
- [ ] Brain Provider Service (already exists)

#### For KnowledgeGraphService:
- [ ] Graph database or PostgreSQL graph functions
- [ ] Node/Edge repositories
- [ ] Graph traversal algorithms
- [ ] Task/Document repositories (for graph construction)

### 5. Test Setup Best Practices (from existing tests)

**Patterns Found**:
1. Repository mocking with jest.fn()
2. Service mocking with explicit interfaces
3. Integration tests with real database
4. Mock responses matching actual service interfaces
5. Cleanup utilities for test isolation
6. Cost tracking and logging

**NestJS Testing Features Used**:
- Test.createTestingModule()
- getRepositoryToken() for ORM entity injection
- Custom service injection
- beforeEach/afterEach for setup/teardown

### 6. Existing Architecture Insights

**Module Structure**:
- `brain-provider`: Executes Claude Code
- `orchestration`: Task distribution and management
- `document`: Knowledge document storage
- `task`: Task entity and operations

**Database Schema**:
- Task entity with hierarchical support (depth, parentTaskId)
- Document entity for knowledge storage
- Hollon entity for agent representation
- Team entity for group management

**Dependency Pattern**:
- Services inject repositories via @InjectRepository()
- Services call other services via constructor injection
- Repositories use TypeORM for database access

