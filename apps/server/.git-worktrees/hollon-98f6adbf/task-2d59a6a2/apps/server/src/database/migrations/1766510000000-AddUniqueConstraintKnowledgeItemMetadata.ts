import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add UNIQUE constraint on KnowledgeItemMetadata natural key
 *
 * Ensures that each knowledge item can have only one metadata entry per (metadata_type, metadata_key) combination.
 * This constraint enforces the natural key of the KnowledgeItemMetadata table:
 * - One metadata entry per knowledge item per metadata type and key
 * - Prevents duplicate metadata entries for the same knowledge item and key combination
 *
 * Constraint name convention: UQ_table_name_col1_col2_col3
 *
 * Natural key columns (in order of cardinality):
 * 1. knowledge_item_id - lower cardinality (references a document)
 * 2. metadata_type - moderate cardinality (e.g., 'author', 'source', 'domain', etc.)
 * 3. metadata_key - higher cardinality (custom metadata key)
 *
 * Business logic:
 * - Multiple metadata entries for the same knowledge item are allowed
 * - But only one entry per (metadata_type, metadata_key) combination is allowed
 * - Example: Knowledge item can have multiple 'domain' type entries with different keys
 *   but only one entry for ('domain', 'primary_subject')
 */
export class AddUniqueConstraintKnowledgeItemMetadata1766510000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, verify that no duplicate (knowledge_item_id, metadata_type, metadata_key) combinations exist
    // This check ensures the constraint can be applied without failure
    const duplicates = await queryRunner.query(`
      SELECT
        "knowledge_item_id",
        "metadata_type",
        "metadata_key",
        COUNT(*) as count
      FROM "knowledge_item_metadata"
      GROUP BY "knowledge_item_id", "metadata_type", "metadata_key"
      HAVING COUNT(*) > 1
    `);

    if (duplicates.length > 0) {
      throw new Error(
        `Cannot apply UNIQUE constraint: Found ${duplicates.length} duplicate (knowledge_item_id, metadata_type, metadata_key) combinations in knowledge_item_metadata table. ` +
          `Duplicates: ${JSON.stringify(duplicates)}. ` +
          `Please resolve these duplicates before applying this migration.`,
      );
    }

    // Add UNIQUE constraint on the natural key columns
    // Constraint name follows convention: UQ_tablename_col1_col2_col3
    await queryRunner.query(`
      ALTER TABLE "knowledge_item_metadata"
      ADD CONSTRAINT "UQ_knowledge_item_metadata_knowledge_item_id_metadata_type_metadata_key"
      UNIQUE ("knowledge_item_id", "metadata_type", "metadata_key")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the UNIQUE constraint
    await queryRunner.query(`
      ALTER TABLE "knowledge_item_metadata"
      DROP CONSTRAINT IF EXISTS "UQ_knowledge_item_metadata_knowledge_item_id_metadata_type_metadata_key"
    `);
  }
}
