import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoalEntities1733800000000 implements MigrationInterface {
  name = 'AddGoalEntities1733800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // goals 테이블
    await queryRunner.query(`
      CREATE TABLE goals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
        parent_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,

        -- 목표 정보
        title VARCHAR(500) NOT NULL,
        description TEXT,

        -- OKR 타입
        goal_type VARCHAR(20) NOT NULL DEFAULT 'objective'
          CHECK (goal_type IN ('objective', 'key_result')),

        -- 상태
        status VARCHAR(20) NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled', 'archived')),

        -- 진행도
        progress_percent DECIMAL(5, 2) DEFAULT 0.0 CHECK (progress_percent >= 0 AND progress_percent <= 100),

        -- 기간
        start_date DATE,
        target_date DATE,
        completed_at TIMESTAMP WITH TIME ZONE,

        -- 우선순위
        priority VARCHAR(20) DEFAULT 'medium'
          CHECK (priority IN ('low', 'medium', 'high', 'critical')),

        -- 측정 기준 (Key Result용)
        metric_type VARCHAR(20)
          CHECK (metric_type IN ('binary', 'numeric', 'percentage', 'custom')),
        target_value DECIMAL(15, 4),
        current_value DECIMAL(15, 4) DEFAULT 0,
        unit VARCHAR(50),

        -- 성공 기준
        success_criteria JSONB DEFAULT '[]',

        -- 소유자
        owner_hollon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

        -- 자동 분해 관련
        auto_decomposed BOOLEAN DEFAULT false,
        decomposition_strategy VARCHAR(50),

        -- 자율 생성 관련 (Phase 5+)
        auto_generated BOOLEAN DEFAULT false,
        proposal_id UUID,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by_hollon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_goals_org ON goals(organization_id);
      CREATE INDEX idx_goals_team ON goals(team_id);
      CREATE INDEX idx_goals_parent ON goals(parent_goal_id);
      CREATE INDEX idx_goals_status ON goals(status);
      CREATE INDEX idx_goals_owner ON goals(owner_hollon_id);
      CREATE INDEX idx_goals_auto_generated ON goals(auto_generated) WHERE auto_generated = true;
    `);

    // goal_progress_records 테이블
    await queryRunner.query(`
      CREATE TABLE goal_progress_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,

        progress_percent DECIMAL(5, 2) NOT NULL,
        current_value DECIMAL(15, 4),

        note TEXT,
        recorded_by UUID REFERENCES hollons(id) ON DELETE SET NULL,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_goal_progress_goal ON goal_progress_records(goal_id);
      CREATE INDEX idx_goal_progress_date ON goal_progress_records(recorded_at DESC);
    `);

    // projects 테이블에 goal_id 추가
    await queryRunner.query(`
      ALTER TABLE projects
      ADD COLUMN goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;

      CREATE INDEX idx_projects_goal ON projects(goal_id);
    `);

    // tasks 테이블에 organization_id 추가 및 project_id nullable로 변경
    await queryRunner.query(`
      -- organization_id 추가
      ALTER TABLE tasks
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

      -- 기존 tasks에 organization_id 채우기 (projects를 통해)
      UPDATE tasks t
      SET organization_id = p.organization_id
      FROM projects p
      WHERE t.project_id = p.id;

      -- organization_id NOT NULL 제약조건 추가
      ALTER TABLE tasks
      ALTER COLUMN organization_id SET NOT NULL;

      -- project_id를 nullable로 변경
      ALTER TABLE tasks
      ALTER COLUMN project_id DROP NOT NULL;

      -- 인덱스 추가
      CREATE INDEX idx_tasks_organization ON tasks(organization_id);
      CREATE INDEX idx_tasks_project ON tasks(project_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // tasks 테이블 복원
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_tasks_organization;
      DROP INDEX IF EXISTS idx_tasks_project;

      ALTER TABLE tasks ALTER COLUMN project_id SET NOT NULL;
      ALTER TABLE tasks DROP COLUMN organization_id;
    `);

    // projects 테이블 복원
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_projects_goal;
      ALTER TABLE projects DROP COLUMN goal_id;
    `);

    // goal_progress_records 테이블 삭제
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_goal_progress_goal;
      DROP INDEX IF EXISTS idx_goal_progress_date;
      DROP TABLE goal_progress_records;
    `);

    // goals 테이블 삭제
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_goals_org;
      DROP INDEX IF EXISTS idx_goals_team;
      DROP INDEX IF EXISTS idx_goals_parent;
      DROP INDEX IF EXISTS idx_goals_status;
      DROP INDEX IF EXISTS idx_goals_owner;
      DROP INDEX IF EXISTS idx_goals_auto_generated;
      DROP TABLE goals;
    `);
  }
}
