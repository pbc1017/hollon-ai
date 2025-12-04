# Hollon-AI: Technical Blueprint

> 이 문서는 SSOT(ssot.md)에 정의된 개념을 구현하기 위한 구체적인 기술 명세입니다.
> 개념적인 설계는 [ssot.md](./ssot.md)를 참조하세요.

---

## 목차

1. [데이터베이스 스키마](#1-데이터베이스-스키마) - SQL DDL
2. [TypeScript 인터페이스](#2-typescript-인터페이스) - 타입 정의
3. [Brain Provider 구현](#3-brain-provider-구현) - AI 백엔드 추상화
4. [API 엔드포인트](#4-api-엔드포인트) - REST API
5. [실시간 메시징 구현](#5-실시간-메시징-구현) - WebSocket
6. [프롬프트 계층 합성](#6-프롬프트-계층-합성) - PromptComposerService
7. [Task 선택 알고리즘](#7-task-선택-알고리즘) - TaskPoolService
8. [홀론 오케스트레이션](#8-홀론-오케스트레이션) - 실행 사이클
9. [NestJS 프로젝트 구조](#9-nestjs-프로젝트-구조) - 디렉토리 구조
10. [구현 로드맵](#10-구현-로드맵) - 30주 계획
11. [LLM 한계 극복 서비스](#11-llm-한계-극복-서비스-상세) - 상세 구현
12. [협업 서비스](#12-협업-서비스-상세) - 상세 구현
13. [코드 리뷰 서비스](#13-코드-리뷰-서비스) - CodeReviewService
14. [기술 부채 서비스](#14-기술-부채-서비스) - TechDebtService

---

## 1. 데이터베이스 스키마

### 1.1 ERD 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Organization                                    │
└─────────────────────────────────────────────────────────────────────────────┘
       │              │              │              │              │
       │              │              │              │              │
       ▼              ▼              ▼              ▼              ▼
┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
│   Role    │  │   Team    │  │  Project  │  │  Channel  │  │ Document  │
└───────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘
       │              │              │              │              │
       │              │ M:N          │              │ M:N          │
       ▼              ▼              ▼              ▼              │
┌───────────────────────────────────────────────────────────────┐ │
│                          Hollon                                │◄┘
│  (self-ref: parent_id for hierarchy)                          │
└───────────────────────────────────────────────────────────────┘
       │                             │
       │ 1:N                         │ 1:N
       ▼                             ▼
┌───────────┐                 ┌───────────┐
│  Message  │                 │   Task    │ (self-ref: parent_id)
└───────────┘                 └───────────┘
                                    │
                                    │ 1:N
                                    ▼
                              ┌───────────┐
                              │  TaskLog  │
                              └───────────┘
```

### 1.2 Core Tables

#### organizations
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,

    -- 조직 컨텍스트 프롬프트 (Layer 1)
    context_prompt TEXT,  -- 회사 비전, 핵심 가치, 전사 규칙

    -- 리소스 제한
    max_concurrent_holons INTEGER DEFAULT 10,
    max_total_holons INTEGER DEFAULT 100,

    -- 비용 제한
    cost_limit_daily_cents INTEGER,
    cost_limit_monthly_cents INTEGER,
    cost_alert_threshold_percent INTEGER DEFAULT 80,

    -- 기본 Brain Provider
    default_brain_provider_config_id UUID,

    -- 루트 홀론
    root_holon_id UUID,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### brain_provider_configs
```sql
CREATE TABLE brain_provider_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Provider 식별
    name VARCHAR(100) NOT NULL,
    provider_type VARCHAR(50) NOT NULL
        CHECK (provider_type IN (
            'claude-code', 'gemini-cli', 'cursor-cli',
            'claude-api', 'gemini-api', 'openai-api'
        )),

    -- Provider별 설정 (JSON)
    config JSONB NOT NULL,
    /* CLI 예시:
       {
         "command": "claude",
         "args": ["--dangerously-skip-permissions"],
         "env": {"CUSTOM_VAR": "value"},
         "dangerouslySkipPermissions": true
       }

       API 예시:
       {
         "model": "claude-sonnet-4-20250514",
         "maxTokens": 4096,
         "temperature": 0.7
       }
    */

    -- 암호화된 자격 증명
    encrypted_credentials BYTEA,

    is_default BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, name)
);

CREATE INDEX idx_brain_configs_org ON brain_provider_configs(organization_id);
CREATE INDEX idx_brain_configs_type ON brain_provider_configs(provider_type);
```

#### roles
```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- 역할 정보
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- 역할 정의
    system_prompt TEXT NOT NULL,
    capabilities JSONB DEFAULT '[]',
    allowed_paths JSONB DEFAULT '[]',

    -- 의사결정 영역
    decision_domains JSONB DEFAULT '[]',

    -- 자율성 수준
    autonomy_level VARCHAR(20) DEFAULT 'high'
        CHECK (autonomy_level IN ('low', 'medium', 'high')),
    can_create_tasks BOOLEAN DEFAULT true,
    can_create_sub_holons BOOLEAN DEFAULT false,
    can_request_collaboration BOOLEAN DEFAULT true,
    can_request_resources BOOLEAN DEFAULT false,
    can_talk_to_user BOOLEAN DEFAULT true,

    -- 제약사항
    max_instances INTEGER,

    -- Brain Provider 설정
    brain_provider_config_id UUID REFERENCES brain_provider_configs(id) ON DELETE SET NULL,

    -- 프롬프트 버전 관리
    current_prompt_version_id UUID,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, name)
);

CREATE INDEX idx_roles_org ON roles(organization_id);
```

#### teams
```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- 팀 컨텍스트 프롬프트 (Layer 2)
    context_prompt TEXT,  -- 팀 목표, 협업 규칙, 커뮤니케이션 스타일

    -- 팀 계층
    parent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    leader_holon_id UUID,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, name)
);

CREATE TABLE team_role_requirements (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    min_count INTEGER DEFAULT 1,
    max_count INTEGER,
    PRIMARY KEY (team_id, role_id)
);

CREATE INDEX idx_teams_org ON teams(organization_id);
CREATE INDEX idx_teams_parent ON teams(parent_team_id);
```

#### hollons
```sql
CREATE TABLE hollons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

    -- 식별
    name VARCHAR(100) NOT NULL,

    -- 계층 구조
    parent_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    -- 생명주기
    lifecycle VARCHAR(20) NOT NULL CHECK (lifecycle IN ('permanent', 'temporary')),
    status VARCHAR(20) NOT NULL DEFAULT 'idle'
        CHECK (status IN ('idle', 'running', 'waiting', 'terminated', 'error')),

    -- 개별 설정 (Role 오버라이드) - Layer 4
    custom_prompt TEXT,  -- 홀론 커스텀 프롬프트 (성격, 특화 영역, 학습된 선호도)
    custom_capabilities JSONB,
    custom_allowed_paths JSONB,

    -- Brain Provider 오버라이드
    brain_provider_config_id UUID REFERENCES brain_provider_configs(id) ON DELETE SET NULL,

    -- 프로세스 정보
    pid INTEGER,
    process_started_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES hollons(id) ON DELETE SET NULL
);

-- 계층 구조 Closure Table
CREATE TABLE holon_hierarchy (
    ancestor_id UUID NOT NULL REFERENCES hollons(id) ON DELETE CASCADE,
    descendant_id UUID NOT NULL REFERENCES hollons(id) ON DELETE CASCADE,
    depth INTEGER NOT NULL,
    PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX idx_hollons_org ON hollons(organization_id);
CREATE INDEX idx_hollons_role ON hollons(role_id);
CREATE INDEX idx_hollons_team ON hollons(team_id);
CREATE INDEX idx_hollons_parent ON hollons(parent_id);
CREATE INDEX idx_hollons_status ON hollons(status);
CREATE INDEX idx_hierarchy_ancestor ON holon_hierarchy(ancestor_id);
CREATE INDEX idx_hierarchy_descendant ON holon_hierarchy(descendant_id);
```

#### messages
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    from_type VARCHAR(10) NOT NULL CHECK (from_type IN ('holon', 'user')),
    from_id UUID,
    to_type VARCHAR(10) NOT NULL CHECK (to_type IN ('holon', 'user')),
    to_id UUID,

    content TEXT NOT NULL,
    message_type VARCHAR(30) NOT NULL CHECK (message_type IN (
        'task_assignment', 'task_update', 'task_completion',
        'question', 'response', 'delegation_request',
        'delegation_approval', 'general'
    )),

    related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    related_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    read_at TIMESTAMP WITH TIME ZONE,
    requires_response BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_from_holon FOREIGN KEY (from_id) REFERENCES hollons(id) ON DELETE SET NULL,
    CONSTRAINT fk_to_holon FOREIGN KEY (to_id) REFERENCES hollons(id) ON DELETE SET NULL
);

CREATE INDEX idx_messages_to ON messages(to_type, to_id);
CREATE INDEX idx_messages_from ON messages(from_type, from_id);
CREATE INDEX idx_messages_unread ON messages(to_id) WHERE read_at IS NULL;
CREATE INDEX idx_messages_created ON messages(created_at DESC);
```

#### conversations
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    participant_1_type VARCHAR(10) NOT NULL,
    participant_1_id UUID,
    participant_2_type VARCHAR(10) NOT NULL,
    participant_2_id UUID,

    context JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(participant_1_type, participant_1_id, participant_2_type, participant_2_id)
);

CREATE TABLE conversation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,

    UNIQUE(conversation_id, sequence_number)
);
```

### 1.3 Project & Task Tables

#### projects
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(10) NOT NULL,
    description TEXT,
    icon VARCHAR(10),

    lead_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'planning'
        CHECK (status IN ('planning', 'active', 'paused', 'completed', 'archived')),

    start_date DATE,
    target_date DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, identifier)
);

CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_team ON projects(team_id);
```

#### milestones
```sql
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE,

    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'cancelled')),

    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_milestones_project ON milestones(project_id);
```

#### cycles
```sql
CREATE TABLE cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    name VARCHAR(255),
    number INTEGER NOT NULL,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    goal TEXT,

    budget_cents INTEGER,
    actual_cost_cents INTEGER DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'upcoming'
        CHECK (status IN ('upcoming', 'active', 'completed')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(project_id, number)
);

CREATE INDEX idx_cycles_project ON cycles(project_id);
CREATE INDEX idx_cycles_status ON cycles(status);
```

#### tasks
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
    cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,

    number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,

    assigned_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,
    creator_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'backlog'
        CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled')),
    priority VARCHAR(10) NOT NULL DEFAULT 'none'
        CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),

    estimate_points INTEGER,
    due_date DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(project_id, number)
);

CREATE TABLE task_dependencies (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) DEFAULT 'blocks'
        CHECK (dependency_type IN ('blocks', 'relates_to', 'duplicates')),
    PRIMARY KEY (task_id, depends_on_task_id),
    CHECK (task_id != depends_on_task_id)
);

CREATE TABLE task_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7),
    UNIQUE(project_id, name)
);

CREATE TABLE task_label_assignments (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES task_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);

CREATE TABLE task_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    details TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,
    author_type VARCHAR(10) NOT NULL CHECK (author_type IN ('holon', 'user')),

    content TEXT NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_milestone ON tasks(milestone_id);
CREATE INDEX idx_tasks_cycle ON tasks(cycle_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_holon_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_number ON tasks(project_id, number);
CREATE INDEX idx_task_logs_task ON task_logs(task_id);
CREATE INDEX idx_task_comments_task ON task_comments(task_id);
```

#### task_pull_requests (Task-PR 연결)
```sql
CREATE TABLE task_pull_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- PR 정보
    pr_number INTEGER NOT NULL,
    pr_url VARCHAR(500) NOT NULL,
    repository VARCHAR(255) NOT NULL,
    branch_name VARCHAR(255),

    -- 상태
    status VARCHAR(30) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'ready_for_review', 'changes_requested', 'approved', 'merged', 'closed')),

    -- 작성자
    author_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    -- 리뷰어
    reviewer_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,
    reviewer_type VARCHAR(30),  -- 'team_member', 'security_reviewer', 'architecture_reviewer' 등

    -- 리뷰 결과
    review_comments TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    merged_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_task_prs_task ON task_pull_requests(task_id);
CREATE INDEX idx_task_prs_status ON task_pull_requests(status);
CREATE INDEX idx_task_prs_author ON task_pull_requests(author_holon_id);
CREATE INDEX idx_task_prs_reviewer ON task_pull_requests(reviewer_holon_id);
```

#### tech_debts (기술 부채)
```sql
CREATE TABLE tech_debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    -- 부채 정보
    title VARCHAR(500) NOT NULL,
    description TEXT,

    debt_type VARCHAR(30) NOT NULL
        CHECK (debt_type IN ('code', 'test', 'doc', 'dependency', 'architecture')),

    -- 발생 원인
    source_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    source_hollon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,
    source_file VARCHAR(500),
    source_line INTEGER,

    -- 비용 추정
    estimated_fix_hours DECIMAL(5, 2),

    -- 이자 계산
    interest_rate DECIMAL(5, 4) DEFAULT 0.01,  -- 일일 복잡도 증가율
    accumulated_interest DECIMAL(10, 2) DEFAULT 0,

    -- 영향 범위
    affected_files TEXT[] DEFAULT '{}',
    dependent_tasks UUID[] DEFAULT '{}',

    -- 우선순위 점수 (자동 계산)
    priority_score DECIMAL(10, 2) DEFAULT 0,

    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'identified'
        CHECK (status IN ('identified', 'scheduled', 'in_progress', 'resolved', 'wont_fix')),
    scheduled_cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,

    -- 해결 정보
    resolved_by_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tech_debts_org ON tech_debts(organization_id);
CREATE INDEX idx_tech_debts_project ON tech_debts(project_id);
CREATE INDEX idx_tech_debts_type ON tech_debts(debt_type);
CREATE INDEX idx_tech_debts_status ON tech_debts(status);
CREATE INDEX idx_tech_debts_priority ON tech_debts(priority_score DESC);
CREATE INDEX idx_tech_debts_cycle ON tech_debts(scheduled_cycle_id);

-- 이자 자동 누적 (일일 배치 또는 트리거)
CREATE OR REPLACE FUNCTION update_debt_interest()
RETURNS void AS $$
BEGIN
    UPDATE tech_debts
    SET
        accumulated_interest = accumulated_interest + (estimated_fix_hours * interest_rate),
        priority_score = (interest_rate * EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)
                        + (array_length(affected_files, 1) * 0.5)
                        + (array_length(dependent_tasks, 1) * 2),
        updated_at = NOW()
    WHERE status IN ('identified', 'scheduled');
