import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add CHECK constraints for enum validation
 *
 * Implements CHECK constraints on enum-like columns to enforce valid values
 * at the database level, improving data quality and preventing invalid data.
 *
 * Tables affected:
 * - knowledge_item_relations: Adds CHECK constraint on relation_type
 * - knowledge_item_metadata: Adds CHECK constraint on metadata_type
 *
 * Valid relation_type values:
 * - parent_child: Parent-child hierarchical relationship
 * - related: General related/associated relationship
 * - depends_on: Dependency relationship (A depends on B)
 * - references: Reference relationship (A references B)
 * - similar: Similarity relationship
 * - contradicts: Contradictory relationship
 *
 * Valid metadata_type values:
 * - author: Author information
 * - source: Source/origin information
 * - domain: Domain/category classification
 * - category: Category classification
 * - tags: Tag/label metadata
 * - version: Version information
 * - status: Status information
 * - custom: Custom metadata type
 */
export class AddEnumCheckConstraints1766500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add CHECK constraint for relation_type in knowledge_item_relations table
    // Constraint name follows convention: CHK_tablename_columnname
    await queryRunner.query(`
      ALTER TABLE "knowledge_item_relations"
      ADD CONSTRAINT "CHK_knowledge_item_relations_relation_type"
      CHECK (
        "relation_type" IN (
          'parent_child',
          'related',
          'depends_on',
          'references',
          'similar',
          'contradicts'
        )
      )
    `);

    // Add CHECK constraint for metadata_type in knowledge_item_metadata table
    // Constraint name follows convention: CHK_tablename_columnname
    await queryRunner.query(`
      ALTER TABLE "knowledge_item_metadata"
      ADD CONSTRAINT "CHK_knowledge_item_metadata_metadata_type"
      CHECK (
        "metadata_type" IN (
          'author',
          'source',
          'domain',
          'category',
          'tags',
          'version',
          'status',
          'custom'
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop CHECK constraint for metadata_type
    await queryRunner.query(`
      ALTER TABLE "knowledge_item_metadata"
      DROP CONSTRAINT IF EXISTS "CHK_knowledge_item_metadata_metadata_type"
    `);

    // Drop CHECK constraint for relation_type
    await queryRunner.query(`
      ALTER TABLE "knowledge_item_relations"
      DROP CONSTRAINT IF EXISTS "CHK_knowledge_item_relations_relation_type"
    `);
  }
}
