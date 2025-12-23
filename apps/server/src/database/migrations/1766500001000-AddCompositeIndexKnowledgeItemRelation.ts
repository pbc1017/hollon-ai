import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add Composite Index on KnowledgeItemRelation table
 *
 * Adds a composite (multi-column) index on (knowledge_item_id, relation_type)
 * in the knowledge_item_relations table to optimize filtered relationship
 * queries where both columns are used in WHERE clauses.
 *
 * This index supports queries like:
 * - SELECT * FROM knowledge_item_relations WHERE knowledge_item_id = ? AND relation_type = ?
 * - SELECT * FROM knowledge_item_relations WHERE knowledge_item_id = ? ORDER BY relation_type
 *
 * Index naming convention: idx_tablename_col1_col2_col3 (lowercase)
 * This follows the existing constraint naming pattern in the codebase.
 */
export class AddCompositeIndexKnowledgeItemRelation1766500001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create composite index on (knowledge_item_id, relation_type)
    // This optimizes queries filtering by knowledge item and relation type
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_knowledge_item_relations_knowledge_item_id_relation_type"
      ON "knowledge_item_relations" ("knowledge_item_id", "relation_type");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the composite index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_knowledge_item_relations_knowledge_item_id_relation_type";
    `);
  }
}
