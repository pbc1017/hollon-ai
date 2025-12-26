import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Phase 3.8: Hierarchical Task Distribution
 *
 * Adds support for team-based task assignment and hierarchical task delegation:
 * - Task.assignedTeamId: Allows tasks to be assigned to entire teams
 * - Team.managerHollonId: Designates a manager hollon for each team
 * - Task depth tracking for hierarchical structure
 *
 * Hierarchy:
 * Level 0 (depth=0): Team Tasks (assigned to Team)
 * Level 1 (depth=1): Hollon Tasks (assigned to individual Hollon)
 * Level 2 (depth=2): Sub-Hollon Tasks (assigned to temporary Sub-Hollon)
 */
export class AddHierarchicalTaskDistribution1765339799897 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add assignedTeamId to tasks table
    await queryRunner.addColumn(
      'tasks',
      new TableColumn({
        name: 'assigned_team_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // 2. Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE tasks
      ADD CONSTRAINT fk_tasks_assigned_team
      FOREIGN KEY (assigned_team_id)
      REFERENCES teams(id)
      ON DELETE SET NULL
    `);

    // 3. Add index for team-based queries
    await queryRunner.query(`
      CREATE INDEX idx_tasks_assigned_team_id
      ON tasks(assigned_team_id)
      WHERE assigned_team_id IS NOT NULL
    `);

    // 4. Add check constraint: assignedTeamId and assignedHollonId are mutually exclusive
    await queryRunner.query(`
      ALTER TABLE tasks
      ADD CONSTRAINT chk_tasks_assignment_exclusive
      CHECK (
        (assigned_team_id IS NOT NULL AND assigned_hollon_id IS NULL) OR
        (assigned_team_id IS NULL AND assigned_hollon_id IS NOT NULL) OR
        (assigned_team_id IS NULL AND assigned_hollon_id IS NULL)
      )
    `);

    // 5. Add managerHollonId to teams table
    await queryRunner.addColumn(
      'teams',
      new TableColumn({
        name: 'manager_hollon_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // 6. Add foreign key constraint for manager
    await queryRunner.query(`
      ALTER TABLE teams
      ADD CONSTRAINT fk_teams_manager_hollon
      FOREIGN KEY (manager_hollon_id)
      REFERENCES hollons(id)
      ON DELETE SET NULL
    `);

    // 7. Add index for manager queries
    await queryRunner.query(`
      CREATE INDEX idx_teams_manager_hollon_id
      ON teams(manager_hollon_id)
      WHERE manager_hollon_id IS NOT NULL
    `);

    // 8. Update TaskType enum to include TEAM_EPIC
    // Note: This assumes the enum already exists and we're adding a new value
    await queryRunner.query(`
      ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'team_epic'
    `);

    // 9. Add comment for documentation
    await queryRunner.query(`
      COMMENT ON COLUMN tasks.assigned_team_id IS
      'Team-level task assignment (Level 0). Mutually exclusive with assigned_hollon_id.'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN teams.manager_hollon_id IS
      'Manager hollon responsible for distributing team tasks to team members.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove constraints and columns in reverse order

    // 1. Remove comments
    await queryRunner.query(`
      COMMENT ON COLUMN tasks.assigned_team_id IS NULL
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN teams.manager_hollon_id IS NULL
    `);

    // 2. Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_teams_manager_hollon_id
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_tasks_assigned_team_id
    `);

    // 3. Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE teams
      DROP CONSTRAINT IF EXISTS fk_teams_manager_hollon
    `);
    await queryRunner.query(`
      ALTER TABLE tasks
      DROP CONSTRAINT IF EXISTS fk_tasks_assigned_team
    `);

    // 4. Drop check constraint
    await queryRunner.query(`
      ALTER TABLE tasks
      DROP CONSTRAINT IF EXISTS chk_tasks_assignment_exclusive
    `);

    // 5. Drop columns
    await queryRunner.dropColumn('teams', 'manager_hollon_id');
    await queryRunner.dropColumn('tasks', 'assigned_team_id');

    // Note: Cannot remove enum value in PostgreSQL, so TEAM_EPIC will remain
    // This is a PostgreSQL limitation and is acceptable for down migrations
  }
}
