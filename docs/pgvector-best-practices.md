# pgvector Integration Best Practices Guide

## Executive Summary

This document consolidates research findings and best practices for pgvector integration with TypeORM in the Hollon-AI project. It provides actionable recommendations for vector column configuration, indexing strategies, metadata field conventions, and production deployment considerations.

## Table of Contents

1. [pgvector Extension Capabilities](#1-pgvector-extension-capabilities)
2. [TypeORM Vector Column Patterns](#2-typeorm-vector-column-patterns)
3. [Vector Indexing Strategies](#3-vector-indexing-strategies)
4. [Metadata Field Conventions](#4-metadata-field-conventions)
5. [Production Deployment Guidelines](#5-production-deployment-guidelines)
6. [Performance Optimization](#6-performance-optimization)
7. [Implementation Checklist](#7-implementation-checklist)

---

## 1. pgvector Extension Capabilities

### 1.1 Core Features

pgvector provides open-source vector similarity search for PostgreSQL with:

- **Multiple vector types**: `vector` (single-precision), `halfvec` (half-precision), `bit` (binary), `sparsevec` (sparse)
- **Dimension limits**: Up to 2,000 dimensions for vector type, 4,000 for halfvec
- **ACID compliance**: Full transactional support with point-in-time recovery
- **SQL compatibility**: Standard SQL queries with vector-specific operators

### 1.2 Distance Metrics

| Operator | Distance Type    | Use Case                      |
| -------- | ---------------- | ----------------------------- |
| `<->`    | L2 (Euclidean)   | General-purpose similarity    |
| `<=>`    | Cosine distance  | Text embeddings (most common) |
| `<#>`    | Inner product    | When vectors are normalized   |
| `<+>`    | L1 (Manhattan)   | Specialized applications      |
| `<~>`    | Hamming distance | Binary vectors only           |
| `<%>`    | Jaccard distance | Binary vectors only           |

**Recommendation**: Use cosine distance (`<=>`) for text embeddings as it's invariant to vector magnitude and works well with OpenAI/Cohere embeddings.

### 1.3 Common Embedding Dimensions

| Model                         | Dimensions | Notes                      |
| ----------------------------- | ---------- | -------------------------- |
| OpenAI text-embedding-ada-002 | 1536       | Industry standard          |
| OpenAI text-embedding-3-small | 1536       | Latest, improved quality   |
| OpenAI text-embedding-3-large | 3072       | Higher quality, 2x storage |
| Cohere embed-english-v3.0     | 1024       | Efficient alternative      |
| sentence-transformers         | 384-1024   | Open-source options        |

**Project Standard**: Currently using 1536 dimensions (OpenAI ada-002 compatible)

---

## 2. TypeORM Vector Column Patterns

### 2.1 Recommended Implementation: Custom Transformer

Create a reusable transformer for type-safe vector handling:

**File**: `apps/server/src/common/database/vector.transformer.ts`

```typescript
import { ValueTransformer } from 'typeorm';

/**
 * Custom transformer for pgvector columns
 * Converts between JavaScript number arrays and PostgreSQL vector type
 *
 * @param expectedDimension - Optional dimension validation
 */
export class VectorTransformer implements ValueTransformer {
  constructor(private readonly expectedDimension?: number) {}

  /**
   * Transform JavaScript array to pgvector string format
   * @param value - Number array or null
   * @returns String in format '[1,2,3,...]' or null
   */
  to(value: number[] | null): string | null {
    if (!value || !Array.isArray(value)) {
      return null;
    }

    // Validate dimensions if specified
    if (this.expectedDimension && value.length !== this.expectedDimension) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.expectedDimension}, got ${value.length}`,
      );
    }

    // Validate numeric values
    if (value.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
      throw new Error('Vector must contain only finite numbers');
    }

    return `[${value.join(',')}]`;
  }

  /**
   * Transform pgvector string to JavaScript array
   * @param value - Vector string from database '[1,2,3,...]'
   * @returns Number array or null
   */
  from(value: string | null): number[] | null {
    if (!value) {
      return null;
    }

    // Parse vector format: '[1,2,3,...]'
    const match = value.match(/^\[(.+)\]$/);
    if (!match) {
      return null;
    }

    const numbers = match[1].split(',').map(Number);

    // Validate dimensions if specified
    if (this.expectedDimension && numbers.length !== this.expectedDimension) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.expectedDimension}, got ${numbers.length}`,
      );
    }

    return numbers;
  }
}
```

### 2.2 Entity Usage Pattern

**Best Practice Example**:

```typescript
import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { VectorTransformer } from '../../common/database/vector.transformer';

@Entity('vector_embeddings')
@Index(['organizationId'])
@Index(['sourceType', 'sourceId'])
export class VectorEmbedding extends BaseEntity {
  /**
   * Vector embedding stored as pgvector type
   * TypeScript type: number[] for type safety
   * Database type: vector(1536) set in migration
   */
  @Column({
    type: 'vector',
    nullable: false,
    transformer: new VectorTransformer(1536),
  })
  embedding: number[];

  @Column({ type: 'integer' })
  dimensions: number;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;
}
```

### 2.3 Migration Pattern

**Best Practice**: Define vector type explicitly in migration, not in entity synchronization.

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVectorEmbeddingsTable1234567890000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure pgvector extension exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // Create table with vector column
    await queryRunner.query(`
      CREATE TABLE "vector_embeddings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "embedding" vector(1536) NOT NULL,
        "dimensions" integer NOT NULL,
        "content" text,
        "organization_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Create indexes (covered in section 3)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vector_embeddings"`);
  }
}
```

### 2.4 Alternative: Current Workaround Pattern

If not using custom transformer, current project pattern:

```typescript
// Entity uses 'text' type as workaround
@Column({ type: 'text', nullable: true })
embedding: string;

// Migration sets actual vector type
await queryRunner.query(`
  ALTER TABLE documents
  ADD COLUMN embedding vector(1536)
`);
```

**Limitation**: Loses type safety, requires manual string conversion.

**Recommendation**: Migrate to custom transformer pattern for better developer experience.

---

## 3. Vector Indexing Strategies

### 3.1 Index Type Comparison

Based on comprehensive performance research, here's the comparison:

| Metric                | IVFFlat                           | HNSW                                   |
| --------------------- | --------------------------------- | -------------------------------------- |
| **Build Speed**       | 32x faster                        | Slower (hours for large datasets)      |
| **Query Speed**       | 2.6 QPS @ 0.998 recall            | 40.5 QPS @ 0.998 recall (15.5x faster) |
| **Memory Usage**      | 257MB                             | 729MB (2.8x more)                      |
| **Update Resilience** | Poor (centroids not recalculated) | Good (graph adapts)                    |
| **Recall Quality**    | Lower, degrades with updates      | Higher, more stable                    |
| **Best For**          | Static datasets, fast builds      | Dynamic datasets, query speed          |

### 3.2 Index Selection Decision Tree

```
Dataset Size?
│
├─ < 10K rows → No index needed (exact search is fast)
│
├─ 10K - 100K rows
│  ├─ Static dataset → IVFFlat (lists = 100)
│  └─ Frequently updated → HNSW (m=16, ef_construction=64)
│
├─ 100K - 1M rows
│  ├─ Read-heavy, static → IVFFlat (lists = 1000)
│  └─ Mixed workload → HNSW (m=16, ef_construction=64)
│
└─ > 1M rows → HNSW (m=16-32, ef_construction=64-128)
```

### 3.3 HNSW Index Configuration (Recommended)

**Best for**: Hollon-AI use case with dynamic knowledge base

**Migration Implementation**:

```typescript
export class AddVectorIndexes1234567890001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // HNSW index for vector similarity search
    // Using cosine distance for text embeddings
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_hnsw
      ON vector_embeddings
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);

    // Composite index for filtered searches
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_org_source
      ON vector_embeddings (organization_id, source_type)
    `);

    // Index for metadata filtering
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_tags
      ON vector_embeddings USING gin (tags)
      WHERE tags IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_vector_embeddings_hnsw`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_vector_embeddings_org_source`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_vector_embeddings_tags`);
  }
}
```

**HNSW Parameters**:

- **m** (default 16): Maximum connections per layer
  - Higher values (24-32): Better recall, more memory
  - Lower values (8-12): Less memory, slightly worse recall
  - **Recommendation**: Start with 16, increase to 24 if recall is insufficient

- **ef_construction** (default 64): Candidate list size during build
  - Higher values (128-256): Better index quality, slower build
  - Lower values (32-48): Faster build, slightly worse quality
  - **Recommendation**: Use 64 for initial deployment, 128 for critical applications

**Query-time Configuration**:

```typescript
// Adjust ef_search for query-time recall/speed tradeoff
await dataSource.query(`SET hnsw.ef_search = 100`);

