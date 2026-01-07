# pgvector Configuration Summary

## Quick Reference

This document provides a quick reference for all pgvector-related configuration needs discovered across the codebase.

For comprehensive documentation, see: [pgvector-configuration.md](./pgvector-configuration.md)

---

## Configuration Categories

### 1. Connection Configuration

**Purpose**: Database connection settings for PostgreSQL with pgvector

| Variable       | Category   | Required | Default     | Notes                                     |
| -------------- | ---------- | -------- | ----------- | ----------------------------------------- |
| `DB_HOST`      | Connection | Yes      | `localhost` | PostgreSQL host                           |
| `DB_PORT`      | Connection | Yes      | `5432`      | PostgreSQL port                           |
| `DB_NAME`      | Connection | Yes      | `hollon`    | Database name                             |
| `DB_USER`      | Connection | Yes      | `hollon`    | User must have CREATE EXTENSION privilege |
| `DB_PASSWORD`  | Connection | Yes      | -           | Secure password                           |
| `DATABASE_URL` | Connection | No       | -           | Alternative to individual vars            |

**Prerequisites**:

- PostgreSQL 11+ installed
- pgvector extension 0.8.1+ installed on server
- Database user with CREATE EXTENSION privilege

---

### 2. Dimensions Configuration

**Purpose**: Embedding model settings that define vector dimensions

| Variable                       | Category   | Required | Default                  | Notes                                  |
| ------------------------------ | ---------- | -------- | ------------------------ | -------------------------------------- |
| `OPENAI_API_KEY`               | Dimensions | Yes\*    | -                        | Required if using OpenAI provider      |
| `VECTOR_EMBEDDING_PROVIDER`    | Dimensions | No       | `openai`                 | Options: openai, anthropic, local      |
| `VECTOR_EMBEDDING_MODEL`       | Dimensions | No       | `text-embedding-3-small` | Must match dimensions                  |
| `VECTOR_EMBEDDING_DIMENSIONS`  | Dimensions | No       | `1536`                   | Must match model output                |
| `VECTOR_EMBEDDING_API_KEY`     | Dimensions | No       | -                        | Optional, falls back to OPENAI_API_KEY |
| `VECTOR_EMBEDDING_BATCH_SIZE`  | Dimensions | No       | `100`                    | Batch size for API calls               |
| `VECTOR_EMBEDDING_MAX_RETRIES` | Dimensions | No       | `3`                      | Retry attempts                         |
| `VECTOR_EMBEDDING_TIMEOUT_MS`  | Dimensions | No       | `30000`                  | Request timeout                        |

**Key Dimension Values**:

- OpenAI text-embedding-3-small: **1536 dimensions**
- OpenAI text-embedding-3-large: **3072 dimensions**
- OpenAI text-embedding-ada-002: **1536 dimensions**
- Cohere embed-english-v3.0: **1024 dimensions**

---

### 3. Features Configuration

**Purpose**: Control vector search functionality and behavior

| Variable                                  | Category | Required | Default             | Notes                                                  |
| ----------------------------------------- | -------- | -------- | ------------------- | ------------------------------------------------------ |
| `VECTOR_SEARCH_ENABLED`                   | Features | No       | `true` (dev)        | Master feature toggle                                  |
| `VECTOR_SEARCH_DEFAULT_METRIC`            | Features | No       | `cosine`            | Options: cosine, euclidean, dot_product, inner_product |
| `VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY`    | Features | No       | `0.7`               | Range: 0.0 to 1.0                                      |
| `VECTOR_SEARCH_DEFAULT_LIMIT`             | Features | No       | `10`                | Default results count                                  |
| `VECTOR_SEARCH_MAX_LIMIT`                 | Features | No       | `100`               | Maximum results allowed                                |
| `VECTOR_SEARCH_INCLUDE_SCORES_BY_DEFAULT` | Features | No       | `true`              | Include similarity scores                              |
| `VECTOR_INDEX_NAME`                       | Features | No       | `vector_embeddings` | Index identifier                                       |
| `VECTOR_INDEX_AUTO_CREATE`                | Features | No       | `true` (dev)        | Auto-create indexes                                    |
| `VECTOR_INDEX_LISTS`                      | Features | No       | `100`               | IVFFlat lists for indexing                             |
| `VECTOR_INDEX_PROBES`                     | Features | No       | `10`                | Probes during search                                   |

**pgvector Operators**:

- `cosine` → `<=>` (Cosine distance)
- `euclidean` → `<->` (L2 distance)
- `inner_product` → `<#>` (Inner product)

---

### 4. Performance Configuration

**Purpose**: Optimize vector operations for speed and resource usage

| Variable                               | Category    | Required | Default       | Notes                   |
| -------------------------------------- | ----------- | -------- | ------------- | ----------------------- |
| `VECTOR_PERFORMANCE_ENABLE_CACHE`      | Performance | No       | `true` (prod) | Cache embeddings        |
| `VECTOR_PERFORMANCE_CACHE_TTL_SECONDS` | Performance | No       | `3600`        | Cache lifetime (1 hour) |
| `VECTOR_PERFORMANCE_POOL_SIZE`         | Performance | No       | `10`          | Connection pool size    |

