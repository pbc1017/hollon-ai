import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add new relationship types to edge_type enum
 *
 * Extends the edge_type enum with semantic relationship types:
 * - refutes: Indicates negation or refutation
 * - similar_to: Indicates similarity or equivalence
 * - explains: Indicates clarification or explanation
 * - exemplifies: Indicates practical demonstration
 * - prerequisite_of: Indicates prerequisite dependency
 * - extends: Indicates extension or enhancement
 * - supports: Indicates evidence or reinforcement
 * - contradicts: Indicates logical contradiction
 * - relates_to: General association (renamed from related_to for consistency)
 */
export class AddRelationshipTypes1736246723000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new relationship type values to the edge_type enum
    // Note: PostgreSQL requires ALTER TYPE for adding enum values
    await queryRunner.query(`
      ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'refutes'
    `);

    await queryRunner.query(`
      ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'similar_to'
    `);

    await queryRunner.query(`
      ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'explains'
    `);

    await queryRunner.query(`
      ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'exemplifies'
    `);

    await queryRunner.query(`
      ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'prerequisite_of'
    `);

    await queryRunner.query(`
      ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'extends'
    `);

    await queryRunner.query(`
      ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'supports'
    `);

    await queryRunner.query(`
      ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'contradicts'
    `);

    await queryRunner.query(`
      ALTER TYPE edge_type ADD VALUE IF NOT EXISTS 'relates_to'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support removing enum values directly
    // To rollback, we would need to:
    // 1. Create a new enum without the new values
    // 2. Alter the column to use the new enum
    // 3. Drop the old enum
    // This is complex and risky, so we'll leave the enum values in place
    // They won't cause issues if not used

    // For a complete rollback, uncomment and modify as needed:
    // await queryRunner.query(`
    //   CREATE TYPE edge_type_new AS ENUM (
    //     'created_by',
    //     'belongs_to',
    //     'manages',
    //     'collaborates_with',
    //     'depends_on',
    //     'references',
    //     'implements',
    //     'derives_from',
    //     'related_to',
    //     'child_of',
    //     'part_of',
    //     'custom'
    //   )
    // `);
    //
    // await queryRunner.query(`
    //   ALTER TABLE knowledge_graph_edges
    //   ALTER COLUMN type TYPE edge_type_new
    //   USING type::text::edge_type_new
    // `);
    //
    // await queryRunner.query(`DROP TYPE edge_type`);
    // await queryRunner.query(`ALTER TYPE edge_type_new RENAME TO edge_type`);

    console.warn(
      'Migration rollback: New enum values will remain in the database.',
    );
  }
}
