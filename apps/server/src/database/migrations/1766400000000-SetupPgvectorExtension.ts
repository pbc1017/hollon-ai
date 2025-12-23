import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetupPgvectorExtension1766400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create pgvector extension if not exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    // Verify vector type is available
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
          RAISE EXCEPTION 'pgvector extension failed to load. Vector type not found.';
        END IF;
      END
      $$;
    `);

    // Update documents table to use proper vector type if needed
    // Check if embedding column exists and is not already vector type
    const embedColumnInfo = await queryRunner.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'documents' AND column_name = 'embedding'
      AND table_schema = current_schema();
    `);

    if (embedColumnInfo && embedColumnInfo.length > 0) {
      const columnType = embedColumnInfo[0].udt_name || embedColumnInfo[0].data_type;

      // If column exists but is not vector, convert it
      if (columnType !== 'vector') {
        await queryRunner.query(`
          ALTER TABLE "documents"
          ALTER COLUMN "embedding" TYPE vector(1536) USING NULL;
        `);
      }
    } else {
      // If column doesn't exist, create it
      await queryRunner.query(`
        ALTER TABLE "documents"
        ADD COLUMN "embedding" vector(1536) NULL;
      `);
    }

    // Create HNSW index for fast vector similarity search (L2 distance)
    // HNSW index is suitable for similarity search queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_embedding_hnsw"
      ON "documents" USING hnsw (embedding vector_l2_ops)
      WITH (m = 16, ef_construction = 64);
    `);

    // Create IVFFlat index as alternative (lower memory usage for large datasets)
    // Can be useful if memory is constrained
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_embedding_ivfflat"
      ON "documents" USING ivfflat (embedding vector_l2_ops)
      WITH (lists = 100);
    `);

    // Create composite index for organization + type queries with vector search
    // This helps when filtering by organization and type before similarity search
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_org_type_embedding"
      ON "documents" (organization_id, type)
      WHERE embedding IS NOT NULL;
    `);

    // Log successful setup
    console.log('✓ pgvector extension enabled');
    console.log('✓ Vector indexes created (HNSW and IVFFlat)');
    console.log('✓ Composite indexes created for efficient queries');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_embedding_hnsw";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_embedding_ivfflat";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_org_type_embedding";`);

    // Note: We don't drop the embedding column or extension to preserve data
    // If you want to completely remove pgvector support, you would need to:
    // 1. Drop the embedding column
    // 2. Drop the pgvector extension (if no other tables use vector type)
    // This is left as a manual process for safety
  }
}
