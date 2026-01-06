# Database Migration Workflow

## Overview

This document describes the database migration workflow for the Hollon-AI project using TypeORM migrations. The project uses PostgreSQL with the pgvector extension for vector similarity search capabilities.

## Migration Configuration

### TypeORM Configuration

The migration configuration is defined in `apps/server/src/config/typeorm.config.ts`:

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

### Migration Directory

All migrations are stored in: `apps/server/src/database/migrations/`

## Available Migration Commands

### Root Level Commands

Run these from the project root:

```bash
# Run pending migrations
pnpm db:migrate

# Generate a new migration from entity changes
pnpm db:migrate:generate -- ./apps/server/src/database/migrations/MigrationName

# Revert the last executed migration
pnpm db:migrate:revert

# Show all migrations and their status
pnpm db:migrate:show
```

### Server Package Commands

Run these from `apps/server/`:

```bash
# Run pending migrations
pnpm db:migrate

# Generate a new migration
pnpm db:migrate:generate -- ./src/database/migrations/MigrationName

# Revert the last migration
pnpm db:migrate:revert

# Show migration status
pnpm db:migrate:show

# Run migrations for test environment
pnpm db:migrate:test
```

## pgvector Integration

### Extension Setup

The pgvector extension is initialized in the first migration (`1733295000000-InitialSchema.ts`):

```typescript
await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
```

This must be executed before any tables with vector columns are created.

### Vector Column Usage

Vector columns are defined in migrations with explicit dimensionality:

```typescript
await queryRunner.query(`
  CREATE TABLE "documents" (
    "embedding" vector(1536),
    -- other columns...
  )
`);
```

Common embedding dimensions:

- OpenAI text-embedding-ada-002: 1536
- OpenAI text-embedding-3-small: 1536
- OpenAI text-embedding-3-large: 3072
- Cohere embed-english-v3.0: 1024

## Migration Workflow

### 1. Making Entity Changes

When you modify entity files in `apps/server/src/entities/` or module entity files, you need to create a migration to reflect these changes in the database.

### 2. Generating Migrations

TypeORM can automatically generate migrations based on entity changes:

```bash
# From project root
pnpm db:migrate:generate -- ./apps/server/src/database/migrations/DescriptiveNameHere

# Example
pnpm db:migrate:generate -- ./apps/server/src/database/migrations/AddVectorIndexToDocuments
```

### 3. Reviewing Generated Migrations

Always review auto-generated migrations before running them:

1. Check the `up()` method for correct SQL
2. Verify the `down()` method for proper rollback
3. Ensure vector-specific syntax is correct
4. Add comments for complex operations

### 4. Running Migrations

```bash
# Development
pnpm db:migrate

# Test environment
pnpm --filter @hollon-ai/server db:migrate:test
```

### 5. Verifying Migration Status

```bash
pnpm db:migrate:show
```

Output shows:

- `[X]` - Executed migrations
- `[ ]` - Pending migrations

### 6. Rolling Back Migrations

If a migration causes issues:

```bash
pnpm db:migrate:revert
```

This reverts the last executed migration using its `down()` method.

## Best Practices

### Migration Naming

Use descriptive names with timestamps:

- `1735300000000-AddUserAuthentication.ts`
- `1735400000000-CreateVectorIndexes.ts`
- `1735500000000-AddKnowledgeGraphTables.ts`

### Migration Content

1. Keep migrations focused on a single logical change
2. Always include both `up()` and `down()` methods
3. Use transactions for multiple related operations
4. Add comments explaining complex SQL
5. Test migrations on a development database first

### Vector-Specific Considerations

When working with vector columns:

1. Always create the vector extension first
2. Specify dimensions explicitly for vector columns
3. Consider indexing strategies (IVFFlat or HNSW)
4. Add indexes in separate migrations for large tables
5. Document the embedding model and dimensions used

Example vector index migration:

```typescript
export class AddVectorIndexToDocuments1735400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create HNSW index for better query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_embedding_hnsw
      ON documents
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_documents_embedding_hnsw`,
    );
  }
}
```

### Schema Isolation

The project uses schema-based multitenancy with `search_path` configuration:

- Application tables use the configured schema (default: `hollon`)
- pgvector extension is in the `public` schema
- The `search_path` includes both schemas for proper vector type resolution

## Troubleshooting

### Migration Command Not Found

If you see "Cannot find module './cli.js'", ensure you're using the correct TypeORM CLI:

- Use `typeorm-ts-node-commonjs` instead of `ts-node ./node_modules/typeorm/cli.js`

### Vector Type Not Found

If you see "type 'vector' does not exist":

1. Ensure the pgvector extension is installed on PostgreSQL
2. Verify the extension is created: `CREATE EXTENSION IF NOT EXISTS vector`
3. Check that `search_path` includes the `public` schema

### Migration Already Applied

If a migration is marked as executed but needs to be re-run:

1. Check the `migrations` table in your database
2. Remove the entry for that migration (use with caution)
3. Re-run the migration

### Test Migration Failures

For test environment issues:

1. Ensure test database exists
2. Check `DB_SCHEMA` environment variable
3. Verify test database has pgvector extension installed

## Environment Variables

Required environment variables (in `.env` or `.env.local`):

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=hollon
DB_PASSWORD=your_password
DB_NAME=hollon
DB_SCHEMA=hollon  # Optional, defaults to 'hollon'
```

For test environments:

```bash
NODE_ENV=test
DB_SCHEMA=hollon_test_worker_1  # Or other test schema
```

## Migration History

The migration system tracks executed migrations in the `migrations` table:

```sql
SELECT * FROM migrations ORDER BY id;
```

This table is automatically managed by TypeORM and should not be modified manually except in exceptional circumstances.

## References

- [TypeORM Migrations Documentation](https://typeorm.io/migrations)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [pgvector Integration Guide](./pgvector-typeorm-integration.md)
- [pgvector Best Practices](./pgvector-best-practices.md)
