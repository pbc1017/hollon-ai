import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoryPointsColumn1734100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add story_points column to tasks table
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "story_points" integer DEFAULT 0;
    `);

    // Add blocked_reason column to tasks table
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "blocked_reason" text;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "story_points";
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "blocked_reason";
    `);
  }
}
