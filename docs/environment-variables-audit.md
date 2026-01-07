# Environment Variables Audit

This document provides a comprehensive inventory of all environment variables used in the Hollon-AI application, with a focus on database, vector search, and AI service configurations.

## Database Configuration

### PostgreSQL Connection
- **DB_HOST**: Database host address (default: `localhost`)
- **DB_PORT**: Database port number (default: `5432`)
- **DB_NAME**: Database name (default: `hollon`)
- **DB_USER**: Database username (default: `hollon`)
- **DB_PASSWORD**: Database password (default: empty string)
- **DATABASE_URL**: Full PostgreSQL connection URL (alternative to individual DB_* vars)
  - Format: `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
- **DB_SCHEMA**: PostgreSQL schema name (default: `hollon`)
  - In test mode, defaults to `hollon_test`
  - Used for schema isolation and parallel test execution

## AI Service Configuration

### Brain Provider - Claude Code
- **CLAUDE_CODE_PATH**: Path to Claude Code CLI (default: `claude`)
- **BRAIN_TIMEOUT_MS**: Timeout for brain execution in milliseconds (default: `1200000` = 20 minutes)

### Brain Provider - Anthropic API
- **ANTHROPIC_API_KEY**: API key for Anthropic services (optional)
  - Used for Claude API integration

### Brain Provider - OpenAI API
- **OPENAI_API_KEY**: API key for OpenAI services
  - Used for embeddings and other OpenAI features

## Vector Search Configuration

### Feature Control
- **VECTOR_SEARCH_ENABLED**: Enable/disable vector search functionality (default: `true` in dev, `false` in test/prod)

### Embedding Provider Configuration
- **VECTOR_EMBEDDING_PROVIDER**: Embedding provider selection (default: `openai`)
  - Supported values: `openai`, `anthropic`, `local`
- **VECTOR_EMBEDDING_MODEL**: Model name/identifier for embeddings
  - Default for OpenAI: `text-embedding-3-small`
  - Default for Anthropic: `claude-3-embedding`
  - Default for Local: `local-embedding-model`
- **VECTOR_EMBEDDING_DIMENSIONS**: Dimension of embedding vectors
  - Default for OpenAI: `1536`
  - Default for Anthropic: `1024`
  - Default for Local: `768`
- **VECTOR_EMBEDDING_API_KEY**: API key for embedding provider (optional)
  - If not set, uses `OPENAI_API_KEY` for OpenAI provider
- **VECTOR_EMBEDDING_BATCH_SIZE**: Batch size for embedding generation (default: `100`)
- **VECTOR_EMBEDDING_MAX_RETRIES**: Maximum retry attempts for failed embedding requests (default: `3`)
- **VECTOR_EMBEDDING_TIMEOUT_MS**: Timeout for embedding requests in milliseconds (default: `30000`)

### Search Configuration
- **VECTOR_SEARCH_DEFAULT_METRIC**: Default similarity metric for vector search (default: `cosine`)
  - Supported values: `cosine`, `euclidean`, `dot_product`, `inner_product`
- **VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY**: Default minimum similarity threshold, 0.0 to 1.0 (default: `0.7`)
- **VECTOR_SEARCH_DEFAULT_LIMIT**: Default maximum number of results to return (default: `10`)
- **VECTOR_SEARCH_MAX_LIMIT**: Maximum allowed limit for search results (default: `100`)
- **VECTOR_SEARCH_INCLUDE_SCORES_BY_DEFAULT**: Include similarity scores in results by default (default: `true`)

### Index Configuration
- **VECTOR_INDEX_NAME**: Name/identifier for the vector index (default: `vector_embeddings`)
- **VECTOR_INDEX_AUTO_CREATE**: Create index if it doesn't exist (default: `true` in dev, `false` in prod)
- **VECTOR_INDEX_LISTS**: Number of lists for IVF (Inverted File) index - pgvector specific (default: `100`)
- **VECTOR_INDEX_PROBES**: Number of probes for search - pgvector specific (default: `10`)

### Performance Configuration
- **VECTOR_PERFORMANCE_ENABLE_CACHE**: Enable caching for embeddings (default: `true` in prod, `false` otherwise)
- **VECTOR_PERFORMANCE_CACHE_TTL_SECONDS**: Cache TTL in seconds (default: `3600`)
- **VECTOR_PERFORMANCE_POOL_SIZE**: Connection pool size for vector operations (default: `10`)

## Server Configuration

- **NODE_ENV**: Node environment (default: `development`)
  - Values: `development`, `test`, `production`
- **SERVER_PORT**: Server listening port (default: `3001`)
- **SERVER_HOST**: Server host address (default: `0.0.0.0`)

## Cost Management

- **DEFAULT_DAILY_COST_LIMIT_CENTS**: Daily cost limit in cents (default: `10000` = $100)
- **DEFAULT_MONTHLY_COST_LIMIT_CENTS**: Monthly cost limit in cents (default: `100000` = $1000)
- **COST_ALERT_THRESHOLD_PERCENT**: Percentage threshold for cost alerts (default: `80`)

## Logging

- **LOG_LEVEL**: Logging level (default: `debug` in dev, `info` in prod, `error` in test)
  - Supported values: `debug`, `info`, `warn`, `error`
- **LOG_FORMAT**: Log output format (default: `pretty`)

## Security

- **JWT_SECRET**: JWT secret for API authentication (Phase 5 feature)
- **ENCRYPTION_KEY**: Encryption key for credentials - must be 32 bytes hex

## CORS Configuration

- **CORS_ORIGIN**: CORS allowed origins (default: `*`)

## Test/Development Environment Variables

These variables are used internally for testing and are not typically configured by users:

- **JEST_WORKER_ID**: Jest worker ID for parallel test execution
  - Automatically set by Jest
  - Used to create isolated database schemas per worker
- **DISABLE_SCHEDULER**: Disable NestJS ScheduleModule (default: not set, set to `'true'` in tests)
- **HOLLON_E2E_MOCK_LLM**: Use mock LLM responses in E2E tests (default: `false`)

## Configuration Files

The environment variables are loaded and processed through the following configuration system:

1. **Loading**: `.env.local` and `.env` files (loaded via `ConfigModule.forRoot()` in `app.module.ts`)
2. **Processing**: `apps/server/src/config/configuration.ts` - main configuration factory
3. **Database**: `apps/server/src/config/database.config.ts` - TypeORM configuration
4. **Vector Search**: `apps/server/src/modules/vector-search/config/vector-search.config.ts` - vector search configuration

## Notes

- All vector search configuration variables are optional and have sensible defaults
- The configuration system supports provider-specific defaults (OpenAI, Anthropic, Local)
- Test environment automatically uses mock API keys to prevent actual API calls
- Database schema isolation is automatically handled in test mode with Jest worker IDs
- Configuration is globally available through NestJS `ConfigService`
