import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVectorSearchTables1766800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * Create vector_search_configs table
     * Stores organization-specific configuration for vector search and embedding generation
     */
    await queryRunner.query(`
      CREATE TABLE "vector_search_configs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "display_name" varchar(255) NOT NULL,
        "provider" varchar(50) NOT NULL DEFAULT 'openai',
        "embedding_model" varchar(100) NOT NULL DEFAULT 'text-embedding-3-small',
        "dimensions" integer NOT NULL DEFAULT 1536,
        "config" jsonb NOT NULL DEFAULT '{}',
        "search_config" jsonb NOT NULL DEFAULT '{}',
        "cost_per_1k_tokens_cents" decimal(10,6) NOT NULL DEFAULT 0.00002,
        "enabled" boolean NOT NULL DEFAULT true,
        "timeout_seconds" integer NOT NULL DEFAULT 30,
        "max_retries" integer NOT NULL DEFAULT 3,
        "rate_limit_config" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_vector_search_configs_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);

    // Create index for organization_id
    await queryRunner.query(`
      CREATE INDEX "IDX_vector_search_configs_organization" ON "vector_search_configs" ("organization_id")
    `);

    /**
     * Create embedding source type enum
     * Defines the type of entity or content that generated the embedding
     */
    await queryRunner.query(`
      CREATE TYPE "embedding_source_type_enum" AS ENUM (
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

    /**
     * Create embedding model type enum
     * Tracks which embedding model was used for generation
     */
    await queryRunner.query(`
      CREATE TYPE "embedding_model_type_enum" AS ENUM (
        'openai_ada_002',
        'openai_small_3',
        'openai_large_3',
        'cohere_english_v3',
        'custom'
      )
    `);

    /**
     * Create vector_embeddings table
     * Stores vector embeddings for semantic search and similarity matching
     * Uses pgvector extension for efficient vector operations
     *
     * Key Features:
     * - Supports multiple vector dimensions (1536 for ada-002/small-3, 3072 for large-3)
     * - Polymorphic source references via source_type and source_id
     * - Multi-tenant isolation via organization_id
     * - Optional project, team, and hollon associations
     * - Tag-based filtering for hybrid search
     * - JSONB metadata for flexible extension
     *
     * Performance Considerations:
     * - Vector column uses text type in TypeORM (actual vector type set in this migration)
     * - Indexes should be added via HNSW or IVFFlat when data volume grows
     * - Storage: ~6 KB per 1536-dim embedding, ~12 KB per 3072-dim embedding
     */
    await queryRunner.query(`
      CREATE TABLE "vector_embeddings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "embedding" vector(1536) NOT NULL,
        "source_type" embedding_source_type_enum NOT NULL,
        "source_id" uuid NOT NULL,
        "model_type" embedding_model_type_enum NOT NULL DEFAULT 'openai_ada_002',
        "dimensions" integer NOT NULL,
        "content" text,
        "metadata" jsonb,
        "tags" text[],
        "organization_id" uuid NOT NULL,
        "project_id" uuid,
        "team_id" uuid,
        "hollon_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_vector_embeddings_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_vector_embeddings_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_vector_embeddings_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_vector_embeddings_hollon" FOREIGN KEY ("hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes for efficient querying
    await queryRunner.query(`
      CREATE INDEX "IDX_vector_embeddings_organization" ON "vector_embeddings" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_vector_embeddings_source" ON "vector_embeddings" ("source_type", "source_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_vector_embeddings_model" ON "vector_embeddings" ("model_type", "dimensions")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_vector_embeddings_project" ON "vector_embeddings" ("project_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_vector_embeddings_team" ON "vector_embeddings" ("team_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_vector_embeddings_hollon" ON "vector_embeddings" ("hollon_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_vector_embeddings_tags" ON "vector_embeddings" USING GIN ("tags")
    `);

    /**
     * Vector Index for Similarity Search
     *
     * HNSW (Hierarchical Navigable Small World) index for fast approximate nearest neighbor search.
     *
     * Parameters:
     * - m: 16 (number of connections per layer, higher = better recall but more memory)
     * - ef_construction: 64 (size of dynamic candidate list during construction)
     *
     * Performance:
     * - Query speed: ~1ms for small datasets, scales logarithmically
     * - Index build: Slower than IVFFlat but better query performance
     * - Memory: ~20 bytes per vector per layer
     *
     * When to add:
     * - Recommended after inserting >1000 vectors for noticeable performance gains
     * - For smaller datasets, sequential scan is often faster
     * - Can be added/removed dynamically based on data volume
     *
     * Alternative indexes (for future consideration):
     * - IVFFlat: Faster index creation, slower queries
     * - Command: CREATE INDEX ON vector_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
     *
     * Note: Currently commented out to avoid overhead for small datasets.
     * Uncomment when dataset reaches significant size (>10,000 vectors).
     */
    // await queryRunner.query(`
    //   CREATE INDEX "IDX_vector_embeddings_hnsw" ON "vector_embeddings"
    //   USING hnsw (embedding vector_cosine_ops)
    //   WITH (m = 16, ef_construction = 64)
    // `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /**
     * Rollback Migration
     *
     * Drops vector_embeddings and vector_search_configs tables along with their enums.
     * All vector embeddings and search configurations will be lost.
     */

    // Drop vector embeddings table
    await queryRunner.query(`DROP TABLE IF EXISTS "vector_embeddings"`);

    // Drop vector_search_configs table
    await queryRunner.query(`DROP TABLE IF EXISTS "vector_search_configs"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "embedding_model_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "embedding_source_type_enum"`);
  }
}
