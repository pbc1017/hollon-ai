# Vector Dimension Configurations

This document provides a comprehensive overview of all vector dimension settings, embedding sizes, and vector-related constants in the Hollon-AI codebase.

## Summary

The codebase uses **pgvector** extension for PostgreSQL to store and search vector embeddings. The primary dimension used throughout the system is **1536** (OpenAI text-embedding-3-small and ada-002), with support for other dimensions like 3072, 1024, and 768.

## 1. Database Schema

### Documents Table

**File:** `apps/server/src/database/migrations/1733295000000-InitialSchema.ts`

```sql
"embedding" vector(1536)  -- Vector embedding for semantic search
```

**Details:**

- Type: `vector(1536)`
- Nullable: Yes (allows documents without embeddings)
- Compatible models: OpenAI text-embedding-ada-002, text-embedding-3-small
- Storage: ~6 KB per embedding (4 bytes per dimension)
- Lines: 186, 192, 210

**Recommendation:** This hardcoded dimension should be made configurable to support different embedding models.

---

## 2. Entity Definitions

### VectorEmbedding Entity

**File:** `apps/server/src/entities/vector-embedding.entity.ts`

#### Enum: EmbeddingModelType

Lines: 28-33

```typescript
export enum EmbeddingModelType {
  OPENAI_ADA_002 = 'openai_ada_002', // 1536 dimensions
  OPENAI_SMALL_3 = 'openai_small_3', // 1536 dimensions
  OPENAI_LARGE_3 = 'openai_large_3', // 3072 dimensions
  COHERE_ENGLISH_V3 = 'cohere_english_v3', // 1024 dimensions
  CUSTOM = 'custom',
}
```

#### Field: dimensions

Line: 107-109

```typescript
/**
 * Number of dimensions in the vector
 * Must match the vector column dimension in database
 * Common values: 1536 (OpenAI), 3072 (OpenAI large), 1024 (Cohere)
 */
@Column({ type: 'integer' })
dimensions: number;
```

**Key Points:**

- Stores the actual dimension count for each embedding
- Must match the database vector column size
- Variable per embedding record

---

### Document Entity

**File:** `apps/server/src/modules/document/entities/document.entity.ts`

Lines: 56-59

```typescript
// Vector embedding for RAG (pgvector)
// Note: 실제 vector 타입은 migration에서 설정
@Column({ type: 'text', nullable: true })
embedding: string;
```

**Note:** Uses 'text' type in TypeScript as a workaround for TypeORM's lack of native pgvector support. Actual vector type is set in migrations.

---

## 3. Configuration Files

### Vector Search Configuration

**File:** `apps/server/src/modules/vector-search/config/vector-search.config.ts`

#### Provider Defaults

Lines: 110-124

```typescript
const providerDefaults = {
  [EmbeddingProvider.OPENAI]: {
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },
  [EmbeddingProvider.ANTHROPIC]: {
    model: 'claude-3-embedding',
    dimensions: 1024,
  },
  [EmbeddingProvider.LOCAL]: {
    model: 'local-embedding-model',
    dimensions: 768,
  },
};
```

#### Configuration Factory

Lines: 137-140

```typescript
dimensions: configService.get<number>(
  'vectorSearch.embedding.dimensions',
  defaults.dimensions,
),
```

**Environment Variable:** `VECTOR_EMBEDDING_DIMENSIONS`

---

### Application Configuration

**File:** `apps/server/src/config/configuration.ts`

Lines: 87-95

```typescript
vectorSearch: {
  enabled: process.env.VECTOR_SEARCH_ENABLED === 'true' || (!isTest && !isProd),
  embedding: {
    provider: process.env.VECTOR_EMBEDDING_PROVIDER || 'openai',
    model: process.env.VECTOR_EMBEDDING_MODEL,
    dimensions: process.env.VECTOR_EMBEDDING_DIMENSIONS
      ? parseInt(process.env.VECTOR_EMBEDDING_DIMENSIONS, 10)
      : undefined,
  }
}
```

**Environment Variables:**

- `VECTOR_SEARCH_ENABLED`: Enable/disable vector search
- `VECTOR_EMBEDDING_PROVIDER`: Provider name (openai, anthropic, local)
- `VECTOR_EMBEDDING_MODEL`: Model identifier
- `VECTOR_EMBEDDING_DIMENSIONS`: Dimension count (integer)

---

### VectorSearchConfig Entity

**File:** `apps/server/src/modules/vector-search/entities/vector-search-config.entity.ts`

Lines: 44-49

```typescript
/**
 * Number of dimensions in the embedding vector
 * Must match the model's output dimensions
 * Common values: 1536 (ada-002, 3-small), 3072 (3-large)
 */
@Column({ name: 'dimensions', type: 'integer', default: 1536 })
dimensions: number;
```

**Default:** 1536
**Common Values:** 1536, 3072

**Default Embedding Model:**
Lines: 37-41