---

## Environment Presets

### Development

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

### Production

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

### Testing

```bash
VECTOR_SEARCH_ENABLED=false
# Other values not critical in test mode
```

---

## Database Schema

### Tables with Vector Columns

1. **documents**
   - Column: `embedding`
   - Type: `vector(1536)`
   - Purpose: RAG (Retrieval-Augmented Generation)
   - Nullable: Yes

2. **vector_embeddings**
   - Column: `embedding`
   - Type: `text` (TypeORM) / `vector(n)` (PostgreSQL)
   - Purpose: Dedicated vector storage with metadata
   - Supports multiple dimensions via `dimensions` column

### Migrations

- **1733295000000-InitialSchema.ts**: Creates pgvector extension and documents table
- **1736246400000-EnablePgvectorExtension.ts**: Dedicated migration for pgvector with validation

---

## Code Locations

### Configuration

- `apps/server/src/config/configuration.ts`: Main configuration loader
- `apps/server/src/modules/vector-search/config/vector-search.config.ts`: Vector search config factory
- `.env.example`: Environment variable template

### Entities

- `apps/server/src/entities/vector-embedding.entity.ts`: VectorEmbedding entity
- `apps/server/src/modules/document/entities/document.entity.ts`: Document entity with embedding

### Services

- `apps/server/src/modules/vector-search/vector-search.service.ts`: Vector search operations
- `apps/server/src/modules/knowledge-extraction/services/knowledge-extraction.service.ts`: Knowledge graph with vector search

### Migrations

- `apps/server/src/database/migrations/1733295000000-InitialSchema.ts`: Initial schema with pgvector
- `apps/server/src/migrations/1736246400000-EnablePgvectorExtension.ts`: Extension enablement

### Tests

- `apps/server/test/schema-validation.test.ts`: Vector schema validation

### Scripts

- `apps/server/src/scripts/verify-database-config.ts`: Database verification including pgvector
- `apps/server/src/scripts/reset-test-db.ts`: Test database setup with pgvector

---

## Validation Checks

The system automatically validates:

✅ Dimensions > 0  
✅ OpenAI API key present when using OpenAI provider  
✅ Similarity threshold between 0 and 1  
✅ Limits are positive integers  
✅ maxLimit >= defaultLimit  
✅ Index lists and probes > 0  
✅ Cache TTL non-negative  
✅ Pool size > 0

Validation happens in: `apps/server/src/modules/vector-search/config/vector-search.config.ts:validateVectorSearchConfig()`

---

## Common Issues and Solutions

### Issue: Extension not available

**Error**: `pgvector extension is not available on this PostgreSQL server`  
**Solution**: Install pgvector on PostgreSQL server  
**Reference**: https://github.com/pgvector/pgvector#installation

### Issue: Dimension mismatch

**Error**: `Vector dimension mismatch`  
**Solution**: Ensure `VECTOR_EMBEDDING_DIMENSIONS` matches model output (1536 for text-embedding-3-small)

### Issue: Missing API key

**Error**: `OpenAI API key is required when using OpenAI as embedding provider`  
**Solution**: Set `OPENAI_API_KEY` in .env

### Issue: Index build failure

**Error**: `Cannot create index on empty table`  
**Solution**: Insert data before creating IVFFlat indexes, or set `VECTOR_INDEX_AUTO_CREATE=false`

---

## Performance Tuning

### Index Tuning

- **Lists**: Use `rows / 1000` as guideline
  - 100K rows → 100 lists
  - 1M rows → 1000 lists
- **Probes**: Balance accuracy vs speed
  - Start with 10
  - Increase to 20-50 for better recall

### Query Optimization

1. Filter by organization_id, project_id before vector search
2. Use appropriate similarity metric for use case
3. Combine with metadata/tag filters for hybrid search
4. Monitor query performance and adjust probes/lists

### Storage Planning

- **Per vector**: ~4 bytes × dimensions
  - 1536 dimensions = ~6 KB per embedding
  - 3072 dimensions = ~12 KB per embedding
- **Index overhead**:
  - HNSW: +20-50% storage
  - IVFFlat: +10-20% storage

---

## Quick Start Checklist

- [ ] PostgreSQL 11+ installed
- [ ] pgvector extension installed on server
- [ ] Database user has CREATE EXTENSION privilege
- [ ] `OPENAI_API_KEY` set in .env
- [ ] `VECTOR_EMBEDDING_DIMENSIONS=1536` (matches model)
- [ ] `VECTOR_SEARCH_ENABLED=true`
- [ ] Run migrations: `npm run migration:run`
- [ ] Verify setup: `npm run verify:database`

---

## Related Documentation

- [Comprehensive pgvector Configuration Guide](./pgvector-configuration.md)
- [pgvector GitHub Repository](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings Documentation](https://platform.openai.com/docs/guides/embeddings)

---

**Last Updated**: 2025-01-07  
**Version**: 1.0.0