// Higher values = better recall but slower
// Default: 40, Range: 10-1000
// Recommendation: 40-100 for most use cases
```

### 3.4 IVFFlat Index Configuration (Alternative)

**Best for**: Static datasets, resource-constrained environments

```typescript
// IVFFlat index migration
await queryRunner.query(`
  CREATE INDEX idx_vector_embeddings_ivfflat
  ON vector_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
`);
```

**Lists Parameter Calculation**:

- **Formula**:
  - ≤ 1M rows: `rows / 1000`
  - \> 1M rows: `sqrt(rows)`
- **Examples**:
  - 100K rows → lists = 100
  - 500K rows → lists = 500
  - 5M rows → lists = 2236 (sqrt)

**Query-time Configuration**:

```typescript
// Set number of lists to scan
await dataSource.query(`SET ivfflat.probes = 10`);

// Higher values = better recall but slower
// Default: 1, Range: 1-lists
// Recommendation: 10 for balanced performance
```

### 3.5 Hybrid Search Index Strategy

For combining vector similarity with metadata filtering:

```typescript
// Separate indexes optimize different parts of the query
export class AddHybridSearchIndexes1234567890002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Vector index for similarity
    await queryRunner.query(`
      CREATE INDEX idx_embeddings_vector_hnsw
      ON vector_embeddings
      USING hnsw (embedding vector_cosine_ops)
    `);

    // Composite B-tree index for filtering
    await queryRunner.query(`
      CREATE INDEX idx_embeddings_filters
      ON vector_embeddings (
        organization_id,
        source_type,
        project_id,
        team_id
      )
      WHERE project_id IS NOT NULL AND team_id IS NOT NULL
    `);

    // GIN index for array overlap operations
    await queryRunner.query(`
      CREATE INDEX idx_embeddings_tags_gin
      ON vector_embeddings USING gin (tags)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_embeddings_vector_hnsw`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_embeddings_filters`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_embeddings_tags_gin`);
  }
}
```

### 3.6 Index Maintenance Best Practices

1. **Build indexes after bulk inserts**: Create indexes after populating table for better performance
2. **Increase maintenance_work_mem**: Set to at least 2GB for large index builds
   ```sql
   SET maintenance_work_mem = '2GB';
   ```
3. **Use parallel workers**: Enable parallel index creation
   ```sql
   SET max_parallel_maintenance_workers = 4;
   ```
4. **Monitor index size**: Track with pg_indexes and pg_relation_size
5. **Consider partial indexes**: Use WHERE clauses for frequently filtered queries

---

## 4. Metadata Field Conventions

### 4.1 Standard Metadata Structure

**Best Practice**: Use consistent metadata schema across all vector embeddings.

```typescript
/**
 * Standard metadata interface for vector embeddings
 * Ensures consistent structure across the application
 */