```typescript
@Column({
  name: 'embedding_model',
  length: 100,
  default: 'text-embedding-3-small',
})
embeddingModel: string;
```

---

## 4. Validation & DTOs

### EmbeddingDto

**File:** `apps/server/src/modules/knowledge-graph/dto/embedding.dto.ts`

#### Array Size Validation

Lines: 77-79

```typescript
@ArrayMinSize(1024)
@ArrayMaxSize(3072)
embedding: number[];
```

**Constraints:**

- Min size: 1024 (Cohere models)
- Max size: 3072 (OpenAI large models)
- Common sizes: 1024, 1536, 3072

#### Dimension Field

Lines: 183

```typescript
dimensions: number;
```

**Validation:**

- Must match embedding array length
- Common values: 1024, 1536, 3072

#### Model Dimensions Documentation

Lines: 145-148

```typescript
/**
 * @values
 * - OPENAI_ADA_002: text-embedding-ada-002 (1536-d, legacy)
 * - OPENAI_SMALL_3: text-embedding-3-small (1536-d, recommended)
 * - OPENAI_LARGE_3: text-embedding-3-large (3072-d, highest quality)
 * - COHERE_ENGLISH_V3: embed-english-v3.0 (1024-d)
 * - CUSTOM: Custom or third-party models
 */
```

Lines: 175-178

```typescript
/**
 * @modelDimensions
 * - OpenAI ada-002: 1536
 * - OpenAI small-3: 1536
 * - OpenAI large-3: 3072
 * - Cohere english-v3: 1024
 */
```

---

### SearchQueryDto

**File:** `apps/server/src/modules/knowledge-graph/dto/search-query.dto.ts`

Lines: 73, 76, 87-89

```typescript
/**
 * - Length must match model dimensions (1536 for OpenAI ada-002/small-3)
 * - Array size: 1024-3072 dimensions (model-dependent)
 */
@ArrayMinSize(1024)
@ArrayMaxSize(3072)
embedding?: number[];
```

---

## 5. Service Implementation

### VectorSearchConfigService

**File:** `apps/server/src/modules/vector-search/services/vector-search-config.service.ts`

#### Valid Dimensions Array

Lines: 89-95

```typescript
// Validate dimensions
const validDimensions = [1536, 3072, 768, 1024, 256]; // Common embedding dimensions
if (!validDimensions.includes(config.dimensions)) {
  throw new BadRequestException(
    `Invalid dimensions: ${config.dimensions}. Must be one of: ${validDimensions.join(', ')}`,
  );
}
```

**Supported Dimensions:**

- 1536 (OpenAI ada-002, small-3)
- 3072 (OpenAI large-3)
- 1024 (Cohere)
- 768 (Local models)
- 256 (Compact models)

#### Default Configuration

Lines: 173-177

```typescript
const defaultConfig = this.configRepo.create({
  displayName: 'Default Vector Search Config',
  provider: 'openai',
  embeddingModel: 'text-embedding-3-small',
  dimensions: 1536,
  config: {
    apiKey: process.env.OPENAI_API_KEY,
  },
});
```

---

## 6. Hardcoded Values Summary

### Critical Hardcoded Dimensions

1. **Database Migration** (Line 210)
   - Location: `apps/server/src/database/migrations/1733295000000-InitialSchema.ts`
   - Value: `vector(1536)`
   - Impact: **HIGH** - Database schema change required for different dimensions
   - Recommendation: **MUST BE ADDRESSED** - Consider using dynamic schema or migration generator

2. **VectorSearchConfig Default** (Line 48)
   - Location: `apps/server/src/modules/vector-search/entities/vector-search-config.entity.ts`
   - Value: `default: 1536`
   - Impact: Medium - Can be overridden via configuration
   - Recommendation: Keep as sensible default

3. **Default Configuration** (Line 176)
   - Location: `apps/server/src/modules/vector-search/services/vector-search-config.service.ts`
   - Value: `dimensions: 1536`
   - Impact: Low - Runtime configurable
   - Recommendation: Keep as default

---

## 7. Configuration Recommendations

### Current State

- Primary dimension: **1536** (OpenAI text-embedding-3-small)
- Database schema: Fixed at 1536 dimensions
- Runtime: Configurable via environment variables and database configs

### Issues

1. **Database Schema Inflexibility**: The `documents.embedding` column is hardcoded to `vector(1536)`, preventing use of models with different dimensions without schema migration
2. **Mixed Configuration Sources**: Dimensions configured in multiple places (env vars, database, defaults)
3. **Validation Mismatch**: Validation allows 1024-3072, but database only supports 1536

### Recommendations

#### Short-term

1. **Document the limitation** that the documents table only supports 1536-dimensional embeddings
2. **Add validation** to prevent creating embeddings with incompatible dimensions for the documents table
3. **Use VectorEmbedding table** for non-1536 dimensional embeddings (it stores dimensions per record)

