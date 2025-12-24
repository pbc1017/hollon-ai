import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3.7: Task Dependencies Join Table
 *
 * Creates the many-to-many join table for task dependencies.
 * This enables tasks to have multiple dependencies and be depended upon by multiple tasks.
 */
export class CreateTaskDependenciesJoinTable1734700100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create task_dependencies join table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_dependencies" (
        "task_id" uuid NOT NULL,
        "depends_on_id" uuid NOT NULL,
        CONSTRAINT "PK_task_dependencies" PRIMARY KEY ("task_id", "depends_on_id"),
        CONSTRAINT "FK_task_dependencies_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_task_dependencies_depends_on" FOREIGN KEY ("depends_on_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_dependencies_task_id"
      ON "task_dependencies" ("task_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_dependencies_depends_on_id"
      ON "task_dependencies" ("depends_on_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_task_dependencies_depends_on_id";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_task_dependencies_task_id";
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "task_dependencies";
    `);
  }
}
