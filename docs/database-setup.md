# Database Setup Guide

This guide covers setting up the PostgreSQL database with pgvector extension for Hollon-AI.

## Table of Contents

- [Overview](#overview)
- [Quick Start (Docker)](#quick-start-docker)
- [Manual Installation](#manual-installation)
- [pgvector Extension](#pgvector-extension)
- [Running Migrations](#running-migrations)
- [Seeding Data](#seeding-data)
- [Troubleshooting](#troubleshooting)

## Overview

Hollon-AI uses PostgreSQL 16 with the following extensions:

- **pgvector**: Vector similarity search for AI/ML embeddings
- **uuid-ossp**: UUID generation
- **pg_trgm**: Text search and similarity

## Quick Start (Docker)

The easiest way to set up the database is using Docker Compose, which includes all required extensions.

### 1. Start the Database

```bash
# Start PostgreSQL with pgvector
pnpm docker:up

# Or manually:
docker-compose -f docker/docker-compose.yml up -d
```

This will:
- Pull the `pgvector/pgvector:pg16` image
- Create a PostgreSQL 16 container with pgvector pre-installed
- Run initialization scripts to enable extensions
- Set up the database schemas

### 2. Verify Database is Running

```bash
# Check container status
docker ps | grep hollon-postgres

# Check database connection
docker exec -it hollon-postgres psql -U hollon -d hollon -c "SELECT version();"
```

### 3. Verify pgvector Extension

```bash
# Connect to the database
docker exec -it hollon-postgres psql -U hollon -d hollon

# Check if pgvector is enabled
\dx

# You should see 'vector' in the list of extensions
# Exit psql
\q
```

## Manual Installation

If you're not using Docker, follow these steps to set up PostgreSQL manually.

### Prerequisites

- PostgreSQL 16 or higher
- Build tools (gcc, make) for compiling pgvector

### 1. Install PostgreSQL

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-16 postgresql-server-dev-16
sudo systemctl start postgresql
```

### 2. Install pgvector Extension

```bash
# Clone the pgvector repository
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector

# Build and install
make
sudo make install

# For macOS with Homebrew PostgreSQL:
make PG_CONFIG=/opt/homebrew/opt/postgresql@16/bin/pg_config
sudo make install PG_CONFIG=/opt/homebrew/opt/postgresql@16/bin/pg_config
```

### 3. Create Database and User

```bash
# Connect to PostgreSQL
psql postgres

# Create user and database
CREATE USER hollon WITH PASSWORD 'your_secure_password';
CREATE DATABASE hollon OWNER hollon;

# Connect to the hollon database
\c hollon

# Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

# Create schemas
CREATE SCHEMA IF NOT EXISTS hollon;
CREATE SCHEMA IF NOT EXISTS hollon_test;

# Grant permissions
GRANT ALL ON SCHEMA hollon TO hollon;
GRANT ALL ON SCHEMA hollon_test TO hollon;
GRANT USAGE ON SCHEMA public TO hollon;

# Exit
\q
```

## pgvector Extension

### What is pgvector?

pgvector is a PostgreSQL extension that provides:
- Vector data type for storing embeddings
- Similarity search using various distance metrics (L2, inner product, cosine)
- Indexing support (IVFFlat, HNSW) for fast nearest neighbor search

### Use Cases in Hollon-AI

1. **Knowledge Graph Embeddings**: Store and retrieve semantic embeddings of documents
2. **Semantic Search**: Find similar tasks, documents, or code snippets
3. **AI-Powered Recommendations**: Match hollons to tasks based on skill embeddings
4. **Context-Aware Task Assignment**: Use vector similarity to find relevant context

### Vector Operations

```sql
-- L2 distance (Euclidean)
SELECT * FROM knowledge_items ORDER BY embedding <-> '[0.1, 0.2, ...]'::vector LIMIT 10;

-- Inner product
SELECT * FROM knowledge_items ORDER BY embedding <#> '[0.1, 0.2, ...]'::vector LIMIT 10;

-- Cosine distance
SELECT * FROM knowledge_items ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector LIMIT 10;
```

### Creating Indexes

For better performance on large datasets:

```sql
-- IVFFlat index (good for < 1M vectors)
CREATE INDEX ON knowledge_items USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- HNSW index (better for > 1M vectors)
CREATE INDEX ON knowledge_items USING hnsw (embedding vector_l2_ops);
```

## Running Migrations

### Development

```bash
# Run all pending migrations
pnpm db:migrate

# Or manually:
cd apps/server
npm run migration:run
```

### Test Database

```bash
# Run migrations on test database
cd apps/server
npm run migration:run:test
```

### Create New Migration

```bash
cd apps/server
npm run migration:generate -- src/database/migrations/MigrationName
```

## Seeding Data

### Seed Development Database

```bash
# Run seed script
pnpm db:seed

# Or manually:
cd apps/server
npm run seed
```

This will create:
- Sample organization
- Teams and roles
- Test hollons
- Sample tasks

## Troubleshooting

### pgvector Extension Not Found

**Error:**
```
ERROR:  extension "vector" is not available
```

**Solution:**
1. Verify pgvector is installed:
   ```bash
   ls $(pg_config --sharedir)/extension/vector*
   ```
2. If not found, reinstall pgvector (see [Manual Installation](#manual-installation))
3. For Docker, ensure you're using the `pgvector/pgvector:pg16` image

### Migration Fails with Permission Denied

**Error:**
```
ERROR:  permission denied to create extension "vector"
```

**Solution:**
1. Connect as superuser and enable the extension:
   ```bash
   docker exec -it hollon-postgres psql -U postgres -d hollon -c "CREATE EXTENSION IF NOT EXISTS vector;"
   ```

### Connection Refused

**Error:**
```
ECONNREFUSED: Connection refused
```

**Solution:**
1. Check if PostgreSQL is running:
   ```bash
   docker ps | grep hollon-postgres
   ```
2. Verify connection settings in `.env`:
   ```bash
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=hollon
   DB_USER=hollon
   DB_PASSWORD=your_password
   ```
3. Restart the database:
   ```bash
   pnpm docker:restart
   ```

### Vector Dimension Mismatch

**Error:**
```
ERROR:  expected 1536 dimensions, not 768
```

**Solution:**
This occurs when trying to insert embeddings with different dimensions. Ensure:
1. All embeddings use the same model (e.g., OpenAI text-embedding-ada-002 = 1536 dimensions)
2. Vector columns are defined with the correct dimension: `embedding vector(1536)`

## Environment Variables

Required environment variables in `.env`:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hollon
DB_USER=hollon
DB_PASSWORD=your_secure_password_here

# Full connection URL (alternative)
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# OpenAI API Key (for embeddings)
OPENAI_API_KEY=your_openai_api_key_here
```

## Additional Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [PostgreSQL Extensions](https://www.postgresql.org/docs/current/contrib.html)
- [TypeORM Migrations](https://typeorm.io/migrations)
- [Vector Similarity Search Guide](https://github.com/pgvector/pgvector#distances)

## Database Schema

The database uses two schemas:

- `hollon`: Main schema for production data
- `hollon_test`: Isolated schema for testing

All application entities use the `hollon` schema by default, ensuring clean separation from test data.
