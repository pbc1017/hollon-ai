import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlanningWorkflowFields1736300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add planning workflow fields to tasks table
    await queryRunner.query(`
      ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS needs_planning BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS planning_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS plan_document_path TEXT
    `);

    // Create index for efficient planning queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_needs_planning
      ON tasks(needs_planning, status)
      WHERE needs_planning = true
    `);

    // Create index for planning task relationship
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_planning_task_id
      ON tasks(planning_task_id)
      WHERE planning_task_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_tasks_planning_task_id
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_tasks_needs_planning
    `);

    await queryRunner.query(`
      ALTER TABLE tasks
      DROP COLUMN IF EXISTS plan_document_path,
      DROP COLUMN IF EXISTS planning_task_id,
      DROP COLUMN IF EXISTS needs_planning
    `);
  }
}
