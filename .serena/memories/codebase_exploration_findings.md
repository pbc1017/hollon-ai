# Codebase Exploration Findings - Prompt Template System

## Project Summary
- **Name**: Hollon-AI
- **Type**: Recursive Multi-Agent System
- **Tech Stack**: NestJS 10.x, TypeScript, PostgreSQL, TypeORM, pnpm monorepo
- **Testing**: Jest
- **Current Branch**: feature/BackendDev-Charlie/task-f5359c2a

---

## 1. Overall Project Architecture

### Module Structure
```
apps/server/src/modules/
├── organization/       # Organization management & cost limits
├── team/              # Team structures
├── hollon/            # Autonomous agent instances
├── role/              # Role definitions & capabilities
├── task/              # Task management & execution
├── orchestration/     # Core orchestration service
├── prompt-composer/   # Prompt composition (EXISTS - partial)
├── brain-provider/    # LLM integration (Claude)
├── knowledge-extraction/  # Knowledge management
├── vector-search/     # Vector similarity search (skeleton)
├── collaboration/     # Code review workflows
├── message/           # Messaging system
├── goal/              # Goal management
└── [20+ other modules]
```

### Key Architectural Patterns
1. **Module Pattern**: Each module follows NestJS conventions
   - `*.module.ts` - Module definition with imports/exports
   - `*.service.ts` - Business logic with @Injectable
   - `*.controller.ts` - HTTP endpoints
   - `entities/*.entity.ts` - TypeORM entities
   - `dto/*.dto.ts` - Data Transfer Objects with class-validator decorators
   - `*.service.spec.ts` - Unit tests

2. **Database Layer**: TypeORM with PostgreSQL
   - BaseEntity class with UUID PK, createdAt, updatedAt
   - snake_case for DB columns, camelCase for TS properties
   - @Index decorators for performance
   - Migrations in apps/server/src/database/migrations/

3. **Service Patterns**:
   - @InjectRepository for dependency injection
   - Repository pattern with TypeORM
   - NotFoundException for missing entities
   - Logger for structured logging
   - Type safety with TypeScript strict mode

4. **Commit Patterns**:
   - Format: "feat: Description" or "fix: Description" or "Implement Feature Name (#PR)"
   - Multi-part commits show: "* feat: Part 1\n* refactor: Part 2"
   - Footer: "🤖 Generated with [Claude Code](...)\nCo-Authored-By: Claude <noreply@anthropic.com>"

---

## 2. Existing Prompt-Related Functionality

### Current State
- **Prompt Composer Module**: `/apps/server/src/modules/prompt-composer/` (EXISTS but INCOMPLETE)
  - Currently has skeleton structure only
  - DTOs defined but not fully implemented
  - Controller exists but empty

### Orchestration Service
- **PromptComposerService** in `/apps/server/src/modules/orchestration/services/prompt-composer.service.ts`
  - **FULLY IMPLEMENTED** - Core 6-layer prompt composition
  - Layers: Organization → Team → Role → Hollon → Memory → Task
  - Methods:
    - `composePrompt(hollonId, taskId)` - Main composition
    - `composeReviewModePrompt()` - Phase 3.10 review logic
    - `composeTaskDecompositionPrompt()` - Dynamic task decomposition
  - Private methods for each layer composition
  - Memory fetching with keyword matching
  - Token estimation

### DTOs (Already Defined)
1. **prompt-composer/dto/prompt-template.dto.ts**
   - `CreatePromptTemplateDto` - name, template, description, requiredVariables, isActive
   - `UpdatePromptTemplateDto` - All fields optional

2. **prompt-composer/dto/compose-prompt.dto.ts**
   - `ComposePromptDto` - organizationId, templateName, variables, contextVariables
   - `ContextVariable` - key, value pair

3. **prompt-composer/dto/composed-prompt-response.dto.ts**
   - `ComposedPromptResponseDto` - composedPrompt, templateName, variables, metadata

### Interfaces
- **orchestration/interfaces/prompt-context.interface.ts**
  - `OrganizationContext`, `TeamContext`, `RoleContext`, `HollonContext`
  - `MemoryContext`, `TaskContext`, `ComposedPrompt`

---

## 3. Module Organization Patterns (For Reference)

### Example: RoleModule
```typescript
// role.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Role])],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}

// role.service.ts
@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}
  
  async create(dto: CreateRoleDto): Promise<Role> { }
  async findAll(): Promise<Role[]> { }
  async findOne(id: string): Promise<Role> { }
  async update(id: string, dto: UpdateRoleDto): Promise<Role> { }
  async remove(id: string): Promise<void> { }
}
```

### Example: KnowledgeExtractionModule (More Complex)
```typescript
// knowledge-extraction.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeItem])],
  providers: [KnowledgeExtractionService],
  exports: [KnowledgeExtractionService],
})
export class KnowledgeExtractionModule {}
```

---

## 4. Entity & Database Patterns

### BaseEntity (Template)
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

