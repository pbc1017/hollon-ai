# pgvector Integration with TypeORM

## Overview

This document covers the integration of pgvector extension with TypeORM in the Hollon-AI project, including setup, custom column types, decorator patterns, and indexing strategies for vector similarity search.

## 1. pgvector Extension Setup

### 1.1 Installation and Initialization

The pgvector extension is initialized in the database migration:

```typescript
// apps/server/src/database/migrations/1733295000000-InitialSchema.ts
await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
```

**Key Points:**
- The extension must be created before any tables with vector columns
- Use `IF NOT EXISTS` to prevent errors on re-runs
- Requires PostgreSQL 11+ and pgvector extension installed on the database server
- The extension is typically created in the public schema but is accessible from all schemas

### 1.2 Database Configuration

TypeORM configuration (apps/server/src/config/typeorm.config.ts):

```typescript
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'hollon',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hollon',
  schema: schema,
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
  synchronize: false,
  extra: {
    options: `-c search_path=${schema},public`,
  },
});
```

**Important:** The `search_path` includes both the application schema and `public` to ensure pgvector types are accessible.

## 2. TypeORM Custom Column Type for Vectors

### 2.1 Current Implementation

Currently, the project uses a workaround for vector columns:

**Migration (SQL):**
```typescript
// Define vector column with explicit dimensionality in migration
await queryRunner.query(`
  CREATE TABLE "documents" (
    "embedding" vector(1536),
    -- other columns...
  )
`);
```

**Entity (TypeScript):**
```typescript
// apps/server/src/modules/document/entities/document.entity.ts
@Entity('documents')
export class Document extends BaseEntity {
  // Vector embedding stored as text type in TypeScript
  // Actual vector type is set in migration
  @Column({ type: 'text', nullable: true })
  embedding: string;
}
```

### 2.2 Recommended Custom Column Type Implementation

For better type safety and developer experience, implement a custom TypeORM column type:

```typescript
// apps/server/src/common/database/vector.column-type.ts
import { ValueTransformer } from 'typeorm';

/**
 * Custom transformer for pgvector columns
 * Converts between JavaScript arrays and PostgreSQL vector type
 */
export class VectorTransformer implements ValueTransformer {
  /**
   * Transform vector array to string format for database
   * @param value - JavaScript array of numbers
   * @returns String representation for pgvector: '[1,2,3,...]'
   */
  to(value: number[] | null): string | null {
    if (!value || !Array.isArray(value)) {
      return null;
    }
    return `[${value.join(',')]`;
  }

  /**
   * Transform database vector string to JavaScript array
   * @param value - Vector string from database: '[1,2,3,...]'
   * @returns JavaScript array of numbers
   */
  from(value: string | null): number[] | null {
    if (!value) {
      return null;
    }
    // Parse vector format: '[1,2,3,...]'
    const match = value.match(/^\[(.*)\]$/);
    if (!match) {
      return null;
    }
    return match[1].split(',').map(Number);
  }
}
```

**Usage in Entity:**
```typescript
import { VectorTransformer } from '../../../common/database/vector.column-type';

@Entity('documents')
export class Document extends BaseEntity {
  @Column({
    type: 'vector',
    nullable: true,
    transformer: new VectorTransformer(),
  })
  embedding: number[] | null;
}
```

**Note:** The `type: 'vector'` will be recognized by TypeORM when the column exists in the database, even though TypeORM doesn't natively support pgvector types.

### 2.3 Alternative: JSON Storage

For simpler use cases without similarity search:

```typescript
@Column({ type: 'jsonb', nullable: true })
embedding: number[] | null;
```

**Pros:**
- No custom transformer needed
- Native TypeORM support

**Cons:**
- Cannot use vector similarity operators
- No vector indexing support
- Larger storage footprint

## 3. TypeORM Decorator Patterns for Metadata Fields

### 3.1 Standard Metadata Patterns

The project uses several patterns for metadata fields that complement vector storage:

#### JSONB for Flexible Metadata
```typescript
@Column({ type: 'jsonb', nullable: true })
metadata: Record<string, unknown> | null;
```

**Use Cases:**
- Store embedding model information (model name, version, parameters)
- Track vector generation metadata (timestamp, source, processing method)
- Store chunking information for document embeddings

#### Array Columns for Tags
```typescript
@Column({ type: 'text', array: true, nullable: true })
tags: string[];
```

**Use Cases:**
- Categorical metadata for filtering vector searches
- Hybrid search combining vector similarity with exact tag matching

#### Enum Columns for Type Safety
```typescript
export enum DocumentType {
  TASK_CONTEXT = 'task_context',
  DECISION_LOG = 'decision_log',
  KNOWLEDGE = 'knowledge',
}

@Column({
  type: 'enum',
  enum: DocumentType,
  default: DocumentType.KNOWLEDGE,
})
type: DocumentType;
```

### 3.2 Combined Pattern Example

```typescript
@Entity('documents')
export class Document extends BaseEntity {
  // Content and vector
  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'vector', nullable: true, transformer: new VectorTransformer() })
  embedding: number[] | null;

  // Type and categorization
  @Column({ type: 'enum', enum: DocumentType })
  type: DocumentType;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[];

  // Flexible metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    embeddingModel?: string;
    embeddingModelVersion?: string;
    dimensions?: number;
    chunkIndex?: number;
    totalChunks?: number;
    sourceUrl?: string;
    processingTimestamp?: string;
    [key: string]: unknown;
  } | null;

  // Organization and context
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'project_id', nullable: true })
  projectId: string | null;
}
```

## 4. Vector Dimensionality Handling

### 4.1 Dimension Configuration

**Fixed Dimensions in Migration:**
```typescript
// Create vector column with specific dimension
await queryRunner.query(`
  ALTER TABLE documents 
  ADD COLUMN embedding vector(1536)
`);
```

**Common Embedding Dimensions:**
- OpenAI text-embedding-ada-002: 1536 dimensions
- OpenAI text-embedding-3-small: 1536 dimensions
- OpenAI text-embedding-3-large: 3072 dimensions
- Cohere embed-english-v3.0: 1024 dimensions
- sentence-transformers (various): 384, 768, 1024 dimensions

### 4.2 Handling Multiple Embedding Models

**Strategy 1: Multiple Vector Columns**
```typescript
@Column({ type: 'vector', nullable: true, transformer: new VectorTransformer() })
embedding_1536: number[] | null;

@Column({ type: 'vector', nullable: true, transformer: new VectorTransformer() })
embedding_3072: number[] | null;
```

**Strategy 2: Separate Tables by Dimension**
```typescript
@Entity('documents_embeddings_1536')
export class DocumentEmbedding1536 {
  @Column({ name: 'document_id' })
  documentId: string;

  @Column({ type: 'vector', transformer: new VectorTransformer() })
  embedding: number[];
}
```

**Strategy 3: Dynamic Dimensions (Advanced)**
```typescript
// Use vector without dimension specification
// Less efficient but more flexible
await queryRunner.query(`
  ALTER TABLE documents 
  ADD COLUMN embedding vector
`);
```

### 4.3 Dimension Validation

```typescript
export class VectorTransformer implements ValueTransformer {
  constructor(private expectedDimension?: number) {}

  to(value: number[] | null): string | null {
    if (!value) return null;

    if (this.expectedDimension && value.length !== this.expectedDimension) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.expectedDimension}, got ${value.length}`
      );
    }

    return `[${value.join(',')}]`;
  }
}

