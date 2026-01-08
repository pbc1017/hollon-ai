# VectorSearchService Configuration Guide

## Overview

This guide explains how to configure the VectorSearchService for your deployment. Configuration can come from three sources:

1. **Environment Variables** - Recommended for most use cases
2. **Database Configuration** - Per-organization settings
3. **Built-in Defaults** - Fallback values

## Environment Variables

### Embedding Provider Configuration

Configure which provider and model to use for generating embeddings.

```bash
# Provider selection
VECTOR_EMBEDDING_PROVIDER=openai          # Options: openai, anthropic, local
VECTOR_EMBEDDING_MODEL=text-embedding-3-small  # Model identifier

# Vector dimensions (must match model output)
VECTOR_EMBEDDING_DIMENSIONS=1536

# API credentials
VECTOR_EMBEDDING_API_KEY=sk-...           # Or use OPENAI_API_KEY
```

#### Supported Models

##### OpenAI

| Model | Dimensions | Pricing | Notes |
|-------|-----------|---------|-------|
| `text-embedding-3-large` | 3072 | $0.13/1M tokens | Higher quality |
| `text-embedding-3-small` | 1536 | $0.02/1M tokens | Default, good balance |
| `text-embedding-ada-002` | 1536 | $0.10/1M tokens | Legacy model |

**Default**: `text-embedding-3-small` with 1536 dimensions

##### Anthropic (Future Support)

```
model: claude-3-embedding
dimensions: 1024
```

##### Local (Future Support)

```
model: local-embedding-model
dimensions: 768
```

### Batch Processing Configuration

Configure how documents are processed in batches.

```bash
# Number of documents per batch
VECTOR_EMBEDDING_BATCH_SIZE=100

# Retry strategy
VECTOR_EMBEDDING_MAX_RETRIES=3

# Request timeout in milliseconds
VECTOR_EMBEDDING_TIMEOUT_MS=30000  # 30 seconds
```

**Recommendations**:
- `BATCH_SIZE`: 10-200 (balance between speed and memory)
- `MAX_RETRIES`: 2-5 (exponential backoff)
- `TIMEOUT_MS`: 10000-60000 (avoid too short for large documents)

### Search Configuration

Configure default search behavior.

```bash
# Default similarity metric
VECTOR_SEARCH_DEFAULT_METRIC=cosine         # Options: cosine, euclidean, dot_product

# Similarity threshold (0.0 to 1.0)
VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY=0.7    # Return results with >= 0.7 similarity

# Result limits
VECTOR_SEARCH_DEFAULT_LIMIT=10              # Default results per query
VECTOR_SEARCH_MAX_LIMIT=100                 # Never return more than this

# Include scores in responses
VECTOR_SEARCH_INCLUDE_SCORES_BY_DEFAULT=true
```

**Recommendations**:
- `MIN_SIMILARITY`: 0.5-0.8 (lower = more results, higher = stricter matching)
- `DEFAULT_LIMIT`: 5-20 (balance between performance and usefulness)
- `MAX_LIMIT`: 50-200 (prevent resource exhaustion)

### Index Configuration

Configure pgvector index behavior.

```bash
# Index naming
VECTOR_INDEX_NAME=vector_embeddings

# Automatic index creation
VECTOR_INDEX_AUTO_CREATE=true               # Create if doesn't exist

# IVF Index parameters (pgvector specific)
VECTOR_INDEX_LISTS=100                      # Number of cluster lists
VECTOR_INDEX_PROBES=10                      # Search accuracy vs speed tradeoff
```

**IVF Index Tuning**:
- `LISTS`: 30-1000 (lower = faster indexing, slower search; higher = opposite)
  - Start with: `sqrt(number_of_vectors)`
- `PROBES`: 1-20 (higher = more accurate, slower)
  - `lists / 10` is common starting point

### Performance Configuration

Configure caching and connection pooling.

```bash
# Enable caching of embeddings and search results
VECTOR_PERFORMANCE_ENABLE_CACHE=true

# Cache time-to-live in seconds
VECTOR_PERFORMANCE_CACHE_TTL_SECONDS=3600   # 1 hour

# Connection pool size
VECTOR_PERFORMANCE_POOL_SIZE=10
```

**Environment-Specific Defaults**:

```javascript
// Development
enableCache: false              // Faster iteration
cacheTtlSeconds: 300           // 5 minute TTL
poolSize: 5

// Production
enableCache: true               // Performance optimization
cacheTtlSeconds: 3600          // 1 hour TTL
poolSize: 20
```

## Database Configuration

### Creating Organization-Specific Configuration

Insert configuration directly into `vector_search_configs` table:

