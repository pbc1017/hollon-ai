import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3.5: 계층적 조직 구조 + 지식 공유 시스템
 *
 * SSOT 핵심 원칙:
 * 1. 홀론 = 교체 가능한 워커 (개별 성장 아님)
 * 2. 스킬 = Role.capabilities (Hollon.skills 추가 안 함!)
 * 3. 지식 = 조직 레벨 (Document scope: 'organization')
 * 4. experienceLevel = 통계적 성과 지표 (할당 우선순위만)
 * 5. managerId = stored (성능 우선, 읽기 >> 쓰기)
 */
export class HierarchicalOrganization1734400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Experience Level Enum 생성
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "experience_level_enum" AS ENUM (
          'junior',
          'mid',
          'senior',
          'lead',
          'principal'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Team: 계층 구조 지원
    await queryRunner.query(`
      ALTER TABLE "teams"
        ADD COLUMN IF NOT EXISTS "parent_team_id" uuid,
        ADD COLUMN IF NOT EXISTS "leader_hollon_id" uuid;
    `);

    await queryRunner.query(`
      ALTER TABLE "teams"
        ADD CONSTRAINT "FK_teams_parent_team"
          FOREIGN KEY ("parent_team_id")
          REFERENCES "teams"("id")
          ON DELETE SET NULL,
        ADD CONSTRAINT "FK_teams_leader_hollon"
          FOREIGN KEY ("leader_hollon_id")
          REFERENCES "hollons"("id")
          ON DELETE SET NULL;
    `);

    // 3. Hollon: 계층 구조 + 경험 레벨 (SSOT 준수 - skills 없음!)
    await queryRunner.query(`
      ALTER TABLE "hollons"
        ADD COLUMN IF NOT EXISTS "manager_id" uuid,
        ADD COLUMN IF NOT EXISTS "experience_level" experience_level_enum DEFAULT 'mid';
    `);

    await queryRunner.query(`
      ALTER TABLE "hollons"
        ADD CONSTRAINT "FK_hollons_manager"
          FOREIGN KEY ("manager_id")
          REFERENCES "hollons"("id")
          ON DELETE SET NULL;
    `);

    // 4. Project: 팀 할당
    await queryRunner.query(`
      ALTER TABLE "projects"
        ADD COLUMN IF NOT EXISTS "assigned_team_id" uuid;
    `);

    await queryRunner.query(`
      ALTER TABLE "projects"
        ADD CONSTRAINT "FK_projects_assigned_team"
          FOREIGN KEY ("assigned_team_id")
          REFERENCES "teams"("id")
          ON DELETE SET NULL;
    `);

    // 5. Task: 필요 스킬 + 인간 승인 플래그
    await queryRunner.query(`
      ALTER TABLE "tasks"
        ADD COLUMN IF NOT EXISTS "required_skills" text[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "needs_human_approval" boolean DEFAULT false;
    `);

    // 6. Indexes for performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_teams_parent_team_id"
        ON "teams"("parent_team_id");

      CREATE INDEX IF NOT EXISTS "idx_teams_leader_hollon_id"
        ON "teams"("leader_hollon_id");

      CREATE INDEX IF NOT EXISTS "idx_hollons_manager_id"
        ON "hollons"("manager_id");

      CREATE INDEX IF NOT EXISTS "idx_hollons_experience_level"
        ON "hollons"("experience_level");

      CREATE INDEX IF NOT EXISTS "idx_projects_assigned_team_id"
        ON "projects"("assigned_team_id");

      CREATE INDEX IF NOT EXISTS "idx_tasks_required_skills"
        ON "tasks" USING GIN("required_skills");

      CREATE INDEX IF NOT EXISTS "idx_tasks_needs_human_approval"
        ON "tasks"("needs_human_approval")
        WHERE "needs_human_approval" = true;
    `);

    // 7. Comments for clarity
    await queryRunner.query(`
      COMMENT ON COLUMN "hollons"."manager_id" IS
        'Denormalized manager reference - updated when team structure changes.
         Read performance >> Write consistency (에스컬레이션 시 빈번한 조회)';

      COMMENT ON COLUMN "hollons"."experience_level" IS
        'Statistical performance metric for allocation priority.
         NOT individual growth - just allocation score (SSOT 원칙).
         Values: junior, mid, senior, lead, principal';

      COMMENT ON COLUMN "tasks"."required_skills" IS
        'Required skills from Role.capabilities for task assignment.
         Used by ResourcePlanner for skill-based matching.';

      COMMENT ON COLUMN "tasks"."needs_human_approval" IS
        'Flag for Level 5 escalation - human intervention required.
         Phase 3.5: API approval, Phase 5: UI approval.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_tasks_needs_human_approval";
      DROP INDEX IF EXISTS "idx_tasks_required_skills";
      DROP INDEX IF EXISTS "idx_projects_assigned_team_id";
      DROP INDEX IF EXISTS "idx_hollons_experience_level";
      DROP INDEX IF EXISTS "idx_hollons_manager_id";
      DROP INDEX IF EXISTS "idx_teams_leader_hollon_id";
      DROP INDEX IF EXISTS "idx_teams_parent_team_id";
    `);

    // Drop foreign keys
    await queryRunner.query(`
      ALTER TABLE "projects"
        DROP CONSTRAINT IF EXISTS "FK_projects_assigned_team";

      ALTER TABLE "hollons"
        DROP CONSTRAINT IF EXISTS "FK_hollons_manager";

      ALTER TABLE "teams"
        DROP CONSTRAINT IF EXISTS "FK_teams_leader_hollon",
        DROP CONSTRAINT IF EXISTS "FK_teams_parent_team";
    `);

    // Drop columns
    await queryRunner.query(`
      ALTER TABLE "tasks"
        DROP COLUMN IF EXISTS "needs_human_approval",
        DROP COLUMN IF EXISTS "required_skills";

      ALTER TABLE "projects"
        DROP COLUMN IF EXISTS "assigned_team_id";

      ALTER TABLE "hollons"
        DROP COLUMN IF EXISTS "experience_level",
        DROP COLUMN IF EXISTS "manager_id";

      ALTER TABLE "teams"
        DROP COLUMN IF EXISTS "leader_hollon_id",
        DROP COLUMN IF EXISTS "parent_team_id";
    `);

    // Drop enum
    await queryRunner.query(`
      DROP TYPE IF EXISTS "experience_level_enum";
    `);
  }
}
