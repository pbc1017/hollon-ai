# pgvector Integration Research Summary (2025)

## Overview

This document consolidates the latest research on pgvector integration with TypeORM as of January 2025, including recent updates, performance benchmarks, and production best practices.

## Executive Summary

- **TypeORM Native Support**: TypeORM now natively supports vector column types (as of recent versions)
- **pgvector 0.8.0**: Latest version includes iterative scan improvements and performance optimizations
- **Index Recommendation**: HNSW is the recommended index for most production use cases (15.5x faster than IVFFlat at high recall)
- **Common Dimensions**: 384, 768, 1536, 3072 for various embedding models

---

## 1. TypeORM Native Vector Support (2025 Update)

### 1.1 Native Column Type Support

TypeORM now provides native support for vector columns without requiring custom transformers:

```typescript
@Entity()
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  // Vector without specified dimensions
  @Column("vector")
  embedding: number[] | Buffer;

  // Vector with specific dimensions: vector(3)
  @Column("vector", { length: 3 })
  embedding_3d: number[] | Buffer;

  // Half-precision vector: halfvec(4)
  @Column("halfvec", { length: 4 })
  halfvec_embedding: number[] | Buffer;
}
```

**Key Benefits:**
- No custom transformers needed for basic usage
- Type safety with `number[]` or `Buffer`
- Dimension specification via `length` option
- Support for half-precision vectors (`halfvec`) for memory optimization

**Supported Vector Types:**
- `vector`: Single-precision floating point (standard)
- `halfvec`: Half-precision floating point (2x memory savings)

### 1.2 Usage Pattern

```typescript
// Creating a document with embedding
const doc = new Document();
doc.embedding = [0.1, 0.2, 0.3, ..., 0.9]; // number array
await repository.save(doc);

// TypeORM automatically converts to pgvector format
// Database stores as: '[0.1,0.2,0.3,...,0.9]'
```

### 1.3 Migration Pattern

```typescript
export class CreateDocumentsTable implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure extension exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" SERIAL PRIMARY KEY,
        "title" VARCHAR(255) NOT NULL,
        "embedding" vector(1536),
        "created_at" TIMESTAMP DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "documents"`);
  }
}
```

---

## 2. pgvector Extension Features (v0.8.0+)

### 2.1 Core Capabilities

- **Maximum Dimensions**: 
  - `vector`: Up to 2,000 dimensions
  - `halfvec`: Up to 4,000 dimensions
  - `sparsevec`: Sparse vector support
  - `bit`: Binary vector support

- **Distance Metrics**:
  - `<->` : L2 (Euclidean) distance
  - `<=>` : Cosine distance (recommended for text embeddings)
  - `<#>` : Inner product
  - `<+>` : L1 (Manhattan) distance

### 2.2 New Features in v0.8.0

**Iterative Index Scans**: Prevents "overfiltering" in hybrid searches

```sql
-- Enable iterative scanning for better recall with filters
SET hnsw.iterative_scan = on;
SET ivfflat.iterative_scan = on;
```

This feature significantly improves recall when combining vector similarity with metadata filters.

---

## 3. Indexing Strategies: HNSW vs IVFFlat

### 3.1 Performance Comparison (1M vectors, 1536 dimensions)

Based on comprehensive benchmarking studies:

| Metric | IVFFlat | HNSW | Winner |
|--------|---------|------|--------|
| **Build Time** | 128 seconds | 4,065 seconds (32x slower) | IVFFlat |
| **Query Speed (0.998 recall)** | 2.6 QPS | 40.5 QPS (15.5x faster) | HNSW |
| **Memory Usage** | 257 MB | 729 MB (2.8x more) | IVFFlat |
| **Update Resilience** | Poor (centroids not recalculated) | Good (graph adapts) | HNSW |
| **Recall Stability** | Degrades with updates | Stable | HNSW |

### 3.2 Decision Matrix

**Choose HNSW when:**
- Query performance is critical (production workloads)
- Dataset is frequently updated (dynamic knowledge base)
- High recall is required (>95%)
- You have sufficient memory resources
- Dataset > 100K vectors

**Choose IVFFlat when:**
- Dataset is static (rare updates)
- Fast index builds are needed
- Memory is constrained
- Dataset < 100K vectors
- Lower recall is acceptable (90-95%)

**No Index when:**
- Dataset < 10K vectors (exact search is fast enough)

### 3.3 HNSW Configuration Best Practices

