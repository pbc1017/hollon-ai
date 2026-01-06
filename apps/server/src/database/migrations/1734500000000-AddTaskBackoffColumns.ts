import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskBackoffColumns1734500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add backoff columns to tasks table
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN "consecutive_failures" integer NOT NULL DEFAULT 0,
      ADD COLUMN "last_failed_at" timestamp,
      ADD COLUMN "blocked_until" timestamp;
    `);

    // Create index on blocked_until for efficient queries
    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_blocked_until"
      ON "tasks" ("blocked_until")
      WHERE "blocked_until" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_blocked_until"`);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "blocked_until",
      DROP COLUMN IF EXISTS "last_failed_at",
      DROP COLUMN IF EXISTS "consecutive_failures";
    `);
  }
}