END;
$$ LANGUAGE plpgsql;
```

### 1.4 Metrics & Cost Tables

#### metric_definitions
```sql
CREATE TABLE metric_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(50),

    metric_type VARCHAR(30) NOT NULL
        CHECK (metric_type IN ('counter', 'gauge', 'ratio', 'duration', 'score')),

    aggregation_method VARCHAR(20) DEFAULT 'sum'
        CHECK (aggregation_method IN ('sum', 'avg', 'min', 'max', 'last', 'count')),

    applies_to VARCHAR(20)[] DEFAULT ARRAY['holon']
        CHECK (applies_to <@ ARRAY['holon', 'team', 'project', 'cycle', 'organization']::VARCHAR[]),

    target_value DECIMAL(15, 4),
    target_direction VARCHAR(10)
        CHECK (target_direction IN ('higher', 'lower', 'exact')),

    is_computed BOOLEAN DEFAULT false,
    computation_formula TEXT,

    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, name)
);

CREATE INDEX idx_metric_definitions_org ON metric_definitions(organization_id);
```

#### metric_records
```sql
CREATE TABLE metric_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_definition_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,

    holon_id UUID REFERENCES hollons(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    value DECIMAL(15, 4) NOT NULL,

    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,

    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recorded_by UUID REFERENCES hollons(id) ON DELETE SET NULL,
    notes TEXT,

    CONSTRAINT exactly_one_target CHECK (
        (CASE WHEN holon_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN team_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN project_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN cycle_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN organization_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);

CREATE INDEX idx_metric_records_definition ON metric_records(metric_definition_id);
CREATE INDEX idx_metric_records_holon ON metric_records(holon_id);
CREATE INDEX idx_metric_records_team ON metric_records(team_id);
CREATE INDEX idx_metric_records_recorded ON metric_records(recorded_at DESC);
```

#### cost_records
```sql
CREATE TABLE cost_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    holon_id UUID NOT NULL REFERENCES hollons(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,

    cost_type VARCHAR(30) NOT NULL
        CHECK (cost_type IN ('inference', 'sub_holon_spawn', 'tool_execution', 'other')),

    -- Brain Provider 정보
    brain_provider_type VARCHAR(50),
    model_used VARCHAR(50) NOT NULL,

    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_cents DECIMAL(10, 4) NOT NULL,

    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cost_records_holon ON cost_records(holon_id);
CREATE INDEX idx_cost_records_team ON cost_records(team_id);
CREATE INDEX idx_cost_records_cycle ON cost_records(cycle_id);
CREATE INDEX idx_cost_records_created ON cost_records(created_at);
CREATE INDEX idx_cost_records_type ON cost_records(cost_type);
```

#### holon_performance_summary
```sql
CREATE TABLE holon_performance_summary (
    holon_id UUID PRIMARY KEY REFERENCES hollons(id) ON DELETE CASCADE,

    total_tasks_assigned INTEGER DEFAULT 0,
    total_tasks_completed INTEGER DEFAULT 0,
    total_story_points_completed INTEGER DEFAULT 0,

    avg_task_completion_hours DECIMAL(10, 2),
    avg_review_turnaround_hours DECIMAL(10, 2),

    tasks_reopened_count INTEGER DEFAULT 0,
    code_review_comments_received INTEGER DEFAULT 0,

    delegations_made INTEGER DEFAULT 0,
    delegations_received INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    collaboration_requests INTEGER DEFAULT 0,

    last_task_completed_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE,

    productivity_score DECIMAL(5, 2),
    quality_score DECIMAL(5, 2),
    collaboration_score DECIMAL(5, 2),
    overall_score DECIMAL(5, 2),

    total_cost_cents DECIMAL(12, 2) DEFAULT 0,
    avg_cost_per_task_cents DECIMAL(10, 2),

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 1.5 Channel & Document Tables

#### channels
```sql
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    description TEXT,
    channel_type VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (channel_type IN ('public', 'private', 'direct')),

    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    is_archived BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES hollons(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, name)
);

CREATE TABLE channel_memberships (
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    holon_id UUID NOT NULL REFERENCES hollons(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member'
        CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (channel_id, holon_id)
);

CREATE TABLE channel_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,

    author_type VARCHAR(10) NOT NULL CHECK (author_type IN ('holon', 'user')),
    author_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text'
        CHECK (message_type IN ('text', 'system', 'task_update', 'file')),

    thread_parent_id UUID REFERENCES channel_messages(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_channels_org ON channels(organization_id);
CREATE INDEX idx_channel_messages_channel ON channel_messages(channel_id);
CREATE INDEX idx_channel_messages_created ON channel_messages(created_at DESC);
```

#### documents (Memory 시스템 통합)
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    parent_id UUID REFERENCES documents(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    content TEXT,
    summary TEXT,  -- 문서 요약 (프롬프트 주입 시 사용)

    -- 문서 타입 확장 (Memory 역할 포함)
    doc_type VARCHAR(20) NOT NULL DEFAULT 'document'
        CHECK (doc_type IN (
            'folder',     -- 폴더
            'spec',       -- 기술 명세서
            'adr',        -- 아키텍처 결정 기록
            'guide',      -- 가이드/매뉴얼
            'runbook',    -- 운영 절차서
            'memory',     -- 학습된 패턴, 선호도 (자동 생성)
            'postmortem', -- 장애/실패 분석
            'meeting',    -- 회의/논의 기록
            'changelog'   -- 변경 이력
        )),

    -- Memory 스코프 (문서 적용 범위)
    scope VARCHAR(20) NOT NULL DEFAULT 'project'
        CHECK (scope IN ('organization', 'team', 'project', 'hollon')),
    scope_id UUID,  -- scope에 따라 org_id, team_id, project_id, hollon_id 참조

    -- 검색/매칭용 메타데이터
    keywords TEXT[] DEFAULT '{}',
    importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),

    -- 자동 생성 관련
    auto_generated BOOLEAN DEFAULT false,
    source_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    source_hollon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    -- 접근 통계 (Memory 주입 우선순위 결정)
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,

    -- 만료 (임시 메모리용)
    expires_at TIMESTAMP WITH TIME ZONE,

    -- 기존 연결 (하위 호환)
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

    sort_order INTEGER DEFAULT 0,

    created_by UUID REFERENCES hollons(id) ON DELETE SET NULL,
    last_edited_by UUID REFERENCES hollons(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, parent_id, name)
);

-- Memory 검색 최적화 인덱스
CREATE INDEX idx_documents_scope ON documents(scope, scope_id);
CREATE INDEX idx_documents_type ON documents(doc_type);
CREATE INDEX idx_documents_keywords ON documents USING GIN(keywords);
CREATE INDEX idx_documents_importance ON documents(importance DESC);
CREATE INDEX idx_documents_auto_generated ON documents(auto_generated) WHERE auto_generated = true;
CREATE INDEX idx_documents_expires ON documents(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    commit_message VARCHAR(500),
    edited_by UUID REFERENCES hollons(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(document_id, version)
);

CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_documents_parent ON documents(parent_id);
CREATE INDEX idx_document_versions_doc ON document_versions(document_id);
```

### 1.6 Governance Tables

#### approval_requests
```sql
CREATE TABLE approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holon_id UUID NOT NULL REFERENCES hollons(id) ON DELETE CASCADE,

    request_type VARCHAR(30) NOT NULL CHECK (request_type IN (
        'holon_creation', 'holon_deletion', 'high_cost_action', 'path_access', 'budget_extension'
    )),

    description TEXT NOT NULL,
    reasoning TEXT,

    estimated_cost DECIMAL(10, 2),
    risk_level VARCHAR(10) CHECK (risk_level IN ('low', 'medium', 'high')),
    affected_entities JSONB DEFAULT '[]',

    policy_id UUID REFERENCES action_policies(id) ON DELETE SET NULL,

    expires_at TIMESTAMP WITH TIME ZONE,
    auto_action_on_expire VARCHAR(20)
        CHECK (auto_action_on_expire IN ('approve', 'reject', 'escalate', 'none')),

    escalated BOOLEAN DEFAULT false,
    escalated_at TIMESTAMP WITH TIME ZONE,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),

    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    responded_by VARCHAR(100),
    response_note TEXT
);

CREATE INDEX idx_approval_pending ON approval_requests(status) WHERE status = 'pending';
CREATE INDEX idx_approval_holon ON approval_requests(holon_id);
```

#### action_policies
```sql
CREATE TABLE action_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    description TEXT,

    scope_type VARCHAR(20) NOT NULL
        CHECK (scope_type IN ('organization', 'team', 'role', 'holon')),
    scope_id UUID,

    action_category VARCHAR(50) NOT NULL,
    action_pattern VARCHAR(255),

    policy_type VARCHAR(30) NOT NULL
        CHECK (policy_type IN ('requires_approval', 'execute_then_report', 'report_on_request', 'autonomous')),

    conditions JSONB DEFAULT '{}',

    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, name)
);

