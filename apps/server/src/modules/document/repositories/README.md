# KnowledgeRepository

A specialized repository service for managing knowledge documents in the Hollon AI system.

## Overview

The `KnowledgeRepository` provides a type-safe, transaction-aware interface for CRUD operations on knowledge documents. It leverages TypeORM's query builder for complex queries and ensures all operations are properly scoped to `DocumentType.KNOWLEDGE`.

## Features

- ✅ **Full CRUD Operations** - Create, read, update, and delete with proper error handling
- ✅ **Bulk Operations** - Transaction-safe bulk insert and delete operations
- ✅ **Metadata Search** - JSONB-based metadata queries for flexible filtering
- ✅ **Tag Search** - Support for both AND/OR tag matching logic
- ✅ **Relationship Queries** - Find documents by organization, project, team, hollon, or task
- ✅ **Complex Queries** - Multi-relation filtering with sophisticated query building
- ✅ **Pagination** - Built-in pagination support with total counts
- ✅ **Transactions** - All write operations use transactions for data consistency
- ✅ **Type Safety** - Full TypeScript support with proper typing

## Installation

The repository is automatically available when you import the `DocumentModule`:

```typescript
import { DocumentModule } from '@/modules/document/document.module';

@Module({
  imports: [DocumentModule],
})
export class YourModule {}
```

## Usage

### Basic Injection

```typescript
import { Injectable } from '@nestjs/common';
import { KnowledgeRepository } from '@/modules/document/repositories/knowledge.repository';

@Injectable()
export class YourService {
  constructor(private readonly knowledgeRepo: KnowledgeRepository) {}
}
```

### CRUD Operations

#### Create a Knowledge Document

```typescript
const document = await this.knowledgeRepo.create({
  title: 'API Documentation',
  content: 'REST API endpoints...',
  organizationId: 'org-123',
  projectId: 'proj-456',
  tags: ['api', 'documentation'],
  metadata: {
    category: 'technical',
    version: '1.0',
  },
});
```

#### Find by ID

```typescript
const document = await this.knowledgeRepo.findById('doc-id');
// Throws NotFoundException if not found
```

#### Update a Document

```typescript
const updated = await this.knowledgeRepo.update('doc-id', {
  title: 'Updated Title',
  content: 'Updated content',
  tags: ['api', 'documentation', 'v2'],
});
```

#### Delete a Document

```typescript
await this.knowledgeRepo.delete('doc-id');
```

### Bulk Operations

#### Bulk Insert

```typescript
const documents = await this.knowledgeRepo.bulkInsert([
  {
    title: 'Doc 1',
    content: 'Content 1',
    organizationId: 'org-123',
  },
  {
    title: 'Doc 2',
    content: 'Content 2',
    organizationId: 'org-123',
  },
]);
```

#### Bulk Delete

```typescript
await this.knowledgeRepo.bulkDelete(['doc-1', 'doc-2', 'doc-3']);
```

### Search Operations

#### Search by Organization

```typescript
// Get all org-level knowledge (projectId = null)
const orgKnowledge = await this.knowledgeRepo.findByOrganization('org-123', {
  projectId: null,
  limit: 50,
});

// Get project-specific knowledge
const projectKnowledge = await this.knowledgeRepo.findByOrganization('org-123', {
  projectId: 'proj-456',
  teamId: 'team-789',
});
```

#### Search by Metadata

```typescript
const documents = await this.knowledgeRepo.searchByMetadata(
  'org-123',
  {
    category: 'technical',
    status: 'reviewed',
    version: '2.0',
  },
  {
    limit: 20,
    projectId: 'proj-456',
  },
);
```

#### Search by Tags

```typescript
// OR logic: documents with ANY of the tags
const docsWithAnyTag = await this.knowledgeRepo.searchByTags(
  'org-123',
  ['api', 'database', 'security'],
  { matchAll: false },
);

// AND logic: documents with ALL of the tags
const docsWithAllTags = await this.knowledgeRepo.searchByTags(
  'org-123',
  ['api', 'public'],
  { matchAll: true },
);
```

### Relationship Queries

#### Find by Hollon

```typescript
const hollonDocs = await this.knowledgeRepo.findByHollon('hollon-123', {
  limit: 10,
});
```

#### Find by Task

```typescript
const taskDocs = await this.knowledgeRepo.findByTask('task-123');
```

#### Find by Project (with relations)

```typescript
const projectDocs = await this.knowledgeRepo.findByProject('proj-123', {
  includeRelations: true, // Loads organization, project, hollon
  limit: 50,
});
```

#### Complex Multi-Relation Query