### KnowledgeItem Entity (Reference Example)
- Extends BaseEntity
- Uses @Index decorator for performance
- Foreign keys with @JoinColumn
- Proper TypeORM column decorators (type, length, nullable, default)
- JSONB columns for metadata

### Migration Pattern
- Timestamp prefix: `1766556710000-CreateKnowledgeItemsTable.ts`
- Implements `MigrationInterface`
- Methods: `up()` creates, `down()` cleans up
- Creates indexes explicitly
- Adds table/column comments
- Uses proper FK constraints with CASCADE

---

## 5. Testing Patterns

### Unit Test Structure (Service Tests)
```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let module: TestingModule;

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        ServiceName,
        {
          provide: getRepositoryToken(Entity),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### Entity Tests
- Use simple instance creation
- Test property assignment
- Test nullable fields
- Test long values
- Test multi-line values

---

## 6. Related Modules That Could Support Prompt Templates

### Vector Search Module
- `/apps/server/src/modules/vector-search/vector-search.service.ts`
- **SKELETON ONLY** - needs implementation
- Methods: `searchSimilarVectors()`, `indexDocument()`, `deleteDocument()`
- Future: Vector similarity search for template matching

### Knowledge Extraction Module
- `/apps/server/src/modules/knowledge-extraction/`
- **PARTIALLY IMPLEMENTED**
- Entities: KnowledgeItem
- Uses organization-scoped knowledge items
- Could support template content extraction

### Brain Provider Module
- Integrates with Claude LLM
- Handles prompt execution
- Token cost tracking

---

## 7. App.Module Integration

The PromptComposerModule is already imported in `apps/server/src/app.module.ts`:
```typescript
import { PromptComposerModule } from './modules/prompt-composer/prompt-composer.module';

@Module({
  imports: [
    // ... other modules
    PromptComposerModule,
  ],
})
```

---

## 8. Key Architectural Decisions for Template System

### Recommended Split (2 Commits)

**Commit 1: Foundation - Core Database & Service**
- Create PromptTemplate entity extending BaseEntity
- Fields: name, content, description, requiredVariables, isActive, organizationId
- Create migration for prompt_templates table
- Implement repository methods in PromptTemplateRepository
- Export from knowledge-extraction or new dedicated module
- Unit tests for repository

**Commit 2: Integration - API & Composition**
- Implement PromptTemplateService with CRUD operations
- Add HTTP endpoints in PromptComposerController
- Implement template loading in prompt composition pipeline
- Integration with existing PromptComposerService in orchestration
- Add service-level unit tests
- Documentation of template variable syntax

### Design Considerations
1. **Organization Scoping**: All templates scoped to organization
2. **Variable System**: Templates support `{{variable}}` or `${variable}` syntax
3. **Reusability**: Shared across all hollons in organization
4. **Composition**: Can be composed/nested with context layers
5. **Versioning**: Track createdAt/updatedAt for audit trail
6. **Indexes**: organizationId, isActive for fast queries

---

## 9. Migration & Seed Data Pattern

Recent commit shows:
```
Implement KnowledgeExtractionRepository (#88)
* feat: Implement KnowledgeExtractionRepository...
* refactor: Replace deprecated TypeORM methods...
```

Suggests breaking complex features into logical chunks within one PR.

---

## 10. File Structure to Create

```
apps/server/src/modules/prompt-composer/
├── entities/
│   ├── prompt-template.entity.ts        [NEW - Commit 1]
│   └── prompt-template.entity.spec.ts   [NEW - Commit 1]
├── dto/
│   ├── prompt-template.dto.ts           [EXISTS - May refactor]
│   ├── compose-prompt.dto.ts            [EXISTS]
│   └── composed-prompt-response.dto.ts  [EXISTS]
├── services/
│   ├── prompt-template.service.ts       [NEW - Commit 2]
│   └── prompt-template.service.spec.ts  [NEW - Commit 2]
├── prompt-composer.module.ts            [EXISTS - Update]
├── prompt-composer.service.ts           [EXISTS - Keep]
├── prompt-composer.controller.ts        [EXISTS - Implement endpoints Commit 2]
└── prompt-composer.service.spec.ts      [EXISTS]

apps/server/src/database/migrations/
└── [TIMESTAMP]-CreatePromptTemplatesTable.ts [NEW - Commit 1]
```

---

## Summary

The project follows **strong NestJS conventions** with:
- Clear module boundaries
- Repository pattern with TypeORM
- Comprehensive entity testing
- Git workflow with descriptive commits
- Proper database migrations
- Type-safe DTOs with class-validator

**Prompt-related infrastructure is 70% complete**:
- Core composition logic: IMPLEMENTED
- DTOs: DEFINED
- Template persistence: MISSING (2-commit implementation)
- API endpoints: PLACEHOLDER

The 2-commit decomposition should follow:
1. **Data Layer**: Entity, Migration, Repository
2. **Service & API Layer**: Service, Endpoints, Integration