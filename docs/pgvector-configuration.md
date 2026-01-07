# pgvector Configuration Guide

## Overview

This document provides comprehensive documentation of all pgvector-related configuration requirements for the Hollon-AI system. The configurations are categorized into four main areas: Connection, Dimensions, Features, and Performance.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Connection Configuration](#connection-configuration)
3. [Dimensions Configuration](#dimensions-configuration)
4. [Features Configuration](#features-configuration)
5. [Performance Configuration](#performance-configuration)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Recommended Values](#recommended-values)
8. [Migration Notes](#migration-notes)

---

## Prerequisites

### PostgreSQL Requirements

- **PostgreSQL Version**: 11+ (recommended: 14+)
- **pgvector Extension**: Must be installed on the PostgreSQL server
- **Extension Version**: 0.8.1+ recommended for iterative index scans and improved filtering
- **Database Permissions**: CREATE EXTENSION privilege required

### Installation Instructions

For pgvector installation, see: https://github.com/pgvector/pgvector#installation

**Verification**:

```sql
-- Check if pgvector is available
SELECT * FROM pg_available_extensions WHERE name = 'vector';

-- Check if pgvector is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';
```

---

## Connection Configuration

### Database Connection Settings

These settings control the PostgreSQL database connection where pgvector operates.

| Variable       | Type    | Description                                             | Default     | Required |
| -------------- | ------- | ------------------------------------------------------- | ----------- | -------- |
| `DB_HOST`      | string  | PostgreSQL host address                                 | `localhost` | Yes      |
| `DB_PORT`      | integer | PostgreSQL port                                         | `5432`      | Yes      |
| `DB_NAME`      | string  | Database name                                           | `hollon`    | Yes      |
| `DB_USER`      | string  | Database user with extension privileges                 | `hollon`    | Yes      |
| `DB_PASSWORD`  | string  | Database password                                       | -           | Yes      |
| `DB_SCHEMA`    | string  | Schema name (overridden in test mode)                   | `hollon`    | No       |
| `DATABASE_URL` | string  | Full connection string (alternative to individual vars) | -           | No       |

**Notes**:

- The database user must have `CREATE EXTENSION` privilege to enable pgvector
- In test mode, schema is automatically set to `hollon_test` with worker suffixes
- The pgvector extension is installed at the schema level

---

## Dimensions Configuration

### Embedding Model Settings

These settings configure the embedding models and their dimensionality, which directly affects pgvector column definitions.

| Variable                      | Type    | Description                                                | Default                  | Required |
| ----------------------------- | ------- | ---------------------------------------------------------- | ------------------------ | -------- |
| `VECTOR_EMBEDDING_PROVIDER`   | enum    | Embedding provider (`openai`, `anthropic`, `local`)        | `openai`                 | No       |
| `VECTOR_EMBEDDING_MODEL`      | string  | Specific model identifier                                  | `text-embedding-3-small` | No       |
| `VECTOR_EMBEDDING_DIMENSIONS` | integer | Vector dimensions (must match model)                       | `1536`                   | No       |
| `VECTOR_EMBEDDING_API_KEY`    | string  | Provider-specific API key (optional for OpenAI)            | -                        | No       |
| `OPENAI_API_KEY`              | string  | OpenAI API key (used for embeddings if provider is OpenAI) | -                        | Yes\*    |

**Supported Models and Dimensions**:

| Provider | Model                    | Dimensions | Notes                          |
| -------- | ------------------------ | ---------- | ------------------------------ |
| OpenAI   | `text-embedding-ada-002` | 1536       | Legacy model                   |
| OpenAI   | `text-embedding-3-small` | 1536       | Recommended, cost-effective    |
| OpenAI   | `text-embedding-3-large` | 3072       | Higher quality, more expensive |
| Cohere   | `embed-english-v3.0`     | 1024       | Alternative provider           |

**Important**:

- The `VECTOR_EMBEDDING_DIMENSIONS` value must match the model's output dimensions
- Changing dimensions requires database migration and re-embedding all content
- The `vector_embeddings` table stores vectors with dimension specified in migrations
- The `documents` table uses `vector(1536)` for embeddings

---

## Features Configuration

### Core Feature Toggles

| Variable                | Type    | Description                                | Default                           | Required |
| ----------------------- | ------- | ------------------------------------------ | --------------------------------- | -------- |
| `VECTOR_SEARCH_ENABLED` | boolean | Enable/disable vector search functionality | `true` (dev), `false` (test/prod) | No       |

### Search Configuration

These settings control vector similarity search behavior using pgvector operators.

| Variable                                  | Type    | Description                                                               | Default  | Required |
| ----------------------------------------- | ------- | ------------------------------------------------------------------------- | -------- | -------- |
| `VECTOR_SEARCH_DEFAULT_METRIC`            | enum    | Similarity metric (`cosine`, `euclidean`, `dot_product`, `inner_product`) | `cosine` | No       |
| `VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY`    | float   | Minimum similarity threshold (0.0 to 1.0)                                 | `0.7`    | No       |
| `VECTOR_SEARCH_DEFAULT_LIMIT`             | integer | Default number of results to return                                       | `10`     | No       |
| `VECTOR_SEARCH_MAX_LIMIT`                 | integer | Maximum allowed results                                                   | `100`    | No       |
| `VECTOR_SEARCH_INCLUDE_SCORES_BY_DEFAULT` | boolean | Include similarity scores in results                                      | `true`   | No       |

**pgvector Distance Operators**:

| Metric          | pgvector Operator | Description     | Use Case                                         |
| --------------- | ----------------- | --------------- | ------------------------------------------------ |
| `cosine`        | `<=>`             | Cosine distance | Best for normalized vectors, semantic similarity |
| `euclidean`     | `<->`             | L2 distance     | Geometric distance, absolute differences         |
| `inner_product` | `<#>`             | Inner product   | Dot product similarity, raw magnitude            |

**Similarity Thresholds**:

- **0.9-1.0**: Very high similarity (near duplicates)
- **0.7-0.9**: High similarity (related content) - **Recommended default**
- **0.5-0.7**: Moderate similarity (loosely related)
- **Below 0.5**: Low similarity (may not be relevant)

### Index Configuration

These settings control pgvector index creation and behavior.

| Variable                   | Type    | Description                                       | Default                      | Required |
| -------------------------- | ------- | ------------------------------------------------- | ---------------------------- | -------- |
| `VECTOR_INDEX_NAME`        | string  | Name of the vector index                          | `vector_embeddings`          | No       |
| `VECTOR_INDEX_AUTO_CREATE` | boolean | Automatically create indexes                      | `true` (dev), `false` (prod) | No       |
| `VECTOR_INDEX_LISTS`       | integer | Number of IVFFlat lists (affects build time)      | `100`                        | No       |
| `VECTOR_INDEX_PROBES`      | integer | Number of probes during search (affects accuracy) | `10`                         | No       |

**Index Types Supported by pgvector**:

1. **HNSW (Hierarchical Navigable Small World)**
   - Faster queries
   - Slower build time
   - Higher memory usage
   - Best for: Production environments with frequent searches

2. **IVFFlat (Inverted File with Flat Compression)**
   - Faster build time
   - Good query performance
   - Configurable via `lists` and `probes`
   - Best for: Development, datasets < 1M vectors

**Tuning Guidelines**:

- **Lists**: Recommended value is `rows / 1000` for IVFFlat indexes
  - For 100K vectors: `lists = 100`
  - For 1M vectors: `lists = 1000`
- **Probes**: Higher values = better accuracy but slower queries
  - Start with `probes = 10`
  - Increase to 20-50 for better recall
  - Test query performance vs accuracy tradeoff

### Embedding Generation Settings

| Variable                       | Type    | Description                                | Default | Required |
| ------------------------------ | ------- | ------------------------------------------ | ------- | -------- |
| `VECTOR_EMBEDDING_BATCH_SIZE`  | integer | Number of texts to embed in one batch      | `100`   | No       |
| `VECTOR_EMBEDDING_MAX_RETRIES` | integer | Maximum retry attempts for failed requests | `3`     | No       |
| `VECTOR_EMBEDDING_TIMEOUT_MS`  | integer | Request timeout in milliseconds            | `30000` | No       |

---

## Performance Configuration

### Caching Settings

| Variable                               | Type    | Description            | Default                      | Required |
| -------------------------------------- | ------- | ---------------------- | ---------------------------- | -------- |
| `VECTOR_PERFORMANCE_ENABLE_CACHE`      | boolean | Enable embedding cache | `true` (prod), `false` (dev) | No       |
| `VECTOR_PERFORMANCE_CACHE_TTL_SECONDS` | integer | Cache TTL in seconds   | `3600`                       | No       |

**Cache Behavior**:

- Caches generated embeddings to reduce API calls
- Useful for frequently accessed content
- TTL of 3600 seconds (1 hour) balances freshness and performance
- Consider longer TTL for static content

### Connection Pool Settings

| Variable                       | Type    | Description                                  | Default | Required |
| ------------------------------ | ------- | -------------------------------------------- | ------- | -------- |
| `VECTOR_PERFORMANCE_POOL_SIZE` | integer | Database connection pool size for vector ops | `10`    | No       |

**Pool Sizing Guidelines**:

- **Development**: 5-10 connections
- **Production (small)**: 10-20 connections
- **Production (large)**: 20-50 connections
- Monitor connection utilization and adjust accordingly

---

## Environment Variables Reference

### Complete .env.example Template

```bash
# ===========================================
# pgvector Configuration
# ===========================================

# Database Connection (required for pgvector)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hollon
DB_USER=hollon
DB_PASSWORD=your_secure_password_here
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# Embedding Provider (required for vector generation)
OPENAI_API_KEY=your_openai_api_key_here

# Vector Search - Feature Toggle
VECTOR_SEARCH_ENABLED=true

# Vector Search - Dimensions Configuration
VECTOR_EMBEDDING_PROVIDER=openai
VECTOR_EMBEDDING_MODEL=text-embedding-3-small
VECTOR_EMBEDDING_DIMENSIONS=1536
VECTOR_EMBEDDING_API_KEY=  # Optional: uses OPENAI_API_KEY by default
VECTOR_EMBEDDING_BATCH_SIZE=100
VECTOR_EMBEDDING_MAX_RETRIES=3
VECTOR_EMBEDDING_TIMEOUT_MS=30000

# Vector Search - Search Configuration
VECTOR_SEARCH_DEFAULT_METRIC=cosine
VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY=0.7
VECTOR_SEARCH_DEFAULT_LIMIT=10
VECTOR_SEARCH_MAX_LIMIT=100
VECTOR_SEARCH_INCLUDE_SCORES_BY_DEFAULT=true

# Vector Search - Index Configuration
VECTOR_INDEX_NAME=vector_embeddings
VECTOR_INDEX_AUTO_CREATE=true
VECTOR_INDEX_LISTS=100
VECTOR_INDEX_PROBES=10

# Vector Search - Performance Configuration
VECTOR_PERFORMANCE_ENABLE_CACHE=true
VECTOR_PERFORMANCE_CACHE_TTL_SECONDS=3600
VECTOR_PERFORMANCE_POOL_SIZE=10
```

---

## Recommended Values

### Development Environment

```bash
VECTOR_SEARCH_ENABLED=true
VECTOR_EMBEDDING_DIMENSIONS=1536
VECTOR_EMBEDDING_BATCH_SIZE=50
VECTOR_INDEX_AUTO_CREATE=true
VECTOR_INDEX_LISTS=100
VECTOR_INDEX_PROBES=10
VECTOR_PERFORMANCE_ENABLE_CACHE=false
VECTOR_PERFORMANCE_POOL_SIZE=5
```

**Rationale**:

- Smaller batch sizes for faster feedback
- Auto-create indexes for convenience
- Cache disabled for development flexibility
- Smaller pool size for resource efficiency

### Production Environment

```bash
VECTOR_SEARCH_ENABLED=true
VECTOR_EMBEDDING_DIMENSIONS=1536
VECTOR_EMBEDDING_BATCH_SIZE=100
VECTOR_INDEX_AUTO_CREATE=false
VECTOR_INDEX_LISTS=1000
VECTOR_INDEX_PROBES=20
VECTOR_PERFORMANCE_ENABLE_CACHE=true
VECTOR_PERFORMANCE_CACHE_TTL_SECONDS=3600
VECTOR_PERFORMANCE_POOL_SIZE=20
```

**Rationale**:

- Larger batch sizes for efficiency
- Manual index creation for control
- Higher lists/probes for better accuracy
- Cache enabled for performance
- Larger pool for concurrent requests

### Testing Environment

```bash
VECTOR_SEARCH_ENABLED=false
# Other values not critical in test mode
```

**Rationale**:

- Tests use mocked vector services
- Reduces test complexity and external dependencies

---

## Migration Notes

### Enabling pgvector Extension

The system includes a dedicated migration to enable the pgvector extension:

**Migration**: `1736246400000-EnablePgvectorExtension.ts`

**Key Features**:

- Checks if extension is available before enabling
- Idempotent operation (safe to run multiple times)
- Includes verification step
- Provides detailed error messages

**Manual Verification**:

```sql
-- Check extension status
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- List vector columns
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'hollon'
  AND data_type = 'USER-DEFINED'
  AND udt_name = 'vector';
```

### Vector Column Definitions

#### Documents Table

- **Column**: `embedding`
- **Type**: `vector(1536)`
- **Purpose**: RAG (Retrieval-Augmented Generation)
- **Nullable**: Yes
- **Index**: Should be added when data volume grows

#### Vector Embeddings Table

- **Table**: `vector_embeddings`
- **Column**: `embedding` (stored as text in TypeORM, vector in PostgreSQL)
- **Purpose**: Dedicated vector storage with metadata
- **Indexes**: Multiple indexes on foreign keys and metadata
- **Features**: Supports multiple embedding models and dimensions

### Schema Changes

When changing embedding dimensions:

1. Create a new migration to alter the vector column type
2. Re-generate all embeddings with the new model
3. Update the `VECTOR_EMBEDDING_DIMENSIONS` environment variable
4. Rebuild vector indexes

**Example Migration**:

```sql
-- Change from vector(1536) to vector(3072)
ALTER TABLE documents
  ALTER COLUMN embedding TYPE vector(3072);

-- Rebuild index
REINDEX INDEX documents_embedding_idx;
```

### Index Creation

**Development** (auto-create):

```sql
-- Created automatically by the application
-- Index type: IVFFlat
-- Lists: 100
```

**Production** (manual):

```sql
-- For large datasets, create indexes manually during maintenance window
-- HNSW index (recommended for production)
CREATE INDEX ON vector_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- IVFFlat index (alternative)
CREATE INDEX ON vector_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 1000);
```

---

## Validation and Troubleshooting

### Configuration Validation

The system includes automatic validation in `vector-search.config.ts`:

- Dimensions must be > 0
- OpenAI API key required when using OpenAI provider
- Similarity threshold must be between 0 and 1
- Limits must be positive
- maxLimit must be >= defaultLimit
- Index lists and probes must be > 0
- Cache TTL must be non-negative
- Pool size must be > 0

### Common Issues

**1. Extension Not Available**

```
Error: pgvector extension is not available on this PostgreSQL server
```

**Solution**: Install pgvector on the PostgreSQL server

**2. Dimension Mismatch**

```
Error: Vector dimension mismatch
```

**Solution**: Ensure `VECTOR_EMBEDDING_DIMENSIONS` matches the model output

**3. Missing API Key**

```
Error: OpenAI API key is required when using OpenAI as embedding provider
```

**Solution**: Set `OPENAI_API_KEY` environment variable

**4. Index Build Failure**

```
Error: Cannot create index on empty table
```

**Solution**: Insert data before creating IVFFlat indexes, or set `VECTOR_INDEX_AUTO_CREATE=false`

### Health Checks

Verify pgvector configuration:

```bash
npm run verify:database
```

This script checks:

- PostgreSQL version
- pgvector extension availability and version
- Extension enabled status
- Database permissions
- Schema existence

---

## Performance Optimization

### Query Optimization

1. **Use appropriate similarity metrics**
   - Cosine for semantic similarity (normalized vectors)
   - Euclidean for absolute distance
   - Inner product for raw magnitude comparison

2. **Tune index parameters**
   - Increase `lists` for larger datasets
   - Increase `probes` for better accuracy
   - Monitor query performance and adjust

3. **Filter before vector search**
   - Use WHERE clauses on indexed columns (organization_id, project_id, etc.)
   - Combine with tags for hybrid search
   - Leverage metadata JSONB indexes

4. **Batch operations**
   - Use `VECTOR_EMBEDDING_BATCH_SIZE` to optimize API calls
   - Process embeddings in parallel when possible

### Storage Considerations

- **Storage per vector**: ~4 bytes per dimension
  - 1536 dimensions = ~6 KB per embedding
  - 3072 dimensions = ~12 KB per embedding
- **Index overhead**:
  - HNSW: ~20-50% additional storage
  - IVFFlat: ~10-20% additional storage

- **Memory requirements**:
  - HNSW indexes load entirely into memory
  - Plan for index size + buffer cache + working memory

### Scaling Guidelines

| Dataset Size | Lists  | Probes | Index Type          | Expected Query Time |
| ------------ | ------ | ------ | ------------------- | ------------------- |
| < 100K       | 100    | 10     | IVFFlat             | < 50ms              |
| 100K - 1M    | 1000   | 20     | IVFFlat or HNSW     | < 100ms             |
| 1M - 10M     | 10000  | 50     | HNSW                | < 200ms             |
| > 10M        | Custom | Custom | HNSW + partitioning | Varies              |

---

## References

- [pgvector GitHub Repository](https://github.com/pgvector/pgvector)
- [pgvector Documentation](https://github.com/pgvector/pgvector#pgvector)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [TypeORM Documentation](https://typeorm.io/)

---

## Changelog

| Date       | Version | Changes                             |
| ---------- | ------- | ----------------------------------- |
| 2025-01-07 | 1.0.0   | Initial comprehensive documentation |
