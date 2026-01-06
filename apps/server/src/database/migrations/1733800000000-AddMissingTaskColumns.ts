import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingTaskColumns1733800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create task_type_enum
    await queryRunner.query(`
      CREATE TYPE "task_type_enum" AS ENUM (
        'implementation',
        'review',
        'research',
        'bug_fix',
        'documentation',
        'discussion'
      );
    `);

    // Add missing columns to tasks table
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN "type" task_type_enum NOT NULL DEFAULT 'implementation',
      ADD COLUMN "acceptance_criteria" jsonb,
      ADD COLUMN "tags" jsonb,
      ADD COLUMN "error_message" text,
      ADD COLUMN "due_date" timestamp;
    `);

    // Update estimated_complexity to varchar
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ALTER COLUMN "estimated_complexity" TYPE varchar(20),
      ALTER COLUMN "estimated_complexity" DROP DEFAULT;
    `);

    // Update existing task_status_enum values to match entity
    await queryRunner.query(`
      ALTER TYPE "task_status_enum" RENAME TO "task_status_enum_old";
    `);

    await queryRunner.query(`
      CREATE TYPE "task_status_enum" AS ENUM (
        'pending',
        'ready',
        'in_progress',
        'in_review',
        'blocked',
        'completed',
        'failed',
        'cancelled'
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ALTER COLUMN "status" DROP DEFAULT,
      ALTER COLUMN "status" TYPE "task_status_enum" USING (
        CASE
          WHEN "status"::text = 'todo' THEN 'pending'::task_status_enum
          WHEN "status"::text = 'in_progress' THEN 'in_progress'::task_status_enum
          WHEN "status"::text = 'review' THEN 'in_review'::task_status_enum
          WHEN "status"::text = 'blocked' THEN 'blocked'::task_status_enum
          WHEN "status"::text = 'done' THEN 'completed'::task_status_enum
          WHEN "status"::text = 'cancelled' THEN 'cancelled'::task_status_enum
          ELSE 'pending'::task_status_enum
        END
      ),
      ALTER COLUMN "status" SET DEFAULT 'pending';
    `);

    await queryRunner.query(`DROP TYPE "task_status_enum_old"`);

    // Update task_priority_enum values to match entity
    await queryRunner.query(`
      ALTER TYPE "task_priority_enum" RENAME TO "task_priority_enum_old";
    `);

    await queryRunner.query(`
      CREATE TYPE "task_priority_enum" AS ENUM ('P1', 'P2', 'P3', 'P4');
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ALTER COLUMN "priority" DROP DEFAULT,
      ALTER COLUMN "priority" TYPE "task_priority_enum" USING (
        CASE
          WHEN "priority"::text = 'urgent' THEN 'P1'::task_priority_enum
          WHEN "priority"::text = 'high' THEN 'P2'::task_priority_enum
          WHEN "priority"::text = 'medium' THEN 'P3'::task_priority_enum
          WHEN "priority"::text = 'low' THEN 'P4'::task_priority_enum
          ELSE 'P3'::task_priority_enum
        END
      ),
      ALTER COLUMN "priority" SET DEFAULT 'P3';
    `);

    await queryRunner.query(`DROP TYPE "task_priority_enum_old"`);

    // Create index on status and priority
    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_status_priority"
      ON "tasks" ("status", "priority");
    `);

    // Create index on assigned_hollon_id and status
    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_assigned_hollon_status"
      ON "tasks" ("assigned_hollon_id", "status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tasks_assigned_hollon_status"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_status_priority"`);

    // Revert priority enum
    await queryRunner.query(`
      ALTER TYPE "task_priority_enum" RENAME TO "task_priority_enum_old";
    `);

    await queryRunner.query(`
      CREATE TYPE "task_priority_enum" AS ENUM ('low', 'medium', 'high', 'urgent');
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ALTER COLUMN "priority" DROP DEFAULT,
      ALTER COLUMN "priority" TYPE "task_priority_enum" USING (
        CASE
          WHEN "priority"::text = 'P1' THEN 'urgent'::task_priority_enum
          WHEN "priority"::text = 'P2' THEN 'high'::task_priority_enum
          WHEN "priority"::text = 'P3' THEN 'medium'::task_priority_enum
          WHEN "priority"::text = 'P4' THEN 'low'::task_priority_enum
          ELSE 'medium'::task_priority_enum
        END
      ),
      ALTER COLUMN "priority" SET DEFAULT 'medium';
    `);

    await queryRunner.query(`DROP TYPE "task_priority_enum_old"`);

    // Revert status enum
    await queryRunner.query(`
      ALTER TYPE "task_status_enum" RENAME TO "task_status_enum_old";
    `);

    await queryRunner.query(`
      CREATE TYPE "task_status_enum" AS ENUM ('todo', 'in_progress', 'blocked', 'review', 'done', 'cancelled');
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ALTER COLUMN "status" DROP DEFAULT,
      ALTER COLUMN "status" TYPE "task_status_enum" USING (
        CASE
          WHEN "status"::text = 'pending' THEN 'todo'::task_status_enum
          WHEN "status"::text = 'ready' THEN 'todo'::task_status_enum
          WHEN "status"::text = 'in_progress' THEN 'in_progress'::task_status_enum
          WHEN "status"::text = 'in_review' THEN 'review'::task_status_enum
          WHEN "status"::text = 'blocked' THEN 'blocked'::task_status_enum
          WHEN "status"::text = 'completed' THEN 'done'::task_status_enum
          WHEN "status"::text = 'failed' THEN 'done'::task_status_enum
          WHEN "status"::text = 'cancelled' THEN 'cancelled'::task_status_enum
          ELSE 'todo'::task_status_enum
        END
      ),
      ALTER COLUMN "status" SET DEFAULT 'todo';
    `);

    await queryRunner.query(`DROP TYPE "task_status_enum_old"`);

    // Revert estimated_complexity to integer
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ALTER COLUMN "estimated_complexity" TYPE integer USING NULL,
      ALTER COLUMN "estimated_complexity" SET DEFAULT NULL;
    `);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "due_date",
      DROP COLUMN IF EXISTS "error_message",
      DROP COLUMN IF EXISTS "tags",
      DROP COLUMN IF EXISTS "acceptance_criteria",
      DROP COLUMN IF EXISTS "type";
    `);

    // Drop task_type_enum
    await queryRunner.query(`DROP TYPE IF EXISTS "task_type_enum"`);
  }
}
