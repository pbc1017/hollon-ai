import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add Composite Index on (parent_id, relation_type) for KnowledgeItemRelation table
 *
 * Adds a composite (multi-column) index on (parent_id, relation_type) in the
 * knowledge_item_relations table to optimize filtered relationship queries for
 * parent-child traversal with type filtering.
 *
 * This index supports queries like:
 * - SELECT * FROM knowledge_item_relations WHERE parent_id = ? AND relation_type = ?
 * - SELECT * FROM knowledge_item_relations WHERE parent_id = ? ORDER BY relation_type
 * - Hierarchical tree traversal with type-specific filtering
 *
 * Index naming convention: idx_tablename_col1_col2 (lowercase)
 * This follows the existing constraint naming pattern in the codebase.
 *
 * Note: This migration is ordered after single-column foreign key indexes (1766540000000)
 * and composite index on (knowledge_item_id, relation_type) to ensure proper migration ordering.
 * Composite indexes work best when the first column in the index matches query patterns
 * for hierarchical parent-child traversal with type-specific constraints.
 */
export class AddCompositeIndexKnowledgeItemRelationParentId1766550000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create composite index on (parent_id, relation_type)
    // This optimizes queries filtering by parent and relation type,
    // essential for hierarchical traversal with type-specific constraints
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_knowledge_item_relations_parent_id_relation_type"
      ON "knowledge_item_relations" ("parent_id", "relation_type");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the composite index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_knowledge_item_relations_parent_id_relation_type";
    `);
  }
}
