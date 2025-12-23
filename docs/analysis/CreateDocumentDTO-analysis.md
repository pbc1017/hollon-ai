# CreateDocumentDTO Structure and Validation Analysis

## Overview
This document provides a comprehensive analysis of the `CreateDocumentDTO` interface used in the Document module of the Hollon AI application. The DTO is located in `apps/server/src/modules/document/document.service.ts`.

## Current DTO Definition

```typescript
export interface CreateDocumentDto {
  title: string;
  content: string;
  type: DocumentType;
  organizationId: string;
  teamId?: string | null;
  projectId?: string | null;
  hollonId?: string | null;
  taskId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}
```

## Field Analysis

### Required Fields

#### 1. **title: string**
- **Type**: String (primitive)
- **Constraints**: None currently enforced
- **Expected Constraints**:
  - Min length: 1-3 characters
  - Max length: 255 characters (matches database column definition)
  - Should not be empty or whitespace-only
  - Should be trimmed
- **Database**: `VARCHAR(255)` in `Document` entity
- **Usage**: Document heading/identifier visible to users

#### 2. **content: string**
- **Type**: String (primitive)
- **Constraints**: None currently enforced
- **Expected Constraints**:
  - Min length: Should allow meaningful content
  - No max length enforced (stored as TEXT in database)
  - Should not be empty
- **Database**: `TEXT` in `Document` entity
- **Usage**: Main document body

#### 3. **type: DocumentType**
- **Type**: Enum (`DocumentType`)
- **Available Values**:
  ```typescript
  enum DocumentType {
    TASK_CONTEXT = 'task_context',
    DECISION_LOG = 'decision_log',
    KNOWLEDGE = 'knowledge',
    DISCUSSION = 'discussion',
    CODE_REVIEW = 'code_review',
  }
  ```
- **Constraints**: Must be one of the enum values
- **Database**: `ENUM` type with default `DocumentType.KNOWLEDGE`
- **Usage**: Categorizes the purpose/nature of the document

#### 4. **organizationId: string**
- **Type**: String (UUID)
- **Constraints**: Must be a valid organization ID
- **Expected Constraints**:
  - Must be a valid UUID v4
  - Must reference existing Organization entity
  - Cannot be null or empty
- **Database**: `VARCHAR` (no length constraint in entity)
- **Relations**: Foreign key reference to `Organization` entity
- **Cascade**: `onDelete: 'CASCADE'`
- **Usage**: Tenant identifier; scopes all documents to an organization

### Optional Fields

#### 5. **teamId?: string | null**
- **Type**: String (UUID) | null
- **Default**: `null` (nullable in DTO)
- **Constraints**: None currently enforced
- **Expected Constraints**:
  - If provided, must be a valid UUID v4
  - Could optionally reference existing Team entity
- **Database**: `UUID` nullable column
- **Note**: Phase 3.5 feature for team-specific knowledge separation
- **Usage**: Enables team-level document scoping (SSOT principle)

#### 6. **projectId?: string | null**
- **Type**: String | null
- **Default**: `null` (nullable in DTO)
- **Constraints**: None currently enforced
- **Expected Constraints**:
  - If provided, must be a valid UUID
  - Could optionally reference existing Project entity
- **Database**: `VARCHAR` nullable column
- **Relations**: Foreign key reference to `Project` entity with cascade delete
- **SSOT Principle**: When `projectId` is NULL, document is organization-wide knowledge (Single Source of Truth)
- **Usage**: Scopes documents to specific projects

#### 7. **hollonId?: string | null**
- **Type**: String (UUID) | null
- **Default**: `null` (nullable in DTO)
- **Constraints**: None currently enforced
- **Expected Constraints**:
  - If provided, must be a valid UUID v4
  - Could optionally reference existing Hollon entity
- **Database**: `UUID` nullable column
- **Relations**: Foreign key reference to `Hollon` entity with `onDelete: 'SET NULL'`
- **Usage**: Associates document with a specific Hollon (AI agent)

