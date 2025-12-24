import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReviewFieldsToTasks1734800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add new READY_FOR_REVIEW status to task_status_enum
    // Must be done outside transaction
    await queryRunner.commitTransaction();
    await queryRunner.query(`
      ALTER TYPE "task_status_enum"
      ADD VALUE IF NOT EXISTS 'ready_for_review';
    `);
    await queryRunner.startTransaction();

    // Step 2: Add review tracking columns to tasks table
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN "review_count" integer NOT NULL DEFAULT 0,
      ADD COLUMN "last_reviewed_at" timestamp;
    `);

    // Step 3: Create index on (status, review_count) for efficient Priority 0 queries
    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_review_status"
      ON "tasks" ("status", "review_count")
      WHERE "status" = 'ready_for_review';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_review_status"`);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "last_reviewed_at",
      DROP COLUMN IF EXISTS "review_count";
    `);

    // Note: Cannot remove enum value in PostgreSQL easily
    // The READY_FOR_REVIEW status will remain in the enum
  }
}
