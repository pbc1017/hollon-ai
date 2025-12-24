import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskWorkingDirectory1734900000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add workingDirectory column to tasks table
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN "working_directory" text NULL;
    `);

    // Add comment explaining the column
    await queryRunner.query(`
      COMMENT ON COLUMN "tasks"."working_directory" IS
      'Phase 3.12: Worktree path for this task. Set during execution, cleared after completion/cleanup.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove workingDirectory column
    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN "working_directory";
    `);
  }
}