#### 8. **taskId?: string | null**
- **Type**: String (UUID) | null (note: optional in DTO without null literal)
- **Default**: `undefined` (optional property)
- **Constraints**: None currently enforced
- **Expected Constraints**:
  - If provided, must be a valid UUID v4
  - Could optionally reference existing Task entity
- **Database**: `UUID` nullable column
- **Usage**: Associates document with a specific Task

#### 9. **tags?: string[]**
- **Type**: String array
- **Default**: `[]` (empty array, defaults to `dto.tags || []` in service)
- **Constraints**: None currently enforced
- **Expected Constraints**:
  - Array should not be empty if provided
  - Each tag should be:
    - Non-empty string
    - 1-50 characters
    - Alphanumeric with hyphens/underscores
    - Lowercase recommended for consistency
  - Max array size: 50 tags
- **Database**: `TEXT[]` (PostgreSQL text array)
- **Indexing**: Has database GIN index for tag-based search optimization
- **Usage**: Enable categorization and search filtering

#### 10. **metadata?: Record<string, unknown>**
- **Type**: JSON object with unknown values
- **Default**: `{}` (empty object, defaults to `dto.metadata || {}` in service)
- **Constraints**: None currently enforced
- **Expected Constraints**:
  - Max object size: 10 KB (reasonable for metadata)
  - Keys should be alphanumeric with underscores
  - Should not contain circular references
  - Common fields:
    - `source?: string` - Origin of the document
    - `version?: number` - Document version
    - `author?: string` - Creator information
    - `keywords?: string[]` - Search keywords
- **Database**: `JSONB` PostgreSQL type
- **Usage**: Store flexible, extensible document metadata

## Nested Structure Analysis

### DocumentType Enum
```typescript
enum DocumentType {
  TASK_CONTEXT = 'task_context',    // Context for task execution
  DECISION_LOG = 'decision_log',      // Record of decisions made
  KNOWLEDGE = 'knowledge',            // General knowledge base
  DISCUSSION = 'discussion',          // Discussion threads
  CODE_REVIEW = 'code_review',        // Code review documentation
}
```

Each type has different usage patterns and business logic implications.

## Validation Gaps

### Current State
The DTO is a TypeScript interface with **no class-validator decorators**. This means:
- No client-side validation
- No server-side DTO validation
- No automatic API documentation (Swagger/OpenAPI)

### Critical Gaps to Address

1. **String Constraints Missing**
   - `title` needs length validation (min: 1, max: 255)
   - `content` needs non-empty validation
   - Tags need individual validation

2. **UUID Validation Missing**
   - `organizationId` should validate UUID format
   - `teamId`, `hollonId`, `taskId` should validate UUID format when provided

3. **Enum Validation Missing**
   - `type` field should be validated against DocumentType enum

4. **Business Logic Validation Missing**
   - Conditional validation: if `taskId` is provided, `type` should be `TASK_CONTEXT`
   - If `projectId` is provided, it should reference valid Project
   - If `hollonId` is provided, it should reference valid Hollon

5. **Array Validation Missing**
   - `tags` array size constraints
   - Individual tag format validation

6. **Metadata Validation Missing**
   - Type safety for metadata structure
   - Size constraints

## Database Integration Points

### Entity Constraints
The `Document` entity enforces:
- `title`: `@Column({ length: 255 })`
- `content`: `@Column({ type: 'text' })`
- `type`: `@Column({ type: 'enum', enum: DocumentType, default: DocumentType.KNOWLEDGE })`
- `tags`: `@Column({ type: 'text', array: true, nullable: true })`
- `metadata`: `@Column({ type: 'jsonb', nullable: true })`

### Database Indexes
- `organizationId` - Single index
- `[projectId, type]` - Composite index
- `hollonId` - Single index
- `[type, organizationId]` - Composite index (Phase 3.5)
- `tags` - GIN index (configured in migration)

## Relationships and Cascade Rules

