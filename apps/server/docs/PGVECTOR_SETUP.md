# PostgreSQL pgvector Extension Setup Guide

## Overview

This project uses PostgreSQL's `pgvector` extension to enable vector similarity search capabilities for semantic search, retrieval-augmented generation (RAG), and embeddings-based queries.

## Features

- **Vector Type Support**: Store embeddings as 1536-dimensional vectors (compatible with OpenAI embeddings)
- **Similarity Search**: Fast semantic search using L2 distance and other distance metrics
- **Optimized Indexes**: HNSW and IVFFlat indexes for efficient similarity queries
- **Integration**: Fully integrated with TypeORM ORM and NestJS backend

## Installation

### Prerequisites

- PostgreSQL 12 or later
- pgvector extension available for your PostgreSQL version

### Step 1: Install pgvector Extension

#### Option A: Using Homebrew (macOS)

```bash
brew install pgvector
```

#### Option B: Using APT (Ubuntu/Debian)

```bash
sudo apt-get install postgresql-contrib-14  # Replace 14 with your PostgreSQL version
sudo apt-get install postgresql-14-pgvector  # or the pgvector package for your distro
```

#### Option C: From Source

```bash
git clone --branch v0.5.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
# Then restart PostgreSQL
```

#### Option D: Docker

If using Docker Compose, the extension is automatically included in the pgvector-enabled images:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: hollon
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

### Step 2: Verify Installation

After restarting PostgreSQL, connect to your database and run:

```sql
-- Check if pgvector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify vector type is available
SELECT typname FROM pg_type WHERE typname = 'vector';

-- Should return: vector
```

### Step 3: Run Migrations

The application automatically sets up the necessary tables and indexes:

```bash
# Development
pnpm dev:db:migrate

# Production
npm run db:migrate
```

## Schema Setup

### Documents Table

The `documents` table includes vector support:

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  -- Vector embedding for RAG and semantic search
  embedding vector(1536),  -- 1536 dimensions for OpenAI embeddings
  organization_id UUID NOT NULL,
  type document_type_enum,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes

Three indexes are created for optimal performance:

#### 1. HNSW Index (Hierarchical Navigable Small World)

Best for most use cases with good accuracy and performance:

```sql
CREATE INDEX IDX_documents_embedding_hnsw
ON documents USING hnsw (embedding vector_l2_ops)
WITH (m = 16, ef_construction = 64);
```

**Parameters:**
- `m`: Number of bidirectional links created per element (default 16)
- `ef_construction`: Size of dynamic candidate list (default 64)

**Use Case:** General similarity search across all documents

#### 2. IVFFlat Index (Inverted File with Flat Posting Lists)

Better for memory-constrained environments:

```sql
CREATE INDEX IDX_documents_embedding_ivfflat
ON documents USING ivfflat (embedding vector_l2_ops)
WITH (lists = 100);
```

**Parameters:**
- `lists`: Number of inverted lists (clusters)

**Use Case:** Large-scale deployments with memory constraints

#### 3. Composite Index for Organization & Type Filtering

Optimizes queries that filter by organization and type before similarity search:

```sql
CREATE INDEX IDX_documents_org_type_embedding
ON documents (organization_id, type)
WHERE embedding IS NOT NULL;
```

## Usage

### Storing Embeddings

```typescript
// In your service
const embedding = await embeddingService.generateEmbedding(content);

const document = documentRepository.create({
  title: 'My Document',
  content: 'Document content...',
  embedding: embedding,  // Array of 1536 numbers
  organizationId: 'org-uuid',
  type: DocumentType.KNOWLEDGE,
});

await documentRepository.save(document);
```

### Semantic Similarity Search

#### L2 Distance (Euclidean)

```sql
-- Find documents most similar to a given embedding
SELECT 
  id,
  title,
  embedding <-> $1::vector AS distance
FROM documents
WHERE organization_id = $2
  AND embedding IS NOT NULL
ORDER BY embedding <-> $1::vector
LIMIT 10;
```

#### Cosine Distance

```sql
-- For normalized embeddings
SELECT 
  id,
  title,
  embedding <=> $1::vector AS distance  -- <=> operator for cosine distance
FROM documents
WHERE organization_id = $2
  AND embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

#### Inner Product

```sql
-- For maximum similarity
SELECT 
  id,
  title,
  embedding <#> $1::vector AS similarity  -- <#> operator for inner product
FROM documents
WHERE organization_id = $2
  AND embedding IS NOT NULL
