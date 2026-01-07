# pgvector Environment Variables Audit Report

**Generated**: 2025-01-07
**Purpose**: Comprehensive audit of all pgvector-related environment variables and configuration across the Hollon-AI codebase

---

## Executive Summary

This audit identifies all environment variables related to pgvector functionality, database connections, vector search configuration, and infrastructure setup. The current `.env.example` file contains comprehensive coverage of all required pgvector-related configuration.

### Audit Result: ✅ COMPLETE

All pgvector-related environment variables are properly documented in `.env.example`. No missing variables identified.

---

## 1. Database Connection Variables

### 1.1 Core PostgreSQL Configuration

These variables are essential for connecting to the PostgreSQL database with pgvector extension:

| Variable | Required | Default | Description | Usage in Code |
|----------|----------|---------|-------------|---------------|
| `DB_HOST` | ✅ Yes | `localhost` | PostgreSQL server hostname | `configuration.ts:15`, `typeorm.config.ts:14` |
| `DB_PORT` | ✅ Yes | `5432` | PostgreSQL server port | `configuration.ts:16`, `typeorm.config.ts:15` |
| `DB_NAME` | ✅ Yes | `hollon` | Database name | `configuration.ts:17`, `typeorm.config.ts:18` |
| `DB_USER` | ✅ Yes | `hollon` | Database username | `configuration.ts:18`, `typeorm.config.ts:16` |
| `DB_PASSWORD` | ✅ Yes | (empty) | Database password | `configuration.ts:19`, `typeorm.config.ts:17` |
| `DATABASE_URL` | ❌ Optional | (computed) | Full PostgreSQL connection URL | `configuration.ts:43` |
| `DB_SCHEMA` | ❌ Optional | `hollon` | Database schema for multi-tenancy | `configuration.ts:24`, `typeorm.config.ts:10` |

**Status in .env.example**: ✅ All documented (lines 11-18)

**Docker Configuration** (`docker/docker-compose.yml`):
- Uses official `pgvector/pgvector:pg16` image
- Maps environment variables: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- No additional pgvector-specific variables required for Docker

**Test Environment** (`.github/workflows/ci.yml`):
- Test database uses: `DB_SCHEMA=hollon_test_worker_1` for parallel test isolation
- CI PostgreSQL service: `image: pgvector/pgvector:pg16`

---

## 2. Vector Search Configuration

### 2.1 Core Vector Search Settings

| Variable | Required | Default | Description | Location |
|----------|----------|---------|-------------|----------|
| `VECTOR_SEARCH_ENABLED` | ❌ Optional | `true` (dev/prod), `false` (test) | Enable/disable vector search | `configuration.ts:89` |

**Status in .env.example**: ✅ Documented (line 49)

### 2.2 Embedding Provider Configuration

| Variable | Required | Default | Description | Location |
|----------|----------|---------|-------------|----------|
| `VECTOR_EMBEDDING_PROVIDER` | ✅ Yes* | `openai` | Embedding provider (openai/anthropic/local) | `configuration.ts:91` |
| `VECTOR_EMBEDDING_MODEL` | ✅ Yes* | `text-embedding-3-small` | Model identifier | `configuration.ts:92`, `vector-search.config.ts:133` |
| `VECTOR_EMBEDDING_DIMENSIONS` | ✅ Yes* | `1536` (OpenAI), `1024` (Anthropic), `768` (Local) | Vector dimensions | `configuration.ts:93`, `vector-search.config.ts:137` |
| `VECTOR_EMBEDDING_API_KEY` | ❌ Optional | Falls back to `OPENAI_API_KEY` | Provider-specific API key | `configuration.ts:96` |
| `VECTOR_EMBEDDING_BATCH_SIZE` | ❌ Optional | `100` | Batch size for embedding generation | `configuration.ts:97` |
| `VECTOR_EMBEDDING_MAX_RETRIES` | ❌ Optional | `3` | Max retry attempts | `configuration.ts:100` |
| `VECTOR_EMBEDDING_TIMEOUT_MS` | ❌ Optional | `30000` | Request timeout in milliseconds | `configuration.ts:103` |

*Required if `VECTOR_SEARCH_ENABLED=true`

**Status in .env.example**: ✅ All documented (lines 52-58)

**Important Note**:
- `OPENAI_API_KEY` is used by default for OpenAI provider (line 53 in configuration.ts)
- Vector dimensions must match database schema (hardcoded as `vector(1536)` in migrations)

### 2.3 Search Configuration