export interface VectorMetadata {
  // Model information
  embeddingModel: string; // e.g., 'openai_ada_002'
  embeddingModelVersion: string; // e.g., '2023-11-07'

  // Processing information
  processingTimestamp: string; // ISO 8601 format
  processingMethod?: string; // e.g., 'chunked', 'summarized'

  // Content structure
  chunkIndex?: number; // For multi-chunk content
  totalChunks?: number; // Total chunks for this source
  tokenCount?: number; // Tokens in embedded content

  // Source tracking
  sourceUrl?: string; // Original content URL
  sourceHash?: string; // Content hash for deduplication
  language?: string; // ISO 639-1 code (e.g., 'en')

  // Quality metrics
  quality?: number; // 0-1 confidence score
  reviewStatus?: 'pending' | 'approved' | 'rejected';

  // Custom fields (project-specific)
  [key: string]: unknown;
}
```

**Entity Implementation**:

```typescript
@Column({ type: 'jsonb', nullable: true })
metadata: VectorMetadata | null;
```

### 4.2 Tag Conventions

**Purpose**: Enable hybrid search combining vector similarity with exact tag matching.

**Best Practices**:

1. **Use lowercase**: Consistent casing for matching
2. **Use kebab-case**: Multi-word tags (e.g., 'api-documentation')
3. **Hierarchical tags**: Use colons for hierarchy (e.g., 'category:api', 'category:ui')
4. **Limited vocabulary**: Maintain a controlled tag vocabulary

**Example**:

```typescript
@Column({ type: 'text', array: true, nullable: true })
tags: string[] | null;

