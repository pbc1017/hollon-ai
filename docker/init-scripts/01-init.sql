-- Hollon-AI Database Initialization Script
-- This script runs when the PostgreSQL container is first created
--
-- Purpose:
-- - Enable required PostgreSQL extensions
-- - Create database schemas
-- - Grant appropriate permissions
--
-- Execution Context:
-- - Runs automatically when Docker container initializes
-- - Executes as postgres superuser
-- - Only runs on first container creation (not on restarts)

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

/**
 * Enable required extensions in public schema (accessible from all schemas)
 *
 * Extensions:
 * - uuid-ossp: Provides UUID generation functions (uuid_generate_v4)
 * - vector: pgvector extension for vector similarity search (AI embeddings)
 * - pg_trgm: Trigram-based text search for fuzzy matching and similarity
 *
 * Why public schema?
 * - Extensions in public schema are accessible from all database schemas
 * - Allows hollon and hollon_test schemas to use the same extension instances
 * - Follows PostgreSQL best practices for shared resources
 */
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;

/**
 * pgvector extension for AI-powered vector similarity search
 *
 * Features:
 * - Vector data types: vector(n), halfvec(n), bit(n), sparsevec(n)
 * - Distance operators: <=> (cosine), <-> (L2), <#> (inner product)
 * - Index types: HNSW (fast queries), IVFFlat (fast builds)
 *
 * Use Cases:
 * - Semantic search across documents
 * - Knowledge graph embeddings
 * - Content recommendation
 * - Duplicate detection
 *
 * Version: 0.8.1+ recommended (included in pgvector/pgvector:pg16 image)
 * Documentation: https://github.com/pgvector/pgvector
 */
CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA public;

/**
 * pg_trgm extension for trigram-based text search
 *
 * Features:
 * - Fuzzy text matching
 * - Similarity scoring
 * - GIN/GiST indexes for fast text search
 *
 * Use Cases:
 * - Autocomplete functionality
 * - Typo-tolerant search
 * - Text similarity ranking
 */
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA public;  -- Text search

-- ============================================================================
-- SCHEMAS
-- ============================================================================

/**
 * Create application schemas
 *
 * Schemas:
 * - hollon: Production/development schema for application data
 * - hollon_test: Isolated schema for automated tests
 *
 * Benefits:
 * - Schema isolation between production and test data
 * - Clean separation of concerns
 * - Enables parallel test execution without conflicts
 */
CREATE SCHEMA IF NOT EXISTS hollon;
CREATE SCHEMA IF NOT EXISTS hollon_test;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

/**
 * Grant schema permissions to hollon user
 *
 * Permissions:
 * - ALL on hollon: Full access to production/development schema
 * - ALL on hollon_test: Full access to test schema
 * - USAGE on public: Required to access extensions
 *
 * Security Note:
 * - hollon user has full control within its schemas
 * - Cannot modify public schema (extensions are read-only)
 * - Cannot access other databases or schemas
 */
GRANT ALL ON SCHEMA hollon TO hollon;
GRANT ALL ON SCHEMA hollon_test TO hollon;
GRANT USAGE ON SCHEMA public TO hollon;  -- Required for extension access

-- ============================================================================
-- INITIALIZATION LOGGING
-- ============================================================================

/**
 * Log successful initialization
 *
 * This block provides feedback during container startup to confirm:
 * - Database initialization completed successfully
 * - All extensions are enabled and accessible
 * - Schemas are created and ready for migrations
 *
 * Check logs: docker logs hollon-ai-postgres
 */
DO $$
BEGIN
    RAISE NOTICE 'Hollon-AI database initialized successfully';
    RAISE NOTICE 'Extensions enabled in public schema: uuid-ossp, vector, pg_trgm';
    RAISE NOTICE 'Schemas created: hollon, hollon_test';
    RAISE NOTICE 'Permissions granted to hollon user';
    RAISE NOTICE 'Ready for TypeORM migrations';
END
$$;
