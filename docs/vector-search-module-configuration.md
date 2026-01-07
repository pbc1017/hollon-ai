# VectorSearchModule Configuration Guide

## Overview

The VectorSearchModule provides vector-based semantic search capabilities using pgvector, enabling similarity searches across documents, messages, and knowledge base content. This document details the module's structure, configuration requirements, and environment variables.

## Module Structure

### Exported Providers

The VectorSearchModule exports two main services:

1. **VectorSearchService** - Core business logic for vector search operations
2. **VectorSearchConfigService** - Organization-specific configuration management

### Module Dependencies

- **TypeOrmModule** - Manages two entities:
  - `VectorSearchConfig` - Organization-specific vector search settings
  - `VectorEmbedding` - Stored vector embeddings with metadata
- **ConfigModule** - Provides access to environment-based configuration

### Key Entities

#### VectorSearchConfig Entity
Stores organization-specific configuration for vector search operations:
- Provider settings (OpenAI, Anthropic, Cohere, etc.)
- Embedding model configuration
- Search parameters (thresholds, limits)
- Cost tracking
- Rate limiting

#### VectorEmbedding Entity
Stores vector embeddings for semantic search:
- Vector data (pgvector format)
- Source information (type, ID)
- Model metadata
- Multi-tenant isolation (organization, project, team, hollon)
- Searchable tags and metadata

## Configuration Requirements

### Required Environment Variables

#### Core Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | **Yes** (when using OpenAI) | - | OpenAI API key for embedding generation. Used by default when provider is 'openai' |

#### Vector Search Feature Toggle

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VECTOR_SEARCH_ENABLED` | No | `true` (dev/prod), `false` (test) | Enable/disable vector search functionality |

#### Embedding Provider Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VECTOR_EMBEDDING_PROVIDER` | No | `openai` | Embedding provider: `openai`, `anthropic`, or `local` |
| `VECTOR_EMBEDDING_MODEL` | No | `text-embedding-3-small` | Model identifier for embeddings |
| `VECTOR_EMBEDDING_DIMENSIONS` | No | `1536` (OpenAI), `1024` (Anthropic), `768` (Local) | Dimension of embedding vectors |
| `VECTOR_EMBEDDING_API_KEY` | No | Uses `OPENAI_API_KEY` | Optional: Override API key for non-OpenAI providers |
| `VECTOR_EMBEDDING_BATCH_SIZE` | No | `100` | Batch size for embedding generation |
| `VECTOR_EMBEDDING_MAX_RETRIES` | No | `3` | Maximum retry attempts for failed requests |
| `VECTOR_EMBEDDING_TIMEOUT_MS` | No | `30000` | Timeout for embedding requests (milliseconds) |

#### Search Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VECTOR_SEARCH_DEFAULT_METRIC` | No | `cosine` | Similarity metric: `cosine`, `euclidean`, `dot_product`, or `inner_product` |
| `VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY` | No | `0.7` | Minimum similarity threshold (0.0 to 1.0) |
| `VECTOR_SEARCH_DEFAULT_LIMIT` | No | `10` | Default number of results to return |
| `VECTOR_SEARCH_MAX_LIMIT` | No | `100` | Maximum allowed limit for search results |
| `VECTOR_SEARCH_INCLUDE_SCORES_BY_DEFAULT` | No | `true` | Include similarity scores in results by default |

#### Index Configuration (pgvector)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VECTOR_INDEX_NAME` | No | `vector_embeddings` | Name/identifier for the vector index |
| `VECTOR_INDEX_AUTO_CREATE` | No | `true` (dev), `false` (prod) | Auto-create index if it doesn't exist |
| `VECTOR_INDEX_LISTS` | No | `100` | Number of lists for IVF index (pgvector) |
| `VECTOR_INDEX_PROBES` | No | `10` | Number of probes for search (pgvector) |