**Index Creation:**
```sql
CREATE INDEX idx_documents_embedding_hnsw
ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Parameters:**
- `m` (default: 16): Maximum connections per layer
  - Range: 8-48
  - Higher = better recall, more memory
  - **Recommendation**: 16 for balanced, 24-32 for high precision

- `ef_construction` (default: 64): Build-time candidate list size
  - Range: 32-256
  - Higher = better index quality, slower build
  - **Recommendation**: 64 for standard, 128+ for critical applications

**Query-Time Tuning:**
```sql
-- Adjust ef_search for recall/speed tradeoff
SET hnsw.ef_search = 100;

-- Default: 40
-- Range: 10-1000
-- Higher = better recall, slower queries
```

### 3.4 IVFFlat Configuration

**Index Creation:**
```sql
CREATE INDEX idx_documents_embedding_ivfflat
ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Lists Parameter Guidelines:**
- ≤ 1M rows: `rows / 1000`
- \> 1M rows: `sqrt(rows)`

**Examples:**
- 100K rows → lists = 100
- 500K rows → lists = 500
- 5M rows → lists = 2,236

**Query-Time Tuning:**
```sql
-- Number of lists to scan
SET ivfflat.probes = 10;

-- Default: 1
-- Higher = better recall, slower queries
-- Recommendation: 10-20 for balanced performance
```

---

## 4. Vector Dimensions and Embedding Models

### 4.1 Common Embedding Dimensions (2025)

| Model | Dimensions | Provider | Use Case |
|-------|------------|----------|----------|
| **text-embedding-3-small** | 512, 1536 | OpenAI | General purpose, cost-effective |
| **text-embedding-3-large** | 256, 1024, 3072 | OpenAI | High quality, flexible dimensions |
| **text-embedding-ada-002** | 1536 | OpenAI | Legacy standard (still widely used) |
| **embed-english-v3.0** | 1024 | Cohere | Strong alternative to OpenAI |
| **all-MiniLM-L6-v2** | 384 | Sentence Transformers | Lightweight, open-source |
| **BERT-base** | 768 | Hugging Face | Classic baseline |

### 4.2 Dimension Flexibility

OpenAI's new models support dimension reduction without re-training:

```typescript
// text-embedding-3-large can be shortened
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-large",
  input: "Your text here",
  dimensions: 256  // Reduced from default 3072
});
```

**Benefits:**
- Faster searches (fewer dimensions)
- Lower storage costs
- Maintained performance (surprising but true!)

**Example**: A 256-dimension text-embedding-3-large can outperform a 1536-dimension text-embedding-ada-002.

### 4.3 Storage Requirements

| Dimensions | Bytes per Vector | 1M Vectors |
|------------|------------------|------------|
| 384 | ~1.5 KB | ~1.5 GB |
| 768 | ~3 KB | ~3 GB |
| 1024 | ~4 KB | ~4 GB |
| 1536 | ~6 KB | ~6 GB |
| 3072 | ~12 KB | ~12 GB |

*Note: Add ~30-50% for HNSW index overhead*

---

## 5. Best Practices for Production

### 5.1 Schema Design

**Recommended Pattern:**
```typescript
@Entity('vector_embeddings')
@Index(['organizationId', 'sourceType'])
@Index(['tags'], { where: 'tags IS NOT NULL' })
export class VectorEmbedding extends BaseEntity {
  @Column({
    type: 'vector',
    length: 1536,
  })
  embedding: number[];

  @Column({ type: 'integer' })
  dimensions: number;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: EmbeddingSourceType,
  })
  sourceType: EmbeddingSourceType;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[] | null;

  @Column({ type: 'jsonb' })
  metadata: {
    embeddingModel: string;
    embeddingModelVersion: string;
    processingTimestamp: string;
    tokenCount?: number;
  };

  @Column({ name: 'organization_id' })
  organizationId: string;
}
```

### 5.2 Query Optimization

**Pattern 1: Filter Before Vector Search**
```sql
-- GOOD: Reduces search space first
SELECT id, content, embedding <=> $1 AS distance
FROM vector_embeddings
WHERE organization_id = $2
  AND source_type = $3
  AND created_at > $4
ORDER BY embedding <=> $1
LIMIT 10;
```

**Pattern 2: Use Distance Thresholds**
```sql
-- Only return similar results (cosine distance < 0.3)
SELECT id, content, 
       (1 - (embedding <=> $1)) AS similarity
FROM vector_embeddings
WHERE organization_id = $2
  AND (embedding <=> $1) < 0.3
ORDER BY embedding <=> $1
LIMIT 10;
```

**Pattern 3: Hybrid Search with Metadata**
```sql
SELECT 
  id,
  content,
  tags,
  embedding <=> $1 AS distance
FROM vector_embeddings
WHERE
  organization_id = $2
  AND source_type = ANY($3)
  AND tags && $4  -- Array overlap
  AND (embedding <=> $1) < 0.3
ORDER BY embedding <=> $1
LIMIT 20;
```

