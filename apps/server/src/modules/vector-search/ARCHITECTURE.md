# VectorSearchService Architecture

## Overview

The VectorSearchService provides semantic search capabilities using vector embeddings. It integrates with embedding providers (OpenAI, etc.) and PostgreSQL's pgvector extension for efficient similarity searches.

## Architecture Design

### Layered Architecture

```
┌─────────────────────────────────────┐
│  Consumer Modules                    │
│  (KnowledgeExtraction, etc.)         │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  VectorSearchService (Business Logic)│
│  - Query generation & execution      │
│  - Document indexing                 │
│  - Provider orchestration            │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  Provider Implementations             │
│  - OpenAI provider                   │
│  - Pluggable interface               │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  Configuration Management             │
│  - VectorSearchConfigService         │
│  - VectorSearchConfig entity          │
│  - Environment integration            │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  Database Layer                      │
│  - VectorEmbedding repository        │
│  - pgvector operations               │
│  - Organization scoping              │
└─────────────────────────────────────┘
```

## Core Components

### 1. VectorSearchService

**Purpose**: Core business logic for vector search operations

**Key Responsibilities**:
- Orchestrate embedding generation and storage
- Execute similarity searches
- Manage document indexing operations
- Handle multi-tenant isolation
- Coordinate with embedding providers

**Public Methods**:

```typescript
// Search operations
searchSimilarVectors(query: string, options: VectorSearchOptions): Promise<VectorSearchResult[]>

// Document management
indexDocument(id, content, sourceType, metadata, options): Promise<VectorEmbedding>
updateDocument(id, sourceType, content, organizationId): Promise<VectorEmbedding>
deleteDocument(id, sourceType, organizationId): Promise<void>

// Batch operations
batchIndexDocuments(documents, sourceType, options): Promise<VectorEmbedding[]>

// Configuration access
getVectorSearchConfig(): Record<string, unknown>
```

**Dependency Injection**:

```typescript
constructor(
  @InjectRepository(VectorEmbedding)
  private readonly embeddingRepo: Repository<VectorEmbedding>,
  private readonly vectorConfigService: VectorSearchConfigService,
  private readonly configService: ConfigService,
)
```

### 2. VectorSearchConfigService

**Purpose**: Configuration management and validation

**Key Responsibilities**:
- Retrieve organization-specific configurations
- Validate configuration parameters
- Create default configurations
- Integrate with environment variables
- Support configuration updates

**Public Methods**:

```typescript
// Configuration retrieval
getConfig(organizationId: string): Promise<VectorSearchConfig>
getDefaultConfig(): Promise<VectorSearchConfig>
getOrCreateConfig(organizationId: string): Promise<VectorSearchConfig>

// Configuration management
validateConfig(config: VectorSearchConfig): Promise<void>
updateConfig(organizationId: string, updates: Partial<VectorSearchConfig>): Promise<VectorSearchConfig>
```

**Configuration Sources** (Priority Order):
1. Organization-specific database configuration
2. Environment variables via ConfigService
3. Built-in defaults

### 3. VectorSearchConfig Entity

**Purpose**: Persistent storage of vector search configuration

**Key Fields**:

```typescript
// Organization & Identity
organizationId: string         // Multi-tenant isolation
displayName: string            // Configuration name

// Provider Configuration
provider: string               // 'openai', 'anthropic', 'local'
embeddingModel: string         // Model identifier
dimensions: number             // Vector dimensions

// API Configuration
config: {
  apiKey?: string             // Provider API key
  apiEndpoint?: string        // API endpoint URL
  batchSize?: number          // Batch processing size
}

// Search Configuration
searchConfig: {
  similarityThreshold?: number // 0-1 threshold
  defaultLimit?: number        // Default results count
  maxLimit?: number            // Maximum results count
  distanceMetric?: string      // 'cosine', 'l2', 'inner_product'
}

// Cost & Performance
costPer1kTokensCents: number   // Cost tracking
timeoutSeconds: number         // Request timeout
maxRetries: number             // Retry attempts
rateLimitConfig?: {            // Rate limiting
  maxRequestsPerMinute?: number
  maxTokensPerMinute?: number
}
```

