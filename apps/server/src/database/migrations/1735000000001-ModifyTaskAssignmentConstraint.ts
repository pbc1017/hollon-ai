import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4: Modify task assignment XOR constraint to allow team_epic tasks
 * to have both assignedTeamId and assignedHollonId simultaneously.
 *
 * team_epic tasks must have assignedTeamId and can optionally have assignedHollonId.
 * Other task types maintain the original XOR constraint.
 */
export class ModifyTaskAssignmentConstraint1735000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing XOR constraint
    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP CONSTRAINT IF EXISTS "CHK_tasks_assignment_xor"
    `);

    // Add new constraint that allows team_epic to have both team and hollon
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD CONSTRAINT "CHK_tasks_assignment_xor" CHECK (
        -- team_epic must have team, can have hollon
        (type = 'team_epic' AND assigned_team_id IS NOT NULL) OR
        -- Other types: XOR between team and hollon
        (type != 'team_epic' AND (
          (assigned_team_id IS NOT NULL AND assigned_hollon_id IS NULL) OR
          (assigned_team_id IS NULL AND assigned_hollon_id IS NOT NULL) OR
          (assigned_team_id IS NULL AND assigned_hollon_id IS NULL)
        ))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to original XOR constraint
    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP CONSTRAINT IF EXISTS "CHK_tasks_assignment_xor"
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD CONSTRAINT "CHK_tasks_assignment_xor" CHECK (
        (assigned_team_id IS NOT NULL AND assigned_hollon_id IS NULL) OR
        (assigned_team_id IS NULL AND assigned_hollon_id IS NOT NULL) OR
        (assigned_team_id IS NULL AND assigned_hollon_id IS NULL)
      )
    `);
  }
}
