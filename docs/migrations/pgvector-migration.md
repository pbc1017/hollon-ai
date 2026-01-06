# pgvector Migration Documentation

## Overview

This document provides comprehensive information about the pgvector extension setup and usage in the Hollon-AI project. The pgvector extension enables vector similarity search capabilities in PostgreSQL, which is essential for implementing semantic search, knowledge retrieval, and AI-powered features.

## Table of Contents

1. [Purpose](#purpose)
2. [Migration Details](#migration-details)
3. [Schema Changes](#schema-changes)
4. [Setup Instructions](#setup-instructions)
5. [Rollback Procedures](#rollback-procedures)
6. [Usage Examples](#usage-examples)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting](#troubleshooting)

---

## Purpose

### Why pgvector?

The pgvector extension provides open-source vector similarity search capabilities for PostgreSQL, enabling:

- **Semantic Search**: Find similar documents based on meaning rather than keyword matching
- **Knowledge Retrieval**: Retrieve relevant information using AI embeddings (RAG - Retrieval-Augmented Generation)
- **Relationship Discovery**: Identify related entities and concepts in the knowledge graph
- **Content Deduplication**: Detect duplicate or near-duplicate content using vector similarity
- **Recommendation Systems**: Suggest related content based on vector proximity

### Use Cases in Hollon-AI

1. **Document Search**: Enable semantic search across organizational documents
2. **Knowledge Graph**: Store and query vector embeddings for graph nodes
3. **Task Matching**: Find similar tasks or relevant context for task execution
4. **Decision Memory**: Retrieve past decisions based on semantic similarity
5. **Code Search**: Enable semantic code search for development tasks

---

## Migration Details

### Migration Files

The pgvector setup is implemented across the following migrations:

#### 1. Initial Schema Migration

**File**: `apps/server/src/database/migrations/1733295000000-InitialSchema.ts`

**Purpose**: Enables the pgvector extension and creates the initial schema including the documents table with vector embedding support.

**Changes**:
- Enables `pgvector` extension
- Creates `documents` table with `embedding vector(1536)` column
- Sets up indexes for efficient document retrieval
- Configures foreign key relationships

**Migration Class**: `InitialSchema1733295000000`

**Timestamp**: 1733295000000 (December 4, 2023)

#### 2. Knowledge Items Migration

**File**: `apps/server/src/database/migrations/1766556710000-CreateKnowledgeItemsTable.ts`

**Purpose**: Creates the knowledge_items table for storing extracted knowledge that can be enhanced with embeddings in future iterations.

**Changes**:
- Creates `knowledge_items` table
- Prepares schema for future vector embedding integration
- Sets up indexes for performance

**Migration Class**: `CreateKnowledgeItemsTable1766556710000`

**Timestamp**: 1766556710000 (January 23, 2026)

### Docker Setup

**File**: `docker/init-scripts/01-init.sql`

**Purpose**: Initializes the PostgreSQL database with required extensions when the Docker container is first created.

**Changes**:
- Enables `uuid-ossp` extension for UUID generation
- Enables `vector` extension (pgvector) in the public schema
- Enables `pg_trgm` extension for text search
- Creates `hollon` and `hollon_test` schemas
- Grants appropriate permissions

---

## Schema Changes

### Extension Installation

```sql
-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;
```

**Impact**:
- Adds vector data types to PostgreSQL
- Enables vector operators (<->, <=>, <#>, <+>)
- Provides vector indexing capabilities (IVFFlat, HNSW)

### Documents Table Vector Column

The `documents` table includes a vector embedding column:

```sql
CREATE TABLE "documents" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organization_id" uuid NOT NULL,
  "project_id" uuid,
  "task_id" uuid,
  "hollon_id" uuid,
  "title" varchar(500) NOT NULL,
  "content" text NOT NULL,
  "type" document_type_enum NOT NULL DEFAULT 'memory',
  "keywords" jsonb DEFAULT '[]',
  "embedding" vector(1536),  -- Vector embedding column
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  -- Foreign key constraints...
);
```

**Column Details**:

- **Type**: `vector(1536)`
- **Dimensions**: 1536 (compatible with OpenAI text-embedding-ada-002 and text-embedding-3-small)
- **Nullable**: Yes (allows documents without embeddings)
- **Purpose**: Stores vector embeddings for semantic similarity search

### Vector Type Characteristics

| Property | Value | Notes |
|----------|-------|-------|
| Dimensions | 1536 | OpenAI standard embedding size |
| Storage Size | ~6 KB per vector | 4 bytes per dimension |
| Max Dimensions | 2,000 | pgvector limitation for vector type |
| Supported Types | vector, halfvec, bit, sparsevec | See [pgvector-best-practices.md](../pgvector-best-practices.md) |

### Indexes

The current schema includes basic indexes for document retrieval:

```sql
-- Organization-based filtering
CREATE INDEX "IDX_documents_organization"
  ON "documents" ("organization_id");

-- Project-based filtering
CREATE INDEX "IDX_documents_project"
  ON "documents" ("project_id");

-- Task-based filtering
CREATE INDEX "IDX_documents_task"
  ON "documents" ("task_id");
```

**Note**: Vector-specific indexes (HNSW or IVFFlat) should be added in a separate migration when vector search is implemented. See [Performance Considerations](#performance-considerations) for details.

---

## Setup Instructions

### Development Environment

#### Prerequisites

- Docker and Docker Compose installed
- pnpm 9.x or higher
- Node.js 18.x or higher
- PostgreSQL 11+ (automatically handled by Docker)

#### Steps

1. **Start the PostgreSQL database with pgvector**:

   ```bash
   # From project root
   docker-compose up -d postgres
   ```

   The Docker container uses the `pgvector/pgvector:pg16` image which includes:
   - PostgreSQL 16
   - pgvector extension pre-installed

2. **Verify extension installation**:

   ```bash
   # Connect to the database
   docker exec -it hollon-ai-postgres psql -U hollon -d hollon

   # Check available extensions
   \dx

   # Verify vector extension
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

   Expected output:
   ```
     oid  | extname | extowner | extnamespace | extrelocatable | extversion | extconfig | extcondition
   -------+---------+----------+--------------+----------------+------------+-----------+--------------
    16516 | vector  |       10 |         2200 | t              | 0.8.1      |           |
   ```

3. **Run migrations**:

   ```bash
   # From apps/server directory
   cd apps/server
   pnpm run migration:run
   ```

4. **Verify schema**:

   ```bash
   # Connect to database
   docker exec -it hollon-ai-postgres psql -U hollon -d hollon

   # Check documents table structure
   \d documents

   # Verify vector column
   SELECT column_name, data_type, udt_name
   FROM information_schema.columns
   WHERE table_name = 'documents' AND column_name = 'embedding';
   ```

### Production Environment

#### Prerequisites

- PostgreSQL 11+ with pgvector extension installed
- Database credentials and connection string
- Appropriate database permissions (CREATE EXTENSION, CREATE TABLE, etc.)

#### Steps

1. **Install pgvector extension on PostgreSQL server**:

   The installation method depends on your PostgreSQL hosting:

   **AWS RDS/Aurora PostgreSQL**:
   - pgvector is available as a supported extension
   - Enable in parameter groups or via SQL
   - Minimum version: PostgreSQL 11+

   **Google Cloud SQL**:
   - pgvector available on PostgreSQL 12+
   - Enable via Cloud Console or gcloud CLI

   **Azure Database for PostgreSQL**:
   - pgvector available as extension
   - Enable via Azure Portal or Azure CLI

   **Self-hosted PostgreSQL**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql-<version>-pgvector

   # From source
   git clone https://github.com/pgvector/pgvector.git
   cd pgvector
   make
   sudo make install
   ```

2. **Enable extension in database**:

   ```sql
   -- Connect as superuser or database owner
   CREATE EXTENSION IF NOT EXISTS vector SCHEMA public;
   ```

3. **Configure environment variables**:

   ```bash
   # .env.production
   DB_HOST=your-production-host
   DB_PORT=5432
   DB_USER=hollon
   DB_PASSWORD=secure_password
   DB_NAME=hollon
   DB_SCHEMA=hollon
   ```

4. **Run migrations**:

   ```bash
   # Set environment
   export NODE_ENV=production

   # Run migrations
   pnpm run migration:run
   ```

5. **Verify deployment**:

   ```bash
   # Check extension version
   SELECT extversion FROM pg_extension WHERE extname = 'vector';

   # Verify schema
   SELECT table_name, column_name, data_type
   FROM information_schema.columns
   WHERE table_schema = 'hollon'
   AND column_name = 'embedding';
   ```

### Verification Checklist

After setup, verify the following:

- [ ] pgvector extension is enabled and accessible
- [ ] Extension version is 0.7.0 or higher (0.8.1+ recommended)
- [ ] Documents table exists with embedding column
- [ ] Vector column has correct dimensions (1536)
- [ ] Basic indexes are created
- [ ] Foreign key constraints are in place
- [ ] Test database setup (for development)

---

## Rollback Procedures

### Rollback Strategy

The migration system provides safe rollback capabilities. However, **vector column removal should be done with caution** as it results in data loss.

### Development Environment Rollback

#### Complete Rollback (All Migrations)

```bash
# From apps/server directory
cd apps/server

# Revert all migrations
pnpm run migration:revert

# Or revert to specific migration
pnpm run migration:revert -- -t 1733295000000
```

#### Database Reset (Development Only)

```bash
# Stop and remove database container
docker-compose down -v

# Remove volume
docker volume rm hollon-ai_postgres_data

# Restart and re-migrate
docker-compose up -d postgres
cd apps/server
pnpm run migration:run
```

### Production Environment Rollback

**⚠️ WARNING**: Production rollbacks require careful planning and may result in data loss.

#### Pre-Rollback Checklist

- [ ] Create full database backup
- [ ] Verify backup integrity
- [ ] Plan maintenance window
- [ ] Notify stakeholders
- [ ] Document rollback reason
- [ ] Prepare rollback commands

#### Step-by-Step Rollback

1. **Create backup**:

   ```bash
   # Create full database backup
   pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f backup_before_rollback_$(date +%Y%m%d_%H%M%S).dump

   # Verify backup
   pg_restore --list backup_before_rollback_*.dump | head -20
   ```

2. **Test rollback in staging**:

   ```bash
   # In staging environment
   pnpm run migration:revert
   ```

3. **Execute production rollback**:

   ```bash
   # Set production environment
   export NODE_ENV=production

   # Revert migration
   pnpm run migration:revert
   ```

4. **Verify rollback**:

   ```sql
   -- Check extension status
   SELECT * FROM pg_extension WHERE extname = 'vector';

   -- Verify documents table (should not have embedding column)
   \d documents

   -- Check migration status
   SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5;
   ```

#### Partial Rollback (Keep Extension, Remove Tables)

If you want to keep the pgvector extension but remove specific tables:

```sql
BEGIN;

-- Remove documents table (if needed)
DROP TABLE IF EXISTS documents CASCADE;

-- Keep the vector extension
-- (Extension remains available for future use)

COMMIT;
```

### Data Preservation During Rollback

To preserve embedding data before rollback:

```sql
-- Create backup table with embeddings
CREATE TABLE documents_embeddings_backup AS
SELECT
  id,
  embedding,
  created_at,
  updated_at
FROM documents
WHERE embedding IS NOT NULL;

-- After rollback, data can be restored or exported
```

### Emergency Rollback

In case of critical issues:

```sql
-- Quick rollback: Drop vector column only
BEGIN;

ALTER TABLE documents DROP COLUMN IF EXISTS embedding;

COMMIT;

-- Extension remains, can be restored later without full migration
```

---

## Usage Examples

### Basic Vector Operations

#### Inserting Documents with Embeddings

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
  ) {}

  async createDocumentWithEmbedding(
    title: string,
    content: string,
    embedding: number[],
    organizationId: string,
  ): Promise<Document> {
    // Validate embedding dimensions
    if (embedding.length !== 1536) {
      throw new Error(`Invalid embedding dimensions: expected 1536, got ${embedding.length}`);
    }

    // Convert embedding array to pgvector format
    const embeddingStr = `[${embedding.join(',')}]`;

    // Insert document with embedding
    const document = await this.documentRepository
      .createQueryBuilder()
      .insert()
      .into(Document)
      .values({
        title,
        content,
        organizationId,
        embedding: () => `'${embeddingStr}'::vector`,
      })
      .returning('*')
      .execute();

    return document.raw[0];
  }
}
```

#### Similarity Search

```typescript
async findSimilarDocuments(
  queryEmbedding: number[],
  organizationId: string,
  limit: number = 10,
  minSimilarity: number = 0.7,
): Promise<Array<{ document: Document; similarity: number }>> {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const results = await this.documentRepository
    .createQueryBuilder('doc')
    .select([
      'doc.id',
      'doc.title',
      'doc.content',
      'doc.created_at',
    ])
    // Calculate cosine similarity (1 - cosine distance)
    .addSelect(`1 - (doc.embedding <=> '${embeddingStr}'::vector)`, 'similarity')
    .where('doc.organization_id = :organizationId', { organizationId })
    // Filter by similarity threshold
    .andWhere(`(doc.embedding <=> '${embeddingStr}'::vector) < :threshold`, {
      threshold: 1 - minSimilarity,
    })
    // Order by similarity (closest first)
    .orderBy(`doc.embedding <=> '${embeddingStr}'::vector`, 'ASC')
    .limit(limit)
    .getRawMany();

  return results.map(row => ({
    document: row,
    similarity: parseFloat(row.similarity),
  }));
}
```

#### Hybrid Search (Vector + Metadata)

```typescript
async hybridSearch(
  queryEmbedding: number[],
  organizationId: string,
  filters: {
    projectId?: string;
    type?: string;
    keywords?: string[];
  },
  limit: number = 10,
): Promise<Document[]> {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  let query = this.documentRepository
    .createQueryBuilder('doc')
    .select([
      'doc.id',
      'doc.title',
      'doc.content',
      'doc.type',
      'doc.keywords',
    ])
    .addSelect(`doc.embedding <=> '${embeddingStr}'::vector`, 'distance')
    .where('doc.organization_id = :organizationId', { organizationId });

  // Apply metadata filters
  if (filters.projectId) {
    query = query.andWhere('doc.project_id = :projectId', {
      projectId: filters.projectId,
    });
  }

  if (filters.type) {
    query = query.andWhere('doc.type = :type', { type: filters.type });
  }

  if (filters.keywords && filters.keywords.length > 0) {
    query = query.andWhere('doc.keywords ?| ARRAY[:...keywords]', {
      keywords: filters.keywords,
    });
  }

  // Order by vector similarity
  query = query
    .orderBy(`doc.embedding <=> '${embeddingStr}'::vector`, 'ASC')
    .limit(limit);

  return query.getMany();
}
```

### Distance Operators

pgvector provides multiple distance operators for different use cases:

| Operator | Distance Type | SQL Example | Use Case |
|----------|---------------|-------------|----------|
| `<=>` | Cosine distance | `embedding <=> '[...]'` | Text embeddings (recommended) |
| `<->` | L2 (Euclidean) | `embedding <-> '[...]'` | General similarity |
| `<#>` | Inner product | `embedding <#> '[...]'` | Normalized vectors |
| `<+>` | L1 (Manhattan) | `embedding <+> '[...]'` | Specialized use cases |

**Recommendation**: Use cosine distance (`<=>`) for text embeddings as it's invariant to vector magnitude.

### SQL Examples

#### Find Top 10 Similar Documents

```sql
SELECT
  id,
  title,
  content,
  1 - (embedding <=> '[0.1, 0.2, ..., 0.5]'::vector) AS similarity
FROM documents
WHERE
  organization_id = 'org-uuid'
  AND embedding IS NOT NULL
ORDER BY embedding <=> '[0.1, 0.2, ..., 0.5]'::vector
LIMIT 10;
```

#### Find Documents Within Distance Threshold

```sql
SELECT
  id,
  title,
  embedding <=> '[0.1, 0.2, ..., 0.5]'::vector AS distance
FROM documents
WHERE
  organization_id = 'org-uuid'
  AND (embedding <=> '[0.1, 0.2, ..., 0.5]'::vector) < 0.3
ORDER BY distance
LIMIT 10;
```

#### Detect Duplicate Documents

```sql
SELECT
  a.id AS doc1_id,
  b.id AS doc2_id,
  a.title AS doc1_title,
  b.title AS doc2_title,
  a.embedding <=> b.embedding AS distance
FROM documents a
JOIN documents b ON a.id < b.id
WHERE
  a.organization_id = 'org-uuid'
  AND b.organization_id = 'org-uuid'
  AND (a.embedding <=> b.embedding) < 0.1
ORDER BY distance
LIMIT 20;
```

---

## Performance Considerations

### Vector Indexing

For optimal query performance with large datasets, vector-specific indexes should be created. The initial migration does not include these indexes to allow flexibility in choosing the right strategy.

#### When to Add Vector Indexes

- **< 10,000 rows**: Exact search is fast enough; no index needed
- **10,000 - 100,000 rows**: Consider IVFFlat for static data, HNSW for dynamic data
- **> 100,000 rows**: HNSW index recommended

#### HNSW Index (Recommended)

Create a separate migration for HNSW index:

```typescript
// Example migration: AddDocumentsVectorIndex
export class AddDocumentsVectorIndex1234567890000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // HNSW index for vector similarity search
    await queryRunner.query(`
      CREATE INDEX idx_documents_embedding_hnsw
      ON documents
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_documents_embedding_hnsw
    `);
  }
}
```

**Parameters**:
- `m = 16`: Maximum connections per layer (higher = better recall, more memory)
- `ef_construction = 64`: Build quality (higher = better index, slower build)

**Performance**:
- Build time: Slower (hours for 1M+ vectors)
- Query speed: 15.5x faster than IVFFlat
- Recall quality: Better and more stable
- Update resilience: Excellent

#### IVFFlat Index (Alternative)

For static datasets or faster builds:

```sql
CREATE INDEX idx_documents_embedding_ivfflat
ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Parameters**:
- `lists`: Number of clusters (recommended: rows / 1000 for < 1M rows)

**Performance**:
- Build time: 32x faster than HNSW
- Query speed: Slower than HNSW
- Best for: Static datasets with infrequent updates

### Query Optimization

#### Best Practices

1. **Filter before searching**: Always include organization_id and other filters
2. **Use appropriate distance operator**: Cosine (`<=>`) for text embeddings
3. **Set realistic limits**: Don't retrieve more results than needed
4. **Monitor query performance**: Use EXPLAIN ANALYZE for slow queries
5. **Consider caching**: Cache frequently accessed embeddings

#### Example: EXPLAIN ANALYZE

```sql
EXPLAIN ANALYZE
SELECT
  id,
  title,
  embedding <=> '[...]'::vector AS distance
FROM documents
WHERE
  organization_id = 'org-uuid'
  AND embedding IS NOT NULL
ORDER BY embedding <=> '[...]'::vector
LIMIT 10;
```

### Database Configuration

For optimal pgvector performance, configure PostgreSQL settings:

```ini
# postgresql.conf
shared_buffers = 4GB              # 25% of RAM
effective_cache_size = 12GB       # 75% of RAM
work_mem = 256MB                  # Per-operation memory
maintenance_work_mem = 2GB        # For index builds

# For HNSW index searches
hnsw.ef_search = 40              # Default: 40, Range: 10-1000
```

### Monitoring

Track these metrics for pgvector performance:

1. **Query latency**: Average and P95 for vector searches
2. **Index hit rate**: Ensure indexes are being used
3. **Memory usage**: Monitor work_mem and shared_buffers
4. **Disk I/O**: Vector operations can be I/O intensive

```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE tablename = 'documents';

-- Check table and index sizes
SELECT
  pg_size_pretty(pg_total_relation_size('documents')) AS total_size,
  pg_size_pretty(pg_relation_size('documents')) AS table_size,
  pg_size_pretty(pg_indexes_size('documents')) AS indexes_size;
```

---

## Troubleshooting

### Common Issues

#### 1. Extension Not Found

**Error**:
```
ERROR: extension "vector" is not available
```

**Solution**:
- Verify pgvector is installed on PostgreSQL server
- Check PostgreSQL version (11+ required)
- Install pgvector extension (see [Setup Instructions](#setup-instructions))

#### 2. Dimension Mismatch

**Error**:
```
ERROR: expected 1536 dimensions, not 1024
```

**Solution**:
- Ensure embedding arrays have exactly 1536 elements
- Verify embedding model output dimensions
- Consider creating separate columns for different dimensions

#### 3. Invalid Vector Format

**Error**:
```
ERROR: invalid input syntax for type vector
```

**Solution**:
- Check vector format: `[1,2,3,...]` (no spaces)
- Validate numeric values (no NaN or Infinity)
- Use proper type casting: `'[...]'::vector`

#### 4. Slow Query Performance

**Symptom**: Vector searches take > 1 second

**Solutions**:
1. Create vector index (HNSW or IVFFlat)
2. Add filters to reduce search space
3. Increase `hnsw.ef_search` for better recall
4. Monitor and optimize with EXPLAIN ANALYZE
5. Consider increasing `work_mem`

#### 5. Index Build Fails

**Error**:
```
ERROR: out of memory
```

**Solution**:
- Increase `maintenance_work_mem` to 2GB or higher
- Build index during low-traffic periods
- Use `CREATE INDEX CONCURRENTLY` for production
- Consider building on replica first

#### 6. Docker Container Issues

**Symptom**: pgvector extension not available in Docker

**Solutions**:
1. Verify using correct image: `pgvector/pgvector:pg16`
2. Check init scripts are running: `docker logs hollon-ai-postgres`
3. Rebuild container: `docker-compose up -d --force-recreate postgres`
4. Connect and manually create extension: `CREATE EXTENSION vector;`

### Debug Commands

```bash
# Check pgvector version
docker exec hollon-ai-postgres psql -U hollon -d hollon -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"

# List all extensions
docker exec hollon-ai-postgres psql -U hollon -d hollon -c "\dx"

# Check documents table structure
docker exec hollon-ai-postgres psql -U hollon -d hollon -c "\d documents"

# Verify vector column type
docker exec hollon-ai-postgres psql -U hollon -d hollon -c "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'embedding';"

# Check migration status
docker exec hollon-ai-postgres psql -U hollon -d hollon -c "SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5;"
```

### Getting Help

If issues persist:

1. Review [pgvector-best-practices.md](../pgvector-best-practices.md) for detailed guidance
2. Check [pgvector documentation](https://github.com/pgvector/pgvector)
3. Review migration files for inline comments and documentation
4. Check Docker logs: `docker logs hollon-ai-postgres`
5. Verify PostgreSQL logs for detailed error messages

---

## Related Documentation

- [pgvector Best Practices](../pgvector-best-practices.md) - Comprehensive guide to pgvector integration
- [pgvector Implementation Review](../pgvector-implementation-review.md) - Implementation analysis
- [pgvector TypeORM Integration](../pgvector-typeorm-integration.md) - TypeORM-specific patterns
- [Database Migration Audit](../database/migration-audit-2025-01.md) - Migration tracking

---

## Document Metadata

- **Created**: 2025-01-06
- **Last Updated**: 2025-01-06
- **Version**: 1.0
- **pgvector Version**: 0.8.1 (latest as of January 2025)
- **PostgreSQL Version**: 16 (Docker), 11+ (minimum)
- **Related Migrations**:
  - `1733295000000-InitialSchema.ts`
  - `1766556710000-CreateKnowledgeItemsTable.ts`
- **Related Issues**: Vector Embedding Schema Design

---

## Appendix

### Quick Reference

#### Vector Types and Dimensions

| Type | Max Dimensions | Storage/Dim | Use Case |
|------|----------------|-------------|----------|
| vector | 2,000 | 4 bytes | Standard embeddings |
| halfvec | 4,000 | 2 bytes | Large embeddings, cost optimization |
| sparsevec | 1,000 nonzero | Variable | Sparse embeddings (BM25) |
| bit | 64,000 | 1/8 byte | Binary quantization |

#### Common Models and Dimensions

| Model | Dimensions | Type |
|-------|------------|------|
| OpenAI ada-002 | 1536 | vector |
| OpenAI text-embedding-3-small | 1536 | vector |
| OpenAI text-embedding-3-large | 3072 | vector/halfvec |
| Cohere embed-english-v3.0 | 1024 | vector |

#### Distance Metrics Cheat Sheet

```sql
-- Cosine similarity (convert distance to similarity: 0-1)
SELECT 1 - (embedding <=> query_vector) AS similarity

-- Find vectors with similarity > 0.7
WHERE (embedding <=> query_vector) < 0.3  -- (1 - 0.7 = 0.3)

-- L2 distance
SELECT embedding <-> query_vector AS l2_distance

-- Inner product (for normalized vectors)
SELECT embedding <#> query_vector AS inner_product
```

### Migration Timeline

```
2023-12-04: InitialSchema - Enable pgvector, create documents table
2026-01-23: CreateKnowledgeItemsTable - Prepare for future embeddings
Future: Add vector indexes (HNSW/IVFFlat) based on data volume
Future: Add knowledge_items embedding column when needed
```

### Changelog

- **v1.0 (2025-01-06)**: Initial comprehensive documentation
  - Migration details and rollback procedures
  - Setup instructions for dev and production
  - Usage examples with TypeScript and SQL
  - Performance considerations and troubleshooting
  - Inline comments added to migration files

---

**End of Document**