// Usage with validation
@Column({
  type: 'vector',
  nullable: true,
  transformer: new VectorTransformer(1536),
})
embedding: number[] | null;
```

## 5. Vector Indexing Strategies

### 5.1 Index Types

pgvector supports multiple index types for different use cases:

#### IVFFlat (Inverted File with Flat compression)
```sql
CREATE INDEX documents_embedding_ivfflat_idx 
ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Characteristics:**
- Good for datasets up to ~1M vectors
- Faster index creation
- Moderate query performance
- `lists` parameter: √(total_rows) is a good starting point

**Distance Operators:**
- `vector_l2_ops` - Euclidean distance (L2)
- `vector_ip_ops` - Inner product
- `vector_cosine_ops` - Cosine distance

#### HNSW (Hierarchical Navigable Small World)
```sql
CREATE INDEX documents_embedding_hnsw_idx 
ON documents 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Characteristics:**
- Better for larger datasets (1M+ vectors)
- Slower index creation
- Better query performance
- Higher memory usage

**Parameters:**
- `m` (default 16): Maximum connections per layer. Higher = better recall, more memory
- `ef_construction` (default 64): Size of dynamic candidate list during construction. Higher = better index quality, slower build

### 5.2 Migration Example with Indexing

```typescript
export class AddVectorIndexToDocuments implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create HNSW index for cosine similarity search
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_embedding_hnsw 
      ON documents 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);

    // For filtering + vector search, use separate indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_org_type 
      ON documents (organization_id, type)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_documents_embedding_hnsw`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_documents_org_type`);
  }
}
```

### 5.3 Query-Time Configuration

```typescript
// Set ef_search for HNSW queries (higher = better recall, slower)
await queryRunner.query(`SET hnsw.ef_search = 100`);