// Usage
const embedding = new VectorEmbedding();
embedding.tags = [
  'documentation',
  'api',
  'authentication',
  'category:security',
  'status:reviewed'
];
```

### 4.3 Source Type Enumeration

**Best Practice**: Use enum for type safety and consistency.

```typescript
export enum EmbeddingSourceType {
  DOCUMENT = 'document',
  TASK = 'task',
  MESSAGE = 'message',
  KNOWLEDGE_ITEM = 'knowledge_item',
  CODE_SNIPPET = 'code_snippet',
  DECISION_LOG = 'decision_log',
  MEETING_RECORD = 'meeting_record',
  GRAPH_NODE = 'graph_node',
  CUSTOM = 'custom',
}

@Column({
  name: 'source_type',
  type: 'enum',
  enum: EmbeddingSourceType,
})
sourceType: EmbeddingSourceType;
```

### 4.4 Model Type Tracking

**Critical**: Store embedding model information for compatibility.

```typescript
export enum EmbeddingModelType {
  OPENAI_ADA_002 = 'openai_ada_002',      // 1536 dimensions
  OPENAI_SMALL_3 = 'openai_small_3',      // 1536 dimensions
  OPENAI_LARGE_3 = 'openai_large_3',      // 3072 dimensions
  COHERE_ENGLISH_V3 = 'cohere_english_v3', // 1024 dimensions
  CUSTOM = 'custom',
}

@Column({
  name: 'model_type',
  type: 'enum',
  enum: EmbeddingModelType,
  default: EmbeddingModelType.OPENAI_ADA_002,
})
modelType: EmbeddingModelType;
```

**Why this matters**: Vectors from different models are not comparable. Always filter by model type when searching.

### 4.5 Complete Entity Example

See `apps/server/src/entities/vector-embedding.entity.ts` for the full implementation incorporating all best practices.

---

## 5. Production Deployment Guidelines

### 5.1 Pre-deployment Checklist

- [ ] pgvector extension installed on PostgreSQL server
- [ ] PostgreSQL version 11+ (14+ recommended)
- [ ] Vector indexes created (HNSW or IVFFlat)
- [ ] Metadata indexes on filter columns
- [ ] Connection pooling configured
- [ ] Monitoring and alerting set up
- [ ] Backup strategy defined

### 5.2 PostgreSQL Configuration

**Recommended Settings** (`postgresql.conf`):

```ini
# Memory settings for vector operations
shared_buffers = 4GB                    # 25% of RAM
effective_cache_size = 12GB             # 75% of RAM
work_mem = 256MB                        # Per-operation memory
maintenance_work_mem = 2GB              # For index builds

# Parallel processing
max_parallel_workers_per_gather = 4
max_parallel_maintenance_workers = 4

# Connection pooling
max_connections = 200

