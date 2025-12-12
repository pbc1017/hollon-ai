import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskMetadataColumn1734600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add metadata column to tasks table for Phase 4 CI/CD tracking
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN "metadata" jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove metadata column
    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "metadata";
    `);
  }
}
