import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add indexes on foreign key columns for KnowledgeItemRelation and KnowledgeItemMetadata
 *
 * Creates indexes on foreign key columns in both knowledge_item_relations and knowledge_item_metadata tables
 * to optimize JOIN operations and filtered queries on these columns.
 *
 * These indexes support efficient queries such as:
 * - SELECT * FROM knowledge_item_relations WHERE knowledge_item_id = ?
 * - SELECT * FROM knowledge_item_relations WHERE parent_id = ?
 * - SELECT * FROM knowledge_item_metadata WHERE knowledge_item_id = ?
 * - JOIN operations between tables and knowledge_items tables
 * - Filtering and sorting operations on foreign key columns
 *
 * Indexes created:
 * 1. idx_knowledge_item_relations_knowledge_item_id
 *    - Optimizes queries on knowledge_item_id foreign key in KnowledgeItemRelation
 *    - Supports lookups of all relations for a specific knowledge item
 *
 * 2. idx_knowledge_item_relations_parent_id
 *    - Optimizes queries on parent_id foreign key in KnowledgeItemRelation
 *    - Supports hierarchical traversal and parent-child lookups
 *
 * 3. idx_knowledge_item_metadata_knowledge_item_id
 *    - Optimizes queries on knowledge_item_id foreign key in KnowledgeItemMetadata
 *    - Supports lookups of all metadata entries for a specific knowledge item
 *
 * Index naming convention: idx_tablename_columnname (lowercase)
 * This follows the existing constraint naming pattern in the codebase.
 */
export class AddKnowledgeSystemIndexes1766540000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create index on knowledge_item_id foreign key in knowledge_item_relations
    // Optimizes queries filtering by knowledge_item_id
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_knowledge_item_relations_knowledge_item_id"
      ON "knowledge_item_relations" ("knowledge_item_id")
    `);

    // Create index on parent_id foreign key in knowledge_item_relations
    // Optimizes queries filtering by parent_id for hierarchical relationships
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_knowledge_item_relations_parent_id"
      ON "knowledge_item_relations" ("parent_id")
    `);

    // Create index on knowledge_item_id foreign key in knowledge_item_metadata
    // Optimizes queries filtering by knowledge_item_id to retrieve metadata entries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_knowledge_item_metadata_knowledge_item_id"
      ON "knowledge_item_metadata" ("knowledge_item_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop knowledge_item_metadata index first
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_knowledge_item_metadata_knowledge_item_id"
    `);

    // Drop parent_id index in knowledge_item_relations
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_knowledge_item_relations_parent_id"
    `);

    // Drop knowledge_item_id index in knowledge_item_relations
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_knowledge_item_relations_knowledge_item_id"
    `);
  }
}
