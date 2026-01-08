# VectorSearchService API Documentation

## Service Methods

### VectorSearchService

Core service for vector search operations.

#### searchSimilarVectors

Search for semantically similar vectors based on a query string.

```typescript
async searchSimilarVectors(
  query: string,
  options?: VectorSearchOptions
): Promise<VectorSearchResult[]>
```

**Parameters**:

- `query` (string, required): The search query text. Must not be empty.
- `options` (VectorSearchOptions, optional):
  - `organizationId`: (string) Organization for multi-tenant filtering
  - `projectId`: (string) Filter by project
  - `teamId`: (string) Filter by team
  - `sourceTypes`: (EmbeddingSourceType[]) Filter by source type
  - `similarityThreshold`: (number, 0-1) Minimum similarity score
  - `limit`: (number) Maximum results to return
  - `tags`: (string[]) Filter by tags

**Returns**: Promise<VectorSearchResult[]>

**Result Format**:

```typescript
{
  sourceId: string;           // ID of the matching document
  sourceType: EmbeddingSourceType;  // Type of source
  similarity: number;         // Score 0-1 (higher = more similar)
  content: string;            // Original text content
  metadata?: Record<string, unknown>;  // Additional metadata
}
```

**Examples**:

```typescript
// Simple search
const results = await vectorSearchService.searchSimilarVectors(
  'How to deploy?'
);

// With filtering
const results = await vectorSearchService.searchSimilarVectors(
  'How to deploy?',
  {
    organizationId: 'org-123',
    projectId: 'proj-456',
    sourceTypes: [EmbeddingSourceType.DOCUMENT],
    similarityThreshold: 0.8,
    limit: 5
  }
);

// By team
const results = await vectorSearchService.searchSimilarVectors(
  'latest progress',
  {
    organizationId: 'org-123',
    teamId: 'team-789',
    limit: 10
  }
);
```

**Error Cases**:

- Empty query: Throws `Error('Search query cannot be empty')`
- No config found: Throws `NotFoundException`
- Provider error: Throws error from embedding provider

---

#### indexDocument

Index a document for vector search.

```typescript
async indexDocument(
  id: string,
  content: string,
  sourceType: EmbeddingSourceType,
  metadata?: Record<string, unknown>,
  options: {
    organizationId: string;
    projectId?: string;
    teamId?: string;
    hollonId?: string;
    tags?: string[];
  }
): Promise<VectorEmbedding>
```

**Parameters**:

- `id` (string, required): Unique identifier for the document
- `content` (string, required): Text content to be embedded
- `sourceType` (EmbeddingSourceType, required): Type of the source entity
- `metadata` (Record, optional): Additional metadata to store with embedding
- `options` (required):
  - `organizationId`: (string) Organization scope
  - `projectId`: (string) Project association (optional)
  - `teamId`: (string) Team association (optional)
  - `hollonId`: (string) Agent association (optional)
  - `tags`: (string[]) Categorization tags (optional)

**Returns**: Promise<VectorEmbedding>

**Stored Data**:

```typescript
{
  id: UUID;                          // Generated UUID
  embedding: string;                 // Vector in pgvector format
  sourceId: string;                  // Your document ID
  sourceType: EmbeddingSourceType;   // Your source type
  modelType: EmbeddingModelType;     // Model used
  dimensions: number;                // Vector dimensions
  content: string;                   // Original text
  metadata: Record;                  // Your metadata
  tags?: string[];                   // Your tags
  organizationId: string;            // Organization scope
  projectId?: string;                // Project scope
  teamId?: string;                   // Team scope
  hollonId?: string;                 // Agent association
  createdAt: Date;                   // Creation timestamp
  updatedAt: Date;                   // Last update timestamp
}
```

**Examples**:

```typescript
// Index a document
const embedding = await vectorSearchService.indexDocument(
  'doc-123',
  'The system provides semantic search capabilities...',
  EmbeddingSourceType.DOCUMENT,
  { source_url: 'https://...' },
  {
    organizationId: 'org-123'
  }
);

// Index a task with tags
const embedding = await vectorSearchService.indexDocument(
  'task-456',
  'Implement user authentication system',
  EmbeddingSourceType.TASK,
  { priority: 'high' },
  {
    organizationId: 'org-123',
    projectId: 'proj-789',
    tags: ['backend', 'security', 'authentication']
  }
);

// Index with hollon association
const embedding = await vectorSearchService.indexDocument(
  'msg-789',
  'Meeting notes from sprint planning...',
  EmbeddingSourceType.MESSAGE,
  { channel: 'general' },
  {
    organizationId: 'org-123',
    teamId: 'team-456',
    hollonId: 'hollon-789'
  }
);
```