CREATE INDEX idx_action_policies_scope ON action_policies(scope_type, scope_id);
CREATE INDEX idx_action_policies_active ON action_policies(is_active) WHERE is_active = true;
```

### 1.7 PostgreSQL LISTEN/NOTIFY Triggers

```sql
-- 메시지 전송 알림
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'holon_message_' || NEW.to_id::text,
        json_build_object(
            'id', NEW.id,
            'from_type', NEW.from_type,
            'from_id', NEW.from_id,
            'message_type', NEW.message_type,
            'content', substring(NEW.content, 1, 200)
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_new_message
    AFTER INSERT ON messages
    FOR EACH ROW
    WHEN (NEW.to_type = 'holon')
    EXECUTE FUNCTION notify_new_message();

-- 홀론 상태 변경 알림
CREATE OR REPLACE FUNCTION notify_holon_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM pg_notify(
            'holon_status_changed',
            json_build_object(
                'holon_id', NEW.id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'organization_id', NEW.organization_id
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_holon_status
    AFTER UPDATE ON hollons
    FOR EACH ROW
    EXECUTE FUNCTION notify_holon_status_change();

-- 승인 요청 알림
CREATE OR REPLACE FUNCTION notify_approval_request()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'approval_requested',
        json_build_object(
            'id', NEW.id,
            'holon_id', NEW.holon_id,
            'request_type', NEW.request_type,
            'description', NEW.description
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_approval_request
    AFTER INSERT ON approval_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_approval_request();
```

---

## 2. TypeScript 인터페이스

### 2.1 Core Types

```typescript
// === Brain Provider Types ===

type BrainCategory = 'cli' | 'api';

type BrainProviderType =
  | 'claude-code'
  | 'gemini-cli'
  | 'cursor-cli'
  | 'claude-api'
  | 'gemini-api'
  | 'openai-api';

interface BrainProviderMeta {
  type: BrainProviderType;
  category: BrainCategory;
  displayName: string;
  description: string;
  capabilities: {
    codeExecution: boolean;
    fileSystem: boolean;
    webBrowsing: boolean;
    toolUse: boolean;
    streaming: boolean;
    contextWindow: number;
  };
  pricing?: {
    inputPer1kTokens: number;
    outputPer1kTokens: number;
  };
}

// === Organization ===

interface Organization {
  id: string;
  name: string;
  contextPrompt?: string;  // Layer 1 프롬프트
  maxConcurrentHolons: number;
  maxTotalHolons: number;
  costLimitDailyCents?: number;
  costLimitMonthlyCents?: number;
  costAlertThresholdPercent: number;
  defaultBrainProviderConfigId?: string;
  rootHolonId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// === Role ===

interface Role {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  capabilities: string[];
  allowedPaths: string[];
  decisionDomains: string[];
  autonomyLevel: 'low' | 'medium' | 'high';
  canCreateTasks: boolean;
  canCreateSubHolons: boolean;
  canRequestCollaboration: boolean;
  canRequestResources: boolean;
  canTalkToUser: boolean;
  maxInstances?: number;
  brainProviderConfigId?: string;
  currentPromptVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// === Hollon ===

interface Hollon {
  id: string;
  organizationId: string;
  roleId: string;
  teamId?: string;
  name: string;
  parentId: string | null;
  lifecycle: 'permanent' | 'temporary';
  status: 'idle' | 'running' | 'waiting' | 'terminated' | 'error';
  customPrompt?: string;  // Layer 4 프롬프트
  customCapabilities?: string[];
  customAllowedPaths?: string[];
  brainProviderConfigId?: string;
  pid?: number;
  processStartedAt?: Date;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
}

// === Team ===

interface Team {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  contextPrompt?: string;  // Layer 2 프롬프트
  parentTeamId?: string;
  leaderHolonId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// === Project ===

interface Project {
  id: string;
  organizationId: string;
  teamId?: string;
  name: string;
  identifier: string;
  description?: string;
  icon?: string;
  leadHolonId?: string;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'archived';
  startDate?: Date;
  targetDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// === Task ===

interface Task {
  id: string;
  projectId: string;
  parentTaskId?: string;
  milestoneId?: string;
  cycleId?: string;
  number: number;
  title: string;
  description?: string;
  assignedHolonId?: string;
  creatorHolonId?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  estimatePoints?: number;
  dueDate?: Date;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  updatedAt: Date;
}

// === Document (Memory 통합) ===

type DocumentType =
  | 'folder'
  | 'spec'
  | 'adr'
  | 'guide'
  | 'runbook'
  | 'memory'
  | 'postmortem'
  | 'meeting'
  | 'changelog';

type DocumentScope = 'organization' | 'team' | 'project' | 'hollon';

interface Document {
  id: string;
  organizationId: string;
  parentId?: string;
  name: string;
  slug?: string;
  content?: string;
  summary?: string;
  docType: DocumentType;
  scope: DocumentScope;
  scopeId?: string;
  keywords: string[];
  importance: number;  // 1-10
  autoGenerated: boolean;
  sourceTaskId?: string;
  sourceHollonId?: string;
  accessCount: number;
  lastAccessedAt?: Date;
  expiresAt?: Date;
  projectId?: string;
  teamId?: string;
  taskId?: string;
  createdBy?: string;
  lastEditedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// === Message ===

interface Message {
  id: string;
  fromType: 'holon' | 'user';
  fromId: string | null;
  toType: 'holon' | 'user';
  toId: string | null;
  content: string;
  messageType:
    | 'task_assignment'
    | 'task_update'
    | 'task_completion'
    | 'question'
    | 'response'
    | 'delegation_request'
    | 'delegation_approval'
    | 'general';
  relatedTaskId?: string;
  relatedProjectId?: string;
  readAt: Date | null;
  requiresResponse: boolean;
  createdAt: Date;
}
```

### 2.2 Brain Provider Interfaces

```typescript
interface BrainMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface BrainResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  costCents?: number;
  metadata?: {
    model?: string;
    stopReason?: string;
    toolsUsed?: string[];
  };
}

interface BrainExecuteOptions {
  systemPrompt: string;
  messages: BrainMessage[];
  workingDirectory?: string;
  allowedPaths?: string[];
  timeout?: number;
  onStream?: (chunk: string) => void;
  tools?: ToolDefinition[];
}

interface IBrainProvider {
  readonly meta: BrainProviderMeta;
  initialize(config: BrainProviderConfig): Promise<void>;
  execute(options: BrainExecuteOptions): Promise<BrainResponse>;
  executeStream(options: BrainExecuteOptions): AsyncIterable<string>;
  isReady(): boolean;
  dispose(): Promise<void>;
}

type BrainProviderConfig = CLIBrainConfig | APIBrainConfig;

interface CLIBrainConfig {
  category: 'cli';
  type: 'claude-code' | 'gemini-cli' | 'cursor-cli';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  maxConcurrentProcesses?: number;
  processTimeout?: number;
  dangerouslySkipPermissions?: boolean;
}

interface APIBrainConfig {
  category: 'api';
  type: 'claude-api' | 'gemini-api' | 'openai-api';
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  maxRetries?: number;
  retryDelay?: number;
}
```

### 2.3 WebSocket Event Types

```typescript
type WSEvent =
  | { type: 'holon_status_changed'; holonId: string; oldStatus: string; newStatus: string }
  | { type: 'holon_created'; holon: Hollon }
  | { type: 'holon_deleted'; holonId: string }
  | { type: 'message_received'; message: Message }
  | { type: 'task_updated'; task: Task }
  | { type: 'approval_requested'; request: ApprovalRequest }
  | { type: 'log_entry'; holonId: string; log: string };
```

---

## 3. Brain Provider 구현

### 3.1 Provider 메타데이터

```typescript
const BRAIN_PROVIDERS: Record<BrainProviderType, BrainProviderMeta> = {
  'claude-code': {
    type: 'claude-code',
    category: 'cli',
    displayName: 'Claude Code',
    description: 'Anthropic Claude Code CLI - 풀 에이전트 기능',
    capabilities: {
      codeExecution: true,
      fileSystem: true,
      webBrowsing: true,
      toolUse: true,
      streaming: true,
      contextWindow: 200000,
    },
  },
  'gemini-cli': {
    type: 'gemini-cli',
    category: 'cli',
    displayName: 'Gemini CLI',
    description: 'Google Gemini CLI',
    capabilities: {
      codeExecution: true,
      fileSystem: true,
      webBrowsing: true,
      toolUse: true,
      streaming: true,
      contextWindow: 1000000,
    },
  },
  'cursor-cli': {
    type: 'cursor-cli',
    category: 'cli',
    displayName: 'Cursor CLI',
    description: 'Cursor AI CLI',
    capabilities: {
      codeExecution: true,
      fileSystem: true,
      webBrowsing: false,
      toolUse: true,
      streaming: true,
      contextWindow: 128000,
    },
  },
  'claude-api': {
    type: 'claude-api',
    category: 'api',
    displayName: 'Claude API',
    description: 'Anthropic Claude API 직접 호출',
    capabilities: {
      codeExecution: false,
      fileSystem: false,
      webBrowsing: false,
      toolUse: true,
      streaming: true,
      contextWindow: 200000,
    },
    pricing: {
      inputPer1kTokens: 0.3,
      outputPer1kTokens: 1.5,
    },
  },
  'gemini-api': {
    type: 'gemini-api',
    category: 'api',
    displayName: 'Gemini API',
    description: 'Google Gemini API 직접 호출',
    capabilities: {
      codeExecution: false,
      fileSystem: false,
      webBrowsing: false,
      toolUse: true,
      streaming: true,
      contextWindow: 1000000,
    },
    pricing: {
      inputPer1kTokens: 0.075,
      outputPer1kTokens: 0.30,
    },
  },
  'openai-api': {
    type: 'openai-api',
    category: 'api',
    displayName: 'OpenAI API',
    description: 'OpenAI GPT API',
    capabilities: {
      codeExecution: false,
      fileSystem: false,
      webBrowsing: false,
      toolUse: true,
      streaming: true,
      contextWindow: 128000,
    },
    pricing: {
      inputPer1kTokens: 0.5,
      outputPer1kTokens: 1.5,
    },
  },
};
```

### 3.2 Claude Code Provider 구현

```typescript
import { spawn, ChildProcess } from 'child_process';

class ClaudeCodeBrainProvider implements IBrainProvider {
  readonly meta = BRAIN_PROVIDERS['claude-code'];
  private config!: CLIBrainConfig;
  private process: ChildProcess | null = null;

  async initialize(config: CLIBrainConfig): Promise<void> {
    this.config = {
      command: 'claude',
      args: config.dangerouslySkipPermissions
        ? ['--dangerously-skip-permissions']
        : [],
      ...config,
    };
  }

  async execute(options: BrainExecuteOptions): Promise<BrainResponse> {
    const { systemPrompt, messages, workingDirectory, timeout } = options;

    const fullPrompt = this.buildPrompt(systemPrompt, messages);

    this.process = spawn(this.config.command, [
      ...this.config.args!,
      '--print',
      '-p', fullPrompt,
    ], {
      cwd: workingDirectory,
      env: {
        ...process.env,
        ...this.config.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      },
      timeout: timeout || 300000,
    });

    const output = await this.collectOutput();

    return {
      content: output,
      usage: this.estimateTokenUsage(fullPrompt, output),
      metadata: { model: 'claude-code' },
    };
  }

  async *executeStream(options: BrainExecuteOptions): AsyncIterable<string> {
    const proc = spawn(this.config.command, [
      ...this.config.args!,
      '-p', this.buildPrompt(options.systemPrompt, options.messages),
    ], {
      cwd: options.workingDirectory,
    });

    for await (const chunk of proc.stdout!) {
      yield chunk.toString();
    }
  }

  private buildPrompt(systemPrompt: string, messages: BrainMessage[]): string {
    let prompt = systemPrompt + '\n\n';
    for (const msg of messages) {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n`;
      }
    }
    return prompt;
  }

  private async collectOutput(): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      this.process!.stdout?.on('data', (data) => { output += data.toString(); });
      this.process!.stderr?.on('data', (data) => { output += data.toString(); });
      this.process!.on('close', () => resolve(output));
      this.process!.on('error', reject);
    });
  }

  private estimateTokenUsage(input: string, output: string) {
    return {
      inputTokens: Math.ceil(input.length / 4),
      outputTokens: Math.ceil(output.length / 4),
    };
  }

  isReady(): boolean {
    return this.config !== undefined;
  }

  async dispose(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
```

### 3.3 Claude API Provider 구현

```typescript
import Anthropic from '@anthropic-ai/sdk';

class ClaudeAPIBrainProvider implements IBrainProvider {
  readonly meta = BRAIN_PROVIDERS['claude-api'];
  private config!: APIBrainConfig;
  private client!: Anthropic;

  async initialize(config: APIBrainConfig): Promise<void> {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async execute(options: BrainExecuteOptions): Promise<BrainResponse> {
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 4096,
      system: options.systemPrompt,
      messages: options.messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    });

    const content = response.content
      .filter(c => c.type === 'text')
      .map(c => (c as { type: 'text'; text: string }).text)
      .join('');

    const costCents = this.calculateCost(
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      costCents,
      metadata: {
        model: this.config.model,
        stopReason: response.stop_reason || undefined,
      },
    };
  }

  async *executeStream(options: BrainExecuteOptions): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 4096,
      system: options.systemPrompt,
      messages: options.messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as { type: string; text?: string };
        if (delta.type === 'text_delta' && delta.text) {
          yield delta.text;
        }
      }
    }
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    const { pricing } = this.meta;
    if (!pricing) return 0;
    return (
      (inputTokens / 1000) * pricing.inputPer1kTokens +
      (outputTokens / 1000) * pricing.outputPer1kTokens
    );
  }

  isReady(): boolean {
    return this.client !== undefined;
  }

  async dispose(): Promise<void> {
    // No cleanup needed for API client
  }
}
```

### 3.4 Brain Provider Factory

```typescript
class BrainProviderFactory {
  private static providers = new Map<BrainProviderType, new () => IBrainProvider>([
    ['claude-code', ClaudeCodeBrainProvider],
    ['claude-api', ClaudeAPIBrainProvider],
    // ['gemini-cli', GeminiCLIBrainProvider],
    // ['gemini-api', GeminiAPIBrainProvider],
    // ['cursor-cli', CursorCLIBrainProvider],
    // ['openai-api', OpenAIAPIBrainProvider],
  ]);

  static async create(
    type: BrainProviderType,
    config: BrainProviderConfig
  ): Promise<IBrainProvider> {
    const ProviderClass = this.providers.get(type);
    if (!ProviderClass) {
      throw new Error(`Unknown brain provider type: ${type}`);
    }

    const provider = new ProviderClass();
    await provider.initialize(config);
    return provider;
  }

  static register(type: BrainProviderType, provider: new () => IBrainProvider): void {
    this.providers.set(type, provider);
  }

  static getAvailableProviders(): BrainProviderMeta[] {
    return Array.from(this.providers.keys()).map(type => BRAIN_PROVIDERS[type]);
  }
}
```

### 3.5 Effective Brain Provider 결정

```typescript
async function getEffectiveBrainProvider(
  hollon: Hollon,
  role: Role,
  organization: Organization
): Promise<IBrainProvider> {
  // 우선순위: Hollon > Role > Organization 기본값
  const configId =
    hollon.brainProviderConfigId ||
    role.brainProviderConfigId ||
    organization.defaultBrainProviderConfigId;

  if (!configId) {
    // 기본값: Claude Code
    return BrainProviderFactory.create('claude-code', {
      category: 'cli',
      type: 'claude-code',
      command: 'claude',
      dangerouslySkipPermissions: true,
    });
  }

  const config = await db.query.brainProviderConfigs.findFirst({
    where: eq(brainProviderConfigs.id, configId),
  });

  if (!config) {
    throw new Error(`Brain provider config not found: ${configId}`);
  }

  return BrainProviderFactory.create(
    config.providerType as BrainProviderType,
    {
      ...config.config,
      apiKey: config.encryptedCredentials
        ? await decryptCredentials(config.encryptedCredentials)
        : undefined,
    }
  );
}
```

---

## 4. API 엔드포인트

### 4.1 Hollon API

```typescript
// GET /api/holons
// GET /api/holons/:id
// POST /api/holons
// PATCH /api/holons/:id
// DELETE /api/holons/:id
// PATCH /api/holons/:id/status
// GET /api/holons/:id/messages
// GET /api/holons/:id/tasks
```

### 4.2 Message API

```typescript
// POST /api/messages
async function sendMessage(req: Request): Promise<Response> {
  const { fromHolonId, toHolonId, content, messageType } = req.body;

  const message = await db.insert(messages).values({
    fromType: 'holon',
    fromId: fromHolonId,
    toType: 'holon',
    toId: toHolonId,
    content,
    messageType,
  }).returning();

  // NOTIFY 트리거가 자동으로 수신자에게 알림
  return Response.json(message[0]);
}

// GET /api/messages/inbox?holonId=xxx&unreadOnly=true
```

### 4.3 Task API

```typescript
// GET /api/projects/:projectId/tasks
// POST /api/projects/:projectId/tasks
// PATCH /api/tasks/:id
// DELETE /api/tasks/:id
```

---

## 5. 실시간 메시징 구현

### 5.1 메시지 수신 리스너 (Server)

```typescript
import { Pool } from 'pg';

async function listenForMessages(holonId: string) {
  const client = await pool.connect();
  await client.query(`LISTEN holon_message_${holonId}`);

  client.on('notification', async (msg) => {
    const payload = JSON.parse(msg.payload!);
    // WebSocket으로 홀론 프로세스에 전달
    notifyHolonProcess(holonId, payload);
  });
}
```

### 5.2 메시지 흐름

```
발신 홀론                       수신 홀론
    │                              │
    ├── API로 메시지 전송 ─────────┤
    │         │                    │
    │    DB INSERT 발생            │
    │         │                    │
    │    NOTIFY 트리거 실행        │
    │         │                    │
    │    Server가 LISTEN 중 ───────┤
    │         │                    │
    │    WebSocket으로 전달 ───────┤
    │                              │
    │ ◄─────── 응답 (역방향) ──────┤
```

### 5.3 홀론 시스템 프롬프트 템플릿

```markdown
# 홀론 역할 정의

## 당신의 정체성
- 홀론 ID: {holonId}
- 이름: {name}
- 조직: {organizationName}
- 상위 홀론: {parentName || 'None (루트)'}

## 역할
{systemPrompt}

{customPromptSuffix}

## 권한
- 접근 가능 경로: {allowedPaths}
- 서브 홀론 생성: {canCreateSubHolons}
- 사용자 직접 대화: {canTalkToUser}

## 통신 규칙
1. 상위 홀론에게 진행 상황 보고
2. 서브 홀론 생성 시 승인 요청
3. 태스크 완료 시 결과 보고

## API 엔드포인트
- 메시지 발송: POST {apiBaseUrl}/messages
- 메시지 수신: GET {apiBaseUrl}/messages/inbox
- 상태 업데이트: PATCH {apiBaseUrl}/holons/{holonId}/status
- 태스크 조회: GET {apiBaseUrl}/tasks?assignedTo={holonId}
```

---

## 6. 프롬프트 계층 합성

### 6.1 프롬프트 합성 서비스

```typescript
// NestJS Service
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class PromptComposerService {
  constructor(
    @InjectRepository(Organization)
    private orgRepo: Repository<Organization>,
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Hollon)
    private hollonRepo: Repository<Hollon>,
    @InjectRepository(Document)
    private documentRepo: Repository<Document>,
  ) {}

  /**
   * 6계층 프롬프트 합성
   * Layer 1: Organization Context
   * Layer 2: Team Context
   * Layer 3: Role Prompt
   * Layer 4: Hollon Custom Prompt
   * Layer 5: Long-term Memory (Documents)
   * Layer 6: Current Task Context
   */
  async composePrompt(
    hollonId: string,
    taskId?: string,
  ): Promise<ComposedPrompt> {
    const hollon = await this.hollonRepo.findOne({
      where: { id: hollonId },
      relations: ['role', 'team', 'organization'],
    });

    if (!hollon) throw new Error(`Hollon not found: ${hollonId}`);

    const layers: PromptLayer[] = [];

    // Layer 1: Organization Context
    if (hollon.organization?.contextPrompt) {
      layers.push({
        layer: 1,
        name: 'Organization Context',
        content: hollon.organization.contextPrompt,
      });
    }

    // Layer 2: Team Context (상위 팀 포함)
    const teamContexts = await this.getTeamContextChain(hollon.teamId);
    teamContexts.forEach((ctx, idx) => {
      layers.push({
        layer: 2,
        name: `Team Context (${ctx.teamName})`,
        content: ctx.contextPrompt,
      });
    });

    // Layer 3: Role Prompt
    if (hollon.role?.systemPrompt) {
      layers.push({
        layer: 3,
        name: 'Role Prompt',
        content: hollon.role.systemPrompt,
      });
    }

    // Layer 4: Hollon Custom Prompt
    if (hollon.customPrompt) {
      layers.push({
        layer: 4,
        name: 'Hollon Custom',
        content: hollon.customPrompt,
      });
    }

    // Layer 5: Relevant Memory (Documents)
    const memories = await this.getRelevantMemories(hollon, taskId);
    if (memories.length > 0) {
      layers.push({
        layer: 5,
        name: 'Long-term Memory',
        content: this.formatMemories(memories),
      });
    }

    // Layer 6: Task Context
    if (taskId) {
      const taskContext = await this.getTaskContext(taskId);
      layers.push({
        layer: 6,
        name: 'Current Task',
        content: taskContext,
      });
    }

    return {
      systemPrompt: this.mergeLayers(layers),
      layers,
      metadata: {
        hollonId,
        taskId,
        composedAt: new Date(),
      },
    };
  }

  private async getTeamContextChain(teamId?: string): Promise<TeamContext[]> {
    if (!teamId) return [];

    const contexts: TeamContext[] = [];
    let currentTeamId: string | null = teamId;

    while (currentTeamId) {
      const team = await this.teamRepo.findOne({
        where: { id: currentTeamId },
      });
      if (!team) break;

      if (team.contextPrompt) {
        contexts.unshift({
          teamId: team.id,
          teamName: team.name,
          contextPrompt: team.contextPrompt,
        });
      }
      currentTeamId = team.parentTeamId;
    }

    return contexts;
  }

  private async getRelevantMemories(
    hollon: Hollon,
    taskId?: string,
  ): Promise<Document[]> {
    // 태스크에서 키워드 추출
    const keywords = taskId
      ? await this.extractTaskKeywords(taskId)
      : [];

    // 스코프 우선순위: hollon → team → project → organization
    const scopeConditions = [
      { scope: 'hollon', scopeId: hollon.id },
      { scope: 'team', scopeId: hollon.teamId },
      { scope: 'organization', scopeId: hollon.organizationId },
    ].filter(s => s.scopeId);

    const documents = await this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.organization_id = :orgId', { orgId: hollon.organizationId })
      .andWhere('doc.doc_type != :folder', { folder: 'folder' })
      .andWhere('(doc.expires_at IS NULL OR doc.expires_at > NOW())')
      .andWhere(
        new Brackets(qb => {
          scopeConditions.forEach((cond, idx) => {
            if (idx === 0) {
              qb.where('(doc.scope = :scope0 AND doc.scope_id = :scopeId0)', {
                scope0: cond.scope,
                scopeId0: cond.scopeId,
              });
            } else {
              qb.orWhere(`(doc.scope = :scope${idx} AND doc.scope_id = :scopeId${idx})`, {
                [`scope${idx}`]: cond.scope,
                [`scopeId${idx}`]: cond.scopeId,
              });
            }
          });
        }),
      )
      .orderBy('doc.importance', 'DESC')
      .addOrderBy('doc.last_accessed_at', 'DESC')
      .limit(10)
      .getMany();

    // 접근 횟수 업데이트
    if (documents.length > 0) {
      await this.documentRepo.update(
        documents.map(d => d.id),
        {
          accessCount: () => 'access_count + 1',
          lastAccessedAt: new Date(),
        },
      );
    }

    return documents;
  }

  private formatMemories(documents: Document[]): string {
    return documents
      .map(doc => `## ${doc.name}\n${doc.summary || doc.content}`)
      .join('\n\n---\n\n');
  }

  private mergeLayers(layers: PromptLayer[]): string {
    return layers.map(l => l.content).join('\n\n');
  }
}

interface PromptLayer {
  layer: number;
  name: string;
  content: string;
}

interface ComposedPrompt {
  systemPrompt: string;
  layers: PromptLayer[];
  metadata: {
    hollonId: string;
    taskId?: string;
    composedAt: Date;
  };
}

interface TeamContext {
  teamId: string;
  teamName: string;
  contextPrompt: string;
}
```

---

## 7. Task 선택 알고리즘

### 7.1 Task Pool 서비스

```typescript
@Injectable()
export class TaskPoolService {
  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    @InjectRepository(Hollon)
    private hollonRepo: Repository<Hollon>,
  ) {}

  /**
   * 홀론이 처리할 다음 태스크를 선택
   * 우선순위:
   * 1. 홀론에게 직접 할당된 태스크
   * 2. 홀론 팀의 미할당 태스크 (우선순위 높은 순)
   * 3. 홀론 Role과 매칭되는 태스크
   */
  async pullNextTask(hollonId: string): Promise<Task | null> {
    const hollon = await this.hollonRepo.findOne({
      where: { id: hollonId },
      relations: ['role', 'team'],
    });

    if (!hollon) throw new Error(`Hollon not found: ${hollonId}`);

    // 1. 직접 할당된 태스크
    const assignedTask = await this.taskRepo.findOne({
      where: {
        assignedHolonId: hollonId,
        status: In(['todo', 'in_progress']),
      },
      order: {
        priority: 'DESC',
        createdAt: 'ASC',
      },
    });

    if (assignedTask) {
      return this.claimTask(assignedTask, hollonId);
    }

    // 2. 팀의 미할당 태스크
    if (hollon.teamId) {
      const teamTask = await this.taskRepo
        .createQueryBuilder('task')
        .innerJoin('projects', 'p', 'p.id = task.project_id')
        .where('p.team_id = :teamId', { teamId: hollon.teamId })
        .andWhere('task.assigned_holon_id IS NULL')
        .andWhere('task.status = :status', { status: 'todo' })
        .andWhere(this.buildDependencyCheck())
        .orderBy(this.buildPriorityOrder())
        .getOne();

      if (teamTask) {
        return this.claimTask(teamTask, hollonId);
      }
    }

    // 3. Role 매칭 태스크 (라벨 기반)
    const roleLabels = hollon.role?.capabilities || [];
    if (roleLabels.length > 0) {
      const labelTask = await this.taskRepo
        .createQueryBuilder('task')
        .innerJoin('task_label_assignments', 'tla', 'tla.task_id = task.id')
        .innerJoin('task_labels', 'tl', 'tl.id = tla.label_id')
        .where('task.assigned_holon_id IS NULL')
        .andWhere('task.status = :status', { status: 'todo' })
        .andWhere('tl.name IN (:...labels)', { labels: roleLabels })
        .andWhere(this.buildDependencyCheck())
        .orderBy(this.buildPriorityOrder())
        .getOne();

      if (labelTask) {
        return this.claimTask(labelTask, hollonId);
      }
    }

    return null;
  }

  /**
   * 태스크 할당 (원자적 연산)
   */
  private async claimTask(task: Task, hollonId: string): Promise<Task> {
    const result = await this.taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({
        assignedHolonId: hollonId,
        status: 'in_progress',
        startedAt: new Date(),
      })
      .where('id = :id', { id: task.id })
      .andWhere('(assigned_holon_id IS NULL OR assigned_holon_id = :hollonId)', {
        hollonId,
      })
      .execute();

    if (result.affected === 0) {
      // 다른 홀론이 먼저 가져감 - 재시도
      return this.pullNextTask(hollonId);
    }

    return this.taskRepo.findOne({ where: { id: task.id } });
  }

  /**
   * 의존성 체크 서브쿼리
   * 블로킹 태스크가 모두 완료되어야 함
   */
  private buildDependencyCheck(): string {
    return `NOT EXISTS (
      SELECT 1 FROM task_dependencies td
      INNER JOIN tasks blocker ON blocker.id = td.depends_on_task_id
      WHERE td.task_id = task.id
        AND td.dependency_type = 'blocks'
        AND blocker.status NOT IN ('done', 'cancelled')
    )`;
  }

  /**
   * 우선순위 정렬
   */
  private buildPriorityOrder(): { [key: string]: 'ASC' | 'DESC' } {
    return {
      'CASE task.priority WHEN \'urgent\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 WHEN \'low\' THEN 4 ELSE 5 END':
        'ASC',
      'task.due_date': 'ASC',
      'task.created_at': 'ASC',
    };
  }

  /**
   * 태스크 완료 및 Memory 자동 생성
   */
  async completeTask(
    taskId: string,
    hollonId: string,
    result: TaskResult,
  ): Promise<void> {
    await this.taskRepo.update(taskId, {
      status: 'done',
      completedAt: new Date(),
    });

    // 복잡도가 높은 태스크는 자동으로 Memory 생성
    if (result.complexity >= 7 || result.learnings) {
      await this.createTaskMemory(taskId, hollonId, result);
    }
  }

  private async createTaskMemory(
    taskId: string,
    hollonId: string,
    result: TaskResult,
  ): Promise<void> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['project'],
    });

    const document = this.documentRepo.create({
      organizationId: task.project.organizationId,
      name: `Task #${task.number} 완료 기록`,
      content: result.summary,
      summary: result.learnings,
      docType: 'memory',
      scope: 'hollon',
      scopeId: hollonId,
      keywords: result.keywords || [],
      importance: Math.min(result.complexity, 10),
      autoGenerated: true,
      sourceTaskId: taskId,
      sourceHollonId: hollonId,
    });

    await this.documentRepo.save(document);
  }
}

interface TaskResult {
  summary: string;
  learnings?: string;
  keywords?: string[];
  complexity: number;
}
```

---

## 8. 홀론 오케스트레이션

### 8.1 홀론 실행 사이클 (SSOT 5.1 구현)

홀론의 핵심 실행 사이클을 관리하는 오케스트레이터:

```typescript
@Injectable()
export class HollonOrchestratorService {
  constructor(
    private readonly taskPoolService: TaskPoolService,
    private readonly promptComposer: PromptComposerService,
    private readonly brainFactory: BrainProviderFactory,
    private readonly taskAnalyzer: TaskAnalyzerService,
    private readonly qualityGate: QualityGateService,
    private readonly escalationService: EscalationService,
    private readonly costService: CostService,
    private readonly hollonRepo: Repository<Hollon>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 홀론 실행 사이클 시작
   * Single Context 원칙: 하나의 컨텍스트에서 하나의 태스크 완료
   */
  async startHollonCycle(hollonId: string): Promise<void> {
    const hollon = await this.hollonRepo.findOne({
      where: { id: hollonId },
      relations: ['role', 'team', 'organization'],
    });

    if (!hollon) throw new Error(`Hollon not found: ${hollonId}`);

    // 상태를 running으로 변경
    await this.updateHollonStatus(hollonId, 'running');

    try {
      // 메인 실행 루프
      await this.runCycleLoop(hollon);
    } catch (error) {
      await this.handleCycleError(hollon, error);
    }
  }

  /**
   * 메인 실행 루프
   * Task Pull → Context 시작 → 작업 수행 → 결과 저장 → Context 종료 → 반복
   */
  private async runCycleLoop(hollon: Hollon): Promise<void> {
    while (true) {
      // 1. Task Pull
      const task = await this.taskPoolService.pullNextTask(hollon.id);

      if (!task) {
        // 할 일 없음 → idle 상태로 전환
        await this.updateHollonStatus(hollon.id, 'idle');
        this.eventEmitter.emit('hollon.idle', { hollonId: hollon.id });
        break;
      }

      // 2. 태스크 실행
      const result = await this.executeTask(hollon, task);

      // 3. 결과에 따른 분기
      if (result.status === 'completed') {
        await this.handleTaskCompletion(hollon, task, result);
      } else if (result.status === 'needs_subtasks') {
        await this.handleSubtaskCreation(hollon, task, result);
      } else if (result.status === 'needs_escalation') {
        await this.escalationService.escalate(hollon, task, result.escalationReason);
      } else if (result.status === 'failed') {
        await this.handleTaskFailure(hollon, task, result);
      }

      // 4. 다음 사이클로 (Context 종료 후 새 Context 시작)
    }
  }

  /**
   * 단일 태스크 실행
   */
  private async executeTask(hollon: Hollon, task: Task): Promise<TaskExecutionResult> {
    // 1. 복잡도 분석 (서브태스크 분할 필요 여부)
    const analysis = await this.taskAnalyzer.analyze(task, hollon);

    if (analysis.shouldSplit) {
      return {
        status: 'needs_subtasks',
        subtasks: analysis.suggestedSubtasks,
      };
    }

    // 2. 프롬프트 합성 (6계층)
    const composedPrompt = await this.promptComposer.composePrompt(hollon.id, task.id);

    // 3. Brain Provider 획득 및 실행
    const brain = await this.brainFactory.getProviderForHollon(hollon);

    const response = await brain.execute({
      systemPrompt: composedPrompt.systemPrompt,
      messages: [
        { role: 'user', content: this.buildTaskPrompt(task) },
      ],
      workingDirectory: hollon.role?.allowedPaths?.[0],
      timeout: this.calculateTimeout(analysis.estimatedComplexity),
    });

    // 4. 비용 기록
    await this.costService.recordCost({
      hollonId: hollon.id,
      taskId: task.id,
      brainProviderType: brain.meta.type,
      usage: response.usage,
      costCents: response.costCents,
    });

    // 5. 품질 검증
    const validation = await this.qualityGate.validate(task, response);

    if (!validation.passed) {
      if (validation.canRetry) {
        // 재시도 가능 → 다시 실행
        return this.retryTask(hollon, task, validation.feedback);
      }
      return {
        status: 'needs_escalation',
        escalationReason: validation.reason,
      };
    }

    return {
      status: 'completed',
      output: response.content,
      usage: response.usage,
      learnings: this.extractLearnings(response),
    };
  }

  /**
   * 태스크 완료 처리
   */
  private async handleTaskCompletion(
    hollon: Hollon,
    task: Task,
    result: TaskExecutionResult,
  ): Promise<void> {
    // 태스크 상태 업데이트
    await this.taskPoolService.completeTask(task.id, hollon.id, {
      summary: result.output,
      learnings: result.learnings,
      complexity: result.complexity || 5,
    });

    // 이벤트 발행
    this.eventEmitter.emit('task.completed', {
      taskId: task.id,
      hollonId: hollon.id,
      result,
    });
  }

  /**
   * 서브태스크 생성 처리
   */
  private async handleSubtaskCreation(
    hollon: Hollon,
    parentTask: Task,
    result: TaskExecutionResult,
  ): Promise<void> {
    for (const subtask of result.subtasks) {
      await this.taskPoolService.createSubtask(parentTask.id, {
        title: subtask.title,
        description: subtask.description,
        priority: subtask.priority || parentTask.priority,
      });
    }

    // 부모 태스크는 대기 상태로
    await this.taskPoolService.updateTaskStatus(parentTask.id, 'waiting');
  }

  /**
   * 태스크 실패 처리
   */
  private async handleTaskFailure(
    hollon: Hollon,
    task: Task,
    result: TaskExecutionResult,
  ): Promise<void> {
    // 에스컬레이션 시도
    const escalationResult = await this.escalationService.escalate(
      hollon,
      task,
      result.error,
    );

    if (!escalationResult.handled) {
      // 최종 실패 → 인간 개입 요청
      await this.requestHumanIntervention(hollon, task, result);
    }
  }

  /**
   * 홀론 상태 업데이트
   */
  private async updateHollonStatus(
    hollonId: string,
    status: Hollon['status'],
  ): Promise<void> {
    await this.hollonRepo.update(hollonId, { status });
    this.eventEmitter.emit('hollon.status_changed', { hollonId, status });
  }

  private buildTaskPrompt(task: Task): string {
    return `
## 현재 태스크

**Task #${task.number}**: ${task.title}

### 설명
${task.description || '설명 없음'}

### 우선순위
${task.priority}

### 기한
${task.dueDate ? task.dueDate.toISOString().split('T')[0] : '없음'}

---

위 태스크를 수행해주세요. 완료 후 결과를 상세히 보고해주세요.
`.trim();
  }

  private calculateTimeout(complexity: number): number {
    // 복잡도에 따른 타임아웃 (분 단위)
    const baseMinutes = 5;
    const maxMinutes = 30;
    return Math.min(baseMinutes + complexity * 2, maxMinutes) * 60 * 1000;
  }

  private extractLearnings(response: BrainResponse): string | undefined {
    // 응답에서 학습 내용 추출 (패턴 기반)
    const learningPatterns = [
      /학습한 내용:(.+?)(?=\n\n|$)/s,
      /배운 점:(.+?)(?=\n\n|$)/s,
      /향후 참고:(.+?)(?=\n\n|$)/s,
    ];

    for (const pattern of learningPatterns) {
      const match = response.content.match(pattern);
      if (match) return match[1].trim();
    }
    return undefined;
  }
}

interface TaskExecutionResult {
  status: 'completed' | 'needs_subtasks' | 'needs_escalation' | 'failed';
  output?: string;
  usage?: { inputTokens: number; outputTokens: number };
  learnings?: string;
  complexity?: number;
  subtasks?: Array<{ title: string; description: string; priority?: string }>;
  escalationReason?: string;
  error?: string;
}
```

### 8.2 태스크 분석 서비스 (SSOT 5.2 구현)

태스크 복잡도 분석 및 분할 결정:

```typescript
@Injectable()
export class TaskAnalyzerService {
  constructor(
    private readonly brainFactory: BrainProviderFactory,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  /**
   * 태스크 복잡도 분석
   */
  async analyze(task: Task, hollon: Hollon): Promise<TaskAnalysis> {
    // 1. 기본 휴리스틱 분석
    const heuristicScore = this.calculateHeuristicComplexity(task);

    // 단순한 태스크는 LLM 호출 없이 바로 처리
    if (heuristicScore < 3) {
      return {
        shouldSplit: false,
        estimatedComplexity: heuristicScore,
        estimatedTokens: this.estimateTokens(task),
        estimatedMinutes: heuristicScore * 5,
      };
    }

    // 2. LLM 기반 심층 분석
    const brain = await this.brainFactory.getAnalyzerBrain();
    const analysisPrompt = this.buildAnalysisPrompt(task, hollon);

    const response = await brain.execute({
      systemPrompt: TASK_ANALYZER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    return this.parseAnalysisResponse(response.content, heuristicScore);
  }

  /**
   * 휴리스틱 복잡도 계산
   */
  private calculateHeuristicComplexity(task: Task): number {
    let score = 1;

    // 설명 길이
    const descLength = task.description?.length || 0;
    if (descLength > 1000) score += 2;
    else if (descLength > 500) score += 1;

    // 우선순위
    if (task.priority === 'urgent') score += 2;
    else if (task.priority === 'high') score += 1;

    // 기존 서브태스크 여부
    const hasSubtasks = task.parentTaskId === null; // 부모 태스크인 경우
    if (hasSubtasks) score += 1;

    // 키워드 기반 복잡도
    const complexKeywords = ['refactor', 'migrate', 'architecture', 'integration', 'security'];
    const titleLower = task.title.toLowerCase();
    const descLower = (task.description || '').toLowerCase();

    for (const keyword of complexKeywords) {
      if (titleLower.includes(keyword) || descLower.includes(keyword)) {
        score += 1;
      }
    }

    return Math.min(score, 10);
  }

  private estimateTokens(task: Task): number {
    const baseTokens = 1000;
    const descTokens = Math.ceil((task.description?.length || 0) / 4);
    return baseTokens + descTokens;
  }

  private buildAnalysisPrompt(task: Task, hollon: Hollon): string {
    return `
## 태스크 분석 요청

**태스크**: ${task.title}
**설명**: ${task.description || '없음'}
**우선순위**: ${task.priority}

**수행 홀론 역할**: ${hollon.role?.name}
**홀론 capabilities**: ${hollon.role?.capabilities?.join(', ') || '없음'}

---

이 태스크를 분석하여 다음을 판단해주세요:

1. **복잡도** (1-10): 예상 난이도
2. **분할 필요 여부**: 서브태스크로 나눠야 하는가?
3. **예상 토큰**: 완료에 필요한 예상 토큰 수
4. **예상 시간**: 완료에 필요한 예상 시간 (분)
5. **필요 도메인**: 필요한 전문 지식 영역
6. **서브태스크 제안** (분할 필요 시): 구체적인 서브태스크 목록

JSON 형식으로 응답해주세요.
`.trim();
  }

  private parseAnalysisResponse(content: string, fallbackScore: number): TaskAnalysis {
    try {
      // JSON 블록 추출
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                        content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return {
          shouldSplit: parsed.shouldSplit || parsed.splitRequired || false,
          estimatedComplexity: parsed.complexity || parsed.estimatedComplexity || fallbackScore,
          estimatedTokens: parsed.estimatedTokens || 2000,
          estimatedMinutes: parsed.estimatedMinutes || parsed.estimatedTime || 15,
          requiredDomains: parsed.requiredDomains || parsed.domains || [],
          suggestedSubtasks: parsed.subtasks || parsed.suggestedSubtasks || [],
        };
      }
    } catch (e) {
      // 파싱 실패 시 기본값
    }

    return {
      shouldSplit: false,
      estimatedComplexity: fallbackScore,
      estimatedTokens: 2000,
      estimatedMinutes: 15,
    };
  }
}

interface TaskAnalysis {
  shouldSplit: boolean;
  estimatedComplexity: number;
  estimatedTokens: number;
  estimatedMinutes: number;
  requiredDomains?: string[];
  suggestedSubtasks?: Array<{
    title: string;
    description: string;
    priority?: string;
  }>;
}

const TASK_ANALYZER_SYSTEM_PROMPT = `
당신은 태스크 분석 전문가입니다. 주어진 태스크의 복잡도를 분석하고,
필요시 서브태스크로 분할하는 것을 권장합니다.

분할 기준:
- 복잡도 7 이상: 분할 권장
- 서로 다른 도메인 지식 필요: 분할 권장
- 예상 시간 30분 이상: 분할 고려
- 명확히 독립적인 단계가 있음: 분할 권장

응답은 반드시 JSON 형식으로 해주세요.
`.trim();
```

### 8.3 에스컬레이션 서비스 (SSOT 8.3 구현)

5단계 에스컬레이션 계층 구현:

```typescript
@Injectable()
export class EscalationService {
  constructor(
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(ApprovalRequest)
    private readonly approvalRepo: Repository<ApprovalRequest>,
    private readonly messageService: MessageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 에스컬레이션 실행
   * Level 1: 자기 해결 → Level 2: 팀 내 협업 → Level 3: 팀 리더 →
   * Level 4: 상위 팀 → Level 5: 인간 개입
   */
  async escalate(
    hollon: Hollon,
    task: Task,
    reason: string,
    startLevel: EscalationLevel = EscalationLevel.SELF,
  ): Promise<EscalationResult> {
    let currentLevel = startLevel;

    while (currentLevel <= EscalationLevel.HUMAN) {
      const result = await this.tryLevel(currentLevel, hollon, task, reason);

      if (result.handled) {
        this.eventEmitter.emit('escalation.resolved', {
          hollonId: hollon.id,
          taskId: task.id,
          level: currentLevel,
          resolution: result.resolution,
        });
        return result;
      }

      // 다음 레벨로 에스컬레이션
      currentLevel++;

      this.eventEmitter.emit('escalation.elevated', {
        hollonId: hollon.id,
        taskId: task.id,
        fromLevel: currentLevel - 1,
        toLevel: currentLevel,
        reason,
      });
    }

    // 모든 레벨 실패 → 인간 개입 대기
    return {
      handled: false,
      level: EscalationLevel.HUMAN,
      pendingApprovalId: await this.createHumanApprovalRequest(hollon, task, reason),
    };
  }

  /**
   * 각 레벨별 에스컬레이션 시도
   */
  private async tryLevel(
    level: EscalationLevel,
    hollon: Hollon,
    task: Task,
    reason: string,
  ): Promise<EscalationResult> {
    switch (level) {
      case EscalationLevel.SELF:
        return this.trySelfResolution(hollon, task, reason);

      case EscalationLevel.TEAM_COLLABORATION:
        return this.tryTeamCollaboration(hollon, task, reason);

      case EscalationLevel.TEAM_LEADER:
        return this.tryTeamLeader(hollon, task, reason);

      case EscalationLevel.UPPER_TEAM:
        return this.tryUpperTeam(hollon, task, reason);

      case EscalationLevel.HUMAN:
        return this.requestHumanIntervention(hollon, task, reason);

      default:
        return { handled: false, level };
    }
  }

  /**
   * Level 1: 자기 해결
   * 재시도, 대안 탐색
   */
  private async trySelfResolution(
    hollon: Hollon,
    task: Task,
    reason: string,
  ): Promise<EscalationResult> {
    // 재시도 횟수 확인
    const retryCount = await this.getRetryCount(hollon.id, task.id);

    if (retryCount < 3) {
      // 재시도 가능
      return {
        handled: true,
        level: EscalationLevel.SELF,
        resolution: 'retry',
        action: { type: 'retry', attempt: retryCount + 1 },
      };
    }

    // 재시도 한도 초과
    return { handled: false, level: EscalationLevel.SELF };
  }

  /**
   * Level 2: 팀 내 협업
   * 같은 팀 홀론에게 도움 요청
   */
  private async tryTeamCollaboration(
    hollon: Hollon,
    task: Task,
    reason: string,
  ): Promise<EscalationResult> {
    if (!hollon.teamId) {
      return { handled: false, level: EscalationLevel.TEAM_COLLABORATION };
    }

    // 같은 팀의 idle 상태 홀론 찾기
    const availableTeammates = await this.hollonRepo.find({
      where: {
        teamId: hollon.teamId,
        status: 'idle',
        id: Not(hollon.id),
      },
      relations: ['role'],
    });

    if (availableTeammates.length === 0) {
      return { handled: false, level: EscalationLevel.TEAM_COLLABORATION };
    }

    // 가장 적합한 팀원 선택 (역할 기반)
    const helper = this.selectBestHelper(availableTeammates, task);

    if (helper) {
      // 도움 요청 메시지 전송
      await this.messageService.send({
        fromHollonId: hollon.id,
        toHollonId: helper.id,
        messageType: 'collaboration_request',
        content: `
도움 요청: ${task.title}

문제 상황:
${reason}

원래 담당 홀론: ${hollon.name}

도움이 필요합니다.
        `.trim(),
        relatedTaskId: task.id,
      });

      return {
        handled: true,
        level: EscalationLevel.TEAM_COLLABORATION,
        resolution: 'collaboration_requested',
        action: { type: 'collaborate', helperId: helper.id },
      };
    }

    return { handled: false, level: EscalationLevel.TEAM_COLLABORATION };
  }

  /**
   * Level 3: 팀 리더 판단
   * 팀 리더 홀론에게 판단 요청
   */
  private async tryTeamLeader(
    hollon: Hollon,
    task: Task,
    reason: string,
  ): Promise<EscalationResult> {
    if (!hollon.teamId) {
      return { handled: false, level: EscalationLevel.TEAM_LEADER };
    }

    const team = await this.teamRepo.findOne({
      where: { id: hollon.teamId },
      relations: ['leaderHollon'],
    });

    if (!team?.leaderHollonId || team.leaderHollonId === hollon.id) {
      // 리더가 없거나 자신이 리더
      return { handled: false, level: EscalationLevel.TEAM_LEADER };
    }

    // 팀 리더에게 판단 요청
    await this.messageService.send({
      fromHollonId: hollon.id,
      toHollonId: team.leaderHollonId,
      messageType: 'escalation_request',
      content: `
에스컬레이션 요청: ${task.title}

문제 상황:
${reason}

요청 홀론: ${hollon.name}
현재 상태: 팀 내 협업으로 해결 불가

팀 리더로서 판단이 필요합니다:
1. 우선순위 조정
2. 리소스 재배치
3. 태스크 재할당
4. 상위 에스컬레이션
      `.trim(),
      relatedTaskId: task.id,
      requiresResponse: true,
    });

    return {
      handled: true,
      level: EscalationLevel.TEAM_LEADER,
      resolution: 'escalated_to_leader',
      action: { type: 'leader_decision', leaderId: team.leaderHollonId },
    };
  }

  /**
   * Level 4: 상위 팀/조직 레벨
   */
  private async tryUpperTeam(
    hollon: Hollon,
    task: Task,
    reason: string,
  ): Promise<EscalationResult> {
    if (!hollon.teamId) {
      return { handled: false, level: EscalationLevel.UPPER_TEAM };
    }

    const team = await this.teamRepo.findOne({
      where: { id: hollon.teamId },
    });

    if (!team?.parentTeamId) {
      // 상위 팀이 없음
      return { handled: false, level: EscalationLevel.UPPER_TEAM };
    }

    const parentTeam = await this.teamRepo.findOne({
      where: { id: team.parentTeamId },
      relations: ['leaderHollon'],
    });

    if (!parentTeam?.leaderHollonId) {
      return { handled: false, level: EscalationLevel.UPPER_TEAM };
    }

    // 상위 팀 리더에게 에스컬레이션
    await this.messageService.send({
      fromHollonId: hollon.id,
      toHollonId: parentTeam.leaderHollonId,
      messageType: 'escalation_request',
      content: `
상위 에스컬레이션: ${task.title}

원래 팀: ${team.name}
문제 상황:
${reason}

팀 레벨에서 해결 불가하여 상위 팀에 에스컬레이션합니다.
조직 차원의 판단이 필요합니다.
      `.trim(),
      relatedTaskId: task.id,
      requiresResponse: true,
    });

    return {
      handled: true,
      level: EscalationLevel.UPPER_TEAM,
      resolution: 'escalated_to_upper_team',
      action: { type: 'upper_team_decision', teamId: parentTeam.id },
    };
  }

  /**
   * Level 5: 인간 개입 요청
   */
  private async requestHumanIntervention(
    hollon: Hollon,
    task: Task,
    reason: string,
  ): Promise<EscalationResult> {
    const approvalId = await this.createHumanApprovalRequest(hollon, task, reason);

    return {
      handled: true, // 요청은 생성됨
      level: EscalationLevel.HUMAN,
      resolution: 'human_intervention_requested',
      action: { type: 'await_human', approvalId },
    };
  }

  private async createHumanApprovalRequest(
    hollon: Hollon,
    task: Task,
    reason: string,
  ): Promise<string> {
    const approval = this.approvalRepo.create({
      hollonId: hollon.id,
      requestType: 'escalation',
      description: `태스크 에스컬레이션: ${task.title}`,
      reasoning: reason,
      riskLevel: 'high',
      affectedEntities: [{ type: 'task', id: task.id }],
      escalated: true,
      escalatedAt: new Date(),
    });

    const saved = await this.approvalRepo.save(approval);

    this.eventEmitter.emit('approval.requested', {
      approvalId: saved.id,
      type: 'escalation',
      hollonId: hollon.id,
      taskId: task.id,
    });

    return saved.id;
  }

  private selectBestHelper(candidates: Hollon[], task: Task): Hollon | null {
    // 태스크 라벨과 역할 capabilities 매칭
    // 간단한 구현: 첫 번째 가능한 홀론 반환
    return candidates[0] || null;
  }

  private async getRetryCount(hollonId: string, taskId: string): Promise<number> {
    // 태스크 로그에서 재시도 횟수 조회
    // 실제 구현 시 task_logs 테이블 활용
    return 0;
  }
}

enum EscalationLevel {
  SELF = 1,
  TEAM_COLLABORATION = 2,
  TEAM_LEADER = 3,
  UPPER_TEAM = 4,
  HUMAN = 5,
}

interface EscalationResult {
  handled: boolean;
  level: EscalationLevel;
  resolution?: string;
  action?: {
    type: string;
    [key: string]: any;
  };
  pendingApprovalId?: string;
}
```

### 8.4 품질 게이트 서비스 (SSOT 8.4 구현)

자율 운영의 품질 검증:

```typescript
@Injectable()
export class QualityGateService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly costService: CostService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 태스크 완료 품질 검증
   */
  async validate(task: Task, response: BrainResponse): Promise<ValidationResult> {
    const gates: GateCheck[] = [
      this.checkOutputExists(response),
      this.checkOutputFormat(task, response),
      await this.checkCostBudget(task, response),
      await this.checkTimeLimit(task),
      await this.checkDependencies(task),
    ];

    const failedGates = gates.filter(g => !g.passed);

    if (failedGates.length === 0) {
      return { passed: true };
    }

    // 실패한 게이트 분석
    const canRetry = failedGates.some(g => g.canRetry);
    const reasons = failedGates.map(g => g.reason).join('; ');

    return {
      passed: false,
      canRetry,
      reason: reasons,
      feedback: this.generateFeedback(failedGates),
      failedGates: failedGates.map(g => g.name),
    };
  }

  /**
   * Gate 1: 결과물 존재 검증
   */
  private checkOutputExists(response: BrainResponse): GateCheck {
    const hasContent = response.content && response.content.trim().length > 0;

    return {
      name: 'output_exists',
      passed: hasContent,
      canRetry: true,
      reason: hasContent ? '' : '결과물이 비어있습니다',
    };
  }

  /**
   * Gate 2: 결과물 포맷 검증
   */
  private checkOutputFormat(task: Task, response: BrainResponse): GateCheck {
    // 태스크 유형에 따른 포맷 검증
    const content = response.content;

    // 코드 태스크: 코드 블록 포함 여부
    const isCodeTask = this.isCodeRelatedTask(task);
    if (isCodeTask) {
      const hasCodeBlock = /```[\s\S]*```/.test(content);
      if (!hasCodeBlock) {
        return {
          name: 'output_format',
          passed: false,
          canRetry: true,
          reason: '코드 태스크이나 코드 블록이 없습니다',
        };
      }
    }

    // 분석 태스크: 섹션 구조 여부
    const isAnalysisTask = this.isAnalysisTask(task);
    if (isAnalysisTask) {
      const hasSections = /^##?\s/m.test(content);
      if (!hasSections) {
        return {
          name: 'output_format',
          passed: false,
          canRetry: true,
          reason: '분석 태스크이나 구조화된 섹션이 없습니다',
        };
      }
    }

    return { name: 'output_format', passed: true, canRetry: false, reason: '' };
  }

  /**
   * Gate 3: 비용 예산 검증
   */
  private async checkCostBudget(task: Task, response: BrainResponse): Promise<GateCheck> {
    if (!response.costCents) {
      return { name: 'cost_budget', passed: true, canRetry: false, reason: '' };
    }

    // 태스크별 비용 한도 확인
    const project = await this.taskRepo.findOne({
      where: { id: task.id },
      relations: ['project', 'project.team', 'project.team.organization'],
    });

    const dailyLimit = project?.project?.team?.organization?.costLimitDailyCents;
    if (!dailyLimit) {
      return { name: 'cost_budget', passed: true, canRetry: false, reason: '' };
    }

    const todayUsage = await this.costService.getTodayUsage(
      project.project.team.organization.id,
    );

    if (todayUsage + response.costCents > dailyLimit) {
      return {
        name: 'cost_budget',
        passed: false,
        canRetry: false, // 비용 초과는 재시도로 해결 불가
        reason: `일일 비용 한도 초과 (${todayUsage}/${dailyLimit} cents)`,
      };
    }

    return { name: 'cost_budget', passed: true, canRetry: false, reason: '' };
  }

  /**
   * Gate 4: 시간 제한 검증 (SLA)
   */
  private async checkTimeLimit(task: Task): Promise<GateCheck> {
    if (!task.dueDate) {
      return { name: 'time_limit', passed: true, canRetry: false, reason: '' };
    }

    const now = new Date();
    const dueDate = new Date(task.dueDate);

    if (now > dueDate) {
      return {
        name: 'time_limit',
        passed: false,
        canRetry: false,
        reason: `기한 초과: ${dueDate.toISOString().split('T')[0]}`,
      };
    }

    // 기한 임박 경고 (24시간 이내)
    const hoursRemaining = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursRemaining < 24) {
      // 경고만, 실패 아님
      return {
        name: 'time_limit',
        passed: true,
        canRetry: false,
        reason: '',
        warning: `기한 임박: ${Math.round(hoursRemaining)}시간 남음`,
      };
    }

    return { name: 'time_limit', passed: true, canRetry: false, reason: '' };
  }

  /**
   * Gate 5: 의존성 검증
   */
  private async checkDependencies(task: Task): Promise<GateCheck> {
    const blockers = await this.taskRepo
      .createQueryBuilder('t')
      .innerJoin('task_dependencies', 'td', 'td.depends_on_task_id = t.id')
      .where('td.task_id = :taskId', { taskId: task.id })
      .andWhere('td.dependency_type = :type', { type: 'blocks' })
      .andWhere('t.status NOT IN (:...doneStatuses)', { doneStatuses: ['done', 'cancelled'] })
      .getMany();

    if (blockers.length > 0) {
      return {
        name: 'dependencies',
        passed: false,
        canRetry: false,
        reason: `블로킹 태스크 미완료: ${blockers.map(b => `#${b.number}`).join(', ')}`,
      };
    }

    return { name: 'dependencies', passed: true, canRetry: false, reason: '' };
  }

  /**
   * 실패 피드백 생성
   */
  private generateFeedback(failedGates: GateCheck[]): string {
    const feedbackParts = failedGates.map(gate => {
      switch (gate.name) {
        case 'output_exists':
          return '결과물을 생성해주세요.';
        case 'output_format':
          return '결과물 형식을 확인해주세요. ' + gate.reason;
        case 'cost_budget':
          return '비용 한도를 초과했습니다. 더 효율적인 방법을 찾아주세요.';
        case 'time_limit':
          return '기한이 지났습니다. 우선순위를 조정해주세요.';
        case 'dependencies':
          return '의존하는 태스크가 완료되지 않았습니다.';
        default:
          return gate.reason;
      }
    });

    return feedbackParts.join('\n');
  }

  private isCodeRelatedTask(task: Task): boolean {
    const codeKeywords = ['구현', 'implement', '개발', 'develop', '코드', 'code', 'fix', '수정', 'refactor'];
    const text = `${task.title} ${task.description || ''}`.toLowerCase();
    return codeKeywords.some(k => text.includes(k));
  }

  private isAnalysisTask(task: Task): boolean {
    const analysisKeywords = ['분석', 'analysis', '조사', 'research', '검토', 'review', '설계', 'design'];
    const text = `${task.title} ${task.description || ''}`.toLowerCase();
    return analysisKeywords.some(k => text.includes(k));
  }
}

interface GateCheck {
  name: string;
  passed: boolean;
  canRetry: boolean;
  reason: string;
  warning?: string;
}

interface ValidationResult {
  passed: boolean;
  canRetry?: boolean;
  reason?: string;
  feedback?: string;
  failedGates?: string[];
}
```

---

## 9. NestJS 프로젝트 구조

### 9.1 디렉토리 구조

```
apps/
├── web/                          # Next.js 프론트엔드
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── org/[orgId]/
│   │   │   │   ├── page.tsx     # 조직도 뷰
│   │   │   │   ├── hollons/
│   │   │   │   ├── projects/
│   │   │   │   └── documents/
│   │   │   └── layout.tsx
│   │   └── api/                  # Next.js API Routes (BFF)
│   ├── components/
│   └── lib/
│
└── server/                       # NestJS 백엔드
    ├── src/
    │   ├── main.ts
    │   ├── app.module.ts
    │   │
    │   ├── common/
    │   │   ├── decorators/
    │   │   ├── filters/
    │   │   ├── guards/
    │   │   └── interceptors/
    │   │
    │   ├── config/
    │   │   ├── database.config.ts
    │   │   └── brain-provider.config.ts
    │   │
    │   ├── modules/
    │   │   ├── organization/
    │   │   │   ├── organization.module.ts
    │   │   │   ├── organization.controller.ts
    │   │   │   ├── organization.service.ts
    │   │   │   └── entities/
    │   │   │       └── organization.entity.ts
    │   │   │
    │   │   ├── hollon/
    │   │   │   ├── hollon.module.ts
    │   │   │   ├── hollon.controller.ts
    │   │   │   ├── hollon.service.ts
    │   │   │   ├── hollon-lifecycle.service.ts
    │   │   │   └── entities/
    │   │   │       └── hollon.entity.ts
    │   │   │
    │   │   ├── brain-provider/
    │   │   │   ├── brain-provider.module.ts
    │   │   │   ├── brain-provider.factory.ts
    │   │   │   ├── providers/
    │   │   │   │   ├── claude-code.provider.ts
    │   │   │   │   ├── claude-api.provider.ts
    │   │   │   │   └── base.provider.ts
    │   │   │   └── interfaces/
    │   │   │       └── brain-provider.interface.ts
    │   │   │
    │   │   ├── task/
    │   │   │   ├── task.module.ts
    │   │   │   ├── task.controller.ts
    │   │   │   ├── task.service.ts
    │   │   │   ├── task-pool.service.ts
    │   │   │   ├── task-analyzer.service.ts
    │   │   │   └── entities/
    │   │   │
    │   │   ├── orchestration/
    │   │   │   ├── orchestration.module.ts
    │   │   │   ├── hollon-orchestrator.service.ts
    │   │   │   └── interfaces/
    │   │   │       └── execution-result.interface.ts
    │   │   │
    │   │   ├── escalation/
    │   │   │   ├── escalation.module.ts
    │   │   │   ├── escalation.service.ts
    │   │   │   └── interfaces/
    │   │   │       └── escalation-request.interface.ts
    │   │   │
    │   │   ├── quality-gate/
    │   │   │   ├── quality-gate.module.ts
    │   │   │   ├── quality-gate.service.ts
    │   │   │   └── interfaces/
    │   │   │       └── gate-check.interface.ts
    │   │   │
    │   │   ├── document/
    │   │   │   ├── document.module.ts
    │   │   │   ├── document.controller.ts
    │   │   │   ├── document.service.ts
    │   │   │   ├── memory.service.ts
    │   │   │   └── entities/
    │   │   │
    │   │   ├── prompt/
    │   │   │   ├── prompt.module.ts
    │   │   │   └── prompt-composer.service.ts
    │   │   │
    │   │   ├── message/
    │   │   │   ├── message.module.ts
    │   │   │   ├── message.controller.ts
    │   │   │   ├── message.service.ts
    │   │   │   └── message.gateway.ts  # WebSocket
    │   │   │
    │   │   └── realtime/
    │   │       ├── realtime.module.ts
    │   │       ├── pg-notify.service.ts
    │   │       └── websocket.gateway.ts
    │   │
    │   └── database/
    │       ├── migrations/
    │       └── seeds/
    │
    └── test/
```

### 9.2 TypeORM Entity 예시

```typescript
// hollon.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('hollons')
export class Hollon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'role_id' })
  roleId: string;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ name: 'team_id', nullable: true })
  teamId?: string;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'team_id' })
  team?: Team;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'parent_id', nullable: true })
  parentId?: string;

  @ManyToOne(() => Hollon, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Hollon;

  @OneToMany(() => Hollon, hollon => hollon.parent)
  children: Hollon[];

  @Column({
    type: 'enum',
    enum: ['permanent', 'temporary'],
  })
  lifecycle: 'permanent' | 'temporary';

  @Column({
    type: 'enum',
    enum: ['idle', 'running', 'waiting', 'terminated', 'error'],
    default: 'idle',
  })
  status: 'idle' | 'running' | 'waiting' | 'terminated' | 'error';

  @Column({ name: 'custom_prompt', type: 'text', nullable: true })
  customPrompt?: string;

  @Column({ name: 'custom_capabilities', type: 'jsonb', nullable: true })
  customCapabilities?: string[];

  @Column({ name: 'brain_provider_config_id', nullable: true })
  brainProviderConfigId?: string;

  @Column({ nullable: true })
  pid?: number;

  @Column({ name: 'process_started_at', type: 'timestamptz', nullable: true })
  processStartedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 9.3 Prisma Schema 예시 (대안)

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organization {
  id                          String   @id @default(uuid())
  name                        String
  contextPrompt               String?  @map("context_prompt")
  maxConcurrentHolons         Int      @default(10) @map("max_concurrent_holons")
  maxTotalHolons              Int      @default(100) @map("max_total_holons")
  costLimitDailyCents         Int?     @map("cost_limit_daily_cents")
  costLimitMonthlyCents       Int?     @map("cost_limit_monthly_cents")
  defaultBrainProviderConfigId String? @map("default_brain_provider_config_id")
  createdAt                   DateTime @default(now()) @map("created_at")
  updatedAt                   DateTime @updatedAt @map("updated_at")

  hollons  Hollon[]
  teams    Team[]
  roles    Role[]
  projects Project[]
  documents Document[]

  @@map("organizations")
}

model Hollon {
  id             String  @id @default(uuid())
  organizationId String  @map("organization_id")
  roleId         String  @map("role_id")
  teamId         String? @map("team_id")
  name           String
  parentId       String? @map("parent_id")

  lifecycle HollonLifecycle
  status    HollonStatus    @default(idle)

  customPrompt       String?  @map("custom_prompt")
  customCapabilities Json?    @map("custom_capabilities")
  brainProviderConfigId String? @map("brain_provider_config_id")

  pid              Int?
  processStartedAt DateTime? @map("process_started_at")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id])
  role         Role         @relation(fields: [roleId], references: [id])
  team         Team?        @relation(fields: [teamId], references: [id])
  parent       Hollon?      @relation("HollonHierarchy", fields: [parentId], references: [id])
  children     Hollon[]     @relation("HollonHierarchy")

  assignedTasks Task[] @relation("AssignedTasks")
  createdTasks  Task[] @relation("CreatedTasks")

  @@map("hollons")
}