### 5.3 PostgreSQL Configuration

**Recommended Settings:**
```ini
# Memory for vector operations
shared_buffers = 4GB              # 25% of RAM
effective_cache_size = 12GB       # 75% of RAM
work_mem = 256MB                  # Per operation
maintenance_work_mem = 2GB        # Index builds

# Parallel processing
max_parallel_workers_per_gather = 4
max_parallel_maintenance_workers = 4

# SSD optimization
random_page_cost = 1.1
effective_io_concurrency = 200
```

**For Docker Deployments:**
```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    shm_size: 2gb  # Critical for performance
    environment:
      POSTGRES_DB: hollon
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    command: 
      - "postgres"
      - "-c" 
      - "shared_buffers=4GB"
      - "-c"
      - "effective_cache_size=12GB"
```

### 5.4 Index Build Strategy

**For Large Datasets:**
```sql
-- Step 1: Increase memory
SET maintenance_work_mem = '4GB';
SET max_parallel_maintenance_workers = 8;

-- Step 2: Build index concurrently (allows reads/writes)
CREATE INDEX CONCURRENTLY idx_embeddings_hnsw
ON vector_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Step 3: Reset settings
RESET maintenance_work_mem;
RESET max_parallel_maintenance_workers;
```

**Timing Estimates:**
- 100K vectors: ~10-30 minutes (HNSW)
- 1M vectors: ~1-2 hours (HNSW)
- 10M vectors: ~10-20 hours (HNSW)

**Recommendation**: Build indexes during off-peak hours.

### 5.5 Monitoring and Observability

**Key Metrics:**
1. **Query Performance**: P50, P95, P99 latency
2. **Index Health**: Size, hit rate, scan type
3. **Resource Usage**: CPU, memory, I/O during queries
4. **Application Metrics**: Embedding generation time, cache hit rate

**Monitoring Queries:**
```sql
-- Index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'vector_embeddings';

-- Table and index sizes
SELECT
  pg_size_pretty(pg_total_relation_size('vector_embeddings')) as total,
  pg_size_pretty(pg_relation_size('vector_embeddings')) as table,
  pg_size_pretty(pg_indexes_size('vector_embeddings')) as indexes;

-- Slow queries
SELECT 
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE query LIKE '%vector_embeddings%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## 6. Common Pitfalls and Solutions

### 6.1 Dimension Mismatch Errors

**Problem:**
```
ERROR: different vector dimensions 1536 and 768
```

**Solution:**
```typescript
// Always validate dimensions before insertion
if (embedding.length !== EXPECTED_DIMENSIONS) {
  throw new Error(
    `Invalid embedding dimensions: expected ${EXPECTED_DIMENSIONS}, got ${embedding.length}`
  );
}

// Or store model type and filter by it
WHERE model_type = 'openai_ada_002'
```

### 6.2 Poor Recall with Filters

**Problem:** Combining WHERE clauses with vector search gives poor results.

**Solution:** Use iterative scan (pgvector 0.8.0+)
```sql
SET hnsw.iterative_scan = on;
```

### 6.3 Slow Index Builds

**Problem:** HNSW index takes too long to build.

**Solutions:**
1. Increase `maintenance_work_mem`
2. Use parallel workers
3. Build during off-peak hours
4. Consider IVFFlat for initial deployment
5. Use `CONCURRENTLY` to allow concurrent access

### 6.4 High Memory Usage

**Problem:** PostgreSQL using too much memory for vector operations.

**Solutions:**
1. Use `halfvec` instead of `vector` (2x savings)
2. Reduce `m` parameter in HNSW (e.g., m=8 instead of 16)
3. Implement dimension reduction
4. Use smaller embedding models (384 or 768 dimensions)

---

## 7. Integration with Hollon-AI Project

### 7.1 Current Status

**Implemented:**
- ✅ pgvector extension enabled in database
- ✅ Document entity with embedding column
- ✅ Migrations infrastructure
- ✅ TypeORM configuration

**Not Implemented:**
- ❌ Vector indexes (HNSW/IVFFlat)
- ❌ Embedding generation service
- ❌ Vector search queries
- ❌ Hybrid search implementation

### 7.2 Recommended Implementation Path

**Phase 1: Foundation (Immediate)**
1. Update Document entity to use native TypeORM vector support
2. Create HNSW index migration
3. Add metadata tracking (model, version, dimensions)

**Phase 2: Service Layer (Next)**
1. Implement embedding generation service (OpenAI integration)
2. Create vector search service with filtering
3. Add caching for embedding generation
4. Implement hybrid search (vector + metadata)

**Phase 3: Optimization (Later)**
1. Add monitoring and metrics
2. Fine-tune index parameters based on usage
3. Implement dimension reduction for cost savings
4. Add query result caching

### 7.3 Example Implementation

**Updated Document Entity:**
```typescript
import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum DocumentType {
  TASK_CONTEXT = 'task_context',
  DECISION_LOG = 'decision_log',
  KNOWLEDGE = 'knowledge',
}