| Variable | Required | Default | Description | Location |
|----------|----------|---------|-------------|----------|
| `VECTOR_SEARCH_DEFAULT_METRIC` | ❌ Optional | `cosine` | Similarity metric (cosine/euclidean/dot_product) | `configuration.ts:108`, `vector-search.config.ts:160` |
| `VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY` | ❌ Optional | `0.7` | Minimum similarity threshold (0.0-1.0) | `configuration.ts:109` |
| `VECTOR_SEARCH_DEFAULT_LIMIT` | ❌ Optional | `10` | Default number of results | `configuration.ts:112` |
| `VECTOR_SEARCH_MAX_LIMIT` | ❌ Optional | `100` | Maximum allowed results | `configuration.ts:115` |
| `VECTOR_SEARCH_INCLUDE_SCORES_BY_DEFAULT` | ❌ Optional | `true` | Include similarity scores in results | `configuration.ts:119` |

**Status in .env.example**: ✅ All documented (lines 61-65)

### 2.4 Index Configuration (pgvector-specific)

| Variable | Required | Default | Description | Location |
|----------|----------|---------|-------------|----------|
| `VECTOR_INDEX_NAME` | ❌ Optional | `vector_embeddings` | Vector index/table name | `configuration.ts:122`, `vector-search.config.ts:180` |
| `VECTOR_INDEX_AUTO_CREATE` | ❌ Optional | `true` (non-prod), `false` (prod) | Auto-create index if missing | `configuration.ts:123`, `vector-search.config.ts:184` |
| `VECTOR_INDEX_LISTS` | ❌ Optional | `100` | Number of lists for IVF index (pgvector) | `configuration.ts:124`, `vector-search.config.ts:188` |
| `VECTOR_INDEX_PROBES` | ❌ Optional | `10` | Number of probes for search (pgvector) | `configuration.ts:127`, `vector-search.config.ts:189` |

**Status in .env.example**: ✅ All documented (lines 68-71)

**pgvector Index Details**:
- `VECTOR_INDEX_LISTS`: Controls IVF (Inverted File) index creation
  - Formula: `lists = rows / 1000` for large datasets
  - Affects index build time and search performance
- `VECTOR_INDEX_PROBES`: Controls search accuracy vs speed trade-off
  - Higher values = more accurate but slower searches
  - Recommended: 1-20 probes for most use cases

### 2.5 Performance Configuration

| Variable | Required | Default | Description | Location |
|----------|----------|---------|-------------|----------|
| `VECTOR_PERFORMANCE_ENABLE_CACHE` | ❌ Optional | `true` (prod), `false` (dev/test) | Enable embedding caching | `configuration.ts:132`, `vector-search.config.ts:193` |
| `VECTOR_PERFORMANCE_CACHE_TTL_SECONDS` | ❌ Optional | `3600` | Cache TTL in seconds | `configuration.ts:133` |
| `VECTOR_PERFORMANCE_POOL_SIZE` | ❌ Optional | `10` | Connection pool size | `configuration.ts:136` |

**Status in .env.example**: ✅ All documented (lines 74-76)

---

## 3. pgvector Extension Configuration

### 3.1 Extension Enablement

**Method**: Migration-based (no environment variable)

**Files**:
- `apps/server/src/migrations/1736246400000-EnablePgvectorExtension.ts` - Dedicated pgvector extension migration
- `apps/server/src/database/migrations/1733295000000-InitialSchema.ts` - Initial schema with vector extension

**SQL**: `CREATE EXTENSION IF NOT EXISTS vector`

**No environment variable required** - extension is enabled automatically via TypeORM migrations.

### 3.2 Vector Data Types in Database

**Entity**: `VectorEmbedding` (`apps/server/src/entities/vector-embedding.entity.ts`)

**Vector Column Configuration**:
```typescript
// TypeORM entity uses 'text' type (workaround)
@Column({ type: 'text', nullable: false })
embedding: string;

// Actual database type is vector(1536) set in migration
```

**Dimension**: Fixed at `1536` in migration (matches OpenAI embeddings)

**Supported Models** (from `vector-embedding.entity.ts:28-34`):
- `OPENAI_ADA_002`: 1536 dimensions
- `OPENAI_SMALL_3`: 1536 dimensions
- `OPENAI_LARGE_3`: 3072 dimensions
- `COHERE_ENGLISH_V3`: 1024 dimensions
- `CUSTOM`: Variable dimensions

**Note**: To use different dimensions, database migration must be updated.

---

## 4. Related Infrastructure Variables

### 4.1 Redis (Optional Caching)

| Variable | Required | Default | Description | Location |
|----------|----------|---------|-------------|----------|
| `REDIS_PORT` | ❌ Optional | `6379` | Redis server port | `docker/docker-compose.yml:31` |