model Document {
  id             String  @id @default(uuid())
  organizationId String  @map("organization_id")
  parentId       String? @map("parent_id")

  name    String
  content String?
  summary String?

  docType    DocumentType @default(spec) @map("doc_type")
  scope      DocumentScope @default(project)
  scopeId    String?       @map("scope_id")

  keywords      String[]  @default([])
  importance    Int       @default(5)
  autoGenerated Boolean   @default(false) @map("auto_generated")
  sourceTaskId  String?   @map("source_task_id")
  sourceHollonId String?  @map("source_hollon_id")

  accessCount    Int       @default(0) @map("access_count")
  lastAccessedAt DateTime? @map("last_accessed_at")
  expiresAt      DateTime? @map("expires_at")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id])
  parent       Document?    @relation("DocumentHierarchy", fields: [parentId], references: [id])
  children     Document[]   @relation("DocumentHierarchy")

  @@map("documents")
}

enum HollonLifecycle {
  permanent
  temporary
}

enum HollonStatus {
  idle
  running
  waiting
  terminated
  error
}

enum DocumentType {
  folder
  spec
  adr
  guide
  runbook
  memory
  postmortem
  meeting
  changelog
}

enum DocumentScope {
  organization
  team
  project
  hollon
}
```

---

## 10. 구현 로드맵

### Phase 1: MVP 코어 (자율 실행 엔진) - 6주

핵심 목표: **홀론이 태스크를 자율적으로 Pull → 실행 → 완료하는 사이클 구현**

```
Week 1-2: 인프라 및 데이터 계층
├── 모노레포 설정 (pnpm workspace + Turborepo)
├── Docker Compose (PostgreSQL 16)
├── NestJS 프로젝트 구조
├── TypeORM Entity 정의 (Organization, Team, Role, Hollon, Task)
└── 기본 CRUD API