**Error Cases**:

- Missing required parameters: Throws `Error('Missing required parameters...')`
- Invalid sourceType: Throws error from TypeORM
- Provider error: Throws error from embedding provider

---

#### updateDocument

Update an existing document's embedding with new content.

```typescript
async updateDocument(
  id: string,
  sourceType: EmbeddingSourceType,
  content: string,
  organizationId: string
): Promise<VectorEmbedding>
```

**Parameters**:

- `id` (string, required): Source ID of the document
- `sourceType` (EmbeddingSourceType, required): Source type
- `content` (string, required): Updated text content
- `organizationId` (string, required): Organization scope

**Returns**: Promise<VectorEmbedding>

**Notes**:
- Finds existing embedding by id, sourceType, and organizationId
- Regenerates embedding with new content
- Preserves existing metadata and relationships
- Updates timestamp

**Examples**:

```typescript
// Update a document's content
const updated = await vectorSearchService.updateDocument(
  'doc-123',
  EmbeddingSourceType.DOCUMENT,
  'Updated content with new information...',
  'org-123'
);

// Update a task description
const updated = await vectorSearchService.updateDocument(
  'task-456',
  EmbeddingSourceType.TASK,
  'Implement OAuth 2.0 authentication flow',
  'org-123'
);
```

**Error Cases**:

- Missing parameters: Throws `Error('Missing required parameters...')`
- Embedding not found: Throws `Error('Embedding not found for...')`
- Provider error: Throws error from embedding provider

---

#### deleteDocument

Delete a document from the vector index.

```typescript
async deleteDocument(
  id: string,
  sourceType: EmbeddingSourceType,
  organizationId: string
): Promise<void>
```

**Parameters**:

- `id` (string, required): Source ID to delete
- `sourceType` (EmbeddingSourceType, required): Source type
- `organizationId` (string, required): Organization scope

**Returns**: Promise<void>

**Examples**:

```typescript
// Delete a document
await vectorSearchService.deleteDocument(
  'doc-123',
  EmbeddingSourceType.DOCUMENT,
  'org-123'
);

// Delete a task embedding
await vectorSearchService.deleteDocument(
  'task-456',
  EmbeddingSourceType.TASK,
  'org-123'
);
```

**Error Cases**:

- Missing parameters: Throws `Error('Missing required parameters...')`
- Database error: Throws TypeORM error

---

#### batchIndexDocuments

Efficiently index multiple documents in a batch operation.

```typescript
async batchIndexDocuments(
  documents: Array<{
    id: string;
    content: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }>,
  sourceType: EmbeddingSourceType,
  options: {
    organizationId: string;
    projectId?: string;
    teamId?: string;
    hollonId?: string;
  }
): Promise<VectorEmbedding[]>
```

**Parameters**:

- `documents` (array, required): Array of documents to index
  - Each document must have `id` and `content`
  - Optional: `metadata`, `tags`
- `sourceType` (EmbeddingSourceType, required): Type for all documents
- `options` (required): Scoping options (same as indexDocument)

**Returns**: Promise<VectorEmbedding[]>

**Processing**:
- Documents processed in configurable batches (default: 100)
- Each batch processed in parallel
- Returns all created embeddings

**Examples**:

```typescript
// Batch index documents
const embeddings = await vectorSearchService.batchIndexDocuments(
  [
    {
      id: 'doc-1',
      content: 'First document content...',
      metadata: { chapter: 1 },
      tags: ['chapter', 'intro']
    },
    {
      id: 'doc-2',
      content: 'Second document content...',
      metadata: { chapter: 2 },
      tags: ['chapter', 'main']
    },
    // ... more documents
  ],
  EmbeddingSourceType.DOCUMENT,
  {
    organizationId: 'org-123',
    projectId: 'proj-456'
  }
);

// Batch index tasks
const taskEmbeddings = await vectorSearchService.batchIndexDocuments(
  tasks.map(task => ({
    id: task.id,
    content: task.description,
    metadata: { priority: task.priority },
    tags: task.tags
  })),
  EmbeddingSourceType.TASK,
  {
    organizationId: 'org-123',
    projectId: 'proj-456'
  }
);
```

**Error Cases**:

- Empty documents array: Throws `Error('Documents array cannot be empty')`
- Provider error: Throws error from embedding provider
- Database error: Throws TypeORM error

