import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to sync entity definitions with database schema
 * Adds missing columns that exist in entities but not in migrations
 */
export class SyncEntitySchemas1734300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add tags column to documents table
    await queryRunner.query(`
      ALTER TABLE "documents"
      ADD COLUMN IF NOT EXISTS "tags" text[] NULL;
    `);

    // Update documents type enum to match entity
    // Using IF NOT EXISTS pattern that works with schema-local enums
    await queryRunner.query(`
      ALTER TYPE "document_type_enum" ADD VALUE IF NOT EXISTS 'task_context';
    `);
    await queryRunner.query(`
      ALTER TYPE "document_type_enum" ADD VALUE IF NOT EXISTS 'decision_log';
    `);
    await queryRunner.query(`
      ALTER TYPE "document_type_enum" ADD VALUE IF NOT EXISTS 'knowledge';
    `);
    await queryRunner.query(`
      ALTER TYPE "document_type_enum" ADD VALUE IF NOT EXISTS 'discussion';
    `);
    await queryRunner.query(`
      ALTER TYPE "document_type_enum" ADD VALUE IF NOT EXISTS 'code_review';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "documents"
      DROP COLUMN IF EXISTS "tags";
    `);
    // Note: Cannot easily remove enum values in PostgreSQL
  }
}