Week 3-4: Brain Provider 및 오케스트레이션
├── IBrainProvider 인터페이스
├── ClaudeCodeProvider 구현
├── HollonOrchestratorService (태스크 사이클)
├── TaskPoolService (Pull 방식 태스크 할당)
└── PromptComposerService (6계층 프롬프트 합성)

Week 5-6: 품질 및 안전장치
├── QualityGateService (5가지 검증)
├── EscalationService (5단계 에스컬레이션)
├── TaskAnalyzerService (복잡도 분석, 서브태스크 분할)
├── FactCheckService (할루시네이션 방지)
├── DecisionLogService (일관성 보장)
├── ConsistencyEnforcer (스타일 일관성)
├── UncertaintyDecisionService (불확실성 의사결정)
├── 비용 추적 및 제한
└── Human Approval 플로우
```

**MVP 완료 기준**:
- 단일 홀론이 태스크를 Pull하여 Brain Provider로 실행
- 결과물 품질 검증 및 실패 시 재시도/에스컬레이션
- 비용 한도 초과 시 작업 중단
- 생성된 코드 컴파일/테스트 검증 통과

---

### Phase 2: 협업 시스템 - 6주

핵심 목표: **다수 홀론이 협업하여 프로젝트를 진행하는 메커니즘**

```
Week 7-8: 실시간 통신
├── PostgreSQL LISTEN/NOTIFY 연동
├── WebSocket Gateway
├── Message 시스템 (1:1, Channel)
└── 실시간 상태 동기화