```typescript
const documents = await this.knowledgeRepo.findByMultipleRelations({
  organizationId: 'org-123',
  projectIds: ['proj-1', 'proj-2'],
  teamIds: ['team-1', 'team-2'],
  hollonIds: ['hollon-1'],
  tags: ['critical', 'security'],
  limit: 100,
});
```

### Pagination

#### Simple Pagination

```typescript
const result = await this.knowledgeRepo.findWithPagination(
  'org-123',
  1, // page
  20, // pageSize
  {
    projectId: 'proj-456',
    tags: ['api'],
  },
);

console.log(result.data); // Document[]
console.log(result.total); // Total count
console.log(result.page); // Current page
console.log(result.pageSize); // Page size
```

### Counting

```typescript
// Count all knowledge docs in organization
const total = await this.knowledgeRepo.countByOrganization('org-123');

// Count org-level knowledge only
const orgLevel = await this.knowledgeRepo.countByOrganization('org-123', {
  projectId: null,
});

// Count by team
const teamCount = await this.knowledgeRepo.countByOrganization('org-123', {
  teamId: 'team-123',
});
```

## Advanced Patterns

### RAG (Retrieval-Augmented Generation)

```typescript
// Store embeddings
await this.knowledgeRepo.create({
  title: 'API Guide',
  content: 'Complete API documentation...',
  organizationId: 'org-123',
  embedding: vectorEmbeddingString,
  metadata: {
    embeddingModel: 'text-embedding-ada-002',
    vectorDimensions: 1536,
  },
});

// Later: Implement similarity search in a custom method
```

### Team Knowledge Isolation

```typescript
// Team-scoped knowledge
const teamKnowledge = await this.knowledgeRepo.findByOrganization('org-123', {
  teamId: 'team-123',
  projectId: null, // Team-level, not project-specific
});
```

### Knowledge Lifecycle

```typescript
// Create knowledge from task completion
const taskResult = await this.taskService.complete(taskId);

await this.knowledgeRepo.create({
  title: `Learnings: ${taskResult.title}`,
  content: taskResult.summary,
  organizationId: task.organizationId,
  projectId: task.projectId,
  taskId: task.id,
  hollonId: task.assignedHollonId,
  tags: ['lesson-learned', taskResult.category],
  metadata: {
    source: 'task-completion',
    complexity: task.complexity,
  },
});
```

## Error Handling

The repository throws standard NestJS exceptions:

- `NotFoundException`: When a document is not found
- Transaction errors are propagated from TypeORM

Example:

```typescript
try {
  const doc = await this.knowledgeRepo.findById('invalid-id');
} catch (error) {
  if (error instanceof NotFoundException) {
    // Handle not found
  }
  throw error;
}
```

## Testing

The repository includes comprehensive unit tests. Run them with:

```bash
pnpm test knowledge.repository.spec.ts
```

### Test Coverage

- ✅ CRUD operations
- ✅ Bulk operations
- ✅ Metadata and tag search
- ✅ Relationship queries
- ✅ Pagination
- ✅ Error handling
- ✅ Transaction behavior

## Performance Considerations

### Indexes

The Document entity has indexes on:
- `organizationId`
- `projectId + type`
- `hollonId`
- `type + organizationId`
- `tags` (GIN index for array operations)

### Query Optimization

- Use `limit` and `offset` for large result sets
- Use pagination for user-facing queries
- Metadata queries use JSONB containment operators (`@>`) which are indexed
- Tag queries use array operators (`&&` for OR, `@>` for AND)

### Bulk Operations

Bulk insert and delete operations use transactions, which are atomic but may be slower for very large datasets (>1000 records). For massive imports, consider:
- Batching in chunks of 500-1000
- Using raw SQL for extreme cases

## Architecture

```
DocumentModule
├── entities/
│   └── document.entity.ts (Document entity with KNOWLEDGE type)
├── repositories/
│   ├── knowledge.repository.ts (This repository)
│   ├── knowledge.repository.spec.ts (Unit tests)
│   └── README.md (This file)
└── document.service.ts (Legacy service, still available)
```

## Migration from DocumentService

If you're using `DocumentService`, you can gradually migrate:

```typescript
// Old way
const docs = await this.documentService.findOrganizationKnowledge(
  orgId,
  { type: DocumentType.KNOWLEDGE }
);

// New way (more explicit, better typed)
const docs = await this.knowledgeRepo.findByOrganization(orgId);
```

Benefits:
- Better type safety
- Transaction support
- More flexible querying
- Clearer method names
- Dedicated to knowledge documents

## Contributing

When adding new methods:
1. Add the method to `knowledge.repository.ts`
2. Add comprehensive tests to `knowledge.repository.spec.ts`
3. Update this README with usage examples
4. Ensure TypeScript types are properly defined

## License

Part of the Hollon AI project.
