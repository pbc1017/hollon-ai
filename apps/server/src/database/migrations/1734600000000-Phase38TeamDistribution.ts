import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3.8: Team-based Hierarchical Task Distribution
 *
 * Adds:
 * 1. teams.manager_hollon_id - Manager who distributes team tasks
 * 2. tasks.assigned_team_id - Team-level task assignment (Level 0)
 * 3. tasks.type enum extension - TEAM_EPIC type
 * 4. tasks.depth - Task hierarchy depth (0 = Team, 1+ = Hollon)
 */
export class Phase38TeamDistribution1734600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add manager_hollon_id to teams
    await queryRunner.query(`
      ALTER TABLE "teams"
        ADD COLUMN IF NOT EXISTS "manager_hollon_id" uuid;
    `);

    await queryRunner.query(`
      ALTER TABLE "teams"
        ADD CONSTRAINT "FK_teams_manager_hollon"
          FOREIGN KEY ("manager_hollon_id")
          REFERENCES "hollons"("id")
          ON DELETE SET NULL;
    `);

    // 2. Add assigned_team_id to tasks
    await queryRunner.query(`
      ALTER TABLE "tasks"
        ADD COLUMN IF NOT EXISTS "assigned_team_id" uuid,
        ADD COLUMN IF NOT EXISTS "depth" integer DEFAULT 0;
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
        ADD CONSTRAINT "FK_tasks_assigned_team"
          FOREIGN KEY ("assigned_team_id")
          REFERENCES "teams"("id")
          ON DELETE SET NULL;
    `);

    // 3. Extend task_type enum with TEAM_EPIC
    await queryRunner.query(`
      ALTER TYPE "task_type_enum" ADD VALUE IF NOT EXISTS 'team_epic';
    `);

    // 4. Add check constraint: assignedTeamId XOR assignedHollonId
    await queryRunner.query(`
      ALTER TABLE "tasks"
        ADD CONSTRAINT "CHK_tasks_assignment_xor"
        CHECK (
          (assigned_team_id IS NOT NULL AND assigned_hollon_id IS NULL)
          OR
          (assigned_team_id IS NULL AND assigned_hollon_id IS NOT NULL)
          OR
          (assigned_team_id IS NULL AND assigned_hollon_id IS NULL)
        );
    `);

    // 5. Indexes for performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_teams_manager_hollon_id"
        ON "teams"("manager_hollon_id");

      CREATE INDEX IF NOT EXISTS "idx_tasks_assigned_team_id"
        ON "tasks"("assigned_team_id");

      CREATE INDEX IF NOT EXISTS "idx_tasks_depth"
        ON "tasks"("depth");
    `);

    // 6. Comments for clarity
    await queryRunner.query(`
      COMMENT ON COLUMN "teams"."manager_hollon_id" IS
        'Manager hollon who distributes team tasks to team members using Brain Provider.
         Phase 3.8: Hierarchical task distribution (Level 0 → Level 1).';

      COMMENT ON COLUMN "tasks"."assigned_team_id" IS
        'Team-level task assignment (Level 0, TEAM_EPIC type).
         XOR with assigned_hollon_id - task assigned to team OR hollon, not both.';

      COMMENT ON COLUMN "tasks"."depth" IS
        'Task hierarchy depth: 0 = Team Task (TEAM_EPIC), 1+ = Hollon Task.
         Phase 3.8: Manager distributes Level 0 → Level 1.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_tasks_depth";
      DROP INDEX IF EXISTS "idx_tasks_assigned_team_id";
      DROP INDEX IF EXISTS "idx_teams_manager_hollon_id";
    `);

    // Drop check constraint
    await queryRunner.query(`
      ALTER TABLE "tasks"
        DROP CONSTRAINT IF EXISTS "CHK_tasks_assignment_xor";
    `);

    // Drop foreign keys
    await queryRunner.query(`
      ALTER TABLE "tasks"
        DROP CONSTRAINT IF EXISTS "FK_tasks_assigned_team";

      ALTER TABLE "teams"
        DROP CONSTRAINT IF EXISTS "FK_teams_manager_hollon";
    `);

    // Drop columns
    await queryRunner.query(`
      ALTER TABLE "tasks"
        DROP COLUMN IF EXISTS "depth",
        DROP COLUMN IF EXISTS "assigned_team_id";

      ALTER TABLE "teams"
        DROP COLUMN IF EXISTS "manager_hollon_id";
    `);

    // Note: Cannot remove enum value from PostgreSQL enum type
    // TEAM_EPIC will remain in task_type_enum after rollback
  }
}