ORDER BY embedding <#> $1::vector DESC
LIMIT 10;
```

### In TypeORM/NestJS

```typescript
// Find similar documents
async findSimilarDocuments(
  embedding: number[],
  organizationId: string,
  limit: number = 10,
): Promise<Document[]> {
  return this.documentRepository
    .createQueryBuilder('doc')
    .where('doc.organizationId = :orgId', { orgId: organizationId })
    .andWhere('doc.embedding IS NOT NULL')
    .orderBy('doc.embedding <-> :embedding', 'ASC')
    .setParameter('embedding', embedding)
    .limit(limit)
    .getMany();
}
```

## Performance Considerations

### Index Selection

| Index Type | Memory | Speed | Best For |
|-----------|--------|-------|----------|
| HNSW | ~2x data size | Fastest | Most applications |
| IVFFlat | ~1.5x data size | Fast | Large datasets, memory-constrained |
| Sequential | Minimal | Slowest | Small datasets (<10k rows) |

### Query Optimization Tips

1. **Always filter by organization** before similarity search to reduce index range
2. **Use WHERE embedding IS NOT NULL** to exclude documents without embeddings
3. **Consider batch operations** for multiple similarity searches
4. **Monitor index size** with:
   ```sql
   SELECT pg_size_pretty(pg_relation_size('IDX_documents_embedding_hnsw'));
   ```

### Vector Dimension Size

The project uses 1536 dimensions (compatible with OpenAI embeddings). If using different embedding models:

- OpenAI (text-embedding-3-small, text-embedding-3-large): 1536 dimensions
- Cohere: 1024 or 2048 dimensions
- HuggingFace models: Varies (typically 384-1024)

To change dimension size, modify the migration:

```sql
-- Change from 1536 to 1024 dimensions
ALTER TABLE documents
ALTER COLUMN embedding TYPE vector(1024) USING embedding::vector(1024);
```

## Troubleshooting

### pgvector Extension Not Found

```
ERROR: could not open extension control file
```

**Solution:**
- Verify PostgreSQL and pgvector versions match
- Reinstall pgvector for your PostgreSQL version
- Check PostgreSQL extension directory: `pg_config --sharedir`

### Vector Type Not Available

```
ERROR: type "vector" does not exist
```

**Solution:**
```sql
-- Create the extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify it was created
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Slow Similarity Queries

**Solution:**
1. Verify indexes are used: `EXPLAIN (ANALYZE) SELECT ...`
2. Rebuild indexes if needed:
   ```sql
   REINDEX INDEX IDX_documents_embedding_hnsw;
   ```
3. Increase `ef_construction` in HNSW index (more accurate but slower indexing)

### Memory Issues with Large Indexes

**Solution:**
1. Switch to IVFFlat index (uses less memory)
2. Increase PostgreSQL `shared_buffers`:
   ```sql
   -- In postgresql.conf
   shared_buffers = 256MB  # or higher based on available RAM
   ```
3. Consider archiving old embeddings

## Testing pgvector Setup

### Verify Extension

```bash
# Connect to database
psql -h localhost -U hollon -d hollon

# In psql:
\dx vector
# Should show: pgvector extension

# Create test vector
SELECT '[1,2,3]'::vector;
# Should return: [1,2,3]

# Test similarity operator
SELECT '[1,2,3]'::vector <-> '[4,5,6]'::vector;
# Should return numeric distance
```

### Test with Application

```typescript
// In your NestJS app
async testPgvectorSetup(): Promise<void> {
  try {
    // Check extension exists
    const extension = await this.dataSource.query(
      `SELECT * FROM pg_extension WHERE extname = 'vector'`,
    );
    
    if (!extension || extension.length === 0) {
      throw new Error('pgvector extension not installed');
    }

    // Test vector operations
    const result = await this.dataSource.query(
      `SELECT '[1,2,3]'::vector <-> '[4,5,6]'::vector AS distance`,
    );
    
    console.log('✓ pgvector is working correctly');
    console.log(`Distance test result: ${result[0].distance}`);
  } catch (error) {
    console.error('✗ pgvector setup failed:', error.message);
    throw error;
  }
}
```

## Production Considerations

### Backup and Recovery

Ensure your backup strategy includes:
- Vector indexes are rebuilt after restore
- Embeddings are preserved in backups
- Test vector operations after restore

### Monitoring

Track index usage:

```sql
-- Check index size
SELECT 
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_indexes
WHERE tablename = 'documents' AND indexname LIKE '%embedding%';

-- Check index hit rate (after sufficient usage)
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname LIKE '%embedding%';
```

### Scaling Strategies

1. **Partitioning**: Partition by organization_id or creation date
2. **Archiving**: Move old embeddings to separate tablespace
3. **Sharding**: Distribute embeddings across databases
4. **Caching**: Use Redis for frequently accessed embeddings

## References

- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [pgvector Documentation](https://github.com/pgvector/pgvector#documentation)
- [PostgreSQL Vector Similarity Search](https://www.postgresql.org/docs/current/functions-math.html)
- [Tuning HNSW Parameters](https://github.com/pgvector/pgvector#hnsw)

## Related Documentation

- [Document Module](../src/modules/document/README.md)
- [RAG Implementation](../docs/RAG.md)
- [Database Configuration](../src/config/database.config.ts)
