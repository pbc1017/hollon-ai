import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add Vector Search Infrastructure
 *
 * Creates the complete vector search infrastructure including:
 * - vector_search_configs: Configuration for embedding providers and search parameters
 * - vector_embeddings: Storage for vector embeddings with pgvector support
 *
 * This migration establishes the foundation for semantic search capabilities
 * across the application, enabling similarity searches for documents, messages,
 * knowledge items, and other content types.
 *
 * Prerequisites:
 * - pgvector extension must be enabled (see EnablePgvectorExtension1736246400000)
 * - PostgreSQL 11+ with pgvector extension installed
 *
 * Features:
 * - Multi-tenant isolation via organization_id
 * - Flexible metadata storage with JSONB
 * - Optimized indexes for vector similarity search (HNSW)
 * - Support for multiple embedding models and dimensions
 * - Polymorphic source references (documents, messages, etc.)
 * - Tag-based filtering and categorization
 *
 * @see VectorSearchConfig entity for configuration schema
 * @see VectorEmbedding entity for embedding schema
 * @see VectorSearchService for usage examples
 */
export class AddVectorSearchInfrastructure1736250000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // Step 1: Create Enum Types
    // =========================================================================

    // Create EmbeddingSourceType enum
    await queryRunner.query(`
      CREATE TYPE embedding_source_type AS ENUM (
        'document',
        'task',
        'message',
        'knowledge_item',
        'code_snippet',
        'decision_log',
        'meeting_record',
        'graph_node',
        'custom'
      )
    `);

    // Create EmbeddingModelType enum
    await queryRunner.query(`
      CREATE TYPE embedding_model_type AS ENUM (
        'openai_ada_002',
        'openai_small_3',
        'openai_large_3',
        'cohere_english_v3',
        'custom'
      )
    `);

    // =========================================================================
    // Step 2: Create vector_search_configs Table
    // =========================================================================

    await queryRunner.query(`
      CREATE TABLE vector_search_configs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        provider VARCHAR(50) NOT NULL DEFAULT 'openai',
        embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
        dimensions INTEGER NOT NULL DEFAULT 1536,
        config JSONB NOT NULL DEFAULT '{}',
        search_config JSONB NOT NULL DEFAULT '{}',
        cost_per_1k_tokens_cents DECIMAL(10, 6) NOT NULL DEFAULT 0.00002,
        enabled BOOLEAN NOT NULL DEFAULT true,
        timeout_seconds INTEGER NOT NULL DEFAULT 30,
        max_retries INTEGER NOT NULL DEFAULT 3,
        rate_limit_config JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create indexes for vector_search_configs
    await queryRunner.query(`
      CREATE INDEX idx_vector_search_configs_organization_id
      ON vector_search_configs(organization_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_vector_search_configs_enabled
      ON vector_search_configs(enabled)
    `);

    // =========================================================================
    // Step 3: Create vector_embeddings Table
    // =========================================================================

    await queryRunner.query(`
      CREATE TABLE vector_embeddings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        embedding vector(1536) NOT NULL,
        source_type embedding_source_type NOT NULL,
        source_id UUID NOT NULL,
        model_type embedding_model_type NOT NULL DEFAULT 'openai_ada_002',
        dimensions INTEGER NOT NULL,
        content TEXT,
        metadata JSONB,
        tags TEXT[],
        organization_id UUID NOT NULL,
        project_id UUID,
        team_id UUID,
        hollon_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_vector_embeddings_organization
          FOREIGN KEY (organization_id)
          REFERENCES organizations(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_vector_embeddings_project
          FOREIGN KEY (project_id)
          REFERENCES projects(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_vector_embeddings_team
          FOREIGN KEY (team_id)
          REFERENCES teams(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_vector_embeddings_hollon
          FOREIGN KEY (hollon_id)
          REFERENCES hollons(id)
          ON DELETE SET NULL
      )
    `);

    // =========================================================================
    // Step 4: Create Standard Indexes for vector_embeddings
    // =========================================================================

    // Multi-tenant isolation
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_organization_id
      ON vector_embeddings(organization_id)
    `);

    // Polymorphic source reference lookup
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_source
      ON vector_embeddings(source_type, source_id)
    `);

    // Model compatibility filtering
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_model
      ON vector_embeddings(model_type, dimensions)
    `);

    // Scoped searches
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_project_id
      ON vector_embeddings(project_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_team_id
      ON vector_embeddings(team_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_hollon_id
      ON vector_embeddings(hollon_id)
    `);

    // Tag-based filtering (GIN index for array operations)
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_tags
      ON vector_embeddings USING gin(tags)
    `);

    // =========================================================================
    // Step 5: Create Vector Similarity Search Indexes (HNSW)
    // =========================================================================

    // HNSW index for cosine distance similarity search
    // This is the primary index for semantic search queries
    // m=16: number of connections per layer (default, good balance)
    // ef_construction=64: size of dynamic candidate list during index build
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_embedding_hnsw_cosine
      ON vector_embeddings
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);

    // Alternative: L2 distance index (Euclidean distance)
    // Uncomment if L2 distance is needed for specific use cases
    // await queryRunner.query(`
    //   CREATE INDEX idx_vector_embeddings_embedding_hnsw_l2
    //   ON vector_embeddings
    //   USING hnsw (embedding vector_l2_ops)
    //   WITH (m = 16, ef_construction = 64)
    // `);

    // Alternative: Inner product index
    // Uncomment if inner product similarity is needed
    // await queryRunner.query(`
    //   CREATE INDEX idx_vector_embeddings_embedding_hnsw_ip
    //   ON vector_embeddings
    //   USING hnsw (embedding vector_ip_ops)
    //   WITH (m = 16, ef_construction = 64)
    // `);

    // =========================================================================
    // Step 6: Add Composite Indexes for Common Query Patterns
    // =========================================================================

    // Organization + source type filtering (common query pattern)
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_org_source_type
      ON vector_embeddings(organization_id, source_type)
    `);

    // Project-scoped searches with source type
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_project_source_type
      ON vector_embeddings(project_id, source_type)
      WHERE project_id IS NOT NULL
    `);

    // Team-scoped searches with source type
    await queryRunner.query(`
      CREATE INDEX idx_vector_embeddings_team_source_type
      ON vector_embeddings(team_id, source_type)
      WHERE team_id IS NOT NULL
    `);

    // =========================================================================
    // Step 7: Add Table Comments for Documentation
    // =========================================================================

    await queryRunner.query(`
      COMMENT ON TABLE vector_search_configs IS
      'Configuration for vector search and embedding generation per organization'
    `);

    await queryRunner.query(`
      COMMENT ON TABLE vector_embeddings IS
      'Vector embeddings for semantic search across various content types'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN vector_embeddings.embedding IS
      'Vector representation for semantic similarity search using pgvector'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN vector_embeddings.source_type IS
      'Type of entity that generated this embedding (polymorphic reference)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN vector_embeddings.source_id IS
      'ID of the source entity (polymorphic reference)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables (cascade will handle dependent objects)
    await queryRunner.query(`DROP TABLE IF EXISTS vector_embeddings CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS vector_search_configs CASCADE`,
    );

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS embedding_model_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS embedding_source_type`);
  }
}
