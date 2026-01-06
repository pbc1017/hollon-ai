import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vector Embeddings Module - Create vector_embeddings table with pgvector support
 *
 * This migration:
 * - Enables the pgvector extension for vector similarity search
 * - Creates the vector_embeddings table for storing vector embeddings
 * - Sets up indexes for efficient queries on organization, source, and model filters
 * - Configures foreign key relationships with CASCADE/SET NULL constraints
 */
export class AddVectorEmbeddingsTable1766900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector extension (idempotent - safe to run multiple times)
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
    `);

    // Create enum types for source_type and model_type
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
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "embedding_model_type_enum" AS ENUM (
        'openai_ada_002',
        'openai_small_3',
        'openai_large_3',
        'cohere_english_v3',
        'custom'
      );
    `);

    // Create vector_embeddings table
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
        CONSTRAINT "FK_vector_embeddings_organization"
          FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_vector_embeddings_project"
          FOREIGN KEY ("project_id")
          REFERENCES "projects"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_vector_embeddings_team"
          FOREIGN KEY ("team_id")
          REFERENCES "teams"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_vector_embeddings_hollon"
          FOREIGN KEY ("hollon_id")
          REFERENCES "hollons"("id")
          ON DELETE SET NULL
      );
    `);

    // Create indexes for performance
    await queryRunner.query(`
      -- Organization index for multi-tenant filtering
      CREATE INDEX "idx_vector_embeddings_organization_id"
        ON "vector_embeddings"("organization_id");

      -- Source type and ID for polymorphic lookups
      CREATE INDEX "idx_vector_embeddings_source"
        ON "vector_embeddings"("source_type", "source_id");

      -- Model type and dimensions for compatibility checks
      CREATE INDEX "idx_vector_embeddings_model"
        ON "vector_embeddings"("model_type", "dimensions");

      -- Project, team, and hollon indexes for scoped searches
      CREATE INDEX "idx_vector_embeddings_project_id"
        ON "vector_embeddings"("project_id")
        WHERE "project_id" IS NOT NULL;

      CREATE INDEX "idx_vector_embeddings_team_id"
        ON "vector_embeddings"("team_id")
        WHERE "team_id" IS NOT NULL;

      CREATE INDEX "idx_vector_embeddings_hollon_id"
        ON "vector_embeddings"("hollon_id")
        WHERE "hollon_id" IS NOT NULL;

      -- GIN index for tag array searches
      CREATE INDEX "idx_vector_embeddings_tags"
        ON "vector_embeddings" USING GIN("tags")
        WHERE "tags" IS NOT NULL;

      -- IVFFlat index for vector similarity search
      -- Using cosine distance (most common for embeddings)
      -- lists = rows/1000 is a good starting point (adjust based on data size)
      CREATE INDEX "idx_vector_embeddings_embedding_cosine"
        ON "vector_embeddings" USING ivfflat ("embedding" vector_cosine_ops)
        WITH (lists = 100);
    `);

    // Add comments for documentation
    await queryRunner.query(`
      COMMENT ON TABLE "vector_embeddings" IS
        'Stores vector embeddings for semantic search and similarity matching.
         Uses pgvector extension for efficient vector operations.';

      COMMENT ON COLUMN "vector_embeddings"."embedding" IS
        'Vector representation stored as pgvector type (1536 dimensions by default).
         Format: [0.1, 0.2, 0.3, ...] - actual dimensions depend on model_type.';

      COMMENT ON COLUMN "vector_embeddings"."source_type" IS
        'Type of entity that generated this embedding (document, task, message, etc).';

      COMMENT ON COLUMN "vector_embeddings"."source_id" IS
        'UUID of the source entity (polymorphic reference based on source_type).';

      COMMENT ON COLUMN "vector_embeddings"."model_type" IS
        'Embedding model used for generation (e.g., openai_ada_002).
         Important for compatibility when querying similar vectors.';

      COMMENT ON COLUMN "vector_embeddings"."dimensions" IS
        'Number of dimensions in the vector. Must match embedding column dimension.
         Common values: 1536 (OpenAI), 3072 (OpenAI large), 1024 (Cohere).';

      COMMENT ON COLUMN "vector_embeddings"."content" IS
        'Original text content that was embedded (stored for reference).';

      COMMENT ON COLUMN "vector_embeddings"."metadata" IS
        'JSONB metadata including: embeddingModelVersion, processingTimestamp,
         chunkIndex, totalChunks, tokenCount, sourceUrl, language, quality.';

      COMMENT ON COLUMN "vector_embeddings"."tags" IS
        'Array of tags for filtering and hybrid search (vector + tag matching).';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_vector_embeddings_embedding_cosine";
      DROP INDEX IF EXISTS "idx_vector_embeddings_tags";
      DROP INDEX IF EXISTS "idx_vector_embeddings_hollon_id";
      DROP INDEX IF EXISTS "idx_vector_embeddings_team_id";
      DROP INDEX IF EXISTS "idx_vector_embeddings_project_id";
      DROP INDEX IF EXISTS "idx_vector_embeddings_model";
      DROP INDEX IF EXISTS "idx_vector_embeddings_source";
      DROP INDEX IF EXISTS "idx_vector_embeddings_organization_id";
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "vector_embeddings";
    `);

    // Drop enum types
    await queryRunner.query(`
      DROP TYPE IF EXISTS "embedding_model_type_enum";
      DROP TYPE IF EXISTS "embedding_source_type_enum";
    `);

    // Note: We don't drop the vector extension as other tables might be using it
    // If you need to drop it, run: DROP EXTENSION IF EXISTS vector;
  }
}