#### Medium-term

1. **Create migration** to alter documents table or add multiple vector columns
2. **Centralize dimension configuration** in a single source of truth
3. **Add runtime checks** to ensure embedding dimensions match database schema

#### Long-term

1. **Implement dynamic vector columns** based on configuration
2. **Support multiple embedding models** simultaneously with separate vector columns
3. **Add dimension migration utility** to convert between different embedding sizes

---

## 8. Environment Variables

Complete list of vector-related environment variables:

```bash
# Vector Search
VECTOR_SEARCH_ENABLED=true
VECTOR_EMBEDDING_PROVIDER=openai
VECTOR_EMBEDDING_MODEL=text-embedding-3-small
VECTOR_EMBEDDING_DIMENSIONS=1536
VECTOR_EMBEDDING_API_KEY=sk-...
VECTOR_EMBEDDING_BATCH_SIZE=100
VECTOR_EMBEDDING_MAX_RETRIES=3

# OpenAI (used as fallback for vector search)
OPENAI_API_KEY=sk-...
```

---

## 9. Model-Dimension Mapping

| Provider  | Model                  | Dimensions | Status       | Notes                                       |
| --------- | ---------------------- | ---------- | ------------ | ------------------------------------------- |
| OpenAI    | text-embedding-ada-002 | 1536       | ✅ Supported | Legacy model                                |
| OpenAI    | text-embedding-3-small | 1536       | ✅ Supported | Recommended default                         |
| OpenAI    | text-embedding-3-large | 3072       | ⚠️ Partial   | Supported in VectorEmbedding table only     |
| Cohere    | embed-english-v3.0     | 1024       | ⚠️ Partial   | Supported in VectorEmbedding table only     |
| Anthropic | claude-3-embedding     | 1024       | ⚠️ Partial   | Supported in VectorEmbedding table only     |
| Local     | custom models          | 768        | ⚠️ Partial   | Supported in VectorEmbedding table only     |
| Custom    | various                | 256-3072   | ⚠️ Partial   | Validation allows, but DB constraints apply |

**Legend:**

- ✅ Supported: Works with all tables including documents
- ⚠️ Partial: Works with VectorEmbedding table but not documents table
- ❌ Not Supported: Not available

---

## 10. Cost Information

**File:** `apps/server/src/modules/vector-search/entities/vector-search-config.entity.ts`

Line: 88

```typescript
default: 0.00002, // $0.0002 per 1K tokens for text-embedding-3-small
```

Default cost per 1K tokens: **$0.0002** (text-embedding-3-small)

---

## 11. Files Containing Vector Configurations

### Core Files (High Priority)

1. `apps/server/src/database/migrations/1733295000000-InitialSchema.ts` - **CRITICAL**
2. `apps/server/src/entities/vector-embedding.entity.ts`
3. `apps/server/src/modules/vector-search/entities/vector-search-config.entity.ts`
4. `apps/server/src/modules/vector-search/config/vector-search.config.ts`
5. `apps/server/src/config/configuration.ts`

### Service Files

6. `apps/server/src/modules/vector-search/services/vector-search-config.service.ts`
7. `apps/server/src/modules/vector-search/vector-search.service.ts`

### DTO/Validation Files

8. `apps/server/src/modules/knowledge-graph/dto/embedding.dto.ts`
9. `apps/server/src/modules/knowledge-graph/dto/search-query.dto.ts`

### Other Entity Files

10. `apps/server/src/modules/document/entities/document.entity.ts`

### Test Files

11. `apps/server/test/schema-validation.test.ts`

---

## 12. Next Steps for Refactoring

To make vector dimensions fully configurable:

1. **Create a constant file**

   ```typescript
   // src/common/constants/vector.constants.ts
   export const DEFAULT_VECTOR_DIMENSION = 1536;
   export const SUPPORTED_DIMENSIONS = [256, 768, 1024, 1536, 3072] as const;
   export type VectorDimension = (typeof SUPPORTED_DIMENSIONS)[number];
   ```

2. **Create a migration generator** for vector columns with configurable dimensions

3. **Add table-specific dimension tracking**

   ```typescript
   // Map of table -> supported dimensions
   const TABLE_DIMENSIONS = {
     documents: [1536], // Currently fixed
     vector_embeddings: [256, 768, 1024, 1536, 3072], // Flexible
   };
   ```

4. **Implement dimension validation middleware** to prevent mismatches

5. **Add dimension migration tools** to help convert existing embeddings

---

## Conclusion

The codebase has **1536** as the primary vector dimension, with support for 1024, 3072, and 768 in the VectorEmbedding table. The most critical issue is the **hardcoded dimension in the documents table migration**, which should be addressed to support multiple embedding models.

**Priority Actions:**

1. ✅ Document current limitations (this document)
2. 🔴 Address documents table dimension limitation
3. 🟡 Centralize dimension configuration
4. 🟢 Add comprehensive dimension validation
