import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3.7: Dynamic Sub-Hollon Delegation
 *
 * Adds:
 * 1. roles.available_for_temporary_hollon - Flag to indicate if role can be used for temporary hollons
 *
 * This enables Brain Provider to dynamically select appropriate roles when
 * decomposing complex tasks into Sub-Hollons.
 */
export class AddAvailableForTemporaryHollonToRole1734700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add available_for_temporary_hollon column to roles
    await queryRunner.query(`
      ALTER TABLE "roles"
        ADD COLUMN IF NOT EXISTS "available_for_temporary_hollon" boolean DEFAULT false;
    `);

    // 2. Seed: Set default temporary-capable roles
    //    These are the standard roles for task decomposition
    await queryRunner.query(`
      UPDATE "roles"
      SET "available_for_temporary_hollon" = true
      WHERE name IN ('Planner', 'Analyzer', 'Coder');
    `);

    // 3. Create index for performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_roles_temporary_available"
      ON "roles" ("organization_id", "available_for_temporary_hollon")
      WHERE "available_for_temporary_hollon" = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_roles_temporary_available";
    `);

    // Drop column
    await queryRunner.query(`
      ALTER TABLE "roles"
        DROP COLUMN IF EXISTS "available_for_temporary_hollon";
    `);
  }
}
