import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3.16: Hierarchical Review with Temporary Review Hollon
 *
 * Adds reviewer_hollon_id to tasks table to support:
 * - Manager hollon creates temporary review hollon
 * - Review hollon performs code review
 * - Manager hollon receives review result and decides next action
 *
 * Key distinction:
 * - assigned_hollon_id: Who executes the task (Worker)
 * - reviewer_hollon_id: Who reviews the task (Reviewer, created by Manager)
 */
export class AddReviewerHollonIdToTasks1734900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add reviewer_hollon_id column
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN "reviewer_hollon_id" uuid,
      ADD CONSTRAINT "FK_tasks_reviewer_hollon"
        FOREIGN KEY ("reviewer_hollon_id")
        REFERENCES "hollons"("id")
        ON DELETE SET NULL;
    `);

    // Create index for efficient reviewer queries
    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_reviewer_hollon_status"
      ON "tasks" ("reviewer_hollon_id", "status")
      WHERE "reviewer_hollon_id" IS NOT NULL;
    `);

    // For hierarchical review flow:
    // When subtask is created, set reviewer_hollon_id = parent task's assigned_hollon_id
    await queryRunner.query(`
      UPDATE "tasks" subtask
      SET "reviewer_hollon_id" = parent."assigned_hollon_id"
      FROM "tasks" parent
      WHERE subtask."parent_task_id" = parent."id"
        AND subtask."reviewer_hollon_id" IS NULL
        AND parent."assigned_hollon_id" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tasks_reviewer_hollon_status"`,
    );

    // Drop foreign key and column
    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP CONSTRAINT IF EXISTS "FK_tasks_reviewer_hollon",
      DROP COLUMN IF EXISTS "reviewer_hollon_id";
    `);
  }
}