// Perform similarity search
const results = await queryRunner.query(`
  SELECT id, title, content, 
         embedding <=> $1::vector AS distance
  FROM documents
  WHERE organization_id = $2
  ORDER BY embedding <=> $1::vector
  LIMIT 10
`, [embeddingVector, organizationId]);
```

### 5.4 Index Selection Guidelines

| Dataset Size | Recommended Index | Parameters |
|--------------|------------------|------------|
| < 10K rows | None (exact search) | - |
| 10K - 100K | IVFFlat | lists = 100 |
| 100K - 1M | IVFFlat | lists = 1000 |
| 1M+ | HNSW | m = 16-32, ef_construction = 64-128 |

### 5.5 Hybrid Search Pattern

Combine vector similarity with metadata filtering:

```typescript
const results = await dataSource.query(`
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
    AND d.tags && $4::text[]  -- Array overlap
  ORDER BY d.embedding <=> $1::vector
  LIMIT $5
`, [
  embeddingVector,
  organizationId,
  allowedTypes,
  requiredTags,
  limit
]);
```

**Index Strategy for Hybrid Search:**
```sql
-- Separate indexes for filtering and vector search
CREATE INDEX idx_documents_org_type_tags ON documents (organization_id, type) 
  WHERE tags IS NOT NULL;

CREATE INDEX idx_documents_embedding_hnsw ON documents 
  USING hnsw (embedding vector_cosine_ops);
```

## 6. Best Practices

### 6.1 Vector Storage

1. **Normalize vectors** before storage if using cosine similarity
2. **Store metadata** about the embedding model and version
3. **Validate dimensions** on insertion to prevent errors
4. **Use appropriate precision**: Float32 is standard for embeddings
5. **Consider compression**: For very large datasets, quantization can reduce storage

### 6.2 Performance Optimization

1. **Choose the right index** based on dataset size and query patterns
2. **Batch insertions** for better performance
3. **Use connection pooling** for concurrent vector operations
4. **Monitor index build time** - HNSW can take hours for large datasets
5. **Partition large tables** by organization_id or date if needed

### 6.3 Query Optimization

1. **Combine filters before vector search** when possible
2. **Set appropriate limits** on similarity searches
3. **Use distance thresholds** to filter low-quality matches
4. **Cache frequent queries** if embedding generation is expensive
5. **Monitor query performance** with EXPLAIN ANALYZE

### 6.4 Schema Evolution

1. **Version your embedding models** in metadata
2. **Support gradual migration** when changing dimensions
3. **Use feature flags** for rolling out new embedding strategies
4. **Maintain backward compatibility** during transitions

## 7. Current Project Implementation Status

### 7.1 Implemented

- ✅ pgvector extension enabled in initial migration
- ✅ `documents` table with `embedding vector(1536)` column
- ✅ Basic entity structure with embedding field
- ✅ Metadata fields (JSONB, tags, type enum)
- ✅ Organization and project scoping

### 7.2 Not Yet Implemented

- ❌ Custom VectorTransformer for type-safe vector handling
- ❌ Vector similarity indexes (IVFFlat or HNSW)
- ❌ Vector search service implementation
- ❌ Embedding generation integration
- ❌ Similarity search queries
- ❌ Hybrid search (vector + metadata filtering)

### 7.3 Recommendations for Next Steps

1. **Implement VectorTransformer**: Add custom column type for better TypeScript support
2. **Add vector indexes**: Start with HNSW for better query performance
3. **Implement embedding service**: Integrate with OpenAI or other embedding providers
4. **Build search service**: Implement similarity search with metadata filtering
5. **Add monitoring**: Track query performance and index effectiveness
6. **Document API**: Create developer guide for using vector search features

## 8. Example Implementation: Complete Entity

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { VectorTransformer } from '../../../common/database/vector.column-type';
import { Organization } from '../../organization/entities/organization.entity';

export enum DocumentType {
  TASK_CONTEXT = 'task_context',
  DECISION_LOG = 'decision_log',
  KNOWLEDGE = 'knowledge',
}

@Entity('documents')
@Index(['organizationId', 'type'])
@Index(['tags'], { where: 'tags IS NOT NULL' })
export class Document extends BaseEntity {
  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: DocumentType })
  type: DocumentType;

  // Vector embedding with custom transformer
  @Column({
    type: 'vector',
    nullable: true,
    transformer: new VectorTransformer(1536),
  })
  embedding: number[] | null;

  // Metadata fields
  @Column({ type: 'text', array: true, nullable: true })
  tags: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    embeddingModel?: string;
    embeddingModelVersion?: string;
    dimensions?: number;
    processingTimestamp?: string;
  } | null;

  // Foreign keys
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'project_id', nullable: true })
  projectId: string | null;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
```

## 9. References

- [pgvector GitHub Repository](https://github.com/pgvector/pgvector)
- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Vector Operations](https://github.com/pgvector/pgvector#vector-operations)
- [HNSW Algorithm Paper](https://arxiv.org/abs/1603.09320)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
