import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add embedding_id foreign key index on KnowledgeItem
 *
 * Adds an index on the embedding_id foreign key column in knowledge_items table
 * to optimize queries filtering or joining by embedding relationships.
 *
 * This optimization supports:
 * - Fast lookups of embeddings associated with knowledge items
 * - Efficient JOIN operations between knowledge_items and knowledge_embeddings
 * - Improved query performance for semantic search and similarity operations
 *
 * Index naming convention: idx_tablename_columnname
 */
export class AddEmbeddingIdIndexOnKnowledgeItem1766496788000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add embedding_id column to knowledge_items table if it doesn't exist
    // This creates a denormalized foreign key for faster access patterns
    const table = await queryRunner.getTable('knowledge_items');

    if (table && !table.columns.find((col) => col.name === 'embedding_id')) {
      await queryRunner.query(`
        ALTER TABLE "knowledge_items"
        ADD COLUMN "embedding_id" uuid
      `);

      // Add foreign key constraint to knowledge_embeddings
      await queryRunner.query(`
        ALTER TABLE "knowledge_items"
        ADD CONSTRAINT "FK_knowledge_items_embedding"
        FOREIGN KEY ("embedding_id")
        REFERENCES "knowledge_embeddings"("id")
        ON DELETE SET NULL
      `);
    }

    // Create index on embedding_id for optimized query performance
    // Naming convention: idx_tablename_columnname
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_knowledgeitem_embedding_id"
      ON "knowledge_items" ("embedding_id")
      WHERE "embedding_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the index first
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_knowledgeitem_embedding_id"
    `);

    // Drop the foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "knowledge_items"
      DROP CONSTRAINT IF EXISTS "FK_knowledge_items_embedding"
    `);

    // Drop the column
    const table = await queryRunner.getTable('knowledge_items');

    if (table && table.columns.find((col) => col.name === 'embedding_id')) {
      await queryRunner.query(`
        ALTER TABLE "knowledge_items"
        DROP COLUMN "embedding_id"
      `);
    }
  }
}