### 4. VectorEmbedding Entity

**Purpose**: Storage of vector embeddings with metadata

**Key Fields**:

```typescript
embedding: string              // Vector data (pgvector format)
sourceType: EmbeddingSourceType // Type of source (document, task, etc.)
sourceId: string               // ID of source entity
modelType: EmbeddingModelType  // Model used for generation
dimensions: number             // Vector dimensions
content: string | null         // Original text content
metadata?: Record              // Additional metadata
tags?: string[]                // Categorization tags

// Multi-tenant & Scoping
organizationId: string         // Organization scope
projectId?: string             // Project scope
teamId?: string                // Team scope
hollonId?: string              // Agent association
```

## Configuration Flow

### Environment Variables

Configuration is loaded from environment via NestJS ConfigService:

```bash
# Embedding Provider
VECTOR_EMBEDDING_PROVIDER=openai
VECTOR_EMBEDDING_MODEL=text-embedding-3-small
VECTOR_EMBEDDING_DIMENSIONS=1536
VECTOR_EMBEDDING_API_KEY=sk-...

# Batch Processing
VECTOR_EMBEDDING_BATCH_SIZE=100
VECTOR_EMBEDDING_MAX_RETRIES=3
VECTOR_EMBEDDING_TIMEOUT_MS=30000

# Search Defaults
VECTOR_SEARCH_DEFAULT_METRIC=cosine
VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY=0.7
VECTOR_SEARCH_DEFAULT_LIMIT=10
VECTOR_SEARCH_MAX_LIMIT=100

# Index Configuration
VECTOR_INDEX_NAME=vector_embeddings
VECTOR_INDEX_AUTO_CREATE=true
VECTOR_INDEX_LISTS=100
VECTOR_INDEX_PROBES=10

# Performance
VECTOR_PERFORMANCE_ENABLE_CACHE=true
VECTOR_PERFORMANCE_CACHE_TTL_SECONDS=3600
VECTOR_PERFORMANCE_POOL_SIZE=10
```

### Configuration Resolution

When `getOrCreateConfig()` is called:

1. **Check Database**: Look for organization config in `vector_search_configs` table
2. **If Found**: Validate and return
3. **If Not Found**: Create default config from environment variables
4. **Save to Database**: Store for future use
5. **Return**: Configuration object

## Provider Interface

### Extensible Design

Providers are registered via a Map-based plugin system:

```typescript
interface EmbeddingProvider {
  generateEmbedding(text: string, apiKey: string): Promise<number[]>;
  batchGenerateEmbeddings(texts: string[], apiKey: string): Promise<number[][]>;
}
```

### OpenAI Provider Implementation

```typescript
// Built-in OpenAI provider
this.embeddingProviders.set('openai', {
  generateEmbedding: (text, apiKey) => this.generateOpenAIEmbedding(text, apiKey),
  batchGenerateEmbeddings: (texts, apiKey) => this.batchGenerateOpenAIEmbeddings(texts, apiKey)
});
```

### Adding New Providers

To add a new provider:

1. Implement the `EmbeddingProvider` interface
2. Register in `initializeProviders()`
3. Update configuration and environment variables

## Search Query Execution

### Query Building Process

```
1. Parse search options
   ↓
2. Load organization configuration
   ↓
3. Generate query embedding
   ↓
4. Build TypeORM QueryBuilder
   ├── Select fields (sourceId, sourceType, content, metadata)
   ├── Calculate similarity with pgvector <=> operator
   ├── Apply filters (organization, project, team, source types, tags)
   ├── Apply similarity threshold
   ├── Order by similarity DESC
   ├── Limit results
   ↓
5. Execute raw query
   ↓
6. Transform results to VectorSearchResult[]
```

### Multi-Tenant Scoping

All searches are automatically scoped to organization:

```typescript
// Always filtered by organization
.andWhere('embedding.organizationId = :organizationId')

// Optional project/team/type filters
if (options.projectId) { ... }
if (options.teamId) { ... }
if (options.sourceTypes) { ... }
```