```sql
INSERT INTO vector_search_configs (
  id,
  organization_id,
  display_name,
  provider,
  embedding_model,
  dimensions,
  config,
  search_config,
  cost_per_1k_tokens_cents,
  enabled,
  timeout_seconds,
  max_retries,
  rate_limit_config,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  'Production Vector Config',
  'openai',
  'text-embedding-3-small',
  1536,
  '{
    "apiKey": "sk-...",
    "apiEndpoint": "https://api.openai.com/v1",
    "batchSize": 100
  }'::jsonb,
  '{
    "similarityThreshold": 0.7,
    "defaultLimit": 10,
    "maxLimit": 100,
    "distanceMetric": "cosine"
  }'::jsonb,
  0.00002,
  true,
  30,
  3,
  '{
    "maxRequestsPerMinute": 60,
    "maxTokensPerMinute": 1000000
  }'::jsonb,
  now(),
  now()
);
```

### Configuration Schema

```typescript
// vector_search_configs table
{
  id: UUID                           // Primary key
  organization_id: UUID              // Organization scope
  display_name: String               // Human-readable name
  
  // Provider
  provider: String                   // 'openai', 'anthropic', etc.
  embedding_model: String            // Model identifier
  dimensions: Integer                // Vector dimensions
  
  // API Config (JSONB)
  config: {
    apiKey: String                   // Provider API key
    apiEndpoint: String              // API endpoint
    batchSize: Integer               // Batch size
  }
  
  // Search Config (JSONB)
  search_config: {
    similarityThreshold: Number      // 0-1 threshold
    defaultLimit: Integer            // Default result count
    maxLimit: Integer                // Maximum results
    distanceMetric: String           // 'cosine', 'l2', 'inner_product'
  }
  
  // Pricing
  cost_per_1k_tokens_cents: Decimal // Cost tracking
  
  // Operational
  enabled: Boolean                   // Active configuration
  timeout_seconds: Integer           // Request timeout
  max_retries: Integer               // Retry count
  
  // Rate Limiting (JSONB)
  rate_limit_config: {
    maxRequestsPerMinute: Integer
    maxTokensPerMinute: Integer
  }
  
  // Audit
  created_at: Timestamp
  updated_at: Timestamp
}
```

## Configuration Precedence

When multiple configuration sources exist, precedence is:

1. **Database Configuration** (highest priority)
   - Organization-specific settings in `vector_search_configs`
   - Validated and used directly

2. **Environment Variables**
   - Used when creating default configurations
   - Fallback for missing values

3. **Built-in Defaults** (lowest priority)
   - Hardcoded values in code
   - Safety net for essential parameters

### Example Resolution

```typescript
// Request: getOrCreateConfig('org-123')

// Step 1: Check database
config = await configRepo.findOne({
  organizationId: 'org-123',
  enabled: true
})

if (config) {
  validate(config)
  return config  // ← Uses database config
}

// Step 2: Create from environment
config = {
  embeddingModel: process.env.VECTOR_EMBEDDING_MODEL || 'text-embedding-3-small'
  dimensions: process.env.VECTOR_EMBEDDING_DIMENSIONS || 1536
  searchConfig: {
    similarityThreshold: process.env.VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY || 0.7
    defaultLimit: process.env.VECTOR_SEARCH_DEFAULT_LIMIT || 10
  }
  // ... more fields
}

save(config)
return config  // ← Uses environment-based config
```

## Cost Configuration

### Pricing Models

The service tracks costs per 1K tokens for budget management.

```bash
# OpenAI text-embedding-3-small
$0.02 per 1M tokens = 0.00002 cents per 1K tokens

# Configure in database
cost_per_1k_tokens_cents = 0.00002
```

### Cost Tracking

Costs are tracked in the `cost_per_1k_tokens_cents` field:

```typescript
// Calculate cost for batch
const tokenCount = estimateTokens(content);  // ~4 tokens per word
const cost = (tokenCount / 1000) * configFieldValue;
```

## Validation Rules

The service validates configuration on load:

### Numeric Ranges

```typescript
// Timeout (seconds)
min: 5
max: 300

// Dimensions (common embedding dimensions)
valid: [1536, 3072, 768, 1024, 256]

// Similarity threshold
min: 0
max: 1

// Result limits
min: 1
max: unlimited (but maxLimit >= defaultLimit)
```

### Required Fields

- `provider`: Must be configured
- `config.apiKey`: Required if provider enabled
- `dimensions`: Must be valid dimension
- `enabled`: Boolean flag

## Example Configurations

### Development Environment