Week 9-10: 정기 회의 자동화
├── MeetingScheduler (Cron 기반)
├── StandupService (일일 스탠드업)
├── SprintPlanningService
└── RetrospectiveService

Week 11-12: 협업 패턴
├── CollaborationService (페어 프로그래밍, 코드 리뷰)
├── CrossTeamCollaborationService (팀 간 Contract)
├── IncidentResponseService (P1-P4 긴급 대응)
└── ConflictResolutionService
```

**Phase 2 완료 기준**:
- 3+ 홀론이 동시에 프로젝트 진행
- 일일 스탠드업 리포트 자동 생성
- 팀 간 의존성 요청 및 계약 체결

---

### Phase 3: 전략-실행 연결 - 6주

핵심 목표: **고수준 목표가 실행 가능한 태스크로 자동 분해**

```
Week 13-14: 목표 관리 시스템
├── Goal Entity (OKR 구조)
├── GoalTrackingService
└── GoalReviewService

Week 15-16: 목표 → 태스크 분해
├── GoalDecompositionService
├── DependencyAnalyzer
└── ResourcePlanner

Week 17-18: 동적 우선순위 및 전략 변경 대응
├── PriorityRebalancerService
├── PivotResponseService (피벗 대응)
└── StrategyAdaptationService
```

**Phase 3 완료 기준**:
- 목표 입력 → 프로젝트/마일스톤/태스크 자동 생성
- 피벗 선언 시 영향 분석 자동화

---

### Phase 4: 학습 및 성장 - 6주

핵심 목표: **홀론과 조직이 경험에서 학습하여 지속 개선**

```
Week 19-20: 온보딩 시스템
├── OnboardingService
└── SkillMatrixService