## Data Flow Diagrams

### Document Indexing Flow

```
Document Input
  │
  ├─ Validate parameters
  │
  ├─ Load organization config
  │
  ├─ Generate embedding (via provider)
  │
  ├─ Determine model type from config
  │
  ├─ Create VectorEmbedding entity
  │  ├─ Store vector representation
  │  ├─ Store source metadata
  │  ├─ Store tags
  │  └─ Set organization scope
  │
  └─ Save to database
       │
       └─ VectorEmbedding record created
```

### Search Flow

```
Search Query
  │
  ├─ Validate query (non-empty)
  │
  ├─ Load configuration
  │
  ├─ Generate query embedding
  │
  ├─ Build QueryBuilder
  │  ├─ Calculate cosine similarity
  │  ├─ Apply scoping filters
  │  ├─ Apply business filters
  │  ├─ Apply threshold
  │  └─ Order & limit
  │
  ├─ Execute raw query
  │
  └─ Transform results
       │
       └─ VectorSearchResult[]
```

## Error Handling

### Validation Points

1. **Configuration Validation**:
   - Timeout: 5-300 seconds
   - Dimensions: [1536, 3072, 768, 1024, 256]
   - Similarity: 0-1 range
   - Limits: positive, consistent values

2. **Input Validation**:
   - Non-empty search queries
   - Required parameters in indexing
   - Valid organization IDs

3. **Provider Validation**:
   - API key presence
   - Provider support
   - Response format validation

### Exception Types

```typescript
BadRequestException   // Invalid configuration or input
NotFoundException     // Config or embedding not found
Error                 // Provider or database errors
```

## Performance Considerations

### Indexing Optimization

- **Batch Processing**: Documents indexed in configurable batches
- **Default Batch Size**: 100 documents
- **Parallel Processing**: Batch documents processed in parallel

### Search Optimization

- **pgvector Indexes**: IVF (Inverted File) index on vector column
- **Index Parameters**:
  - `lists`: 100 (IVF clusters)
  - `probes`: 10 (search accuracy/speed tradeoff)
- **Query Result Caching**: Optional caching via configuration
- **Cache TTL**: Configurable, default 3600 seconds

### Multi-Tenancy

- **Organization Isolation**: All queries filtered by organization
- **Query Scoping**: ProjectID, TeamID, HollonID for fine-grained access
- **Index Separation**: Shared pgvector index with scoping filters

## Integration Points

### Used By

- **PromptComposerModule**: Retrieve relevant context
- **KnowledgeExtractionModule**: Find related knowledge entries
- **OrchestrationModule**: Context-aware decision making
- **Message Module**: Semantic message search
- **KnowledgeGraphModule**: Similar node/edge discovery

### Provides To

```typescript
// Exported services
providers: [VectorSearchService, VectorSearchConfigService]
exports: [VectorSearchService, VectorSearchConfigService]
```

## Testing Strategy

### Unit Tests

- Configuration validation logic
- Provider initialization
- Search query building
- Error handling

### Integration Tests

- Database operations
- Configuration persistence
- Multi-tenant isolation
- Search result accuracy

### Fixtures

- Sample embeddings
- Test configurations
- Mock providers

## Future Enhancements

### Planned Features

1. **Additional Providers**:
   - Anthropic embeddings
   - Local/open-source models
   - Cohere embeddings

2. **Advanced Search**:
   - Hybrid search (vector + keyword)
   - Faceted search with tags
   - Range queries

3. **Caching Layer**:
   - Redis-based embedding cache
   - Query result caching
   - LRU cache implementation

4. **Monitoring**:
   - Embedding generation metrics
   - Search performance tracking
   - Cost monitoring

5. **Chunking Strategy**:
   - Document chunking before embedding
   - Chunk overlap handling
   - Semantic chunking

## Configuration Reference

See [CONFIGURATION.md](./CONFIGURATION.md) for detailed configuration guide.

## API Reference

See [API.md](./API.md) for complete API documentation.
