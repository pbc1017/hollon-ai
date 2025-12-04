# Hollon-AI: Technical Blueprint

> 이 문서는 SSOT(ssot.md)에 정의된 개념을 구현하기 위한 구체적인 기술 명세입니다.
> 개념적인 설계는 [ssot.md](./ssot.md)를 참조하세요.

---

## 목차

1. [데이터베이스 스키마](#1-데이터베이스-스키마)
2. [TypeScript 인터페이스](#2-typescript-인터페이스)
3. [Brain Provider 구현](#3-brain-provider-구현)
4. [API 엔드포인트](#4-api-엔드포인트)
5. [실시간 메시징 구현](#5-실시간-메시징-구현)

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

    -- 개별 설정 (Role 오버라이드)
    custom_prompt_suffix TEXT,
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

#### documents
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    parent_id UUID REFERENCES documents(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    content TEXT,

    doc_type VARCHAR(20) NOT NULL DEFAULT 'document'
        CHECK (doc_type IN ('folder', 'document')),

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
  customPromptSuffix?: string;
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

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2024-12-04 | 1.0.0 | ssot.md에서 분리하여 초기 문서 작성 |