Week 21-22: 지식 관리 고도화
├── KnowledgeExtractionService
├── KnowledgeGraphService
├── ExternalKnowledgeService
└── BestPracticeService

Week 23-24: 자기 개선 시스템
├── PerformanceAnalyzer
├── PromptOptimizer
└── ProcessImprovementService
```

---

### Phase 5: 웹 UI 및 외부 연동 - 6주

핵심 목표: **인간이 시스템을 모니터링하고 전략적 개입을 수행하는 인터페이스**

```
Week 25-26: 대시보드
├── Next.js 14 앱 설정
├── 조직도 뷰 (React Flow)
├── 프로젝트 대시보드
└── 홀론 상세 뷰

Week 27-28: 상호작용 인터페이스
├── 대화 인터페이스
├── 승인 센터
└── 목표 설정 UI

Week 29-30: 외부 연동
├── GitHubIntegrationService
├── SlackIntegrationService
└── WebhookService
```

---

### 로드맵 요약

| Phase | 기간 | 핵심 결과물 |
|-------|------|------------|
| **Phase 1** | 6주 | 자율 실행 엔진 |
| **Phase 2** | 6주 | 협업 시스템 |
| **Phase 3** | 6주 | 전략-실행 연결 |
| **Phase 4** | 6주 | 학습 및 성장 |
| **Phase 5** | 6주 | UI 및 외부 연동 |

**총 예상 기간**: 30주 (약 7-8개월)

---

### 마일스톤별 검증 시나리오

**M1 (Phase 1)**: "README 작성" 태스크를 홀론이 자율 수행
**M2 (Phase 2)**: 3명의 홀론이 "블로그 포스트 시리즈" 협업 완료
**M3 (Phase 3)**: "신규 API 엔드포인트 3개 추가" 목표 입력 → 자동 실행
**M4 (Phase 4)**: 동일 유형 태스크 5회 수행 후 효율성 20% 향상
**M5 (Phase 5)**: 인간이 대시보드에서 전략만 설정하면 팀이 자율 운영

---

## 11. LLM 한계 극복 서비스 상세

### 11.1 DecisionLogService

모든 중요 결정을 강제 기록하고, 동일 맥락에서 자동 참조합니다.

```typescript
@Injectable()
export class DecisionLogService {
  async recordDecision(decision: {
    hollonId: string;
    taskId?: string;
    projectId?: string;
    type: 'architecture' | 'naming' | 'process' | 'priority';
    question: string;
    options: string[];
    chosen: string;
    rationale: string;
  }): Promise<DecisionLog> {
    return this.decisionLogRepo.save(decision);
  }

  async findRelevantDecisions(context: {
    projectId?: string;
    keywords: string[];
    type?: string;
  }): Promise<DecisionLog[]> {
    // 동일 프로젝트/맥락의 기존 결정 검색
    // 프롬프트에 자동 주입
  }
}
```

### 11.2 FactCheckService

```typescript
@Injectable()
export class FactCheckService {
  async verify(result: TaskResult): Promise<VerificationResult> {
    const checks = [];

    // Level 1: 구문 검증
    checks.push(await this.verifySyntax(result));

    // Level 2: 실행 검증
    checks.push(await this.verifyExecution(result));

    // Level 3: 참조 검증 (패키지, API 등)
    checks.push(await this.verifyReferences(result));

    // Level 4: 의미 검증 (선택적)
    if (result.requiresSemanticCheck) {
      checks.push(await this.verifySemantics(result));
    }

    return this.aggregateResults(checks);
  }
}
```

### 11.3 ConsistencyEnforcer

```typescript
@Injectable()
export class ConsistencyEnforcer {
  async enforce(result: TaskResult, projectId: string): Promise<EnforcementResult> {
    const styleGuide = await this.getStyleGuide(projectId);
    const violations = await this.detectViolations(result, styleGuide);

    if (violations.autoFixable.length > 0) {
      return this.autoFix(result, violations.autoFixable);
    }

    if (violations.manual.length > 0) {
      return { status: 'needs_rework', violations: violations.manual };
    }

    return { status: 'passed' };
  }
}
```

---

## 12. 협업 서비스 상세

### 12.1 StandupService

```typescript
@Injectable()
export class StandupService {
  @Cron('0 9 * * 1-5') // 평일 09:00
  async runDailyStandup(): Promise<void> {
    const teams = await this.teamRepo.find();

    for (const team of teams) {
      const hollons = await this.getTeamHollons(team.id);
      const responses = await Promise.all(
        hollons.map(h => this.collectStatus(h))
      );

      const summary = await this.generateSummary(team, responses);
      await this.documentService.create({
        name: `standup-${team.name}-${today()}`,
        docType: 'meeting',
        content: summary,
        scope: 'team',
        scopeId: team.id,
      });
    }
  }
}
```

### 12.2 IncidentResponseService

```typescript
@Injectable()
export class IncidentResponseService {
  async handleIncident(incident: Incident): Promise<void> {
    // 1. 심각도 분류
    const severity = this.classifySeverity(incident);

    // 2. 자동 대응
    if (severity <= 2) { // P1, P2
      await this.pauseNonEssentialTasks();
      await this.notifyHumans(incident);
    }

    // 3. Owner 할당
    const owner = await this.assignOwner(incident);

    // 4. 영향 분석
    const impact = await this.analyzeImpact(incident);

    // 5. Postmortem 준비
    await this.preparePostmortem(incident, impact);
  }
}
```

### 12.3 PivotResponseService

```typescript
@Injectable()
export class PivotResponseService {
  async handlePivot(pivot: PivotDecision): Promise<PivotAnalysis> {
    // 1. 영향 분석
    const affectedTasks = await this.findAffectedTasks(pivot.oldGoalId);
    const affectedProjects = await this.findAffectedProjects(pivot.oldGoalId);
    const estimatedLoss = await this.calculateLoss(affectedTasks);

    // 2. 작업 중단
    await this.suspendTasks(affectedTasks);

    // 3. 자산 분류
    const assets = await this.classifyAssets(affectedTasks, pivot.newDirection);

    // 4. 리포트 생성 (인간 검토용)
    return {
      affectedTasks,
      affectedProjects,
      estimatedLoss,
      assets: {
        reusable: assets.filter(a => a.classification === 'reusable'),
        archive: assets.filter(a => a.classification === 'archive'),
        discard: assets.filter(a => a.classification === 'discard'),
      },
      newTaskProposal: await this.proposeNewTasks(pivot.newGoalId),
    };
  }
}
```

### 12.4 UncertaintyDecisionService

```typescript
@Injectable()
export class UncertaintyDecisionService {
  async decide(context: DecisionContext): Promise<DecisionResult> {
    // 에스컬레이션 체크
    if (!context.isReversible) {
      return { action: 'escalate', reason: 'irreversible_decision' };
    }

    if (context.estimatedCost > context.costThreshold) {
      return { action: 'escalate', reason: 'cost_exceeded' };
    }

    if (context.hasExternalImpact) {
      return { action: 'escalate', reason: 'external_impact' };
    }

    // 자율 결정
    const decision = await this.makeDecision(context);
    await this.decisionLogService.recordDecision(decision);

    return { action: 'proceed', decision };
  }