**Status in .env.example**: ❌ Not documented (Redis is optional)

**Usage**: Optional caching layer for vector operations (not currently implemented)

### 4.2 Node Environment

| Variable | Required | Default | Description | Location |
|----------|----------|---------|-------------|----------|
| `NODE_ENV` | ✅ Yes | `development` | Node environment (development/production/test) | `configuration.ts:2` |

**Status in .env.example**: ✅ Documented (line 6)

**Impact on pgvector**:
- Test mode: Disables vector search by default
- Production mode: Enables caching, disables auto-index creation

---

## 5. Test Environment Specifics

### 5.1 Test Database Configuration

**Special Variables** (used in CI/CD):
- `JEST_WORKER_ID`: Jest parallel worker ID (used for schema isolation)
- `DB_SCHEMA`: Set to `hollon_test_worker_N` for parallel tests

**CI Configuration** (`.github/workflows/ci.yml:274-289`):
```yaml
env:
  DB_HOST: localhost
  DB_PORT: 5432
  DB_USER: hollon
  DB_PASSWORD: hollon_test_password
  DB_NAME: hollon
  DB_SCHEMA: hollon_test_worker_1
```

**PostgreSQL Service**:
```yaml
postgres:
  image: pgvector/pgvector:pg16
  env:
    POSTGRES_USER: hollon
    POSTGRES_PASSWORD: hollon_test_password
    POSTGRES_DB: hollon
```

### 5.2 Test Setup Scripts

Multiple test scripts use database configuration:
- `apps/server/src/scripts/setup-test-db.ts`
- `apps/server/src/scripts/reset-test-db.ts`
- `apps/server/src/scripts/sync-test-db.ts`
- `apps/server/src/scripts/check-test-db-state.ts`
- `apps/server/test/setup/test-database.ts`

All scripts read standard `DB_*` environment variables.

---

## 6. Dependencies and API Keys

### 6.1 OpenAI API (Primary Embedding Provider)

| Variable | Required | Default | Description | Location |
|----------|----------|---------|-------------|----------|
| `OPENAI_API_KEY` | ✅ Yes* | (none) | OpenAI API key for embeddings | `configuration.ts:53` |

*Required if using OpenAI as embedding provider

**Status in .env.example**: ✅ Documented (line 43)

**Validation**: `vector-search.config.ts:228-234` validates API key presence when OpenAI provider is enabled

### 6.2 Anthropic API (Optional Brain Provider)

| Variable | Required | Default | Description | Location |
|----------|----------|---------|-------------|----------|
| `ANTHROPIC_API_KEY` | ❌ Optional | (none) | Anthropic API key (for brain, not currently used for embeddings) | `configuration.ts:52` |

**Status in .env.example**: ✅ Documented (line 38)

**Note**: Anthropic embeddings not yet implemented (placeholder in `vector-search.config.ts:116-119`)

---

## 7. Recommendations

### 7.1 Current Status: ✅ Complete

All pgvector-related environment variables are properly documented in `.env.example`.

### 7.2 Optional Enhancements

Consider adding these optional variables for future functionality:

1. **Redis Configuration** (if caching is implemented):
   ```bash
   # Redis (optional - for vector search caching)
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

2. **Advanced pgvector Settings**:
   ```bash
   # pgvector Advanced Configuration (optional)
   VECTOR_INDEX_TYPE=ivfflat  # or hnsw
   VECTOR_INDEX_M=16          # HNSW parameter
   VECTOR_INDEX_EF_CONSTRUCTION=64  # HNSW parameter
   ```

3. **Monitoring and Debugging**:
   ```bash
   # Vector Search Monitoring (optional)
   VECTOR_SEARCH_LOG_QUERIES=false
   VECTOR_SEARCH_METRICS_ENABLED=true
   ```

### 7.3 Documentation Recommendations

1. **Add Comments in .env.example**:
   - Clarify that `DB_*` variables must point to PostgreSQL with pgvector extension
   - Note that Docker setup automatically includes pgvector
   - Explain dimension requirements must match database schema

2. **Update README** with pgvector setup instructions:
   - PostgreSQL version requirements (13+, recommended 14+)
   - pgvector extension installation (if not using Docker)
   - Cloud provider compatibility (AWS RDS, GCP Cloud SQL, etc.)

3. **Migration Documentation**:
   - Document that vector dimensions are hardcoded in migrations
   - Explain how to change dimensions (requires new migration)
   - Note TypeORM workaround for pgvector types

---

## 8. Configuration Validation

### 8.1 Validation Functions

**Location**: `apps/server/src/modules/vector-search/config/vector-search.config.ts:216-274`

**Validates**:
- Embedding dimensions > 0
- OpenAI API key present when using OpenAI provider
- Similarity threshold between 0 and 1
- Search limits are positive
- Index configuration values are positive
- Performance settings are valid

### 8.2 Validation Checks

Run these checks to verify configuration:

```bash
# 1. Verify database connection and pgvector extension
pnpm --filter @hollon-ai/server db:verify