| Foreign Key | Entity | Cascade Rule | Usage |
|---|---|---|---|
| `organizationId` | Organization | CASCADE | Document deleted when org deleted |
| `projectId` | Project | CASCADE | Document deleted when project deleted |
| `hollonId` | Hollon | SET NULL | Hollon reference cleared if Hollon deleted |
| N/A | Task | No FK defined | Only taskId stored, no constraints |
| N/A | Team | No FK defined | Only teamId stored, no constraints |

## Service Integration

### Create Method
```typescript
async create(dto: CreateDocumentDto): Promise<Document> {
  const document = this.documentRepo.create({
    title: dto.title,
    content: dto.content,
    type: dto.type,
    organizationId: dto.organizationId,
    teamId: dto.teamId ?? null,
    projectId: dto.projectId ?? null,
    hollonId: dto.hollonId ?? null,
    taskId: dto.taskId ?? null,
    tags: dto.tags || [],
    metadata: dto.metadata || {},
  });
  return this.documentRepo.save(document);
}
```

- No pre-validation performed
- Defaults applied at service level (should be in DTO)
- No null coalescing in DTO itself

## Recommendations for Enhancement

### Phase 1: Add class-validator Decorators
```typescript
import { IsString, IsUUID, IsEnum, IsOptional, IsArray, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @IsString()
  @MinLength(1)
  content: string;

  @IsEnum(DocumentType)
  type: DocumentType;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsUUID()
  teamId?: string | null;

  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @IsUUID()
  hollonId?: string | null;

  @IsOptional()
  @IsUUID()
  taskId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @MinLength(1, { each: true })
  @ArrayMaxSize(50)
  tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
```

### Phase 2: Convert to Class and Move to Separate File
- Create `apps/server/src/modules/document/dto/create-document.dto.ts`
- Convert from interface to class
- Add full validation decorators

### Phase 3: Add Custom Validators
- Validate organizational ownership
- Validate project existence
- Validate task/hollon references
- Add tag format validation

### Phase 4: Update Service
- Remove manual null-coalescing
- Add error handling for validation failures
- Add pre-save business logic validation

## Usage Examples

### Valid Creation Request
```typescript
const dto: CreateDocumentDto = {
  title: "API Documentation",
  content: "Comprehensive API documentation...",
  type: DocumentType.KNOWLEDGE,
  organizationId: "550e8400-e29b-41d4-a716-446655440000",
  projectId: "650e8400-e29b-41d4-a716-446655440000",
  tags: ["api", "documentation", "v1"],
  metadata: {
    source: "internal",
    version: 1,
  }
};
```

### Minimal Creation Request
```typescript
const dto: CreateDocumentDto = {
  title: "Task Notes",
  content: "Quick notes about the task...",
  type: DocumentType.TASK_CONTEXT,
  organizationId: "550e8400-e29b-41d4-a716-446655440000",
};
```

## Testing Considerations

The `DocumentFactory` test fixture shows expected usage patterns:
- Documents are created with unique titles (UUID prefix)
- Type defaults to `DocumentType.KNOWLEDGE`
- Tags default to `['test']`
- Metadata defaults to `{}`
- SSOT knowledge documents require `organizationId` and `projectId`

## SSOT Principle (Single Source of Truth)

As mentioned in service comments:
- When `projectId` is NULL → Document is organization-wide knowledge
- Organization-level documents are retrieved via `findOrganizationKnowledge()`
- Project-level documents are scoped via `findProjectDocuments()`
- Phase 3.5 enhancement adds team-level scoping with `teamId`

## Summary

The `CreateDocumentDTO` is currently a simple TypeScript interface lacking validation decorators and constraints. While it maps well to the `Document` entity structure, it needs enhancement to:

1. Add class-validator decorators for input validation
2. Enforce string length and format constraints
3. Add UUID validation for ID fields
4. Support custom business logic validation
5. Move to a dedicated DTO file following project conventions
6. Add comprehensive error messages for validation failures

This analysis provides the foundation for implementing these improvements in subsequent phases.
