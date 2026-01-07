# VectorSearchModule

## Overview

The VectorSearchModule provides vector similarity search capabilities for the Hollon-AI platform. It enables efficient semantic search across knowledge items using vector embeddings.

## Module Structure

```
vector-search/
├── services/
│   └── vector-search.service.ts   # Core vector search service
├── vector-search.module.ts        # Module definition
├── index.ts                       # Public exports
└── README.md                      # This file
```

## Module Configuration

The module follows NestJS best practices with proper dependency injection:

```typescript
@Module({
  providers: [VectorSearchService],
  exports: [VectorSearchService],
})
export class VectorSearchModule {}
```

### Exports

- **VectorSearchService** - Exported for use in other modules

## Using VectorSearchService in Other Modules

### 1. Import the Module

Add `VectorSearchModule` to your module's imports:

```typescript
import { Module } from '@nestjs/common';
import { VectorSearchModule } from '@/modules/vector-search';
import { MyService } from './my.service';

@Module({
  imports: [VectorSearchModule],
  providers: [MyService],
})
export class MyModule {}
```

### 2. Inject the Service

Inject `VectorSearchService` into your service or controller:

```typescript
import { Injectable } from '@nestjs/common';
import { VectorSearchService } from '@/modules/vector-search';

@Injectable()
export class MyService {
  constructor(private readonly vectorSearchService: VectorSearchService) {}

  async searchKnowledge(query: string, organizationId: string) {
    return this.vectorSearchService.searchSimilar(query, organizationId, {
      limit: 10,
      threshold: 0.7,
    });
  }
}
```

### 3. Example Controller Usage

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { VectorSearchService } from '@/modules/vector-search';

@Controller('search')
export class SearchController {
  constructor(private readonly vectorSearchService: VectorSearchService) {}

  @Get('similar')
  async searchSimilar(
    @Query('q') query: string,
    @Query('orgId') organizationId: string,
  ) {
    return this.vectorSearchService.searchSimilar(query, organizationId);
  }
}
```

## Service API

### `searchSimilar(query, organizationId, options?)`

Search for similar knowledge items using vector similarity.

**Parameters:**

- `query` (string): The search query text
- `organizationId` (string): The organization ID to search within
- `options` (optional):
  - `limit` (number): Maximum number of results (default: varies)
  - `threshold` (number): Similarity threshold (0-1)
  - `projectId` (string | null): Filter by project ID
  - `teamId` (string | null): Filter by team ID

**Returns:** `Promise<unknown[]>` - Array of knowledge items with similarity scores

### `generateEmbedding(text)`

Generate embeddings for a given text.

**Parameters:**

- `text` (string): The text to generate embeddings for

**Returns:** `Promise<number[]>` - The embedding vector

### `indexItem(itemId, text)`

Index a knowledge item for vector search.

**Parameters:**

- `itemId` (string): The knowledge item ID
- `text` (string): The text content to index

**Returns:** `Promise<void>`

### `removeFromIndex(itemId)`

Remove a knowledge item from the vector index.

**Parameters:**

- `itemId` (string): The knowledge item ID to remove

**Returns:** `Promise<void>`

### `updateIndex(itemId, text)`

Update the vector index for a knowledge item.

**Parameters:**

- `itemId` (string): The knowledge item ID
- `text` (string): The updated text content

**Returns:** `Promise<void>`

## Testing

The module includes comprehensive integration tests that verify:

- ✅ Module setup and configuration
- ✅ Dependency injection functionality
- ✅ Service method availability
- ✅ Basic service behavior

Run integration tests:

```bash
pnpm test:integration vector-search
```

## Implementation Status

⚠️ **Note:** This module currently provides stub implementations. Full functionality will be added in future iterations, including:

- Vector embedding generation (OpenAI, Cohere, etc.)
- Vector database integration (pgvector, Pinecone, etc.)
- Semantic search implementation
- Index management

## Related Modules

- **KnowledgeGraphModule** - Works with vector search for enhanced knowledge retrieval
- **PromptComposerModule** - Can utilize search results for prompt generation