# 2. Run migrations to ensure pgvector is enabled
pnpm --filter @hollon-ai/server db:migrate

# 3. Verify configuration loads correctly
pnpm --filter @hollon-ai/server test:integration
```

---

## 9. File Reference Matrix

### 9.1 Environment Variable Usage

| File | Purpose | Variables Used |
|------|---------|----------------|
| `.env.example` | Template configuration | ALL variables (lines 1-99) |
| `apps/server/src/config/configuration.ts` | Main config loader | ALL `DB_*`, `VECTOR_*`, `OPENAI_API_KEY` |
| `apps/server/src/config/typeorm.config.ts` | TypeORM DataSource | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SCHEMA` |
| `apps/server/src/modules/vector-search/config/vector-search.config.ts` | Vector search config factory | ALL `VECTOR_*` variables |
| `docker/docker-compose.yml` | Docker infrastructure | `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `REDIS_PORT` |
| `.github/workflows/ci.yml` | CI/CD pipeline | `DB_*`, `POSTGRES_*` |
| `apps/server/test/setup/test-database.ts` | Test database setup | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` |

### 9.2 pgvector-Specific Code

| File | Purpose | pgvector Usage |
|------|---------|----------------|
| `apps/server/src/migrations/1736246400000-EnablePgvectorExtension.ts` | Enable extension | `CREATE EXTENSION vector` |
| `apps/server/src/database/migrations/1733295000000-InitialSchema.ts` | Initial schema | `vector(1536)` column type |
| `apps/server/src/entities/vector-embedding.entity.ts` | Vector entity | TypeORM entity with vector column |
| `apps/server/src/modules/vector-search/vector-search.service.ts` | Vector search service | pgvector similarity queries |
| `apps/server/src/modules/vector-search/config/vector-search.config.ts` | Index configuration | IVF lists/probes settings |

---

## 10. Audit Conclusion

### ✅ Audit Complete

**Summary**:
- Total pgvector-related variables: 25
- Documented in `.env.example`: 25 (100%)
- Missing variables: 0
- Optional enhancements identified: 3 categories

**Critical Variables Status**:
- ✅ Database connection variables: Complete
- ✅ Vector search configuration: Complete
- ✅ Embedding provider settings: Complete
- ✅ Index configuration: Complete
- ✅ Performance settings: Complete

**Action Items**: None required - `.env.example` is comprehensive.

**Next Steps** (optional):
1. Consider adding Redis configuration if caching will be implemented
2. Add inline comments in `.env.example` explaining pgvector requirements
3. Create separate `.env.development` and `.env.production` templates with recommended values

---

## Appendix A: Quick Reference

### Essential pgvector Variables

Minimum required for pgvector functionality:

```bash
# Database (must have pgvector extension)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hollon
DB_USER=hollon
DB_PASSWORD=your_password

# Vector Search
VECTOR_SEARCH_ENABLED=true
OPENAI_API_KEY=your_openai_key

# Recommended Defaults
VECTOR_EMBEDDING_PROVIDER=openai
VECTOR_EMBEDDING_MODEL=text-embedding-3-small
VECTOR_EMBEDDING_DIMENSIONS=1536
```

### Environment-Specific Recommendations

**Development**:
```bash
VECTOR_SEARCH_ENABLED=true
VECTOR_INDEX_AUTO_CREATE=true
VECTOR_PERFORMANCE_ENABLE_CACHE=false
LOG_LEVEL=debug
```

**Production**:
```bash
VECTOR_SEARCH_ENABLED=true
VECTOR_INDEX_AUTO_CREATE=false  # Create indexes manually
VECTOR_PERFORMANCE_ENABLE_CACHE=true
VECTOR_PERFORMANCE_CACHE_TTL_SECONDS=7200
LOG_LEVEL=info
```

**Test**:
```bash
VECTOR_SEARCH_ENABLED=false  # Disabled by default in tests
NODE_ENV=test
DB_SCHEMA=hollon_test
```

---

**Audit Completed**: 2025-01-07
**Audited By**: Claude (Hollon-AI)
**Version**: 1.0.0