  async createSpike(spikeConfig: SpikeConfig): Promise<Task> {
    return this.taskService.create({
      title: `[Spike] ${spikeConfig.objective}`,
      description: spikeConfig.description,
      timeBoxMinutes: spikeConfig.timeLimit,
      costLimitCents: spikeConfig.costLimit,
      successCriteria: spikeConfig.successCriteria,
      labels: ['spike', 'experiment'],
    });
  }
}
```

---

## 13. 코드 리뷰 서비스

### 13.1 CodeReviewService

PR 생성, 리뷰어 할당, 리뷰 프로세스 관리:

```typescript
@Injectable()
export class CodeReviewService {
  constructor(
    @InjectRepository(TaskPullRequest)
    private readonly prRepo: Repository<TaskPullRequest>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    private readonly messageService: MessageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * PR 생성 및 Task 연결
   */
  async createPullRequest(
    taskId: string,
    prData: CreatePRDto,
    authorHollonId: string,
  ): Promise<TaskPullRequest> {
    const pr = this.prRepo.create({
      taskId,
      prNumber: prData.prNumber,
      prUrl: prData.prUrl,
      repository: prData.repository,
      branchName: prData.branchName,
      authorHollonId,
      status: 'draft',
    });

    const saved = await this.prRepo.save(pr);

    this.eventEmitter.emit('pr.created', { prId: saved.id, taskId });

    return saved;
  }

  /**
   * 리뷰 요청 - 리뷰어 자동 할당
   */
  async requestReview(prId: string): Promise<TaskPullRequest> {
    const pr = await this.prRepo.findOne({
      where: { id: prId },
      relations: ['task', 'task.project', 'authorHollon', 'authorHollon.team'],
    });

    if (!pr) throw new Error(`PR not found: ${prId}`);

    // 리뷰어 선택
    const reviewer = await this.selectReviewer(pr);

    // PR 상태 업데이트
    pr.status = 'ready_for_review';
    pr.reviewerHollonId = reviewer.hollonId;
    pr.reviewerType = reviewer.type;
    await this.prRepo.save(pr);

    // 리뷰어에게 알림
    await this.messageService.send({
      fromHollonId: pr.authorHollonId,
      toHollonId: reviewer.hollonId,
      messageType: 'review_request',
      content: `
코드 리뷰 요청

**PR**: ${pr.prUrl}
**Task**: ${pr.task.title}
**Branch**: ${pr.branchName}

리뷰 후 approve 또는 changes_requested 해주세요.
      `.trim(),
      relatedTaskId: pr.taskId,
    });

    this.eventEmitter.emit('pr.review_requested', { prId, reviewerId: reviewer.hollonId });

    return pr;
  }

  /**
   * 리뷰어 선택 로직
   */
  private async selectReviewer(pr: TaskPullRequest): Promise<ReviewerSelection> {
    const authorTeamId = pr.authorHollon?.teamId;

    // 1. PR 유형에 따른 전문 리뷰어 필요 여부 판단
    const prType = await this.classifyPRType(pr);

    if (prType === 'security') {
      return this.createSpecializedReviewer('SecurityReviewer', pr);
    }
    if (prType === 'architecture') {
      return this.createSpecializedReviewer('ArchitectureReviewer', pr);
    }
    if (prType === 'performance') {
      return this.createSpecializedReviewer('PerformanceReviewer', pr);
    }

    // 2. 일반 PR: 같은 팀 동료 홀론
    if (authorTeamId) {
      const teammate = await this.hollonRepo.findOne({
        where: {
          teamId: authorTeamId,
          status: 'idle',
          id: Not(pr.authorHollonId),
        },
      });

      if (teammate) {
        return { hollonId: teammate.id, type: 'team_member' };
      }
    }

    // 3. Fallback: 전문 CodeReviewer 생성
    return this.createSpecializedReviewer('CodeReviewer', pr);
  }

  /**
   * 전문 리뷰어 홀론 생성 (임시)
   */
  private async createSpecializedReviewer(
    roleType: string,
    pr: TaskPullRequest,
  ): Promise<ReviewerSelection> {
    const role = await this.roleRepo.findOne({
      where: { name: roleType, organizationId: pr.task.project.organizationId },
    });

    if (!role) {
      throw new Error(`Reviewer role not found: ${roleType}`);
    }

    // 임시 홀론 생성
    const reviewer = await this.hollonService.createTemporary({
      roleId: role.id,
      organizationId: pr.task.project.organizationId,
      name: `${roleType}-${pr.prNumber}`,
      createdBy: pr.authorHollonId,
    });

    return { hollonId: reviewer.id, type: roleType.toLowerCase() };
  }

  /**
   * PR 유형 분류
   */
  private async classifyPRType(pr: TaskPullRequest): Promise<PRType> {
    // 키워드 기반 분류
    const title = pr.task?.title?.toLowerCase() || '';
    const desc = pr.task?.description?.toLowerCase() || '';
    const combined = `${title} ${desc}`;

    if (/security|auth|encrypt|token|credential/i.test(combined)) {
      return 'security';
    }
    if (/architect|refactor|migrate|structure/i.test(combined)) {
      return 'architecture';
    }
    if (/performance|optimize|cache|speed/i.test(combined)) {
      return 'performance';
    }

    return 'general';
  }

  /**
   * 리뷰 완료 처리
   */
  async submitReview(
    prId: string,
    reviewerHollonId: string,
    decision: 'approve' | 'request_changes',
    comments?: string,
  ): Promise<TaskPullRequest> {
    const pr = await this.prRepo.findOne({ where: { id: prId } });

    if (!pr) throw new Error(`PR not found: ${prId}`);
    if (pr.reviewerHollonId !== reviewerHollonId) {
      throw new Error('Not authorized to review this PR');
    }

    pr.reviewComments = comments;

    if (decision === 'approve') {
      pr.status = 'approved';
      pr.approvedAt = new Date();

      this.eventEmitter.emit('pr.approved', { prId, reviewerHollonId });
    } else {
      pr.status = 'changes_requested';

      // 작성자에게 수정 요청 알림
      await this.messageService.send({
        fromHollonId: reviewerHollonId,
        toHollonId: pr.authorHollonId,
        messageType: 'review_feedback',
        content: `
코드 리뷰 피드백: 수정 필요

**PR**: ${pr.prUrl}

**피드백**:
${comments}

수정 후 다시 리뷰 요청해주세요.
        `.trim(),
        relatedTaskId: pr.taskId,
      });

      this.eventEmitter.emit('pr.changes_requested', { prId, reviewerHollonId });
    }

    return this.prRepo.save(pr);
  }

  /**
   * PR Merge 처리
   */
  async mergePullRequest(prId: string): Promise<TaskPullRequest> {
    const pr = await this.prRepo.findOne({
      where: { id: prId },
      relations: ['task'],
    });

    if (!pr) throw new Error(`PR not found: ${prId}`);
    if (pr.status !== 'approved') {
      throw new Error('PR must be approved before merging');
    }

    pr.status = 'merged';
    pr.mergedAt = new Date();
    await this.prRepo.save(pr);

    // Task 완료 처리
    await this.taskService.completeTask(pr.taskId);

    this.eventEmitter.emit('pr.merged', { prId, taskId: pr.taskId });

    return pr;
  }
}

type PRType = 'general' | 'security' | 'architecture' | 'performance';

interface ReviewerSelection {
  hollonId: string;
  type: string;
}

interface CreatePRDto {
  prNumber: number;
  prUrl: string;
  repository: string;
  branchName?: string;
}
```

---

## 14. 기술 부채 서비스

### 14.1 TechDebtService

기술 부채 감지, 추적, 우선순위화:

```typescript
@Injectable()
export class TechDebtService {
  constructor(
    @InjectRepository(TechDebt)
    private readonly debtRepo: Repository<TechDebt>,
    @InjectRepository(Cycle)
    private readonly cycleRepo: Repository<Cycle>,
    private readonly documentService: DocumentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 기술 부채 자동 감지 (QualityGate 연동)
   */
  async detectDebts(
    taskId: string,
    hollonId: string,
    codeAnalysis: CodeAnalysisResult,
  ): Promise<TechDebt[]> {
    const debts: TechDebt[] = [];

    // 1. TODO/FIXME 패턴 감지
    for (const todo of codeAnalysis.todos) {
      debts.push(await this.createDebt({
        title: `TODO: ${todo.content.substring(0, 100)}`,
        description: todo.content,
        debtType: 'code',
        sourceTaskId: taskId,
        sourceHollonId: hollonId,
        sourceFile: todo.file,
        sourceLine: todo.line,
        estimatedFixHours: 1,
        interestRate: 0.01,
      }));
    }

    // 2. 복잡도 초과 감지
    for (const complex of codeAnalysis.complexFunctions) {
      if (complex.complexity > 15) {
        debts.push(await this.createDebt({
          title: `High complexity: ${complex.functionName}`,
          description: `Cyclomatic complexity ${complex.complexity} exceeds threshold 15`,
          debtType: 'code',
          sourceTaskId: taskId,
          sourceHollonId: hollonId,
          sourceFile: complex.file,
          estimatedFixHours: complex.complexity / 5,
          interestRate: 0.02,
          affectedFiles: [complex.file],
        }));
      }
    }

    // 3. 테스트 커버리지 미달 감지
    if (codeAnalysis.testCoverage < 80) {
      debts.push(await this.createDebt({
        title: `Test coverage below 80%: ${codeAnalysis.testCoverage}%`,
        description: `Test coverage is ${codeAnalysis.testCoverage}%, should be at least 80%`,
        debtType: 'test',
        sourceTaskId: taskId,
        sourceHollonId: hollonId,
        estimatedFixHours: (80 - codeAnalysis.testCoverage) / 10,
        interestRate: 0.03,
        affectedFiles: codeAnalysis.uncoveredFiles,
      }));
    }

    // 4. 린트 경고 무시 감지
    for (const suppression of codeAnalysis.lintSuppressions) {
      debts.push(await this.createDebt({
        title: `Lint suppression: ${suppression.rule}`,
        description: suppression.comment,
        debtType: 'code',
        sourceTaskId: taskId,
        sourceHollonId: hollonId,
        sourceFile: suppression.file,
        sourceLine: suppression.line,
        estimatedFixHours: 0.5,
        interestRate: 0.005,
      }));
    }

    return debts;
  }

  /**
   * 기술 부채 생성
   */
  async createDebt(data: CreateDebtDto): Promise<TechDebt> {
    const task = await this.taskRepo.findOne({
      where: { id: data.sourceTaskId },
      relations: ['project'],
    });

    const debt = this.debtRepo.create({
      ...data,
      organizationId: task.project.organizationId,
      projectId: task.projectId,
      status: 'identified',
      priorityScore: 0,
    });

    const saved = await this.debtRepo.save(debt);

    // Decision Log에 기록
    await this.decisionLogService.recordDecision({
      hollonId: data.sourceHollonId,
      taskId: data.sourceTaskId,
      type: 'process',
      question: '기술 부채 발생',
      options: ['즉시 해결', '부채로 기록'],
      chosen: '부채로 기록',
      rationale: `빠른 전달을 위해 ${data.title}을 기술 부채로 기록`,
    });

    this.eventEmitter.emit('debt.created', { debtId: saved.id });

    return saved;
  }

  /**
   * 이자 누적 업데이트 (일일 배치)
   */
  @Cron('0 0 * * *') // 매일 자정
  async updateInterest(): Promise<void> {
    await this.debtRepo.query('SELECT update_debt_interest()');

    this.eventEmitter.emit('debt.interest_updated');
  }

  /**
   * 우선순위 기반 부채 목록 조회
   */
  async getDebtsByPriority(
    organizationId: string,
    options?: { projectId?: string; type?: string; limit?: number },
  ): Promise<TechDebt[]> {
    const query = this.debtRepo
      .createQueryBuilder('debt')
      .where('debt.organization_id = :orgId', { orgId: organizationId })
      .andWhere('debt.status IN (:...statuses)', { statuses: ['identified', 'scheduled'] })
      .orderBy('debt.priority_score', 'DESC');

    if (options?.projectId) {
      query.andWhere('debt.project_id = :projectId', { projectId: options.projectId });
    }

    if (options?.type) {
      query.andWhere('debt.debt_type = :type', { type: options.type });
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    return query.getMany();
  }

  /**
   * 사이클에 부채 해결 태스크 스케줄링
   */
  async scheduleDebtsForCycle(
    cycleId: string,
    debtBudgetPercent: number = 20,
  ): Promise<ScheduledDebts> {
    const cycle = await this.cycleRepo.findOne({
      where: { id: cycleId },
      relations: ['project'],
    });

    if (!cycle) throw new Error(`Cycle not found: ${cycleId}`);

    // 사이클 예산의 X%를 부채 해결에 할당
    const totalBudgetHours = cycle.budgetCents ? cycle.budgetCents / 100 : 40; // 기본 40시간
    const debtBudgetHours = totalBudgetHours * (debtBudgetPercent / 100);

    // 우선순위 높은 부채 선택
    const debts = await this.getDebtsByPriority(cycle.project.organizationId, {
      projectId: cycle.projectId,
    });

    const scheduled: TechDebt[] = [];
    let allocatedHours = 0;

    for (const debt of debts) {
      if (allocatedHours + debt.estimatedFixHours <= debtBudgetHours) {
        debt.status = 'scheduled';
        debt.scheduledCycleId = cycleId;
        await this.debtRepo.save(debt);

        scheduled.push(debt);
        allocatedHours += debt.estimatedFixHours;
      }
    }

    return {
      cycleId,
      budgetHours: debtBudgetHours,
      allocatedHours,
      scheduledDebts: scheduled,
      remainingDebts: debts.length - scheduled.length,
    };
  }

  /**
   * 부채 해결 완료
   */
  async resolveDebt(
    debtId: string,
    resolverHollonId: string,
    notes?: string,
  ): Promise<TechDebt> {
    const debt = await this.debtRepo.findOne({ where: { id: debtId } });

    if (!debt) throw new Error(`Debt not found: ${debtId}`);

    debt.status = 'resolved';
    debt.resolvedByHollonId = resolverHollonId;
    debt.resolvedAt = new Date();
    debt.resolutionNotes = notes;

    const saved = await this.debtRepo.save(debt);

    this.eventEmitter.emit('debt.resolved', { debtId, resolverHollonId });

    return saved;
  }

  /**
   * 주간 부채 리포트 생성
   */
  @Cron('0 9 * * 1') // 매주 월요일 09:00
  async generateWeeklyReport(organizationId: string): Promise<void> {
    const debts = await this.debtRepo.find({
      where: { organizationId, status: In(['identified', 'scheduled']) },
    });

    const totalDebt = debts.reduce((sum, d) => sum + d.estimatedFixHours + d.accumulatedInterest, 0);
    const byType = this.groupByType(debts);

    const report = `
# 기술 부채 주간 리포트

**총 부채**: ${debts.length}건 (${totalDebt.toFixed(1)} 시간)

## 유형별 현황

| 유형 | 건수 | 예상 해결 시간 | 누적 이자 |
|------|------|--------------|----------|
${Object.entries(byType).map(([type, items]) => {
  const hours = items.reduce((s, d) => s + d.estimatedFixHours, 0);
  const interest = items.reduce((s, d) => s + d.accumulatedInterest, 0);
  return `| ${type} | ${items.length} | ${hours.toFixed(1)}h | ${interest.toFixed(1)}h |`;
}).join('\n')}

## 우선순위 TOP 5

${debts.slice(0, 5).map((d, i) => `${i + 1}. **${d.title}** (Score: ${d.priorityScore.toFixed(1)})`).join('\n')}
    `.trim();

    await this.documentService.create({
      organizationId,
      name: `tech-debt-report-${new Date().toISOString().split('T')[0]}`,
      content: report,
      docType: 'meeting',
      scope: 'organization',
      scopeId: organizationId,
      keywords: ['tech-debt', 'report', 'weekly'],
    });
  }

  private groupByType(debts: TechDebt[]): Record<string, TechDebt[]> {
    return debts.reduce((acc, debt) => {
      acc[debt.debtType] = acc[debt.debtType] || [];
      acc[debt.debtType].push(debt);
      return acc;
    }, {} as Record<string, TechDebt[]>);
  }
}

interface CreateDebtDto {
  title: string;
  description?: string;
  debtType: 'code' | 'test' | 'doc' | 'dependency' | 'architecture';
  sourceTaskId: string;
  sourceHollonId: string;
  sourceFile?: string;
  sourceLine?: number;
  estimatedFixHours: number;
  interestRate?: number;
  affectedFiles?: string[];
}

interface ScheduledDebts {
  cycleId: string;
  budgetHours: number;
  allocatedHours: number;
  scheduledDebts: TechDebt[];
  remainingDebts: number;
}

interface CodeAnalysisResult {
  todos: Array<{ content: string; file: string; line: number }>;
  complexFunctions: Array<{ functionName: string; complexity: number; file: string }>;
  testCoverage: number;
  uncoveredFiles: string[];
  lintSuppressions: Array<{ rule: string; comment: string; file: string; line: number }>;
}
```

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2024-12-04 | 1.0.0 | ssot.md에서 분리하여 초기 문서 작성 |
| 2024-12-04 | 1.1.0 | 자율 운영 지원: Document-Memory 통합, 프롬프트 계층 합성, Task Pool, NestJS 구조 |
| 2024-12-04 | 1.2.0 | 홀론 오케스트레이션: HollonOrchestratorService, TaskAnalyzerService, EscalationService, QualityGateService 추가 |
| 2024-12-04 | 1.3.0 | SSOT에서 구현 로드맵 이동, LLM 한계 극복 서비스 상세, 협업 서비스 상세 추가 |
| 2024-12-04 | 1.4.0 | 목차 업데이트 (섹션 6-12 추가) |
| 2024-12-04 | 1.5.0 | Task-PR 연결 테이블, 기술 부채 테이블, CodeReviewService, TechDebtService 추가 |