@Entity('documents')
@Index(['organizationId', 'type'])
@Index(['projectId'], { where: 'project_id IS NOT NULL' })
export class Document extends BaseEntity {
  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: DocumentType })
  type: DocumentType;

  // Native TypeORM vector support
  @Column({ 
    type: 'vector',
    length: 1536,
    nullable: true 
  })
  embedding: number[] | null;

  // Track embedding metadata
  @Column({ type: 'jsonb', nullable: true })
  embeddingMetadata: {
    model: string;
    version: string;
    dimensions: number;
    generatedAt: string;
  } | null;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[] | null;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'project_id', nullable: true })
  projectId: string | null;
}
```

**Index Migration:**
```typescript
export class AddDocumentVectorIndex1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // HNSW index for vector similarity
    await queryRunner.query(`
      CREATE INDEX idx_documents_embedding_hnsw
      ON documents
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
      WHERE embedding IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_documents_embedding_hnsw
    `);
  }
}
```

---

## 8. Sources and References

### Primary Research Sources

**TypeORM Integration:**
- [TypeORM Vector Column Support](https://typeorm.io/docs/entity/entities/) - Official documentation
- [TypeORM Pull Request #10138](https://github.com/typeorm/typeorm/pull/10138) - Vector type support
- [How to add support for custom column datatypes in TypeORM](https://joaowebber.medium.com/how-to-add-support-for-custom-column-datatypes-in-typeorm-64386cfd6026) - Custom types guide

**pgvector Extension:**
- [pgvector GitHub Repository](https://github.com/pgvector/pgvector) - Official source
- [pgvector 0.8.0 Release Notes](https://www.postgresql.org/about/news/pgvector-080-released-2952/) - Latest features
- [pgvector Tutorial](https://www.datacamp.com/tutorial/pgvector-tutorial) - Comprehensive guide

**Performance Benchmarks:**
- [PGVector: HNSW vs IVFFlat — A Comprehensive Study](https://medium.com/@bavalpreetsinghh/pgvector-hnsw-vs-ivfflat-a-comprehensive-study-21ce0aaab931) - Detailed comparison
- [AWS: Optimize AI applications with pgvector indexing](https://aws.amazon.com/blogs/database/optimize-generative-ai-applications-with-pgvector-indexing-a-deep-dive-into-ivfflat-and-hnsw-techniques/) - Production insights
- [Vector Indexes in Postgres using pgvector](https://legacy.tembo.io/blog/vector-indexes-in-pgvector/) - IVFFlat vs HNSW
- [Neon: Optimize pgvector search](https://neon.com/docs/ai/ai-vector-search-optimization) - Query optimization

**Embedding Models:**
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings) - Official API documentation
- [Vector Embeddings with OpenAI in Python](https://codesignal.com/learn/courses/understanding-embeddings-and-vector-representations-3/lessons/vector-embeddings-with-openai-in-python-pgvector) - Practical guide

**Production Best Practices:**
- [PostgreSQL as Vector Database Guide (2025)](https://dbadataverse.com/tech/postgresql/2025/12/pgvector-postgresql-vector-database-guide) - Complete setup guide
- [Supabase pgvector Documentation](https://supabase.com/docs/guides/database/extensions/pgvector) - Production patterns
- [Azure PostgreSQL Vector Search](https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector) - Enterprise deployment

---

## 9. Conclusion

### Key Takeaways

1. **TypeORM Native Support**: Use the built-in vector type support for cleaner code
2. **HNSW Recommended**: 15.5x faster than IVFFlat at high recall, worth the build time
3. **Dimension Flexibility**: Consider smaller dimensions (384-768) for cost/performance
4. **Filter Early**: Apply metadata filters before vector search for best performance
5. **Monitor Everything**: Track query performance, index health, and resource usage

### Next Steps for Hollon-AI

1. ✅ Research complete (this document)
2. ⏭️ Update entity definitions to use native TypeORM vector support
3. ⏭️ Create HNSW index migrations
4. ⏭️ Implement embedding generation service
5. ⏭️ Build vector search service with hybrid filtering
6. ⏭️ Add monitoring and optimization

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-06  
**Research Date**: January 2025  
**Status**: Complete - Ready for implementation