# Query optimization
random_page_cost = 1.1                  # For SSD storage
effective_io_concurrency = 200          # For SSD storage
```

### 5.3 Docker Configuration

Current setup in `docker/docker-compose.yml`:

```yaml
postgres:
  image: pgvector/pgvector:pg16
  environment:
    POSTGRES_PASSWORD: ${DB_PASSWORD}
    POSTGRES_DB: hollon
  volumes:
    - postgres_data:/var/lib/postgresql/data
  shm_size: 1gb # Important for pgvector performance
```

**Recommendation**: Add resource limits and health checks:

```yaml
postgres:
  image: pgvector/pgvector:pg16
  environment:
    POSTGRES_PASSWORD: ${DB_PASSWORD}
    POSTGRES_DB: hollon
  volumes:
    - postgres_data:/var/lib/postgresql/data
  shm_size: 2gb # Increase for better performance
  deploy:
    resources:
      limits:
        cpus: '4'
        memory: 8G
      reservations:
        cpus: '2'
        memory: 4G
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U hollon']
    interval: 10s
    timeout: 5s
    retries: 5
```

### 5.4 Environment Variables

**Required**:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=hollon
DB_PASSWORD=secure_password
DB_NAME=hollon
DB_SCHEMA=hollon

# Embedding service (when implemented)
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

### 5.5 Monitoring Metrics

**Key Metrics to Track**:

1. **Query Performance**:
   - Average vector search latency
   - P95/P99 latency
   - Queries per second (QPS)

2. **Index Health**:
   - Index size growth
   - Index hit rate
   - Rebuild frequency

3. **Database Resources**:
   - CPU usage during vector operations
   - Memory usage (shared_buffers, work_mem)
   - Disk I/O for vector queries

4. **Application Metrics**:
   - Embedding generation success rate
   - Embedding API latency
   - Cache hit rate (if caching embeddings)

**Monitoring Query Example**:

```sql
-- Monitor index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'vector_embeddings';

-- Monitor table size
SELECT
  pg_size_pretty(pg_total_relation_size('vector_embeddings')) as total_size,
  pg_size_pretty(pg_relation_size('vector_embeddings')) as table_size,
  pg_size_pretty(pg_indexes_size('vector_embeddings')) as indexes_size;
```

---

## 6. Performance Optimization

### 6.1 Query Optimization Patterns

**Best Practice #1: Filter Before Vector Search**

```typescript
// GOOD: Filter first, then vector search
const results = await dataSource.query(
  `
  SELECT
    id,
    content,
    embedding <=> $1::vector AS distance
  FROM vector_embeddings
  WHERE
    organization_id = $2
    AND source_type = $3
    AND project_id = $4
  ORDER BY embedding <=> $1::vector
  LIMIT 10
`,
  [queryVector, orgId, sourceType, projectId],
);

// BAD: Vector search without filtering
const results = await dataSource.query(
  `
  SELECT *
  FROM vector_embeddings
  ORDER BY embedding <=> $1::vector
  LIMIT 10
`,
  [queryVector],
);
```

**Best Practice #2: Use Iterative Scanning (pgvector 0.8.0+)**

For filtered vector searches with better recall:

```typescript
// Enable iterative scanning for this query
await dataSource.query(`SET LOCAL enable_indexscan = off`);
await dataSource.query(`SET LOCAL enable_seqscan = off`);

const results = await dataSource.query(
  `
  SELECT
    id,
    content,
    embedding <=> $1::vector AS distance
  FROM vector_embeddings
  WHERE
    organization_id = $2
    AND tags && $3  -- Array overlap
  ORDER BY embedding <=> $1::vector
  LIMIT 10
`,
  [queryVector, orgId, requiredTags],
);
```

**Best Practice #3: Implement Distance Threshold**

```typescript
// Only return results above similarity threshold
const SIMILARITY_THRESHOLD = 0.3; // Cosine distance < 0.3

const results = await dataSource.query(
  `
  SELECT
    id,
    content,
    (1 - (embedding <=> $1::vector)) AS similarity
  FROM vector_embeddings
  WHERE
    organization_id = $2
    AND (embedding <=> $1::vector) < $3
  ORDER BY embedding <=> $1::vector
  LIMIT 10
`,
  [queryVector, orgId, SIMILARITY_THRESHOLD],
);
```

### 6.2 Embedding Generation Optimization

**Best Practice #1: Batch Processing**

```typescript
/**
 * Generate embeddings in batches for efficiency
 */
