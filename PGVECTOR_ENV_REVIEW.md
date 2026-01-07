# pgvector Environment Configuration Review

## Summary

This document reviews the current `.env.example` file structure and identifies all pgvector-related environment variables needed for the Hollon-AI project.

## Current State Analysis

### Existing Configuration in .env.example

The `.env.example` file already includes a comprehensive "Vector Search Configuration" section with the following variables:

#### Core Vector Search Settings

- `VECTOR_SEARCH_ENABLED` - Enable/disable vector search functionality (default: true)

#### Embedding Provider Configuration

- `VECTOR_EMBEDDING_PROVIDER` - Provider for embeddings (default: openai)
- `VECTOR_EMBEDDING_MODEL` - Model name (default: text-embedding-3-small)
- `VECTOR_EMBEDDING_DIMENSIONS` - Vector dimensions (default: 1536)
- `VECTOR_EMBEDDING_API_KEY` - Optional API key (falls back to OPENAI_API_KEY)
- `VECTOR_EMBEDDING_BATCH_SIZE` - Batch processing size (default: 100)
- `VECTOR_EMBEDDING_MAX_RETRIES` - Retry attempts (default: 3)
- `VECTOR_EMBEDDING_TIMEOUT_MS` - Request timeout (default: 30000ms)

#### Search Configuration

- `VECTOR_SEARCH_DEFAULT_METRIC` - Similarity metric (default: cosine)
- `VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY` - Minimum similarity threshold (default: 0.7)
- `VECTOR_SEARCH_DEFAULT_LIMIT` - Default result limit (default: 10)
- `VECTOR_SEARCH_MAX_LIMIT` - Maximum result limit (default: 100)
- `VECTOR_SEARCH_INCLUDE_SCORES_BY_DEFAULT` - Include similarity scores (default: true)

#### pgvector Index Configuration

- `VECTOR_INDEX_NAME` - Index identifier (default: vector_embeddings)
- `VECTOR_INDEX_AUTO_CREATE` - Auto-create index (default: true)
- `VECTOR_INDEX_LISTS` - IVF index lists for pgvector (default: 100)
- `VECTOR_INDEX_PROBES` - Search probes for pgvector (default: 10)

#### Performance Configuration

- `VECTOR_PERFORMANCE_ENABLE_CACHE` - Enable embedding cache (default: true)
- `VECTOR_PERFORMANCE_CACHE_TTL_SECONDS` - Cache TTL (default: 3600)
- `VECTOR_PERFORMANCE_POOL_SIZE` - Connection pool size (default: 10)

### Database Configuration

The database section includes:

- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name (default: hollon)
- `DB_USER` - Database user (default: hollon)
- `DB_PASSWORD` - Database password
- `DATABASE_URL` - Full connection URL

### Missing Environment Variable

**`DB_SCHEMA`** - This variable is used extensively throughout the codebase but is NOT documented in `.env.example`.

#### Usage of DB_SCHEMA in Codebase:

- `apps/server/src/config/configuration.ts` - Uses `process.env.DB_SCHEMA || 'hollon'`
- `apps/server/src/config/typeorm.config.ts` - Uses `process.env.DB_SCHEMA || 'hollon'`
- Multiple test scripts and setup files reference it
- CI/CD workflow uses it: `DB_SCHEMA: hollon_test_worker_1`

#### Purpose:

- Allows schema isolation between production, development, and test environments
- Enables parallel test execution with worker-specific schemas
- Default: `hollon` for production/development, `hollon_test` for testing

## Recommendations

### 1. Add DB_SCHEMA to .env.example

Add the following to the Database section of `.env.example`:

```env
# Database schema (optional, defaults based on environment)
# Production/Development: hollon
# Test: hollon_test (automatically suffixed with worker ID in parallel tests)
DB_SCHEMA=hollon
```

### 2. Verify pgvector Docker Setup

The `docker/docker-compose.yml` already uses the correct pgvector image:

```yaml
postgres:
  image: pgvector/pgvector:pg16
```

The `docker/init-scripts/01-init.sql` properly:

- Enables the vector extension: `CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA public;`
- Creates required schemas: `hollon` and `hollon_test`
- Grants proper permissions

### 3. Configuration Validation

The `vector-search.config.ts` includes a `validateVectorSearchConfig()` function that validates:

- Embedding dimensions > 0
- OpenAI API key when using OpenAI provider
- Similarity thresholds between 0 and 1
- Index configuration (lists and probes > 0)
- Performance settings (cache TTL, pool size)

### 4. Supported pgvector Features

Based on the codebase and documentation review:

#### Supported Distance Metrics:

- Cosine similarity (default, recommended for text embeddings)
- Euclidean distance (L2)
- Dot product
- Inner product

#### Supported Embedding Providers:

- OpenAI (primary, with models: ada-002, text-embedding-3-small, text-embedding-3-large)
- Anthropic (planned)
- Local (planned)

#### pgvector-Specific Features:

- IVF (Inverted File) indexing with configurable lists
- Configurable probe counts for search optimization
- Support for dimensions up to 2,000 (standard vector type)
- HNSW and IVFFlat index types (configured in migrations)

### 5. Advanced pgvector Features (Future Consideration)

The codebase documentation mentions pgvector 0.7.0+ features that are NOT currently configured:

#### Alternative Vector Types (not in current .env):

- `halfvec` - 50% storage reduction, supports up to 4,000 dimensions
- `sparsevec` - For sparse embeddings (BM25, BGE-M3)
- `bit` - Binary quantization, 96.9% storage reduction

These could be added as optional configuration if needed:

```env
# Advanced pgvector features (optional)
VECTOR_TYPE=vector  # Options: vector, halfvec, sparsevec, bit
VECTOR_USE_QUANTIZATION=false
```

## Implementation Checklist

- [x] Review current .env.example structure
- [x] Identify all pgvector-related variables
- [x] Verify database connection settings
- [x] Check vector dimension configurations
- [x] Review optional parameters
- [x] Identify missing DB_SCHEMA variable
- [ ] Add DB_SCHEMA to .env.example (pending approval)
- [ ] Document all findings

## Files Analyzed

1. `.env.example` - Main environment template
2. `apps/server/src/config/configuration.ts` - Configuration loader
3. `apps/server/src/modules/vector-search/config/vector-search.config.ts` - Vector search config
4. `apps/server/src/entities/vector-embedding.entity.ts` - Vector embedding entity
5. `apps/server/src/database/migrations/1733295000000-InitialSchema.ts` - pgvector extension setup
6. `docker/docker-compose.yml` - PostgreSQL with pgvector
7. `docker/init-scripts/01-init.sql` - Database initialization
8. `docs/pgvector-best-practices.md` - pgvector best practices

## Conclusion

The current `.env.example` file has comprehensive pgvector configuration. The only missing variable is `DB_SCHEMA`, which should be added to the Database section for completeness and to match the codebase usage patterns.

All pgvector-specific settings (dimensions, index configuration, similarity metrics) are properly configured with sensible defaults that align with OpenAI's text-embedding-3-small model (1536 dimensions) and pgvector best practices.