---

#### getVectorSearchConfig

Get vector search configuration from ConfigService.

```typescript
getVectorSearchConfig(): Record<string, unknown>
```

**Parameters**: None

**Returns**: Record<string, unknown>

Configuration object structure:

```typescript
{
  enabled: boolean;
  embedding: {
    provider: string;
    model: string;
    dimensions: number;
    apiKey?: string;
    batchSize: number;
    maxRetries: number;
    timeoutMs: number;
  };
  search: {
    defaultMetric: string;
    defaultMinSimilarity: number;
    defaultLimit: number;
    maxLimit: number;
    includeScoresByDefault: boolean;
  };
  index: {
    name: string;
    autoCreate: boolean;
    lists: number;
    probes: number;
  };
  performance: {
    enableCache: boolean;
    cacheTtlSeconds: number;
    poolSize: number;
  };
}
```

**Examples**:

```typescript
// Get config
const config = vectorSearchService.getVectorSearchConfig();
console.log('Provider:', config.embedding.provider);
console.log('Model:', config.embedding.model);
```

---

### VectorSearchConfigService

Configuration management service.

#### getConfig

Get configuration for a specific organization.

```typescript
async getConfig(organizationId: string): Promise<VectorSearchConfig>
```

**Parameters**:

- `organizationId` (string, required): UUID of organization

**Returns**: Promise<VectorSearchConfig>

**Throws**:
- `BadRequestException`: If organizationId is empty
- `NotFoundException`: If no enabled config found

---

#### getDefaultConfig

Get system-wide default configuration.

```typescript
async getDefaultConfig(): Promise<VectorSearchConfig>
```

**Parameters**: None

**Returns**: Promise<VectorSearchConfig>

**Behavior**:
- Returns first enabled configuration in database
- If none found, returns environment-based configuration
- Falls back to built-in defaults

---

#### getOrCreateConfig

Get configuration or create default if not exists.

```typescript
async getOrCreateConfig(organizationId: string): Promise<VectorSearchConfig>
```

**Parameters**:

- `organizationId` (string, required): UUID of organization

**Returns**: Promise<VectorSearchConfig>

**Behavior**:
1. Attempt to get organization-specific config
2. If not found, create default from environment
3. Save created config to database
4. Return configuration

This is the recommended method for most use cases.

---

#### validateConfig

Validate configuration parameters.

```typescript
async validateConfig(config: VectorSearchConfig): Promise<void>
```

**Parameters**:

- `config` (VectorSearchConfig, required): Configuration to validate

**Throws**: `BadRequestException` if validation fails

**Validation Rules**:
- Timeout: 5-300 seconds
- Dimensions: [1536, 3072, 768, 1024, 256]
- Cost: >= 0
- Similarity: 0-1
- Limits: positive and consistent
- API key: required if enabled

---

#### updateConfig

Update organization configuration.

```typescript
async updateConfig(
  organizationId: string,
  updates: Partial<VectorSearchConfig>
): Promise<VectorSearchConfig>
```

**Parameters**:

- `organizationId` (string, required): UUID of organization
- `updates` (Partial<VectorSearchConfig>, required): Fields to update

**Returns**: Promise<VectorSearchConfig>

**Updatable Fields**:
- `embeddingModel`
- `dimensions`
- `searchConfig`
- `timeoutSeconds`
- `maxRetries`

**Examples**:

```typescript
// Update search threshold
const updated = await vectorConfigService.updateConfig(
  'org-123',
  {
    searchConfig: {
      similarityThreshold: 0.8,
      defaultLimit: 20
    }
  }
);

// Update timeout
const updated = await vectorConfigService.updateConfig(
  'org-123',
  {
    timeoutSeconds: 60
  }
);
```

---

## Data Types

### VectorSearchResult

```typescript
interface VectorSearchResult {
  sourceId: string;              // Document ID
  sourceType: EmbeddingSourceType;  // Type of source
  similarity: number;            // 0-1 score
  content: string;               // Original text
  metadata?: Record<string, unknown>;  // Additional data
}
```

### VectorSearchOptions

```typescript
interface VectorSearchOptions {
  organizationId?: string;
  projectId?: string;
  teamId?: string;
  sourceTypes?: EmbeddingSourceType[];
  similarityThreshold?: number;  // 0-1
  limit?: number;
  tags?: string[];
}
```

### EmbeddingSourceType

