# pgvector Integration and TypeORM Vector Column Patterns - 2025 Research

## Executive Summary

This document provides comprehensive research findings on pgvector integration, TypeORM vector column patterns, vector dimensionality configuration, and indexing strategies for vector similarity search. This research combines current project implementation patterns with latest 2025 best practices.

**Date:** January 2025  
**Project:** Hollon-AI  
**Purpose:** Technical research to inform vector search implementation decisions

---

## Table of Contents

1. [pgvector Extension Requirements](#1-pgvector-extension-requirements)
2. [TypeORM Vector Column Type Definitions](#2-typeorm-vector-column-type-definitions)
3. [Vector Dimensionality Configuration](#3-vector-dimensionality-configuration)
4. [Indexing Strategies for Vector Similarity Search](#4-indexing-strategies-for-vector-similarity-search)
5. [Distance Operators and Use Cases](#5-distance-operators-and-use-cases)
6. [Performance Considerations](#6-performance-considerations)
7. [Current Project Implementation](#7-current-project-implementation)
8. [Recommendations](#8-recommendations)
9. [References](#9-references)

---

## 1. pgvector Extension Requirements

### 1.1 Installation and Prerequisites

**PostgreSQL Version Requirements:**
- PostgreSQL 11 or higher required
- PostgreSQL 16 recommended (used in project via `pgvector/pgvector:pg16`)

**Extension Installation:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Current Project Implementation:**
- Installed via Docker image: `pgvector/pgvector:pg16`
- Enabled in initial migration: `1733295000000-InitialSchema.ts:6`
- Extension created in `public` schema, accessible from all schemas

### 1.2 Database Configuration

**Search Path Configuration:**
```typescript
extra: {
  options: `-c search_path=${schema},public`,
}
```

This ensures vector types are accessible even when using custom schemas.

**Key Requirements:**
- pgvector extension must be created before any vector columns
- Use `IF NOT EXISTS` clause for idempotent migrations
- Extension persists across database restarts
- No additional runtime dependencies required

### 1.3 Docker Setup

```yaml
postgres:
  image: pgvector/pgvector:pg16
  environment:
    POSTGRES_DB: hollon
    POSTGRES_USER: hollon
    POSTGRES_PASSWORD: hollon_dev_password
  ports:
    - "5432:5432"
  volumes:
    - postgres-data:/var/lib/postgresql/data
```

**Benefits:**
- Pre-installed pgvector extension
- No manual compilation required
- Production-ready configuration
- Consistent environment across development and testing

---

## 2. TypeORM Vector Column Type Definitions

### 2.1 Current State of TypeORM pgvector Support (2025)

**Status:** TypeORM does not natively support `vector(n)` column types as of TypeORM 0.3.20.

**Key Issues:**
- TypeORM throws `DataTypeNotSupportedError` for vector types
- Cannot use `synchronize: true` with vector columns
- Vector columns must be created via raw SQL migrations
- Custom transformers required for JavaScript/PostgreSQL type conversion

**Sources:**
- [TypeORM Issue #11485](https://github.com/typeorm/typeorm/issues/11485)
- [TypeORM Issue #10056](https://github.com/typeorm/typeorm/issues/10056)

### 2.2 Recommended Workaround Pattern

#### Migration (SQL)

```typescript
export class AddVectorColumn1234567890000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create vector column with specific dimensions
    await queryRunner.query(`
      ALTER TABLE documents 
      ADD COLUMN embedding vector(1536)
    `);
    
    // Add index (see section 4)
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
    await queryRunner.query(`
      ALTER TABLE documents 
      DROP COLUMN IF EXISTS embedding
    `);
  }
}
```

#### Entity (TypeScript) - Current Project Pattern

```typescript
@Entity('vector_embeddings')
export class VectorEmbedding extends BaseEntity {
  /**
   * Vector embedding stored as text type in TypeScript
   * Actual vector type (e.g., vector(1536)) is set in migration
   * This is a workaround for TypeORM's lack of native pgvector support
   */
  @Column({ type: 'text', nullable: false })
  embedding: string;
  
  @Column({ type: 'integer' })
  dimensions: number;
}
```

**Limitations:**
- No type safety for vector operations in TypeScript
- Manual serialization/deserialization required
- Cannot leverage TypeORM's column validation

### 2.3 Enhanced Pattern with Custom Transformer

For improved type safety and developer experience:

```typescript
// common/database/transformers/vector.transformer.ts
import { ValueTransformer } from 'typeorm';

/**
 * Custom transformer for pgvector columns
 * Converts between JavaScript arrays and PostgreSQL vector type
 */
export class VectorTransformer implements ValueTransformer {
  constructor(private readonly expectedDimension?: number) {}

  /**
   * Transform array to PostgreSQL vector string format
   * @param value - JavaScript array of numbers
   * @returns String representation: '[0.1,0.2,0.3,...]'
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

    // Format as pgvector string: [x,y,z,...]
    return `[${value.join(',')}]`;
  }

  /**
   * Transform PostgreSQL vector string to JavaScript array
   * @param value - Vector string from database: '[0.1,0.2,0.3,...]'
   * @returns JavaScript array of numbers
   */
  from(value: string | null): number[] | null {
    if (!value) {
      return null;
    }

    // Parse vector format: '[x,y,z,...]'
    const match = value.match(/^\[(.+)\]$/);
    if (!match) {
      return null;
    }

    const numbers = match[1].split(',').map((str) => parseFloat(str.trim()));

    // Validate dimensions if specified
    if (this.expectedDimension && numbers.length !== this.expectedDimension) {
      console.warn(
        `Vector dimension mismatch on read: expected ${this.expectedDimension}, got ${numbers.length}`,
      );
    }

    return numbers;
  }
}
```

**Usage in Entity:**

```typescript
import { VectorTransformer } from '../../../common/database/transformers/vector.transformer';

@Entity('documents')
export class Document extends BaseEntity {
  @Column({
    type: 'text', // TypeORM type
    nullable: true,
    transformer: new VectorTransformer(1536), // With dimension validation
  })
  embedding: number[] | null; // TypeScript type
}
```

**Benefits:**
- Type-safe vector operations in TypeScript
- Automatic dimension validation
- Transparent serialization/deserialization
- Better developer experience

### 2.4 Alternative: pgvector-node Package

The official pgvector package provides utilities for Node.js:

```bash
npm install pgvector
```

```typescript
import pgvector from 'pgvector';

// Convert array to SQL format
const embedding = [0.1, 0.2, 0.3];
const sql = pgvector.toSql(embedding); // Returns: '[0.1,0.2,0.3]'

// Use in raw query
await queryRunner.query(
  `INSERT INTO documents (embedding) VALUES ($1)`,
  [sql],
);
```

**Source:** [pgvector-node GitHub](https://github.com/pgvector/pgvector-node)

### 2.5 Column Decorator Pattern Summary

| Pattern | Type Safety | Ease of Use | Performance | Recommended |
|---------|-------------|-------------|-------------|-------------|
| `type: 'text'` (current) | ❌ Low | ✅ Simple | ✅ Good | Legacy code only |
| Custom Transformer | ✅ High | ✅ Simple | ✅ Good | **Recommended** |
| pgvector package | ⚠️ Medium | ⚠️ Manual | ✅ Good | Advanced usage |
| Raw queries | ❌ None | ❌ Complex | ✅ Best | Bulk operations |

---

## 3. Vector Dimensionality Configuration

### 3.1 Common Embedding Models and Dimensions (2025)

#### OpenAI Embeddings

| Model | Dimensions | Notes | Performance |
|-------|-----------|-------|-------------|
| `text-embedding-3-small` | 1536 (default) | Cost-effective, good quality | Fast |
| `text-embedding-3-small` | 512 | Reduced via API parameter | Very fast |
| `text-embedding-3-large` | 3072 (default) | Highest quality | Slower |
| `text-embedding-3-large` | 1536 | Reduced via API parameter | Balanced |
| `text-embedding-ada-002` | 1536 | Legacy model | Fast |

**Native Dimension Reduction:**
```typescript
const response = await openai.embeddings.create({
  model: 'text-embedding-3-large',
  input: text,
  dimensions: 1536, // Reduce from 3072 to 1536
});
```

**Source:** [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)

#### Cohere Embeddings

| Model | Dimensions | Use Case |
|-------|-----------|----------|
| `embed-english-v3.0` | 1024 | General purpose |
| `embed-english-light-v3.0` | 384 | Fast retrieval |
| `embed-multilingual-v3.0` | 1024 | Multi-language |

**Source:** [Cohere Embedding Models](https://research.aimultiple.com/embedding-models/)

#### Other Popular Models

| Provider | Model | Dimensions |
|----------|-------|-----------|
| sentence-transformers | `all-MiniLM-L6-v2` | 384 |
| sentence-transformers | `all-mpnet-base-v2` | 768 |
| Google | `text-embedding-004` | 768 |

### 3.2 Dimension Selection Best Practices

#### Performance vs. Quality Trade-offs

**Research Findings (2025):**
- Switching from 1536 to 384 dimensions cuts query latency in half
- Reduces vector database storage costs by 75%
- Often no measurable drop in retrieval accuracy for domain-specific data
- Higher dimensions capture more semantic nuance but with diminishing returns

**Source:** [Azure SQL Embedding Dimensions](https://devblogs.microsoft.com/azure-sql/embedding-models-and-dimensions-optimizing-the-performance-resource-usage-ratio/)

#### Recommendations by Use Case

| Use Case | Recommended Dimensions | Rationale |
|----------|----------------------|-----------|
| High-precision semantic search | 1536-3072 | Maximum accuracy |
| General knowledge retrieval | 768-1536 | Balanced performance |
| High-volume queries | 384-512 | Cost and speed optimization |
| Real-time applications | 384 | Latency-sensitive |
| Multi-language support | 1024 | Model compatibility |

#### Testing Approach

**Don't trust benchmarks alone** - test with your actual data:

```typescript
// A/B testing framework for dimension comparison
interface EmbeddingTest {
  model: string;
  dimensions: number;
  avgLatency: number;
  storageSize: number;
  recallAt10: number; // Percentage of relevant results in top 10
}

// Test with 100-200 actual user queries
const testResults: EmbeddingTest[] = [
  {
    model: 'text-embedding-3-small',
    dimensions: 1536,
    avgLatency: 45,
    storageSize: 6144,
    recallAt10: 0.92,
  },
  {
    model: 'text-embedding-3-small',
    dimensions: 512,
    avgLatency: 23,
    storageSize: 2048,
    recallAt10: 0.89,
  },
];
```

**Source:** [Particula - Embedding Dimensions](https://particula.tech/blog/embedding-dimensions-rag-vector-search)

### 3.3 Handling Multiple Dimensions in Database

#### Strategy 1: Multiple Vector Columns (Simple)

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  content TEXT NOT NULL,
  embedding_1536 vector(1536),
  embedding_512 vector(512),
  embedding_model VARCHAR(50)
);
```

**Pros:**
- Simple to implement
- Fast queries (no joins)
- Can use different models simultaneously

**Cons:**
- Storage duplication
- Maintenance overhead
- Schema changes required for new dimensions

#### Strategy 2: Polymorphic Embeddings Table (Current Project Pattern)

```sql
CREATE TABLE vector_embeddings (
  id UUID PRIMARY KEY,
  embedding TEXT NOT NULL, -- Stored as text, dimension varies
  source_type VARCHAR(50) NOT NULL,
  source_id UUID NOT NULL,
  model_type VARCHAR(50) NOT NULL,
  dimensions INTEGER NOT NULL,
  -- indexes and other fields...
);
```

**Pros:**
- Flexible dimension support
- Centralized embedding management
- Easy to add new models

**Cons:**
- Requires joins for queries
- More complex indexing strategy
- Type safety challenges

#### Strategy 3: Dynamic Dimensions (Flexible)

```sql
-- Vector without dimension specification
ALTER TABLE documents 
ADD COLUMN embedding vector;
```

**Pros:**
- Maximum flexibility
- No schema changes for new models

**Cons:**
- Less efficient indexing
- Slower queries
- No dimension validation at database level

### 3.4 Migration Strategy for Dimension Changes

```typescript
export class MigrateEmbeddingDimensions implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new column
    await queryRunner.query(`
      ALTER TABLE documents 
      ADD COLUMN embedding_new vector(512)
    `);
    
    // Backfill strategy: null values trigger re-embedding
    // No automatic conversion - requires re-generation
    
    // Create index on new column
    await queryRunner.query(`
      CREATE INDEX idx_documents_embedding_new_hnsw 
      ON documents 
      USING hnsw (embedding_new vector_cosine_ops)
    `);
    
    // After full backfill, drop old column
    // await queryRunner.query(`ALTER TABLE documents DROP COLUMN embedding`);
    // await queryRunner.query(`ALTER TABLE documents RENAME COLUMN embedding_new TO embedding`);
  }
}
```

---

## 4. Indexing Strategies for Vector Similarity Search

### 4.1 Index Types Comparison

pgvector supports two main indexing algorithms: **IVFFlat** and **HNSW**.

#### IVFFlat (Inverted File with Flat compression)

**Algorithm:**
- Clusters vectors into lists during training
- Searches nearest cluster lists at query time
- Linear scan within selected clusters

**Syntax:**
```sql
CREATE INDEX idx_documents_embedding_ivfflat 
ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Parameters:**
- `lists`: Number of clusters (√total_rows is good starting point)

**Characteristics:**
- ✅ Fast index build time (12-42x faster than HNSW)
- ✅ Lower memory usage (2.8x less than HNSW)
- ✅ Good for static datasets
- ❌ Requires periodic rebuilding as data changes
- ❌ Linear search time growth with probes
- ❌ Requires training step (needs existing data)

**Build Time:** ~15 seconds for 58,000 records  
**Query Time:** ~2.4ms  
**Memory:** ~257MB for recall 0.998

**Sources:**
- [AWS pgvector Indexing Deep Dive](https://aws.amazon.com/blogs/database/optimize-generative-ai-applications-with-pgvector-indexing-a-deep-dive-into-ivfflat-and-hnsw-techniques/)
- [Medium: HNSW vs IVFFlat](https://medium.com/@bavalpreetsinghh/pgvector-hnsw-vs-ivfflat-a-comprehensive-study-21ce0aaab931)

#### HNSW (Hierarchical Navigable Small World)

**Algorithm:**
- Multi-layer graph structure
- Hierarchical navigation from coarse to fine
- Logarithmic search time complexity

**Syntax:**
```sql
CREATE INDEX idx_documents_embedding_hnsw 
ON documents 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Parameters:**
- `m` (default 16): Maximum connections per layer
  - Higher = better recall, more memory
  - Range: 4-64, typically 8-32
- `ef_construction` (default 64): Build-time search width
  - Higher = better quality index, slower build
  - Range: 4-1000, typically 64-256

**Characteristics:**
- ✅ Best query performance (~1.5ms vs 2.4ms for IVFFlat)
- ✅ Logarithmic scalability
- ✅ No training step required
- ✅ Incremental updates (no rebuild needed)
- ✅ Better for dynamic datasets
- ❌ Slower index build (30-81 seconds for 58K records with pgvector 0.6.0+)
- ❌ Higher memory usage (~729MB vs 257MB)

**Throughput:** 40.5 QPS vs 2.6 QPS for IVFFlat (15.5x better at recall 0.998)

**Sources:**
- [Tembo: Vector Indexes IVFFlat vs HNSW](https://legacy.tembo.io/blog/vector-indexes-in-pgvector/)
- [Google Cloud: Faster Similarity Search](https://cloud.google.com/blog/products/databases/faster-similarity-search-performance-with-pgvector-indexes)

### 4.2 Index Selection Guidelines

| Dataset Size | Query Pattern | Recommended Index | Parameters |
|-------------|---------------|-------------------|------------|
| < 10K rows | Any | None (exact search) | - |
| 10K-100K | Static data, batch queries | IVFFlat | lists = 100 |
| 100K-1M | Static data, moderate updates | IVFFlat | lists = 1000 |
| 100K-1M | Dynamic data, frequent queries | HNSW | m=16, ef=64 |
| 1M+ | High-volume queries | HNSW | m=24, ef=128 |
| 1M+ | Real-time updates | HNSW | m=32, ef=256 |

**General Recommendation:** 
- **HNSW is recommended for most production use cases** due to performance and robustness against changing data
- Use IVFFlat only for static datasets with limited resources or when faster build times are critical

**Source:** [Microsoft Azure: Optimize pgvector Performance](https://learn.microsoft.com/en-us/azure/cosmos-db/postgresql/howto-optimize-performance-pgvector)

### 4.3 Distance Operators

pgvector supports three distance operators:

| Operator | Distance Metric | Index Operator Type | Use Case |
|----------|----------------|---------------------|----------|
| `<->` | Euclidean (L2) | `vector_l2_ops` | General similarity, clustering |
| `<#>` | Negative inner product | `vector_ip_ops` | Normalized vectors, magnitude matters |
| `<=>` | Cosine distance | `vector_cosine_ops` | Text/document similarity (recommended) |

**Index Creation by Operator:**

```sql
-- Cosine similarity (most common for text embeddings)
CREATE INDEX idx_cosine ON documents 
USING hnsw (embedding vector_cosine_ops);

-- Euclidean distance
CREATE INDEX idx_l2 ON documents 
USING hnsw (embedding vector_l2_ops);

-- Inner product (for normalized vectors)
CREATE INDEX idx_ip ON documents 
USING hnsw (embedding vector_ip_ops);
```

**Sources:**
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Severalnines: Vector Similarity Search](https://severalnines.com/blog/vector-similarity-search-with-postgresqls-pgvector-a-deep-dive/)

### 4.4 Query-Time Configuration

#### HNSW Query Parameters

```sql
-- Set ef_search for current session (higher = better recall, slower)
SET hnsw.ef_search = 100; -- Default: 40

-- Perform similarity search
SELECT 
  id, 
  title, 
  embedding <=> '[0.1,0.2,...]'::vector AS distance
FROM documents
WHERE organization_id = 'org-uuid'
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 10;
```

**ef_search Parameter:**
- Default: 40
- Range: 1-1000
- Higher values improve recall but increase query time
- Should be >= k (number of results)
- Typical values: 40-200

#### IVFFlat Query Parameters

```sql
-- Set number of probes (higher = better recall, slower)
SET ivfflat.probes = 10; -- Default: 1

-- Perform similarity search
SELECT id, title, embedding <=> '[0.1,0.2,...]'::vector AS distance
FROM documents
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 10;
```

**probes Parameter:**
- Default: 1
- Range: 1-lists
- Trade-off between speed and recall
- Typical values: 1-20

### 4.5 Hybrid Search Pattern

Combine vector similarity with metadata filtering:

```sql
-- Create separate indexes for optimal performance
CREATE INDEX idx_documents_org_type_tags 
ON documents (organization_id, type);

CREATE INDEX idx_documents_embedding_hnsw 
ON documents 
USING hnsw (embedding vector_cosine_ops);

-- Hybrid search query
SELECT 
  d.id,
  d.title,
  d.content,
  d.type,
  d.embedding <=> $1::vector AS distance
FROM documents d
WHERE 
  d.organization_id = $2
  AND d.type = ANY($3::document_type_enum[])
  AND d.tags && $4::text[]  -- Array overlap operator
  AND d.embedding <=> $1::vector < 0.5  -- Distance threshold
ORDER BY d.embedding <=> $1::vector
LIMIT $5;
```

**Index Strategy:**
- Separate B-tree index for metadata filtering
- Vector index for similarity search
- PostgreSQL optimizer handles execution plan

**Source:** [Neon Docs: pgvector Extension](https://neon.com/docs/extensions/pgvector)

### 4.6 Index Maintenance

#### For IVFFlat

```sql
-- Rebuild index after significant data changes
REINDEX INDEX idx_documents_embedding_ivfflat;
```

**Rebuild Frequency:**
- After 10-20% data change
- Monthly for active datasets
- When query performance degrades

#### For HNSW

```sql
-- HNSW handles updates incrementally
-- No regular rebuild needed
-- Optional: rebuild for optimal structure after major changes
REINDEX INDEX idx_documents_embedding_hnsw;
```

### 4.7 Performance Benchmarks

| Metric | IVFFlat (58K rows) | HNSW (58K rows) | Improvement |
|--------|-------------------|-----------------|-------------|
| Build time | 15s | 30s (optimized) | 0.5x |
| Query time | 2.4ms | 1.5ms | 1.6x faster |
| Throughput (recall 0.998) | 2.6 QPS | 40.5 QPS | 15.5x faster |
| Memory usage | 257MB | 729MB | 2.8x more |

**Source:** [Medium: Comparing IVFFlat and HNSW](https://medium.com/@emreks/comparing-ivfflat-and-hnsw-with-pgvector-performance-analysis-on-diverse-datasets-e1626505bc9a)

---

## 5. Distance Operators and Use Cases

### 5.1 Operator Definitions

#### Euclidean Distance (L2) - `<->` operator

**Formula:** √(Σ(ai - bi)²)

**Characteristics:**
- Measures straight-line distance between vectors
- Sensitive to vector magnitude
- Range: [0, ∞)

**Use Cases:**
- Finding alternative or most similar items
- Clustering algorithms
- Nearest neighbor search where magnitude matters
- Image similarity (when scale is important)

**Example:**
```sql
-- Find documents with smallest L2 distance
SELECT id, title, embedding <-> '[0.1,0.2,...]'::vector AS l2_distance
FROM documents
ORDER BY embedding <-> '[0.1,0.2,...]'::vector
LIMIT 10;
```

#### Cosine Distance - `<=>` operator

**Formula:** 1 - (A·B) / (||A|| × ||B||)

**Characteristics:**
- Measures angle between vectors
- Insensitive to vector magnitude
- Range: [0, 2] (0 = identical direction, 2 = opposite)

**Use Cases (Recommended):**
- Text and document similarity
- Semantic search where direction matters more than magnitude
- Anomaly detection (frequency doesn't matter)
- General-purpose embedding similarity
- **Most common choice for text embeddings**

**Example:**
```sql
-- Find semantically similar documents
SELECT id, title, 1 - (embedding <=> '[0.1,0.2,...]'::vector) AS similarity
FROM documents
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 10;
```

**Note:** The operator returns distance (lower is better), so `1 - distance` gives similarity score.

#### Inner Product (Negative) - `<#>` operator

**Formula:** -(A·B) (negative because Postgres only supports ASC index scans)

**Characteristics:**
- Dot product of vectors
- Sensitive to both direction and magnitude
- Efficient for normalized vectors
- Range: [-∞, ∞] (higher magnitude = higher product)

**Use Cases:**
- Vectors with unit length (normalized)
- Finding items similar in topic and magnitude
- Image identification where magnitude matters
- Maximum similarity when vectors are normalized

**Example:**
```sql
-- Find documents with highest inner product (most similar)
SELECT id, title, (embedding <#> '[0.1,0.2,...]'::vector) * -1 AS inner_product
FROM documents
ORDER BY embedding <#> '[0.1,0.2,...]'::vector
LIMIT 10;
```

**Source:** [Heroku: pgvector Distance Operators](https://devcenter.heroku.com/articles/pgvector-heroku-postgres)

### 5.2 Equivalence for Normalized Vectors

**Important:** For unit vectors (length = 1), all three measures produce the **same ranking order**.

```typescript
// Check if vectors are normalized
function isNormalized(vector: number[]): boolean {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val ** 2, 0));
  return Math.abs(magnitude - 1.0) < 0.0001;
}

// Normalize vector
function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val ** 2, 0));
  return vector.map((val) => val / magnitude);
}
```

**Many embedding models return normalized vectors by default:**
- OpenAI `text-embedding-ada-002` ✅
- OpenAI `text-embedding-3-*` ✅
- Cohere embeddings ✅

**For normalized vectors:**
- Inner product provides best performance
- Cosine distance is most intuitive for similarity scores
- L2 distance correlates with cosine distance

**Source:** [DeepWiki: Vector Distance Metrics](https://deepwiki.com/pgvector/pgvector/3.1-vector-distance-metrics)

### 5.3 Practical Recommendation

**General guidance:** Use **cosine distance** (`<=>`) for most applications.

**Reasons:**
1. Most intuitive for text/semantic similarity
2. Industry standard for embedding models
3. Works well with both normalized and non-normalized vectors
4. Easier to interpret similarity scores (0-1 range after conversion)
5. Consistent behavior across different embedding models

```sql
-- Recommended pattern with similarity score
SELECT 
  id,
  title,
  1 - (embedding <=> $1::vector) AS similarity_score
FROM documents
WHERE 1 - (embedding <=> $1::vector) > 0.7  -- 70% similarity threshold
ORDER BY embedding <=> $1::vector
LIMIT 20;
```

**Source:** [Apache Cloudberry: pgvector Search](https://cloudberry.apache.org/docs/advanced-analytics/pgvector-search/)

---

## 6. Performance Considerations

### 6.1 Storage Requirements

#### Vector Storage Size

```typescript
// Calculate storage per vector
function calculateVectorStorage(dimensions: number): number {
  // Each dimension: 4 bytes (float32)
  const vectorBytes = dimensions * 4;
  
  // Overhead: ~24 bytes per row (UUID, timestamps, etc.)
  const overheadBytes = 24;
  
  return vectorBytes + overheadBytes;
}

// Examples
const storage1536 = calculateVectorStorage(1536); // 6,168 bytes (~6KB)
const storage512 = calculateVectorStorage(512);   // 2,072 bytes (~2KB)
const storage384 = calculateVectorStorage(384);   // 1,560 bytes (~1.5KB)
```

#### Database Size Estimates

| Documents | Dimensions | Storage per Vector | Total Storage | With Index (HNSW) |
|-----------|-----------|-------------------|---------------|-------------------|
| 100K | 1536 | 6KB | ~600MB | ~2GB |
| 1M | 1536 | 6KB | ~6GB | ~20GB |
| 1M | 512 | 2KB | ~2GB | ~7GB |
| 1M | 384 | 1.5KB | ~1.5GB | ~5GB |

**Cost Optimization:**
Reducing dimensions from 1536 to 384 can save **75% storage costs** with minimal accuracy impact.

### 6.2 Query Performance

#### Factors Affecting Query Speed

1. **Index Type**
   - HNSW: ~1.5ms (faster)
   - IVFFlat: ~2.4ms
   - No index: ~650ms (sequential scan)

2. **Dimensions**
   - 384 dims: ~23ms latency
   - 1536 dims: ~45ms latency
   - **50% latency reduction** with smaller dimensions

3. **Result Set Size**
   - LIMIT 10: Fast
   - LIMIT 100: Moderate
   - LIMIT 1000: Slow (consider pagination)

4. **Filter Complexity**
   - Simple filters: Minimal impact
   - Complex joins: Can slow down significantly
   - Array operations: Moderate overhead

**Source:** [Particula: Embedding Dimensions](https://particula.tech/blog/embedding-dimensions-rag-vector-search)

### 6.3 Optimization Strategies

#### Strategy 1: Dimension Reduction

```typescript
// Use OpenAI's native dimension reduction
const response = await openai.embeddings.create({
  model: 'text-embedding-3-large',
  input: text,
  dimensions: 512, // Reduce from 3072
});
```

**Benefits:**
- 2-6x faster queries
- 3-4x less storage
- Often no accuracy loss for domain-specific data

#### Strategy 2: Efficient Indexing

```sql
-- HNSW with optimized parameters for production
CREATE INDEX idx_embeddings_hnsw 
ON vector_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (
  m = 24,               -- Higher connectivity for better recall
  ef_construction = 128 -- Better index quality
);

-- Query-time optimization
SET hnsw.ef_search = 80; -- Balance between speed and recall
```

#### Strategy 3: Partitioning

```sql
-- Partition by organization for multi-tenant systems
CREATE TABLE vector_embeddings (
  -- columns...
  organization_id UUID NOT NULL
) PARTITION BY HASH (organization_id);

-- Create partitions
CREATE TABLE vector_embeddings_p0 PARTITION OF vector_embeddings
  FOR VALUES WITH (MODULUS 4, REMAINDER 0);

CREATE TABLE vector_embeddings_p1 PARTITION OF vector_embeddings
  FOR VALUES WITH (MODULUS 4, REMAINDER 1);

-- Indexes on each partition
CREATE INDEX idx_p0_embedding_hnsw 
ON vector_embeddings_p0 
USING hnsw (embedding vector_cosine_ops);
```

**Benefits:**
- Smaller indexes per partition
- Faster queries within organization
- Better maintenance (VACUUM, REINDEX)

#### Strategy 4: Caching

```typescript
// Cache frequent embeddings in memory
class EmbeddingCache {
  private cache = new Map<string, number[]>();
  private readonly maxSize = 10000;

  async getEmbedding(text: string): Promise<number[]> {
    const cacheKey = this.hashText(text);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const embedding = await this.generateEmbedding(text);
    this.cache.set(cacheKey, embedding);

    // LRU eviction
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return embedding;
  }
}
```

### 6.4 Monitoring and Metrics

#### Key Metrics to Track

```sql
-- Index size
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE indexname LIKE '%embedding%';

-- Query performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, embedding <=> '[0.1,0.2,...]'::vector AS distance
FROM documents
WHERE organization_id = 'org-uuid'
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 10;

-- Index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan AS number_of_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE '%embedding%';
```

#### Performance Targets

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Query latency (p50) | < 50ms | > 100ms |
| Query latency (p95) | < 200ms | > 500ms |
| Index scan ratio | > 95% | < 90% |
| Recall@10 | > 90% | < 85% |
| Storage growth | Linear | Exponential |

---

## 7. Current Project Implementation

### 7.1 Entities with Vector Support

#### VectorEmbedding Entity

**File:** `apps/server/src/entities/vector-embedding.entity.ts`

**Features:**
- ✅ Comprehensive metadata tracking
- ✅ Multiple embedding models support (via enum)
- ✅ Polymorphic source references
- ✅ Organization/project/team scoping
- ✅ Flexible JSONB metadata
- ✅ Tag-based categorization
- ⚠️ Uses `type: 'text'` workaround (no custom transformer)

**Supported Models:**
```typescript
export enum EmbeddingModelType {
  OPENAI_ADA_002 = 'openai_ada_002',     // 1536 dimensions
  OPENAI_SMALL_3 = 'openai_small_3',     // 1536 dimensions
  OPENAI_LARGE_3 = 'openai_large_3',     // 3072 dimensions
  COHERE_ENGLISH_V3 = 'cohere_english_v3', // 1024 dimensions
  CUSTOM = 'custom',
}
```

**Schema:**
```sql
CREATE TABLE vector_embeddings (
  id UUID PRIMARY KEY,
  embedding TEXT NOT NULL,              -- Should be vector(n) in migration
  source_type VARCHAR(50) NOT NULL,     -- Polymorphic reference
  source_id UUID NOT NULL,
  model_type VARCHAR(50) NOT NULL,
  dimensions INTEGER NOT NULL,
  content TEXT,
  metadata JSONB,
  tags TEXT[],
  organization_id UUID NOT NULL,
  -- indexes...
);
```

#### Document Entity

**File:** `apps/server/src/modules/document/entities/document.entity.ts`

**Vector Column:**
```typescript
@Column({ type: 'text', nullable: true })
embedding: string; // Should be number[] with transformer
```

**Migration:**
```sql
-- From 1733295000000-InitialSchema.ts:180
"embedding" vector(1536)
```

### 7.2 Implemented Infrastructure

✅ **Completed:**
- pgvector extension enabled
- Docker container with pgvector/pgvector:pg16
- Initial migration with vector columns
- Entity structures defined
- Multi-tenancy support (organization scoping)
- Polymorphic embedding storage pattern

❌ **Not Implemented:**
- Custom VectorTransformer
- Vector similarity indexes (HNSW or IVFFlat)
- Vector search services (stub implementations exist)
- Embedding generation integration
- Similarity search queries
- Hybrid search (vector + metadata)

### 7.3 Service Stubs

#### VectorSearchService (Knowledge Extraction)

**File:** `apps/server/src/modules/knowledge-extraction/services/vector-search.service.ts`

**Status:** TODO markers, awaiting implementation

**Planned Methods:**
```typescript
async searchSimilar(
  query: string,
  organizationId: string,
  options?: {
    limit?: number;
    threshold?: number;
    projectId?: string;
    teamId?: string;
  },
): Promise<SearchResult[]> {
  // TODO: Implement similarity search
}
```

---

## 8. Recommendations

### 8.1 Immediate Actions (High Priority)

#### 1. Implement Custom VectorTransformer

**Why:** Type safety, automatic serialization, dimension validation

**Implementation:**
```typescript
// Create: apps/server/src/common/database/transformers/vector.transformer.ts
export class VectorTransformer implements ValueTransformer {
  constructor(private readonly expectedDimension?: number) {}
  // ... implementation from section 2.3
}
```

**Update Entities:**
```typescript
// Update vector_embedding.entity.ts
@Column({
  type: 'text',
  nullable: false,
  transformer: new VectorTransformer(), // Dynamic dimensions
})
embedding: number[]; // Changed from string
```

#### 2. Create Vector Indexes

**Recommended:** HNSW with cosine distance

```typescript
// Create migration: AddVectorIndexes[timestamp].ts
export class AddVectorIndexes implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Index for vector_embeddings table
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_hnsw 
      ON vector_embeddings 
      USING hnsw ((embedding::vector) vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
    
    // Index for documents table
    await queryRunner.query(`
      CREATE INDEX idx_documents_embedding_hnsw 
      ON documents 
      USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
    
    // Supporting indexes for hybrid search
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_org_source 
      ON vector_embeddings (organization_id, source_type, source_id)
    `);
  }
}
```

**Note:** Cast to `::vector` is needed when column is stored as text.

#### 3. Implement Vector Search Service

**Core functionality:**

```typescript
@Injectable()
export class VectorSearchService {
  constructor(
    @InjectRepository(VectorEmbedding)
    private readonly embeddingRepo: Repository<VectorEmbedding>,
    private readonly dataSource: DataSource,
  ) {}

  async searchSimilar(
    queryVector: number[],
    organizationId: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    const {
      limit = 10,
      threshold = 0.7,
      sourceType,
      projectId,
      teamId,
    } = options;

    // Build query with filters
    let query = `
      SELECT 
        id,
        source_type,
        source_id,
        content,
        model_type,
        dimensions,
        tags,
        metadata,
        1 - ((embedding::vector) <=> $1::vector) AS similarity
      FROM vector_embeddings
      WHERE organization_id = $2
    `;

    const params: any[] = [
      `[${queryVector.join(',')}]`,
      organizationId,
    ];
    let paramIndex = 3;

    if (sourceType) {
      query += ` AND source_type = $${paramIndex}`;
      params.push(sourceType);
      paramIndex++;
    }

    if (projectId) {
      query += ` AND project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }

    if (threshold) {
      query += ` AND 1 - ((embedding::vector) <=> $1::vector) > $${paramIndex}`;
      params.push(threshold);
      paramIndex++;
    }

    query += `
      ORDER BY (embedding::vector) <=> $1::vector
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const results = await this.dataSource.query(query, params);
    return results;
  }
}
```

### 8.2 Short-term Improvements (Medium Priority)

#### 4. Integrate Embedding Generation

**Option A: OpenAI Integration**

```typescript
@Injectable()
export class EmbeddingService {
  private readonly openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('OPENAI_API_KEY'),
    });
  }

  async generateEmbedding(
    text: string,
    model: EmbeddingModelType = EmbeddingModelType.OPENAI_SMALL_3,
  ): Promise<{ embedding: number[]; dimensions: number }> {
    const response = await this.openai.embeddings.create({
      model: this.mapModelType(model),
      input: text,
      dimensions: this.getModelDimensions(model),
    });

    return {
      embedding: response.data[0].embedding,
      dimensions: response.data[0].embedding.length,
    };
  }

  private mapModelType(modelType: EmbeddingModelType): string {
    const modelMap = {
      [EmbeddingModelType.OPENAI_SMALL_3]: 'text-embedding-3-small',
      [EmbeddingModelType.OPENAI_LARGE_3]: 'text-embedding-3-large',
      [EmbeddingModelType.OPENAI_ADA_002]: 'text-embedding-ada-002',
    };
    return modelMap[modelType];
  }

  private getModelDimensions(modelType: EmbeddingModelType): number {
    const dimensionMap = {
      [EmbeddingModelType.OPENAI_SMALL_3]: 1536,
      [EmbeddingModelType.OPENAI_LARGE_3]: 3072,
      [EmbeddingModelType.OPENAI_ADA_002]: 1536,
    };
    return dimensionMap[modelType];
  }
}
```

#### 5. Add KnowledgeItem Vector Column

**Migration:**
```typescript
export class AddKnowledgeItemEmbedding implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE knowledge_items 
      ADD COLUMN embedding vector(1536)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_knowledge_items_embedding_hnsw 
      ON knowledge_items 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
  }
}
```

**Update Entity:**
```typescript
@Entity('knowledge_items')
export class KnowledgeItem extends BaseEntity {
  // ... existing fields

  @Column({
    type: 'text',
    nullable: true,
    transformer: new VectorTransformer(1536),
  })
  embedding: number[] | null;

  @Column({ name: 'embedding_model', nullable: true })
  embeddingModel: string | null;
}
```

#### 6. Implement Hybrid Search

```typescript
async hybridSearch(
  query: string,
  organizationId: string,
  filters: {
    tags?: string[];
    types?: EmbeddingSourceType[];
    dateRange?: { start: Date; end: Date };
  },
): Promise<SearchResult[]> {
  const embedding = await this.embeddingService.generateEmbedding(query);

  const queryBuilder = this.embeddingRepo
    .createQueryBuilder('e')
    .select([
      'e.id',
      'e.source_type',
      'e.source_id',
      'e.content',
      'e.tags',
      'e.metadata',
    ])
    .addSelect(
      `1 - (e.embedding::vector <=> :queryVector::vector)`,
      'similarity',
    )
    .where('e.organization_id = :organizationId', { organizationId })
    .andWhere(
      `1 - (e.embedding::vector <=> :queryVector::vector) > :threshold`,
      { threshold: 0.7 },
    )
    .setParameter('queryVector', `[${embedding.embedding.join(',')}]`)
    .orderBy('similarity', 'DESC')
    .limit(20);

  // Apply filters
  if (filters.tags && filters.tags.length > 0) {
    queryBuilder.andWhere('e.tags && :tags', { tags: filters.tags });
  }

  if (filters.types && filters.types.length > 0) {
    queryBuilder.andWhere('e.source_type IN (:...types)', {
      types: filters.types,
    });
  }

  if (filters.dateRange) {
    queryBuilder.andWhere('e.created_at BETWEEN :start AND :end', {
      start: filters.dateRange.start,
      end: filters.dateRange.end,
    });
  }

  return await queryBuilder.getRawMany();
}
```

### 8.3 Long-term Enhancements (Low Priority)

#### 7. Performance Monitoring

```typescript
@Injectable()
export class VectorSearchMonitoringService {
  async getIndexHealth(): Promise<IndexHealthMetrics> {
    const query = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
        idx_scan AS scans,
        idx_tup_read AS tuples_read,
        idx_tup_fetch AS tuples_fetched
      FROM pg_stat_user_indexes
      WHERE indexname LIKE '%embedding%'
    `;
    return await this.dataSource.query(query);
  }

  async getQueryPerformanceStats(): Promise<PerformanceStats> {
    // Track query latencies
    // Monitor recall rates
    // Analyze slow queries
  }
}
```

#### 8. Dimension Optimization

Test different dimensions for your use case:

```typescript
@Injectable()
export class DimensionOptimizationService {
  async benchmarkDimensions(
    testQueries: string[],
    dimensions: number[],
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const dim of dimensions) {
      const startTime = Date.now();
      let totalRecall = 0;

      for (const query of testQueries) {
        const embedding = await this.embeddingService.generateEmbedding(
          query,
          { dimensions: dim },
        );
        const searchResults = await this.search(embedding);
        totalRecall += this.calculateRecall(searchResults);
      }

      results.push({
        dimensions: dim,
        avgLatency: (Date.now() - startTime) / testQueries.length,
        avgRecall: totalRecall / testQueries.length,
        storageSize: await this.estimateStorageSize(dim),
      });
    }

    return results;
  }
}
```

#### 9. Documentation and Guides

Create comprehensive documentation:

- **Setup Guide:** Docker, pgvector, environment configuration
- **API Documentation:** Endpoint specs, examples, error handling
- **Developer Guide:** How to add vector search to new entities
- **Operations Guide:** Monitoring, maintenance, troubleshooting
- **Performance Guide:** Optimization strategies, benchmarking

---

## 9. References

### Research Sources

#### pgvector and TypeORM Integration
1. [TypeORM pgvector Support Issue #11485](https://github.com/typeorm/typeorm/issues/11485)
2. [TypeORM Custom Datatypes Issue #10056](https://github.com/typeorm/typeorm/issues/10056)
3. [LangChain TypeORM Vector Store](https://js.langchain.com/docs/integrations/vectorstores/typeorm/)
4. [pgvector-node GitHub Repository](https://github.com/pgvector/pgvector-node)
5. [Medium: Custom Column Datatypes in TypeORM](https://joaowebber.medium.com/how-to-add-support-for-custom-column-datatypes-in-typeorm-64386cfd6026)

#### Indexing Strategies
6. [AWS: Optimize with pgvector Indexing - IVFFlat and HNSW](https://aws.amazon.com/blogs/database/optimize-generative-ai-applications-with-pgvector-indexing-a-deep-dive-into-ivfflat-and-hnsw-techniques/)
7. [pgvector GitHub Repository](https://github.com/pgvector/pgvector)
8. [Medium: HNSW vs IVFFlat Comprehensive Study](https://medium.com/@bavalpreetsinghh/pgvector-hnsw-vs-ivfflat-a-comprehensive-study-21ce0aaab931)
9. [Tembo: Vector Indexes IVFFlat vs HNSW](https://legacy.tembo.io/blog/vector-indexes-in-pgvector/)
10. [Microsoft Azure: Optimize pgvector Performance](https://learn.microsoft.com/en-us/azure/cosmos-db/postgresql/howto-optimize-performance-pgvector)
11. [Google Cloud: Faster Similarity Search with pgvector](https://cloud.google.com/blog/products/databases/faster-similarity-search-performance-with-pgvector-indexes)
12. [Medium: Comparing IVFFlat and HNSW Performance](https://medium.com/@emreks/comparing-ivfflat-and-hnsw-with-pgvector-performance-analysis-on-diverse-datasets-e1626505bc9a)
13. [Supabase: IVFFlat Indexes](https://supabase.com/docs/guides/ai/vector-indexes/ivf-indexes)

#### Distance Operators
14. [pgvector GitHub: Vector Operations](https://github.com/pgvector/pgvector)
15. [Heroku: pgvector on Postgres](https://devcenter.heroku.com/articles/pgvector-heroku-postgres)
16. [Severalnines: Vector Similarity Search Deep Dive](https://severalnines.com/blog/vector-similarity-search-with-postgresqls-pgvector-a-deep-dive/)
17. [Neon Docs: pgvector Extension](https://neon.com/docs/extensions/pgvector)
18. [DeepWiki: Vector Distance Metrics](https://deepwiki.com/pgvector/pgvector/3.1-vector-distance-metrics)
19. [Apache Cloudberry: pgvector Search](https://cloudberry.apache.org/docs/advanced-analytics/pgvector-search/)

#### Embedding Models and Dimensions
20. [AImultiple: Embedding Models - OpenAI vs Gemini vs Cohere](https://research.aimultiple.com/embedding-models/)
21. [OpenAI: Embeddings API Guide](https://platform.openai.com/docs/guides/embeddings)
22. [Document360: Text Embedding Model Analysis](https://document360.com/blog/text-embedding-model-analysis/)
23. [Azure SQL: Embedding Models and Dimensions](https://devblogs.microsoft.com/azure-sql/embedding-models-and-dimensions-optimizing-the-performance-resource-usage-ratio/)
24. [Particula: Embedding Dimensions for RAG](https://particula.tech/blog/embedding-dimensions-rag-vector-search)
25. [Pinecone: OpenAI Text Embeddings v3](https://www.pinecone.io/learn/openai-embeddings-v3/)

### Additional Documentation

#### Internal Project Documentation
- `docs/pgvector-typeorm-integration.md` - Detailed integration patterns
- `docs/pgvector-implementation-review.md` - Current implementation status
- `docs/database/schema.md` - Database schema documentation

#### External Resources
- [HNSW Algorithm Paper](https://arxiv.org/abs/1603.09320)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TypeORM Documentation](https://typeorm.io/)
- [NestJS Documentation](https://docs.nestjs.com/)

---

## Appendix A: Quick Reference

### Common SQL Patterns

```sql
-- Create pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create vector column
ALTER TABLE documents ADD COLUMN embedding vector(1536);

-- Create HNSW index (recommended)
CREATE INDEX idx_embedding_hnsw ON documents 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create IVFFlat index
CREATE INDEX idx_embedding_ivfflat ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Cosine similarity search
SELECT id, embedding <=> '[0.1,0.2,...]'::vector AS distance
FROM documents
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 10;

-- Euclidean distance search
SELECT id, embedding <-> '[0.1,0.2,...]'::vector AS distance
FROM documents
ORDER BY embedding <-> '[0.1,0.2,...]'::vector
LIMIT 10;

-- Inner product search
SELECT id, embedding <#> '[0.1,0.2,...]'::vector AS neg_inner_product
FROM documents
ORDER BY embedding <#> '[0.1,0.2,...]'::vector
LIMIT 10;

-- Hybrid search with filters
SELECT id, embedding <=> '[0.1,0.2,...]'::vector AS distance
FROM documents
WHERE 
  organization_id = 'org-uuid'
  AND type = 'knowledge'
  AND tags && ARRAY['ai', 'ml']
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 10;

-- Set query-time parameters
SET hnsw.ef_search = 100;
SET ivfflat.probes = 10;

-- Index maintenance
REINDEX INDEX idx_embedding_hnsw;
VACUUM ANALYZE documents;
```

### TypeScript Patterns

```typescript
// Custom transformer
export class VectorTransformer implements ValueTransformer {
  to(value: number[] | null): string | null {
    return value ? `[${value.join(',')}]` : null;
  }
  
  from(value: string | null): number[] | null {
    if (!value) return null;
    const match = value.match(/^\[(.+)\]$/);
    return match ? match[1].split(',').map(Number) : null;
  }
}

// Entity with vector column
@Column({
  type: 'text',
  transformer: new VectorTransformer(1536),
})
embedding: number[];

// Generate embedding (OpenAI)
const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: text,
  dimensions: 1536,
});
const embedding = response.data[0].embedding;

// Similarity search
const results = await dataSource.query(
  `SELECT id, embedding <=> $1::vector AS distance
   FROM documents
   WHERE organization_id = $2
   ORDER BY embedding <=> $1::vector
   LIMIT $3`,
  [`[${queryVector.join(',')}]`, orgId, limit],
);
```

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Maintained By:** Hollon-AI Engineering Team