```bash
# .env.development
VECTOR_EMBEDDING_PROVIDER=openai
VECTOR_EMBEDDING_MODEL=text-embedding-3-small
VECTOR_EMBEDDING_DIMENSIONS=1536
VECTOR_EMBEDDING_API_KEY=sk-dev-key

VECTOR_EMBEDDING_BATCH_SIZE=50
VECTOR_EMBEDDING_TIMEOUT_MS=30000

VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY=0.5
VECTOR_SEARCH_DEFAULT_LIMIT=5

VECTOR_INDEX_AUTO_CREATE=true
VECTOR_INDEX_LISTS=50
VECTOR_INDEX_PROBES=5

VECTOR_PERFORMANCE_ENABLE_CACHE=false
```

### Production Environment

```bash
# .env.production
VECTOR_EMBEDDING_PROVIDER=openai
VECTOR_EMBEDDING_MODEL=text-embedding-3-small
VECTOR_EMBEDDING_DIMENSIONS=1536
VECTOR_EMBEDDING_API_KEY=sk-prod-key

VECTOR_EMBEDDING_BATCH_SIZE=200
VECTOR_EMBEDDING_MAX_RETRIES=5
VECTOR_EMBEDDING_TIMEOUT_MS=60000

VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY=0.7
VECTOR_SEARCH_DEFAULT_LIMIT=10
VECTOR_SEARCH_MAX_LIMIT=100

VECTOR_INDEX_AUTO_CREATE=false
VECTOR_INDEX_LISTS=300
VECTOR_INDEX_PROBES=20

VECTOR_PERFORMANCE_ENABLE_CACHE=true
VECTOR_PERFORMANCE_CACHE_TTL_SECONDS=7200
VECTOR_PERFORMANCE_POOL_SIZE=20
```

### High-Volume Environment

```bash
# Optimized for 1M+ embeddings
VECTOR_EMBEDDING_BATCH_SIZE=500
VECTOR_EMBEDDING_MAX_RETRIES=3
VECTOR_EMBEDDING_TIMEOUT_MS=120000

VECTOR_INDEX_LISTS=500
VECTOR_INDEX_PROBES=20

VECTOR_PERFORMANCE_ENABLE_CACHE=true
VECTOR_PERFORMANCE_CACHE_TTL_SECONDS=10800
VECTOR_PERFORMANCE_POOL_SIZE=50
```

## Troubleshooting

### Issue: "No API key configured"

**Solution**: Set `VECTOR_EMBEDDING_API_KEY` or `OPENAI_API_KEY`:

```bash
export OPENAI_API_KEY=sk-...
```

### Issue: "Embedding dimensions mismatch"

**Cause**: Model output dimensions don't match configured dimensions

**Solution**: Match to model:

```bash
# For text-embedding-3-small
VECTOR_EMBEDDING_DIMENSIONS=1536

# For text-embedding-3-large
VECTOR_EMBEDDING_DIMENSIONS=3072
```

### Issue: "Timeout exceeded"

**Cause**: Default timeout too short for your content

**Solution**: Increase timeout:

```bash
VECTOR_EMBEDDING_TIMEOUT_MS=60000  # 60 seconds
```

### Issue: "Search results too few/many"

**Solution**: Adjust similarity threshold:

```bash
# More results (less strict)
VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY=0.5

# Fewer results (more strict)
VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY=0.8
```

## Verification

### Check Configuration Loading

```typescript
// In a service method
const config = await vectorConfigService.getDefaultConfig();
console.log('Config:', config);
```

### Validate in Database

```sql
-- Check configurations
SELECT id, organization_id, provider, embedding_model, dimensions, enabled
FROM vector_search_configs;

-- Check embeddings
SELECT source_type, count(*) as count
FROM vector_embeddings
GROUP BY source_type;
```

## Migration Guide

### Updating Models

From `text-embedding-ada-002` to `text-embedding-3-small`:

```sql
-- Update config
UPDATE vector_search_configs
SET embedding_model = 'text-embedding-3-small'
WHERE id = 'config-id';

-- Note: Existing embeddings won't be re-indexed automatically
-- Consider re-embedding important documents for better results
```

### Scaling pgvector Index

For very large vector sets (1M+ embeddings):

```sql
-- Rebuild IVF index with more clusters
REINDEX INDEX vector_embeddings_embedding_idx;
```

## Performance Tuning

### Index Statistics

Monitor index performance:

```sql
-- Check index size
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'vector_embeddings';
```

### Query Planning

Analyze search query performance:

```sql
EXPLAIN ANALYZE
SELECT similarity, source_id
FROM vector_embeddings
WHERE organization_id = 'org-id'
ORDER BY embedding <=> '[...]'::vector
LIMIT 10;
```