```typescript
enum EmbeddingSourceType {
  DOCUMENT = 'document',
  TASK = 'task',
  MESSAGE = 'message',
  KNOWLEDGE_ITEM = 'knowledge_item',
  CODE_SNIPPET = 'code_snippet',
  DECISION_LOG = 'decision_log',
  MEETING_RECORD = 'meeting_record',
  GRAPH_NODE = 'graph_node',
  CUSTOM = 'custom'
}
```

### EmbeddingModelType

```typescript
enum EmbeddingModelType {
  OPENAI_ADA_002 = 'openai_ada_002',
  OPENAI_SMALL_3 = 'openai_small_3',
  OPENAI_LARGE_3 = 'openai_large_3',
  COHERE_ENGLISH_V3 = 'cohere_english_v3',
  CUSTOM = 'custom'
}
```

---

## Usage Examples

### Complete Workflow

```typescript
import {
  VectorSearchService,
  VectorSearchConfigService,
  EmbeddingSourceType,
  VectorSearchResult
} from '@modules/vector-search';

// Inject services
constructor(
  private vectorSearchService: VectorSearchService,
  private vectorConfigService: VectorSearchConfigService
) {}

// 1. Index documents
async indexDocuments() {
  const embedding = await this.vectorSearchService.indexDocument(
    'doc-123',
    'Document content here...',
    EmbeddingSourceType.DOCUMENT,
    { url: 'https://...' },
    { organizationId: 'org-123' }
  );
}

// 2. Search for similar content
async searchDocuments() {
  const results: VectorSearchResult[] = 
    await this.vectorSearchService.searchSimilarVectors(
    'What is vector search?',
    {
      organizationId: 'org-123',
      similarityThreshold: 0.7,
      limit: 10
    }
  );

  results.forEach(result => {
    console.log(`${result.sourceId}: ${result.similarity.toFixed(2)}`);
  });
}

// 3. Update content
async updateDocument() {
  const updated = await this.vectorSearchService.updateDocument(
    'doc-123',
    EmbeddingSourceType.DOCUMENT,
    'Updated content...',
    'org-123'
  );
}

// 4. Remove from index
async deleteDocument() {
  await this.vectorSearchService.deleteDocument(
    'doc-123',
    EmbeddingSourceType.DOCUMENT,
    'org-123'
  );
}

// 5. Batch operations
async batchProcess() {
  const docs = [
    { id: '1', content: 'Content 1' },
    { id: '2', content: 'Content 2' },
    // ... more
  ];

  const embeddings = await this.vectorSearchService.batchIndexDocuments(
    docs,
    EmbeddingSourceType.DOCUMENT,
    { organizationId: 'org-123' }
  );
}
```

### Integration with Other Modules

```typescript
// In KnowledgeExtractionModule
async extractAndIndex() {
  const knowledge = await this.extractKnowledge(content);

  // Index for search
  await this.vectorSearchService.indexDocument(
    knowledge.id,
    knowledge.content,
    EmbeddingSourceType.KNOWLEDGE_ITEM,
    { extractedAt: new Date() },
    { organizationId: this.orgId }
  );
}

// In PromptComposerModule
async enrichContext() {
  const relevant = await this.vectorSearchService.searchSimilarVectors(
    userContext,
    { organizationId: this.orgId, limit: 5 }
  );

  return {
    context: userContext,
    relatedDocuments: relevant
  };
}
```

---

## Performance Notes

### Search Performance

- Typical latency: 50-200ms for searches on 1M+ documents
- Index type: IVF (pgvector)
- Search speed improves with better indexing tuning

### Indexing Performance

- Batch size: 100 documents (configurable)
- Typical throughput: 1000-5000 documents/minute
- Batch size affects memory usage vs. throughput

### Memory Usage

- Service maintains in-memory provider cache
- Vector data stored in PostgreSQL
- Consider `VECTOR_PERFORMANCE_POOL_SIZE` for production

---

## Error Handling

### Common Errors

```typescript
try {
  const results = await vectorSearchService.searchSimilarVectors(query);
} catch (error) {
  if (error instanceof NotFoundException) {
    // Configuration not found
  } else if (error instanceof BadRequestException) {
    // Invalid input
  } else {
    // Provider or database error
  }
}
```

### Retry Strategy

The service includes built-in retry logic for API calls:

```typescript
// Configured via environment
VECTOR_EMBEDDING_MAX_RETRIES=3           // Number of retries
VECTOR_EMBEDDING_TIMEOUT_MS=30000        // Timeout per attempt
```

Exponential backoff is recommended in calling code.

---

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [CONFIGURATION.md](./CONFIGURATION.md) - Configuration reference