async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 100,
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await embeddingService.generateBatch(batch);
    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}
```

**Best Practice #2: Caching**

```typescript
import { Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class EmbeddingCacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get or generate embedding with caching
   */
  async getOrGenerateEmbedding(text: string): Promise<number[]> {
    // Create cache key from content hash
    const cacheKey = `embedding:${this.hashContent(text)}`;

    // Check cache first
    const cached = await this.cacheManager.get<number[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Generate new embedding
    const embedding = await this.embeddingService.generate(text);

    // Cache for 24 hours
    await this.cacheManager.set(cacheKey, embedding, 86400);

    return embedding;
  }

  private hashContent(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }
}
```

### 6.3 Database Connection Pooling

**TypeORM Configuration**:

```typescript
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  schema: process.env.DB_SCHEMA,

  // Connection pooling
  extra: {
    max: 20, // Maximum pool size
    min: 5, // Minimum pool size
    idleTimeoutMillis: 30000, // Close idle connections
    connectionTimeoutMillis: 2000,
  },

  // Performance settings
  logging: false, // Disable in production
  maxQueryExecutionTime: 5000, // Log slow queries
});
```

### 6.4 Index Build Optimization

**For Large Datasets**:

```sql
-- Temporarily increase memory for index build
SET maintenance_work_mem = '4GB';
SET max_parallel_maintenance_workers = 8;

-- Build index
CREATE INDEX CONCURRENTLY idx_vector_embeddings_hnsw
ON vector_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Reset settings
RESET maintenance_work_mem;
RESET max_parallel_maintenance_workers;
```

**Note**: `CONCURRENTLY` allows reads/writes during index build but takes longer.

---

## 7. Implementation Checklist

### Phase 1: Foundation (Current Status ✅)

- [x] pgvector extension enabled in migration
- [x] VectorEmbedding entity designed
- [x] Documents table with embedding column
- [x] Documentation infrastructure in place

### Phase 2: Type Safety and Tooling (Recommended Next)

- [ ] Implement `VectorTransformer` in `apps/server/src/common/database/vector.transformer.ts`
- [ ] Update `VectorEmbedding` entity to use transformer
- [ ] Update `Document` entity to use transformer
- [ ] Add unit tests for transformer (dimension validation, null handling)
- [ ] Create metadata interface in `apps/server/src/common/interfaces/vector-metadata.interface.ts`

### Phase 3: Indexing (Critical for Performance)

- [ ] Create migration for HNSW indexes on vector columns
- [ ] Add composite indexes for filtered searches
- [ ] Add GIN indexes for tag arrays
- [ ] Test index performance with EXPLAIN ANALYZE
- [ ] Document index maintenance procedures

### Phase 4: Service Implementation

- [ ] Implement embedding generation service
  - [ ] OpenAI API integration
  - [ ] Error handling and retries
  - [ ] Rate limiting
  - [ ] Batch processing support
- [ ] Implement vector search service
  - [ ] Similarity search with filtering
  - [ ] Hybrid search (vector + metadata)
  - [ ] Distance threshold handling
  - [ ] Pagination support
- [ ] Add caching layer for embeddings
- [ ] Create service unit tests
- [ ] Create integration tests with test database

### Phase 5: API Layer

- [ ] Create vector search endpoints
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Implement authentication and authorization
- [ ] Add rate limiting to embedding endpoints
- [ ] Create API integration tests

### Phase 6: Monitoring and Operations

- [ ] Set up query performance monitoring
- [ ] Create dashboards for vector search metrics
- [ ] Implement alerting for slow queries
- [ ] Document backup and recovery procedures
- [ ] Create runbook for common issues

### Phase 7: Optimization

- [ ] Implement embedding caching
- [ ] Optimize batch operations
- [ ] Fine-tune index parameters based on metrics
- [ ] Consider read replicas for scaling
- [ ] Evaluate dimension reduction if needed

---

## References and Resources

### Official Documentation

- [pgvector GitHub Repository](https://github.com/pgvector/pgvector)
- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Vector Operations](https://github.com/pgvector/pgvector#vector-operations)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)

### Research and Comparisons

- [PGVector: HNSW vs IVFFlat — A Comprehensive Study](https://medium.com/@bavalpreetsinghh/pgvector-hnsw-vs-ivfflat-a-comprehensive-study-21ce0aaab931)
- [Vector Indexes in Postgres using pgvector](https://legacy.tembo.io/blog/vector-indexes-in-pgvector/)
- [AWS: Optimize AI applications with pgvector indexing](https://aws.amazon.com/blogs/database/optimize-generative-ai-applications-with-pgvector-indexing-a-deep-dive-into-ivfflat-and-hnsw-techniques/)
- [Neon: Optimize pgvector search](https://neon.com/docs/ai/ai-vector-search-optimization)
- [HNSW Algorithm Paper](https://arxiv.org/abs/1603.09320)

### TypeORM Integration Examples

- [TypeORM Custom Column Types](https://joaowebber.medium.com/how-to-add-support-for-custom-column-datatypes-in-typeorm-64386cfd6026)
- [pgvector-node TypeORM Tests](https://github.com/pgvector/pgvector-node/blob/master/tests/typeorm.test.mjs)
- [TypeORM PGVector Support Issue](https://github.com/typeorm/typeorm/issues/11485)

### Project-Specific Documentation

- [pgvector Implementation Review](./pgvector-implementation-review.md)
- [pgvector TypeORM Integration](./pgvector-typeorm-integration.md)
- [VectorEmbedding Entity](../apps/server/src/entities/vector-embedding.entity.ts)

---

## Document Metadata

- **Created**: 2025-01-06
- **Last Updated**: 2025-01-06
- **Author**: Research and consolidation of pgvector integration patterns
- **Status**: Complete - Ready for implementation
- **Related Issues**: Issue #132 (Vector Embedding Schema Design)

---

## Appendix: Quick Reference

### Distance Operators Quick Reference

```sql
-- Cosine distance (recommended for text embeddings)
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector

-- L2 distance (Euclidean)
ORDER BY embedding <-> '[0.1, 0.2, ...]'::vector

-- Inner product (for normalized vectors)
ORDER BY embedding <#> '[0.1, 0.2, ...]'::vector
```

### Common Query Patterns

```sql
-- Basic similarity search
SELECT id, content, embedding <=> $1 AS distance
FROM vector_embeddings
WHERE organization_id = $2
ORDER BY embedding <=> $1
LIMIT 10;

-- Hybrid search with metadata
SELECT id, content, tags, embedding <=> $1 AS distance
FROM vector_embeddings
WHERE
  organization_id = $2
  AND source_type = $3
  AND tags && $4
  AND (embedding <=> $1) < $5
ORDER BY embedding <=> $1
LIMIT 10;

-- Find duplicates
SELECT a.id, b.id, a.embedding <=> b.embedding AS similarity
FROM vector_embeddings a
JOIN vector_embeddings b ON a.id < b.id
WHERE
  a.organization_id = $1
  AND (a.embedding <=> b.embedding) < 0.1
ORDER BY similarity;
```

### Dimension Standards

| Dimensions | Use Case              | Storage per Vector |
| ---------- | --------------------- | ------------------ |
| 384        | Lightweight models    | ~1.5 KB            |
| 768        | Standard transformers | ~3 KB              |
| 1024       | Cohere embeddings     | ~4 KB              |
| 1536       | OpenAI standard       | ~6 KB              |
| 3072       | OpenAI large          | ~12 KB             |

### Performance Benchmarks

Based on research with 1M vectors, 1536 dimensions:

| Operation            | IVFFlat  | HNSW     |
| -------------------- | -------- | -------- |
| Index build          | 128s     | 4065s    |
| Query @ 0.9 recall   | ~100 QPS | ~500 QPS |
| Query @ 0.998 recall | 2.6 QPS  | 40.5 QPS |
| Memory usage         | 257 MB   | 729 MB   |

---

**End of Document**
