import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCycles1733600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create cycle_status enum
    await queryRunner.query(`
      CREATE TYPE "cycle_status_enum" AS ENUM (
        'upcoming',
        'active',
        'completed'
      );
    `);

    // Create cycles table
    await queryRunner.query(`
      CREATE TABLE "cycles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "name" varchar(255),
        "number" integer NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "goal" text,
        "budget_cents" integer,
        "actual_cost_cents" integer DEFAULT 0,
        "status" cycle_status_enum NOT NULL DEFAULT 'upcoming',
        "completed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_cycles_project"
          FOREIGN KEY ("project_id")
          REFERENCES "projects"("id")
          ON DELETE CASCADE,
        CONSTRAINT "UQ_cycles_project_number"
          UNIQUE ("project_id", "number")
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_cycles_project" ON "cycles" ("project_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_cycles_status" ON "cycles" ("status");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_cycles_project_status" ON "cycles" ("project_id", "status");
    `);

    // Add cycle_id to tasks table
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN "cycle_id" uuid;
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD CONSTRAINT "FK_tasks_cycle"
      FOREIGN KEY ("cycle_id")
      REFERENCES "cycles"("id")
      ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_cycle" ON "tasks" ("cycle_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove cycle_id from tasks
    await queryRunner.query(`DROP INDEX "IDX_tasks_cycle";`);
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_cycle";`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "cycle_id";`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_cycles_project_status";`);
    await queryRunner.query(`DROP INDEX "IDX_cycles_status";`);
    await queryRunner.query(`DROP INDEX "IDX_cycles_project";`);

    // Drop table
    await queryRunner.query(`DROP TABLE "cycles";`);

    // Drop enum
    await queryRunner.query(`DROP TYPE "cycle_status_enum";`);
  }
}