#### Performance and Caching

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VECTOR_PERFORMANCE_ENABLE_CACHE` | No | `true` (prod), `false` (dev/test) | Enable caching for embeddings |
| `VECTOR_PERFORMANCE_CACHE_TTL_SECONDS` | No | `3600` | Cache TTL in seconds (1 hour) |
| `VECTOR_PERFORMANCE_POOL_SIZE` | No | `10` | Connection pool size for vector operations |

### Configuration Mapping

The module uses NestJS ConfigService with the following configuration path structure:

```typescript
{
  vectorSearch: {
    enabled: boolean,
    embedding: {
      provider: 'openai' | 'anthropic' | 'local',
      model: string,
      dimensions: number,
      apiKey: string,
      batchSize: number,
      maxRetries: number,
      timeoutMs: number
    },
    search: {
      defaultMetric: 'cosine' | 'euclidean' | 'dot_product' | 'inner_product',
      defaultMinSimilarity: number,
      defaultLimit: number,
      maxLimit: number,
      includeScoresByDefault: boolean
    },
    index: {
      name: string,
      autoCreate: boolean,
      lists: number,
      probes: number
    },
    performance: {
      enableCache: boolean,
      cacheTtlSeconds: number,
      poolSize: number
    }
  }
}
```

### API Key Resolution

The module uses a fallback strategy for API keys:

1. **For OpenAI Provider**:
   - Reads from `brain.openaiApiKey` (which comes from `OPENAI_API_KEY` env var)
   - This is accessed via `configService.get<string>('brain.openaiApiKey')`

2. **For Other Providers**:
   - Reads from `vectorSearch.embedding.apiKey` (which comes from `VECTOR_EMBEDDING_API_KEY` env var)

### Database Configuration

The module also depends on database configuration stored in the `vector_search_configs` table:

- **Organization-scoped configuration**: Each organization can have custom settings
- **Default configuration**: Created automatically using environment variables if none exists
- **Configuration includes**:
  - Provider-specific API keys (stored in JSONB `config` field)
  - Cost tracking (`costPer1kTokensCents`)
  - Rate limiting (`rateLimitConfig`)
  - Search preferences (`searchConfig`)
  - Timeout and retry settings

## Service Capabilities

### VectorSearchService

Key methods:
- `searchSimilarVectors(query, options)` - Semantic search using cosine similarity
- `indexDocument(id, content, sourceType, metadata, options)` - Index a document
- `updateDocument(id, sourceType, content, organizationId)` - Update existing embedding
- `deleteDocument(id, sourceType, organizationId)` - Remove from vector index
- `batchIndexDocuments(documents, sourceType, options)` - Batch indexing

### VectorSearchConfigService

Key methods:
- `getConfig(organizationId)` - Get organization-specific configuration
- `getDefaultConfig()` - Get system-wide default configuration
- `getOrCreateConfig(organizationId)` - Get or create configuration for organization
- `validateConfig(config)` - Validate configuration parameters

## Multi-tenancy Support

The module supports multi-tenant isolation through:
- Organization-scoped configurations
- Organization/Project/Team/Hollon filtering in searches
- Separate vector embeddings per organization

## Validation Rules

The module validates configuration at multiple levels:

### Embedding Configuration
- Dimensions must be > 0
- Valid dimensions: 256, 768, 1024, 1536, 3072
- OpenAI provider requires API key
- Timeout must be between 5-300 seconds

### Search Configuration
- Similarity threshold must be between 0 and 1
- Default limit must be ≥ 1
- Max limit must be ≥ default limit

### Index Configuration
- Lists must be > 0
- Probes must be > 0

### Performance Configuration
- Cache TTL must be ≥ 0
- Pool size must be > 0

## Usage by Other Modules

The VectorSearchModule is used by:
- **PromptComposerModule** - Retrieves semantically relevant context
- **KnowledgeExtractionModule** - Finds related knowledge entries
- **OrchestrationModule** - Context-aware decision making

## Implementation Status

### Completed
✅ Module structure and dependency injection
✅ Configuration schema and validation
✅ Multi-tenant configuration management
✅ Service interfaces and method signatures
✅ Entity definitions with proper indexing
✅ Database schema support

### Pending Implementation
⚠️ OpenAI API integration (`generateOpenAIEmbedding` is a placeholder)
⚠️ Embedding generation logic (currently returns zero vectors)
⚠️ Caching implementation
⚠️ Rate limiting enforcement

## Example Configuration

### Minimal Configuration (.env)
```bash
# Required
OPENAI_API_KEY=sk-...

# Optional (with defaults)
VECTOR_SEARCH_ENABLED=true
VECTOR_EMBEDDING_PROVIDER=openai
VECTOR_EMBEDDING_MODEL=text-embedding-3-small
```

### Full Configuration (.env)
```bash
# Enable vector search
VECTOR_SEARCH_ENABLED=true

# Embedding provider
VECTOR_EMBEDDING_PROVIDER=openai
VECTOR_EMBEDDING_MODEL=text-embedding-3-small
VECTOR_EMBEDDING_DIMENSIONS=1536
VECTOR_EMBEDDING_BATCH_SIZE=100
VECTOR_EMBEDDING_MAX_RETRIES=3
VECTOR_EMBEDDING_TIMEOUT_MS=30000

# Search configuration
VECTOR_SEARCH_DEFAULT_METRIC=cosine
VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY=0.7
VECTOR_SEARCH_DEFAULT_LIMIT=10
VECTOR_SEARCH_MAX_LIMIT=100
VECTOR_SEARCH_INCLUDE_SCORES_BY_DEFAULT=true

# Index configuration
VECTOR_INDEX_NAME=vector_embeddings
VECTOR_INDEX_AUTO_CREATE=true
VECTOR_INDEX_LISTS=100
VECTOR_INDEX_PROBES=10

# Performance
VECTOR_PERFORMANCE_ENABLE_CACHE=true
VECTOR_PERFORMANCE_CACHE_TTL_SECONDS=3600
VECTOR_PERFORMANCE_POOL_SIZE=10

# API Keys
OPENAI_API_KEY=sk-...
```

## Notes

- The module gracefully handles test environments by using mock API keys
- pgvector extension must be enabled in PostgreSQL (handled by migration)
- Vector dimensions must match between configuration and database schema
- Embedding generation is currently a placeholder awaiting OpenAI SDK integration
