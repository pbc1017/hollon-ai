# Hollon-AI: Multi-Agent System SSOT (Single Source of Truth)

## 1. 프로젝트 개요

### 1.1 비전
Claude Code 기반의 재귀적 멀티 에이전트 시스템. 회사 조직 구조처럼 동작하는 에이전트들이 계층적으로 협업하여 복잡한 작업을 수행한다.

### 1.2 핵심 개념

**Hollon(홀론)**: 전체이자 부분인 자율적 에이전트 단위
- 그 자체로 완전한 에이전트이면서 동시에 상위 시스템의 부분
- Arthur Koestler의 홀라키(Holarchy) 개념에서 영감
- 각 홀론은 Claude Code 프로세스로 실행됨

**Organization(조직)**: 홀론들의 최상위 컨테이너
- 워크스페이스 역할
- 리소스 제한 및 설정 관리
- 복수의 프로젝트 포함 가능

---

## 2. 시스템 아키텍처

### 2.1 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                      Web UI (Next.js)                       │
│    - 조직도 시각화 (Argo CD 스타일)                          │
│    - 홀론 상태 모니터링                                      │
│    - 대화 인터페이스                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Server (Node.js)                 │
│    - 홀론 프로세스 관리                                      │
│    - 메시지 라우팅                                           │
│    - WebSocket 실시간 업데이트                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL (Data Layer)                   │
│    - 홀론 상태 및 메타데이터                                 │
│    - 대화 히스토리                                           │
│    - 메시지 큐 (LISTEN/NOTIFY)                               │
│    - 프로젝트/태스크 관리                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Claude Code Processes (Holons)                 │
│    - 각 홀론 = 독립 프로세스                                 │
│    - dangerously 모드로 API처럼 사용                         │
│    - DB 접근을 위한 API 엔드포인트 활용                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 디렉토리 구조

```
hollon-ai/
├── apps/
│   ├── web/                    # Next.js 웹 UI
│   │   ├── app/
│   │   ├── components/
│   │   └── ...
│   └── server/                 # 백엔드 서버
│       ├── src/
│       │   ├── process/        # 프로세스 관리
│       │   ├── messaging/      # 메시지 처리
│       │   ├── api/            # REST API
│       │   ├── db/             # 데이터베이스 레이어
│       │   │   ├── schema/     # Drizzle 스키마
│       │   │   ├── migrations/ # DB 마이그레이션
│       │   │   └── queries/    # 쿼리 함수
│       │   └── websocket/      # 실시간 통신
│       └── ...
├── packages/
│   ├── core/                   # 핵심 타입 및 유틸리티
│   ├── db/                     # 데이터베이스 스키마 공유
│   ├── shared/                 # 공유 로직
│   └── ui/                     # 공유 UI 컴포넌트
├── docker/
│   ├── docker-compose.yml      # PostgreSQL + 앱 컨테이너
│   └── init.sql                # 초기 DB 설정
└── docs/
    └── ssot.md
```

---

## 3. 데이터베이스 스키마

### 3.1 ERD 개요

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

**핵심 개념**

| 개념 | 설명 | 비유 |
|------|------|------|
| **Organization** | 최상위 컨테이너 | 회사 |
| **Role** | 역할 템플릿 (시스템 프롬프트, 권한 정의) | 직무 기술서 |
| **Team** | 홀론들의 그룹 | 부서/팀 |
| **Hollon** | Role 기반 에이전트 인스턴스 | 직원 (한 사람) |
| **Project** | 목표 달성을 위한 작업 묶음 | 프로젝트 |
| **Task** | 재귀적 작업 단위 (Linear 스타일) | 이슈/태스크 |
| **Channel** | 그룹 커뮤니케이션 공간 | Slack 채널 |
| **Document** | 지식/산출물 저장 | Notion 페이지 |

### 3.2 테이블 정의

#### organizations
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,

    -- 리소스 제한
    max_concurrent_holons INTEGER DEFAULT 10,
    max_total_holons INTEGER DEFAULT 100,

    -- 비용 제한
    cost_limit_daily_cents INTEGER,         -- 일일 비용 한도 (cents)
    cost_limit_monthly_cents INTEGER,       -- 월간 비용 한도 (cents)
    cost_alert_threshold_percent INTEGER DEFAULT 80,  -- 경고 임계값 (%)

    -- 루트 홀론 (nullable, 생성 후 설정)
    root_holon_id UUID,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### roles (역할 템플릿)
```sql
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- 역할 정보
    name VARCHAR(100) NOT NULL,           -- "백엔드 엔지니어", "CTO", "프로젝트 매니저"
    description TEXT,                      -- 역할 설명

    -- 역할 정의 (템플릿)
    system_prompt TEXT NOT NULL,           -- 역할 정의 프롬프트
    capabilities JSONB DEFAULT '[]',       -- 허용된 능력 목록
    allowed_paths JSONB DEFAULT '[]',      -- 접근 가능한 경로들

    -- 의사결정 영역 (역할 기반 의사결정)
    decision_domains JSONB DEFAULT '[]',   -- ["technical_architecture", "api_design", "code_review"]
    -- 이 역할이 최종 결정권을 가지는 영역들

    -- 자율성 수준
    autonomy_level VARCHAR(20) DEFAULT 'high'
        CHECK (autonomy_level IN ('low', 'medium', 'high')),
    can_create_tasks BOOLEAN DEFAULT true,         -- 태스크 생성 권한
    can_create_sub_holons BOOLEAN DEFAULT false,   -- 서브 홀론 생성 권한
    can_request_collaboration BOOLEAN DEFAULT true, -- 타 팀/홀론에 협업 요청
    can_request_resources BOOLEAN DEFAULT false,   -- 리소스(새 홀론) 요청 권한
    can_talk_to_user BOOLEAN DEFAULT true,         -- 사용자와 직접 대화 권한

    -- 제약사항
    max_instances INTEGER,                 -- 이 역할로 생성 가능한 최대 홀론 수 (null = 무제한)

    -- 모델 설정
    default_model VARCHAR(50) DEFAULT 'sonnet'
        CHECK (default_model IN ('haiku', 'sonnet', 'opus')),

    -- 프롬프트 버전 관리
    current_prompt_version_id UUID,        -- role_prompt_versions 테이블 참조 (테이블 생성 후 FK 추가)

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, name)
);

CREATE INDEX idx_roles_org ON roles(organization_id);
```

#### teams (팀/부서)
```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- 팀 정보
    name VARCHAR(100) NOT NULL,            -- "백엔드팀", "프로덕트팀"
    description TEXT,

    -- 팀 계층 (부서 > 팀 > 스쿼드 등)
    parent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

    -- 팀 리더 (홀론)
    leader_holon_id UUID,                  -- hollons 테이블 생성 후 FK 추가

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, name)
);

-- 팀에 필요한 역할 정의 (팀별로 어떤 Role이 필요한지)
CREATE TABLE team_role_requirements (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    min_count INTEGER DEFAULT 1,           -- 최소 필요 인원
    max_count INTEGER,                     -- 최대 인원 (null = 무제한)
    PRIMARY KEY (team_id, role_id)
);

CREATE INDEX idx_teams_org ON teams(organization_id);
CREATE INDEX idx_teams_parent ON teams(parent_team_id);
```

#### hollons (역할 인스턴스 = 팀원)
```sql
CREATE TABLE hollons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,  -- 소속 팀 (1:N)

    -- 식별 (개인 식별자)
    name VARCHAR(100) NOT NULL,            -- "김철수", "Agent-001" 등 개별 이름

    -- 계층 구조 (Adjacency List + Closure Table hybrid)
    parent_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    -- 생명주기
    lifecycle VARCHAR(20) NOT NULL CHECK (lifecycle IN ('permanent', 'temporary')),
    status VARCHAR(20) NOT NULL DEFAULT 'idle'
        CHECK (status IN ('idle', 'running', 'waiting', 'terminated', 'error')),

    -- 개별 설정 (Role의 기본값 오버라이드 가능)
    custom_prompt_suffix TEXT,             -- Role의 시스템 프롬프트에 추가할 내용
    custom_capabilities JSONB,             -- 추가 권한 (Role 권한에 병합)
    custom_allowed_paths JSONB,            -- 추가 경로 (Role 경로에 병합)

    -- 모델 오버라이드 (Role의 default_model 대신 사용)
    model_override VARCHAR(50)
        CHECK (model_override IN ('haiku', 'sonnet', 'opus')),

    -- 프로세스 정보
    pid INTEGER,
    process_started_at TIMESTAMP WITH TIME ZONE,

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,                       -- 생성한 홀론 ID (null이면 user가 생성)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES hollons(id) ON DELETE SET NULL
);

-- 계층 구조 빠른 조회를 위한 Closure Table
CREATE TABLE holon_hierarchy (
    ancestor_id UUID NOT NULL REFERENCES hollons(id) ON DELETE CASCADE,
    descendant_id UUID NOT NULL REFERENCES hollons(id) ON DELETE CASCADE,
    depth INTEGER NOT NULL,
    PRIMARY KEY (ancestor_id, descendant_id)
);

-- 인덱스
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

    -- 발신/수신
    from_type VARCHAR(10) NOT NULL CHECK (from_type IN ('holon', 'user')),
    from_id UUID,  -- holon이면 holon_id, user면 null 또는 user_id
    to_type VARCHAR(10) NOT NULL CHECK (to_type IN ('holon', 'user')),
    to_id UUID,

    -- 내용
    content TEXT NOT NULL,
    message_type VARCHAR(30) NOT NULL CHECK (message_type IN (
        'task_assignment', 'task_update', 'task_completion',
        'question', 'response', 'delegation_request',
        'delegation_approval', 'general'
    )),

    -- 관련 엔티티
    related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    related_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    -- 상태
    read_at TIMESTAMP WITH TIME ZONE,
    requires_response BOOLEAN DEFAULT false,

    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 홀론 참조 (발신자가 홀론인 경우)
    CONSTRAINT fk_from_holon FOREIGN KEY (from_id)
        REFERENCES hollons(id) ON DELETE SET NULL,
    CONSTRAINT fk_to_holon FOREIGN KEY (to_id)
        REFERENCES hollons(id) ON DELETE SET NULL
);

-- 인덱스
CREATE INDEX idx_messages_to ON messages(to_type, to_id);
CREATE INDEX idx_messages_from ON messages(from_type, from_id);
CREATE INDEX idx_messages_unread ON messages(to_id) WHERE read_at IS NULL;
CREATE INDEX idx_messages_created ON messages(created_at DESC);
```

#### conversations (대화 세션 관리)
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 참여자들 (2명의 홀론 또는 홀론+사용자)
    participant_1_type VARCHAR(10) NOT NULL,
    participant_1_id UUID,
    participant_2_type VARCHAR(10) NOT NULL,
    participant_2_id UUID,

    -- 컨텍스트
    context JSONB DEFAULT '{}',  -- 대화 맥락 저장

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(participant_1_type, participant_1_id, participant_2_type, participant_2_id)
);

-- 대화 히스토리 (메시지와 별도로 전체 컨텍스트 저장)
CREATE TABLE conversation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,

    UNIQUE(conversation_id, sequence_number)
);
```

#### projects (Linear 스타일)
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,  -- 담당 팀

    -- 프로젝트 정보
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(10) NOT NULL,       -- "PRJ", "BACK" 등 (태스크 ID 접두사)
    description TEXT,
    icon VARCHAR(10),                      -- 이모지 아이콘

    -- 담당
    lead_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'planning'
        CHECK (status IN ('planning', 'active', 'paused', 'completed', 'archived')),

    -- 날짜
    start_date DATE,
    target_date DATE,                      -- 목표 완료일

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, identifier)
);

-- 마일스톤 (Linear의 Milestone)
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- 날짜
    target_date DATE,

    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'cancelled')),

    -- 순서
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 사이클 (Linear의 Cycle - 스프린트와 유사)
CREATE TABLE cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    name VARCHAR(255),                     -- null이면 자동 생성 "Cycle 1", "Cycle 2"
    number INTEGER NOT NULL,               -- 사이클 번호

    -- 기간
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- 목표
    goal TEXT,                             -- 이번 사이클 목표

    -- 예산
    budget_cents INTEGER,                  -- 사이클 예산 (cents)
    actual_cost_cents INTEGER DEFAULT 0,   -- 실제 사용 비용 (cents)

    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming'
        CHECK (status IN ('upcoming', 'active', 'completed')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(project_id, number)
);

-- 사이클 회고 (Retrospective)
CREATE TABLE cycle_retrospectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,

    -- 회고 내용 (자동 생성 + 홀론들 피드백 종합)
    what_went_well TEXT,                   -- 잘된 점
    what_could_improve TEXT,               -- 개선할 점
    action_items JSONB DEFAULT '[]',       -- 다음 사이클 액션 아이템

    -- 메트릭 스냅샷
    metrics_snapshot JSONB DEFAULT '{}',   -- 사이클 종료 시점 메트릭

    -- 참여 홀론들의 피드백
    holon_feedbacks JSONB DEFAULT '[]',    -- [{holon_id, feedback, sentiment}]

    -- 자동 생성 관련
    auto_generated BOOLEAN DEFAULT false,  -- 시스템 자동 생성 여부
    generated_at TIMESTAMP WITH TIME ZONE,

    -- 개선 제안 (피드백 루프)
    improvement_suggestions JSONB DEFAULT '[]',
    /* [{
         "type": "prompt_change" | "scaling" | "team_reorg",
         "target_id": "role_id or team_id",
         "suggestion": "...",
         "expected_impact": "...",
         "confidence": 0.8
       }] */

    -- 적용된 변경사항 추적
    applied_changes JSONB DEFAULT '[]',    -- 이 회고로 인해 실제 적용된 변경들

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(cycle_id)
);

-- 프로젝트 참여 홀론 (다대다)
CREATE TABLE project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    holon_id UUID NOT NULL REFERENCES hollons(id) ON DELETE CASCADE,
    role VARCHAR(50),                      -- 프로젝트 내 역할
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (project_id, holon_id)
);

CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_team ON projects(team_id);
CREATE INDEX idx_milestones_project ON milestones(project_id);
CREATE INDEX idx_cycles_project ON cycles(project_id);
CREATE INDEX idx_cycles_status ON cycles(status);
```

#### metrics (성과 측정)
```sql
-- 메트릭 정의 (조직에서 측정하고자 하는 지표 정의)
CREATE TABLE metric_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- 메트릭 기본 정보
    name VARCHAR(100) NOT NULL,            -- "task_completion_rate", "code_review_time"
    display_name VARCHAR(255) NOT NULL,    -- "태스크 완료율", "코드 리뷰 시간"
    description TEXT,
    unit VARCHAR(50),                      -- "percent", "hours", "count", "points"

    -- 메트릭 유형
    metric_type VARCHAR(30) NOT NULL
        CHECK (metric_type IN ('counter', 'gauge', 'ratio', 'duration', 'score')),
    -- counter: 누적 카운트 (완료된 태스크 수)
    -- gauge: 현재 상태 값 (진행 중인 태스크 수)
    -- ratio: 비율 (완료율)
    -- duration: 시간 (사이클 타임)
    -- score: 점수 (품질 점수)

    -- 집계 방식
    aggregation_method VARCHAR(20) DEFAULT 'sum'
        CHECK (aggregation_method IN ('sum', 'avg', 'min', 'max', 'last', 'count')),

    -- 적용 대상
    applies_to VARCHAR(20)[] DEFAULT ARRAY['holon']
        CHECK (applies_to <@ ARRAY['holon', 'team', 'project', 'cycle', 'organization']::VARCHAR[]),

    -- 목표값 (선택적)
    target_value DECIMAL(15, 4),
    target_direction VARCHAR(10)           -- 'higher', 'lower', 'exact'
        CHECK (target_direction IN ('higher', 'lower', 'exact')),

    -- 자동 계산 여부 및 공식
    is_computed BOOLEAN DEFAULT false,
    computation_formula TEXT,              -- SQL 또는 표현식 (예: "completed_tasks / total_tasks * 100")

    -- 활성화 여부
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, name)
);

-- 메트릭 기록 (실제 측정된 값)
CREATE TABLE metric_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_definition_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,

    -- 측정 대상 (하나만 설정)
    holon_id UUID REFERENCES hollons(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- 측정 값
    value DECIMAL(15, 4) NOT NULL,

    -- 측정 기간 (선택적 - 특정 기간의 메트릭)
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,

    -- 메타데이터
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recorded_by UUID REFERENCES hollons(id) ON DELETE SET NULL,  -- 자동이면 null
    notes TEXT,

    -- 대상 타입 확인을 위한 제약
    CONSTRAINT exactly_one_target CHECK (
        (CASE WHEN holon_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN team_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN project_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN cycle_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN organization_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);

-- 주기적 메트릭 스냅샷 (일별/주별/월별 집계)
CREATE TABLE metric_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_definition_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,

    -- 스냅샷 기간
    snapshot_type VARCHAR(10) NOT NULL
        CHECK (snapshot_type IN ('daily', 'weekly', 'monthly', 'cycle')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- 대상 (하나만 설정)
    holon_id UUID REFERENCES hollons(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES cycles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- 집계된 값
    value DECIMAL(15, 4) NOT NULL,
    sample_count INTEGER DEFAULT 1,        -- 집계에 사용된 레코드 수

    -- 통계 (선택적)
    min_value DECIMAL(15, 4),
    max_value DECIMAL(15, 4),
    avg_value DECIMAL(15, 4),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 중복 방지
    UNIQUE(metric_definition_id, snapshot_type, period_start, holon_id),
    UNIQUE(metric_definition_id, snapshot_type, period_start, team_id),
    UNIQUE(metric_definition_id, snapshot_type, period_start, project_id),
    UNIQUE(metric_definition_id, snapshot_type, period_start, cycle_id),
    UNIQUE(metric_definition_id, snapshot_type, period_start, organization_id)
);

-- 홀론 성과 요약 (빠른 조회용)
CREATE TABLE holon_performance_summary (
    holon_id UUID PRIMARY KEY REFERENCES hollons(id) ON DELETE CASCADE,

    -- 태스크 관련
    total_tasks_assigned INTEGER DEFAULT 0,
    total_tasks_completed INTEGER DEFAULT 0,
    total_story_points_completed INTEGER DEFAULT 0,

    -- 시간 관련 (평균, 시간 단위)
    avg_task_completion_hours DECIMAL(10, 2),
    avg_review_turnaround_hours DECIMAL(10, 2),

    -- 품질 관련
    tasks_reopened_count INTEGER DEFAULT 0,  -- 다시 열린 태스크 수
    code_review_comments_received INTEGER DEFAULT 0,

    -- 협업 관련
    delegations_made INTEGER DEFAULT 0,
    delegations_received INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    collaboration_requests INTEGER DEFAULT 0,

    -- 최근 활동
    last_task_completed_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE,

    -- 계산된 점수 (0-100)
    productivity_score DECIMAL(5, 2),
    quality_score DECIMAL(5, 2),
    collaboration_score DECIMAL(5, 2),
    overall_score DECIMAL(5, 2),

    -- 비용 관련
    total_cost_cents DECIMAL(12, 2) DEFAULT 0,
    avg_cost_per_task_cents DECIMAL(10, 2),

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 팀 성과 요약
CREATE TABLE team_performance_summary (
    team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,

    -- 멤버 관련
    active_holon_count INTEGER DEFAULT 0,

    -- 태스크 관련
    total_tasks_completed INTEGER DEFAULT 0,
    total_story_points_completed INTEGER DEFAULT 0,
    avg_task_completion_hours DECIMAL(10, 2),

    -- 사이클/스프린트 관련
    velocity_avg DECIMAL(10, 2),           -- 평균 벨로시티 (포인트/사이클)
    velocity_trend VARCHAR(10),            -- 'improving', 'stable', 'declining'

    -- 계산된 점수
    team_health_score DECIMAL(5, 2),

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_metric_definitions_org ON metric_definitions(organization_id);
CREATE INDEX idx_metric_records_definition ON metric_records(metric_definition_id);
CREATE INDEX idx_metric_records_holon ON metric_records(holon_id);
CREATE INDEX idx_metric_records_team ON metric_records(team_id);
CREATE INDEX idx_metric_records_project ON metric_records(project_id);
CREATE INDEX idx_metric_records_recorded ON metric_records(recorded_at DESC);
CREATE INDEX idx_metric_snapshots_definition ON metric_snapshots(metric_definition_id);
CREATE INDEX idx_metric_snapshots_period ON metric_snapshots(snapshot_type, period_start);
```

#### cost_records (비용 추적)
```sql
-- 모든 비용 이벤트 기록
CREATE TABLE cost_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- 비용 발생 주체
    holon_id UUID NOT NULL REFERENCES hollons(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

    -- 컨텍스트
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,

    -- 비용 상세
    cost_type VARCHAR(30) NOT NULL
        CHECK (cost_type IN ('inference', 'sub_holon_spawn', 'tool_execution', 'other')),
    model_used VARCHAR(50) NOT NULL,       -- 'haiku', 'sonnet', 'opus'
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_cents DECIMAL(10, 4) NOT NULL,

    -- 메타데이터
    metadata JSONB DEFAULT '{}',           -- 추가 정보 (tool name, api endpoint 등)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cost_records_holon ON cost_records(holon_id);
CREATE INDEX idx_cost_records_team ON cost_records(team_id);
CREATE INDEX idx_cost_records_cycle ON cost_records(cycle_id);
CREATE INDEX idx_cost_records_created ON cost_records(created_at);
CREATE INDEX idx_cost_records_type ON cost_records(cost_type);
```

#### team_cycle_budgets (사이클별 팀 리소스 할당)
```sql
-- 사이클별 팀 리소스/예산 할당
CREATE TABLE team_cycle_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,

    -- 홀론 할당
    max_permanent_holons INTEGER NOT NULL,
    max_temporary_holons INTEGER NOT NULL,

    -- 비용 예산
    budget_cents INTEGER,

    -- 현재 사용량 (트리거로 자동 업데이트)
    current_permanent_holons INTEGER DEFAULT 0,
    current_temporary_holons INTEGER DEFAULT 0,
    current_cost_cents DECIMAL(10, 2) DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(team_id, cycle_id)
);

CREATE INDEX idx_team_cycle_budgets_team ON team_cycle_budgets(team_id);
CREATE INDEX idx_team_cycle_budgets_cycle ON team_cycle_budgets(cycle_id);
```

#### holon_spawn_budgets (홀론의 서브홀론 생성 예산)
```sql
-- 영구 홀론이 임시 서브홀론을 생성할 때의 예산 관리
CREATE TABLE holon_spawn_budgets (
    holon_id UUID PRIMARY KEY REFERENCES hollons(id) ON DELETE CASCADE,

    -- 서브홀론 생성 권한
    can_spawn_sub_holons BOOLEAN DEFAULT false,
    max_concurrent_sub_holons INTEGER DEFAULT 2,
    max_sub_holon_lifetime_minutes INTEGER DEFAULT 60,

    -- 모델 제한 (서브홀론은 더 저렴한 모델만 허용)
    allowed_sub_holon_models VARCHAR(50)[] DEFAULT ARRAY['haiku'],

    -- 비용 제한
    cost_limit_per_sub_holon_cents INTEGER DEFAULT 100,
    cost_limit_total_cents INTEGER DEFAULT 1000,

    -- 현재 사용량
    current_sub_holons INTEGER DEFAULT 0,
    total_cost_spent_cents DECIMAL(10, 2) DEFAULT 0,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### organization_time_limits (시간대별 동시 홀론 제한)
```sql
-- 시간대별 동시 홀론 제한 (사용자가 직접 관리 가능)
CREATE TABLE organization_time_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- 시간대 정의
    name VARCHAR(100) NOT NULL,            -- "업무 시간", "야간", "주말"
    description TEXT,

    -- 요일 (0=일요일, 6=토요일, null=매일)
    days_of_week INTEGER[],                -- [1,2,3,4,5] = 평일

    -- 시간 범위 (24시간제)
    start_time TIME NOT NULL,              -- '09:00'
    end_time TIME NOT NULL,                -- '18:00'
    timezone VARCHAR(50) DEFAULT 'Asia/Seoul',

    -- 제한
    max_concurrent_holons INTEGER NOT NULL,

    -- 우선순위 (겹치는 규칙이 있을 때)
    priority INTEGER DEFAULT 0,            -- 높을수록 우선

    -- 활성화
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, name)
);

CREATE INDEX idx_time_limits_org ON organization_time_limits(organization_id);
CREATE INDEX idx_time_limits_active ON organization_time_limits(is_active) WHERE is_active = true;

-- 현재 적용되는 제한을 조회하는 함수
CREATE OR REPLACE FUNCTION get_current_holon_limit(org_id UUID)
RETURNS INTEGER AS $$
DECLARE
    current_limit INTEGER;
    current_dow INTEGER;
    current_time_val TIME;
BEGIN
    current_dow := EXTRACT(DOW FROM NOW());
    current_time_val := CURRENT_TIME;

    SELECT max_concurrent_holons INTO current_limit
    FROM organization_time_limits
    WHERE organization_id = org_id
      AND is_active = true
      AND (days_of_week IS NULL OR current_dow = ANY(days_of_week))
      AND current_time_val >= start_time
      AND current_time_val <= end_time
    ORDER BY priority DESC
    LIMIT 1;

    -- 매칭되는 규칙이 없으면 organization의 기본값 사용
    IF current_limit IS NULL THEN
        SELECT max_concurrent_holons INTO current_limit
        FROM organizations
        WHERE id = org_id;
    END IF;

    RETURN current_limit;
END;
$$ LANGUAGE plpgsql;
```

#### tasks (재귀적 구조 - Linear 스타일)
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- 재귀적 구조 (Linear 스타일: Issue > Sub-issue)
    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,

    -- Linear 연결
    milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
    cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,

    -- 식별자 (Linear 스타일: PRJ-123)
    number INTEGER NOT NULL,               -- 프로젝트 내 순번
    -- identifier는 project.identifier + '-' + number로 생성 (예: "PRJ-123")

    title VARCHAR(500) NOT NULL,
    description TEXT,                      -- Markdown 지원

    -- 할당
    assigned_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,
    creator_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    -- 상태 (Linear 스타일)
    status VARCHAR(20) NOT NULL DEFAULT 'backlog'
        CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled')),
    priority VARCHAR(10) NOT NULL DEFAULT 'none'
        CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),

    -- 추정
    estimate_points INTEGER,               -- 스토리 포인트 (피보나치: 1,2,3,5,8,13,21)

    -- 날짜
    due_date DATE,

    -- 추적
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(project_id, number)
);

-- 태스크 의존성 (블로킹 관계)
CREATE TABLE task_dependencies (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) DEFAULT 'blocks'  -- 'blocks', 'relates_to', 'duplicates'
        CHECK (dependency_type IN ('blocks', 'relates_to', 'duplicates')),
    PRIMARY KEY (task_id, depends_on_task_id),
    CHECK (task_id != depends_on_task_id)
);

-- 태스크 라벨
CREATE TABLE task_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7),                      -- hex color: "#FF5733"
    UNIQUE(project_id, name)
);

CREATE TABLE task_label_assignments (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES task_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);

-- 태스크 로그 (활동 기록)
CREATE TABLE task_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL,          -- 'created', 'status_changed', 'assigned', 'commented'
    old_value TEXT,
    new_value TEXT,
    details TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 태스크 댓글
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

    -- 예상 영향
    estimated_cost DECIMAL(10, 2),
    risk_level VARCHAR(10) CHECK (risk_level IN ('low', 'medium', 'high')),
    affected_entities JSONB DEFAULT '[]',

    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),

    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    responded_by VARCHAR(100),  -- 'user' 또는 사용자 식별자
    response_note TEXT
);

CREATE INDEX idx_approval_pending ON approval_requests(status) WHERE status = 'pending';
CREATE INDEX idx_approval_holon ON approval_requests(holon_id);
```

#### role_prompt_versions (프롬프트 버전 관리)
```sql
-- Role 프롬프트 버전 히스토리
CREATE TABLE role_prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,

    -- 버전 정보
    version INTEGER NOT NULL,

    -- 프롬프트 내용
    system_prompt TEXT NOT NULL,

    -- 변경 정보
    change_summary TEXT,
    change_reason TEXT,

    -- 성과 스냅샷 (이 버전 활성화 시점의 메트릭)
    performance_snapshot JSONB DEFAULT '{}',

    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'testing', 'deprecated')),

    -- 생성 정보
    created_by_type VARCHAR(20) NOT NULL DEFAULT 'user'
        CHECK (created_by_type IN ('user', 'holon', 'experiment')),
    created_by_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE,
    deprecated_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(role_id, version)
);

CREATE INDEX idx_prompt_versions_role ON role_prompt_versions(role_id);
CREATE INDEX idx_prompt_versions_status ON role_prompt_versions(status);
```

#### scaling_rules (스케일링 규칙)
```sql
-- 메트릭 기반 자동 스케일링 규칙
CREATE TABLE scaling_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- 적용 범위
    scope_type VARCHAR(20) NOT NULL
        CHECK (scope_type IN ('organization', 'team', 'role')),
    scope_id UUID,

    -- 규칙 정보
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- 트리거 조건 (메트릭 기반)
    metric_definition_id UUID REFERENCES metric_definitions(id) ON DELETE CASCADE,
    condition_operator VARCHAR(10) NOT NULL
        CHECK (condition_operator IN ('>', '<', '>=', '<=', '=')),
    threshold_value DECIMAL(15, 4) NOT NULL,
    evaluation_window_minutes INTEGER DEFAULT 30,

    -- 액션
    action_type VARCHAR(30) NOT NULL
        CHECK (action_type IN ('scale_up', 'scale_down', 'alert', 'request_approval')),
    action_params JSONB NOT NULL,
    /* 예시:
       scale_up: {"role_id": "xxx", "count": 1, "lifecycle": "temporary", "model": "haiku"}
       scale_down: {"strategy": "oldest_idle", "count": 1}
       alert: {"message": "...", "severity": "warning"}
    */

    -- 가드레일
    cooldown_minutes INTEGER DEFAULT 30,
    max_actions_per_day INTEGER DEFAULT 10,
    requires_approval BOOLEAN DEFAULT false,
    respect_budget BOOLEAN DEFAULT true,

    -- 상태
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 스케일링 이벤트 로그
CREATE TABLE scaling_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scaling_rule_id UUID REFERENCES scaling_rules(id) ON DELETE SET NULL,

    -- 트리거 정보
    trigger_metric_value DECIMAL(15, 4),
    trigger_reason TEXT,

    -- 액션 정보
    action_type VARCHAR(30) NOT NULL,
    action_params JSONB NOT NULL,

    -- 결과
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'executed', 'blocked_budget', 'blocked_limit', 'failed', 'approved', 'rejected')),
    result_details JSONB DEFAULT '{}',

    -- 영향받은 홀론
    affected_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    -- 비용 영향
    estimated_cost_cents INTEGER,
    actual_cost_cents INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_scaling_rules_scope ON scaling_rules(scope_type, scope_id);
CREATE INDEX idx_scaling_rules_active ON scaling_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_scaling_events_rule ON scaling_events(scaling_rule_id);
CREATE INDEX idx_scaling_events_status ON scaling_events(status);
```

#### experiments (A/B 테스트)
```sql
-- 프롬프트, 모델, 프로세스 등의 A/B 테스트
CREATE TABLE experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- 실험 정보
    name VARCHAR(255) NOT NULL,
    hypothesis TEXT,

    -- 실험 대상
    experiment_type VARCHAR(30) NOT NULL
        CHECK (experiment_type IN ('prompt', 'model', 'process', 'scaling')),
    target_role_id UUID REFERENCES roles(id) ON DELETE CASCADE,

    -- 변형 (컨트롤 vs 테스트)
    control_config JSONB NOT NULL,
    variant_config JSONB NOT NULL,
    traffic_split_percent INTEGER DEFAULT 50,

    -- 성공 기준
    primary_metric_id UUID REFERENCES metric_definitions(id) ON DELETE SET NULL,
    success_threshold_percent DECIMAL(5, 2),

    -- 비용 제한
    max_cost_cents INTEGER,
    current_cost_cents INTEGER DEFAULT 0,

    -- 기간
    start_at TIMESTAMP WITH TIME ZONE,
    end_at TIMESTAMP WITH TIME ZONE,
    min_sample_size INTEGER DEFAULT 20,

    -- 자동 결정
    auto_stop_on_significance BOOLEAN DEFAULT true,
    auto_promote_winner BOOLEAN DEFAULT false,

    -- 상태
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'running', 'paused', 'completed', 'promoted', 'failed')),

    -- 결과
    winner VARCHAR(20),                    -- 'control', 'variant', 'inconclusive'
    results JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 실험 참가자 할당
CREATE TABLE experiment_assignments (
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    holon_id UUID NOT NULL REFERENCES hollons(id) ON DELETE CASCADE,

    assigned_group VARCHAR(20) NOT NULL CHECK (assigned_group IN ('control', 'variant')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (experiment_id, holon_id)
);

CREATE INDEX idx_experiments_status ON experiments(status);
CREATE INDEX idx_experiments_role ON experiments(target_role_id);
CREATE INDEX idx_experiment_assignments_holon ON experiment_assignments(holon_id);
```

#### improvement_proposals (개선 제안)
```sql
-- 홀론/시스템이 제안하는 개선 사항 (사용자 승인 필수)
CREATE TABLE improvement_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- 제안자
    proposed_by_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,
    proposed_by_type VARCHAR(20) NOT NULL DEFAULT 'holon'
        CHECK (proposed_by_type IN ('holon', 'system', 'user')),

    -- 개선 대상
    target_type VARCHAR(30) NOT NULL
        CHECK (target_type IN ('role_prompt', 'scaling_rule', 'team_allocation', 'process')),
    target_id UUID,

    -- 제안 내용
    title VARCHAR(255) NOT NULL,
    current_state TEXT,
    proposed_change TEXT NOT NULL,
    rationale TEXT,

    -- 근거 데이터
    supporting_metrics JSONB DEFAULT '{}',
    related_cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,

    -- 예상 영향
    expected_cost_impact_cents INTEGER,
    expected_performance_impact_percent DECIMAL(5, 2),

    -- 상태 (사용자 승인 필수)
    status VARCHAR(20) NOT NULL DEFAULT 'proposed'
        CHECK (status IN ('proposed', 'reviewing', 'approved', 'rejected', 'implemented', 'experiment_created')),

    -- 결정
    reviewed_by VARCHAR(50),
    review_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,

    -- 연결된 실험 (제안이 실험으로 전환된 경우)
    linked_experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_proposals_status ON improvement_proposals(status);
CREATE INDEX idx_proposals_target ON improvement_proposals(target_type, target_id);
CREATE INDEX idx_proposals_holon ON improvement_proposals(proposed_by_holon_id);
```

#### channels (그룹 커뮤니케이션 - Slack 스타일)
```sql
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- 채널 정보
    name VARCHAR(100) NOT NULL,            -- "general", "backend-team", "project-alpha"
    description TEXT,
    channel_type VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (channel_type IN ('public', 'private', 'direct')),

    -- 연결된 엔티티 (선택적)
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,        -- 팀 전용 채널
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,  -- 프로젝트 전용 채널

    -- 설정
    is_archived BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES hollons(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, name)
);

-- 채널 멤버십
CREATE TABLE channel_memberships (
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    holon_id UUID NOT NULL REFERENCES hollons(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member'      -- 'admin', 'member'
        CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (channel_id, holon_id)
);

-- 채널 메시지 (messages 테이블과 별도 - 그룹 메시지용)
CREATE TABLE channel_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,

    author_type VARCHAR(10) NOT NULL CHECK (author_type IN ('holon', 'user')),
    author_holon_id UUID REFERENCES hollons(id) ON DELETE SET NULL,

    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text'
        CHECK (message_type IN ('text', 'system', 'task_update', 'file')),

    -- 스레드 (답글)
    thread_parent_id UUID REFERENCES channel_messages(id) ON DELETE CASCADE,

    -- 메타데이터
    metadata JSONB DEFAULT '{}',           -- 첨부파일, 멘션 등

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 멘션 추적
CREATE TABLE channel_message_mentions (
    message_id UUID NOT NULL REFERENCES channel_messages(id) ON DELETE CASCADE,
    mentioned_holon_id UUID NOT NULL REFERENCES hollons(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, mentioned_holon_id)
);

CREATE INDEX idx_channels_org ON channels(organization_id);
CREATE INDEX idx_channels_team ON channels(team_id);
CREATE INDEX idx_channels_project ON channels(project_id);
CREATE INDEX idx_channel_messages_channel ON channel_messages(channel_id);
CREATE INDEX idx_channel_messages_thread ON channel_messages(thread_parent_id);
CREATE INDEX idx_channel_messages_created ON channel_messages(created_at DESC);
```

#### documents (지식 관리 - Markdown 기반 파일시스템 스타일)
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- 재귀적 계층 (파일시스템처럼 폴더/문서 구조)
    parent_id UUID REFERENCES documents(id) ON DELETE CASCADE,

    -- 문서 정보
    name VARCHAR(255) NOT NULL,            -- 파일명 (예: "architecture.md", "api-spec")
    slug VARCHAR(255),                     -- URL용 슬러그
    content TEXT,                          -- Markdown 내용 (폴더면 null)

    -- 문서 유형
    doc_type VARCHAR(20) NOT NULL DEFAULT 'document'
        CHECK (doc_type IN ('folder', 'document')),

    -- 연결된 엔티티 (선택적)
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,  -- 태스크 관련 문서

    -- 순서 (같은 폴더 내 정렬)
    sort_order INTEGER DEFAULT 0,

    -- 작성자/편집자
    created_by UUID REFERENCES hollons(id) ON DELETE SET NULL,
    last_edited_by UUID REFERENCES hollons(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 같은 폴더 내 이름 중복 방지
    UNIQUE(organization_id, parent_id, name)
);

-- 문서 버전 히스토리 (Git처럼 변경 추적)
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

    version INTEGER NOT NULL,              -- 버전 번호
    content TEXT NOT NULL,                 -- 해당 버전의 Markdown 내용

    commit_message VARCHAR(500),           -- 변경 사유
    edited_by UUID REFERENCES hollons(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(document_id, version)
);

-- 문서 경로 캐시 (빠른 경로 조회용)
CREATE TABLE document_paths (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    full_path TEXT NOT NULL,               -- "/projects/alpha/specs/api.md"
    depth INTEGER NOT NULL                 -- 경로 깊이
);

CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_documents_parent ON documents(parent_id);
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_team ON documents(team_id);
CREATE INDEX idx_documents_type ON documents(doc_type);
CREATE INDEX idx_document_versions_doc ON document_versions(document_id);
CREATE INDEX idx_document_paths_path ON document_paths(full_path);
```

### 3.3 PostgreSQL LISTEN/NOTIFY를 활용한 실시간 메시징

```sql
-- 메시지 전송 시 알림 트리거
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

## 4. 핵심 엔티티 (TypeScript 인터페이스)

### 4.1 Organization (조직)

```typescript
interface Organization {
  id: string;                    // UUID
  name: string;                  // 사용자 지정 이름

  // 리소스 제한
  maxConcurrentHolons: number;
  maxTotalHolons: number;

  // 비용 제한
  costLimitDailyCents?: number;      // 일일 비용 한도 (cents)
  costLimitMonthlyCents?: number;    // 월간 비용 한도 (cents)
  costAlertThresholdPercent: number; // 경고 임계값 (%), 기본 80

  // 루트 홀론 ID
  rootHolonId: string | null;

  createdAt: Date;
  updatedAt: Date;
}
```

### 4.2 Role (역할 템플릿)

```typescript
type ModelType = 'haiku' | 'sonnet' | 'opus';

interface Role {
  id: string;                    // UUID
  organizationId: string;

  // 역할 정보
  name: string;                  // "백엔드 엔지니어", "CTO", "프로젝트 매니저"
  description?: string;

  // 모델 설정
  defaultModel: ModelType;       // 기본 모델 (haiku/sonnet/opus)

  // 프롬프트 버전 관리
  currentPromptVersionId?: string;  // role_prompt_versions 테이블 참조

  // 역할 정의 (템플릿)
  systemPrompt: string;          // 역할 정의 프롬프트
  capabilities: string[];        // 허용된 능력 목록
  allowedPaths: string[];        // 접근 가능한 경로들

  // 의사결정 영역 (역할 기반 의사결정)
  decisionDomains: string[];     // ["technical_architecture", "api_design", "code_review"]

  // 자율성 수준
  autonomyLevel: 'low' | 'medium' | 'high';
  canCreateTasks: boolean;       // 태스크 생성 권한
  canCreateSubHolons: boolean;   // 서브 홀론 생성 권한
  canRequestCollaboration: boolean;  // 타 팀/홀론에 협업 요청
  canRequestResources: boolean;  // 리소스(새 홀론) 요청 권한
  canTalkToUser: boolean;        // 사용자와 직접 대화 권한

  // 제약사항
  maxInstances?: number;         // 이 역할로 생성 가능한 최대 홀론 수

  createdAt: Date;
  updatedAt: Date;
}

// 예시: 미리 정의된 역할들
const PREDEFINED_ROLES = {
  CTO: {
    name: 'CTO',
    description: '기술 전략 수립 및 기술팀 총괄',
    systemPrompt: '당신은 CTO로서 기술적 의사결정을 내리고 개발팀을 이끕니다...',
    capabilities: ['architecture_decision', 'code_review', 'team_management'],
    decisionDomains: ['technical_architecture', 'technology_stack', 'engineering_standards'],
    autonomyLevel: 'high',
    canCreateTasks: true,
    canCreateSubHolons: true,
    canRequestCollaboration: true,
    canRequestResources: true,
    canTalkToUser: true,
  },
  BACKEND_ENGINEER: {
    name: '백엔드 엔지니어',
    description: '서버 사이드 개발 담당',
    systemPrompt: '당신은 백엔드 엔지니어로서 API 개발, 데이터베이스 설계...',
    capabilities: ['code_write', 'code_review', 'database_design'],
    decisionDomains: ['api_design', 'database_schema'],
    autonomyLevel: 'high',
    canCreateTasks: true,
    canCreateSubHolons: false,
    canRequestCollaboration: true,
    canRequestResources: false,
    canTalkToUser: true,
  },
  PROJECT_MANAGER: {
    name: '프로젝트 매니저',
    description: '프로젝트 일정 및 리소스 관리',
    systemPrompt: '당신은 PM으로서 프로젝트 진행을 관리하고 팀원들을 조율합니다...',
    capabilities: ['task_management', 'resource_allocation', 'reporting'],
    decisionDomains: ['project_scope', 'timeline', 'resource_allocation'],
    autonomyLevel: 'high',
    canCreateTasks: true,
    canCreateSubHolons: false,
    canRequestCollaboration: true,
    canRequestResources: true,
    canTalkToUser: true,
  },
};
```

### 4.3 Hollon (역할 인스턴스 = 팀원)

```typescript
interface Hollon {
  id: string;                    // UUID
  organizationId: string;
  roleId: string;                // 역할 참조
  teamId?: string;               // 소속 팀 (1:N - 홀론은 하나의 팀에만 속함)

  // 식별 (개인 식별자)
  name: string;                  // "김철수", "Agent-001" 등

  // 계층 구조
  parentId: string | null;       // 루트면 null

  // 모델 오버라이드 (Role의 defaultModel 대신 사용)
  modelOverride?: ModelType;     // 설정 시 Role의 defaultModel 무시

  // 생명주기
  lifecycle: 'permanent' | 'temporary';
  status: 'idle' | 'running' | 'waiting' | 'terminated' | 'error';

  // 개별 설정 (Role 오버라이드)
  customPromptSuffix?: string;   // Role 프롬프트에 추가
  customCapabilities?: string[]; // 추가 권한
  customAllowedPaths?: string[]; // 추가 경로

  // 프로세스 정보
  pid?: number;
  processStartedAt?: Date;

  // 메타데이터
  createdAt: Date;
  createdBy: string | null;      // 생성한 홀론 ID 또는 null (user가 생성)
  updatedAt: Date;
}

// 홀론의 최종 설정을 계산하는 함수
function getEffectiveConfig(holon: Hollon, role: Role): EffectiveHolonConfig {
  return {
    model: holon.modelOverride || role.defaultModel,  // 홀론 오버라이드 우선
    systemPrompt: role.systemPrompt + (holon.customPromptSuffix || ''),
    capabilities: [...role.capabilities, ...(holon.customCapabilities || [])],
    allowedPaths: [...role.allowedPaths, ...(holon.customAllowedPaths || [])],
    canCreateSubHolons: role.canCreateSubHolons,
    canTalkToUser: role.canTalkToUser,
  };
}
```

### 4.4 Team (팀/부서)

```typescript
interface Team {
  id: string;
  organizationId: string;

  name: string;                  // "백엔드팀", "프로덕트팀"
  description?: string;

  parentTeamId?: string;         // 상위 팀/부서
  leaderHolonId?: string;        // 팀 리더

  createdAt: Date;
  updatedAt: Date;
}

// 팀에 필요한 역할 정의
interface TeamRoleRequirement {
  teamId: string;
  roleId: string;
  minCount: number;              // 최소 필요 인원
  maxCount?: number;             // 최대 인원 (null = 무제한)
}
```

### 4.5 Project (Linear 스타일)

```typescript
interface Project {
  id: string;
  organizationId: string;
  teamId?: string;               // 담당 팀

  name: string;
  identifier: string;            // "PRJ", "BACK" - 태스크 ID 접두사
  description?: string;
  icon?: string;                 // 이모지

  leadHolonId?: string;          // 프로젝트 리드

  status: 'planning' | 'active' | 'paused' | 'completed' | 'archived';

  startDate?: Date;
  targetDate?: Date;             // 목표 완료일

  createdAt: Date;
  updatedAt: Date;
}

// 마일스톤 (Linear의 Milestone)
interface Milestone {
  id: string;
  projectId: string;

  name: string;
  description?: string;
  targetDate?: Date;

  status: 'active' | 'completed' | 'cancelled';
  sortOrder: number;

  createdAt: Date;
  completedAt?: Date;
  updatedAt: Date;
}

// 사이클 (Linear의 Cycle - 스프린트와 유사)
interface Cycle {
  id: string;
  projectId: string;

  name?: string;                 // null이면 "Cycle 1", "Cycle 2"
  number: number;

  startDate: Date;
  endDate: Date;

  goal?: string;                 // 이번 사이클 목표

  // 예산
  budgetCents?: number;          // 사이클 예산 (cents)
  actualCostCents: number;       // 실제 사용 비용 (cents), 기본 0

  status: 'upcoming' | 'active' | 'completed';

  createdAt: Date;
  updatedAt: Date;
}
```

### 4.6 Task (재귀적 태스크 - Linear 스타일)

```typescript
interface Task {
  id: string;
  projectId: string;
  parentTaskId?: string;         // 재귀적 구조 (Sub-issue)

  milestoneId?: string;
  cycleId?: string;

  number: number;                // 프로젝트 내 순번
  // identifier = project.identifier + '-' + number (예: "PRJ-123")

  title: string;
  description?: string;          // Markdown 지원

  assignedHolonId?: string;
  creatorHolonId?: string;

  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';

  estimatePoints?: number;       // 피보나치: 1,2,3,5,8,13,21
  dueDate?: Date;

  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  updatedAt: Date;
}

interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: 'blocks' | 'relates_to' | 'duplicates';
}

interface TaskComment {
  id: string;
  taskId: string;
  authorHolonId?: string;
  authorType: 'holon' | 'user';
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.7 Message (1:1 메시지)

```typescript
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

### 4.8 Channel (그룹 커뮤니케이션 - Slack 스타일)

```typescript
interface Channel {
  id: string;
  organizationId: string;

  name: string;                  // "general", "backend-team"
  description?: string;
  channelType: 'public' | 'private' | 'direct';

  teamId?: string;               // 팀 전용 채널
  projectId?: string;            // 프로젝트 전용 채널

  isArchived: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChannelMessage {
  id: string;
  channelId: string;

  authorType: 'holon' | 'user';
  authorHolonId?: string;

  content: string;
  messageType: 'text' | 'system' | 'task_update' | 'file';

  threadParentId?: string;       // 스레드 답글
  metadata: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}
```

### 4.9 Document (지식 관리 - Markdown 파일시스템 스타일)

```typescript
interface Document {
  id: string;
  organizationId: string;

  parentId?: string;             // 재귀적 계층 (폴더/문서)

  name: string;                  // 파일명: "architecture.md"
  slug?: string;                 // URL용 슬러그
  content?: string;              // Markdown 내용 (폴더면 null)

  docType: 'folder' | 'document';

  // 연결된 엔티티 (선택적)
  projectId?: string;
  teamId?: string;
  taskId?: string;               // 태스크 관련 문서

  sortOrder: number;             // 같은 폴더 내 정렬

  createdBy?: string;
  lastEditedBy?: string;

  createdAt: Date;
  updatedAt: Date;
}

// 문서 버전 (Git처럼 변경 추적)
interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  content: string;               // 해당 버전의 Markdown 내용
  commitMessage?: string;        // 변경 사유
  editedBy?: string;
  createdAt: Date;
}

// 문서 경로 (빠른 조회용 캐시)
interface DocumentPath {
  documentId: string;
  fullPath: string;              // "/projects/alpha/specs/api.md"
  depth: number;
}
```

### 4.10 Metrics (성과 측정)

```typescript
// 메트릭 정의 (조직에서 측정하고자 하는 지표)
interface MetricDefinition {
  id: string;
  organizationId: string;

  name: string;                  // "task_completion_rate"
  displayName: string;           // "태스크 완료율"
  description?: string;
  unit?: string;                 // "percent", "hours", "count", "points"

  metricType: 'counter' | 'gauge' | 'ratio' | 'duration' | 'score';
  aggregationMethod: 'sum' | 'avg' | 'min' | 'max' | 'last' | 'count';

  appliesTo: ('holon' | 'team' | 'project' | 'cycle' | 'organization')[];

  // 목표값 (선택적)
  targetValue?: number;
  targetDirection?: 'higher' | 'lower' | 'exact';

  // 자동 계산
  isComputed: boolean;
  computationFormula?: string;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// 메트릭 기록 (실제 측정된 값)
interface MetricRecord {
  id: string;
  metricDefinitionId: string;

  // 측정 대상 (하나만 설정)
  holonId?: string;
  teamId?: string;
  projectId?: string;
  cycleId?: string;
  organizationId?: string;

  value: number;

  periodStart?: Date;
  periodEnd?: Date;

  recordedAt: Date;
  recordedBy?: string;           // 자동이면 undefined
  notes?: string;
}

// 메트릭 스냅샷 (일별/주별/월별 집계)
interface MetricSnapshot {
  id: string;
  metricDefinitionId: string;

  snapshotType: 'daily' | 'weekly' | 'monthly' | 'cycle';
  periodStart: Date;
  periodEnd: Date;

  // 대상 (하나만 설정)
  holonId?: string;
  teamId?: string;
  projectId?: string;
  cycleId?: string;
  organizationId?: string;

  value: number;
  sampleCount: number;

  // 통계
  minValue?: number;
  maxValue?: number;
  avgValue?: number;

  createdAt: Date;
}

// 홀론 성과 요약
interface HolonPerformanceSummary {
  holonId: string;

  // 태스크 관련
  totalTasksAssigned: number;
  totalTasksCompleted: number;
  totalStoryPointsCompleted: number;

  // 시간 관련
  avgTaskCompletionHours?: number;
  avgReviewTurnaroundHours?: number;

  // 품질 관련
  tasksReopenedCount: number;
  codeReviewCommentsReceived: number;

  // 비용 관련
  totalCostCents: number;              // 총 사용 비용 (cents)
  avgCostPerTaskCents?: number;        // 태스크당 평균 비용 (cents)

  // 협업 관련
  delegationsMade: number;
  delegationsReceived: number;
  messagesSent: number;
  collaborationRequests: number;

  // 최근 활동
  lastTaskCompletedAt?: Date;
  lastActiveAt?: Date;

  // 계산된 점수 (0-100)
  productivityScore?: number;
  qualityScore?: number;
  collaborationScore?: number;
  overallScore?: number;

  updatedAt: Date;
}

// 팀 성과 요약
interface TeamPerformanceSummary {
  teamId: string;

  activeHolonCount: number;

  totalTasksCompleted: number;
  totalStoryPointsCompleted: number;
  avgTaskCompletionHours?: number;

  velocityAvg?: number;          // 평균 벨로시티 (포인트/사이클)
  velocityTrend?: 'improving' | 'stable' | 'declining';

  teamHealthScore?: number;

  updatedAt: Date;
}

// 예시: 기본 메트릭 정의들
const DEFAULT_METRICS = {
  TASK_COMPLETION_RATE: {
    name: 'task_completion_rate',
    displayName: '태스크 완료율',
    unit: 'percent',
    metricType: 'ratio',
    appliesTo: ['holon', 'team', 'project'],
    targetValue: 80,
    targetDirection: 'higher',
  },
  CYCLE_VELOCITY: {
    name: 'cycle_velocity',
    displayName: '사이클 벨로시티',
    unit: 'points',
    metricType: 'gauge',
    appliesTo: ['team', 'project'],
    aggregationMethod: 'sum',
  },
  AVG_TASK_TIME: {
    name: 'avg_task_completion_time',
    displayName: '평균 태스크 완료 시간',
    unit: 'hours',
    metricType: 'duration',
    appliesTo: ['holon', 'team'],
    aggregationMethod: 'avg',
    targetDirection: 'lower',
  },
} as const;
```

### 4.11 Cycle Retrospective (사이클 회고)

```typescript
interface CycleRetrospective {
  id: string;
  cycleId: string;

  whatWentWell?: string;         // 잘된 점
  whatCouldImprove?: string;     // 개선할 점
  actionItems: ActionItem[];     // 다음 사이클 액션 아이템

  metricsSnapshot: Record<string, number>;  // 사이클 종료 시점 메트릭

  holonFeedbacks: HolonFeedback[];

  // 자동 생성 관련
  autoGenerated: boolean;        // 자동 생성 여부
  generatedAt?: Date;            // 자동 생성 시점

  // 개선 제안 (피드백 루프)
  improvementSuggestions: ImprovementSuggestion[];

  // 적용된 변경사항 추적
  appliedChanges: AppliedChange[];

  createdAt: Date;
}

interface ActionItem {
  id: string;
  description: string;
  assignedTo?: string;           // holon_id
  dueDate?: Date;
  status: 'pending' | 'in_progress' | 'done';
}

interface HolonFeedback {
  holonId: string;
  feedback: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

interface ImprovementSuggestion {
  type: 'prompt_change' | 'scaling' | 'workflow' | 'resource_allocation';
  targetId?: string;             // role_id 또는 team_id
  suggestion: string;
  reasoning: string;
  priority: 'low' | 'medium' | 'high';
  status: 'suggested' | 'approved' | 'rejected' | 'applied';
}

interface AppliedChange {
  changeType: string;
  description: string;
  appliedAt: Date;
  resultingProposalId?: string;  // improvement_proposals 참조
}
```

### 4.12 Cost Tracking (비용 추적)

```typescript
type CostType = 'inference' | 'sub_holon_spawn' | 'tool_execution' | 'other';

// 비용 기록 (모든 API 호출 비용 추적)
interface CostRecord {
  id: string;
  organizationId: string;
  holonId: string;
  teamId?: string;
  taskId?: string;
  cycleId?: string;

  costType: CostType;
  modelUsed: ModelType;          // haiku, sonnet, opus

  // 토큰 사용량
  inputTokens: number;
  outputTokens: number;

  // 비용 (cents, 소수점 4자리)
  costCents: number;

  metadata?: Record<string, any>;  // 추가 정보

  createdAt: Date;
}

// 팀별 사이클 예산
interface TeamCycleBudget {
  id: string;
  teamId: string;
  cycleId: string;

  // 홀론 수 제한
  maxPermanentHolons: number;
  maxTemporaryHolons: number;

  // 예산
  budgetCents?: number;

  // 현재 상태
  currentPermanentHolons: number;
  currentTemporaryHolons: number;
  currentCostCents: number;

  createdAt: Date;
  updatedAt: Date;
}

// 홀론별 서브 홀론 스폰 예산
interface HolonSpawnBudget {
  holonId: string;                        // PK, FK to hollons

  // 서브 홀론 생성 권한
  canSpawnSubHolons: boolean;
  maxConcurrentSubHolons: number;         // 동시 실행 가능 수
  maxSubHolonLifetimeMinutes: number;     // 최대 생존 시간

  // 서브 홀론 모델 제한
  allowedSubHolonModels: ModelType[];     // 예: ['haiku'] - 저렴한 모델만

  // 비용 제한
  costLimitPerSubHolonCents: number;      // 서브 홀론당 비용 한도
  costLimitTotalCents: number;            // 총 비용 한도

  // 현재 상태
  currentSubHolons: number;
  totalCostSpentCents: number;

  updatedAt: Date;
}
```

### 4.13 Time-based Resource Limits (시간별 리소스 제한)

```typescript
// 조직별 시간대별 홀론 제한
interface OrganizationTimeLimit {
  id: string;
  organizationId: string;

  name: string;                  // "업무 시간", "야간", "주말"
  description?: string;

  // 적용 시간
  daysOfWeek: number[];          // 0=일요일, 1=월요일, ... 6=토요일
  startTime: string;             // "09:00" (TIME 형식)
  endTime: string;               // "18:00"
  timezone: string;              // "Asia/Seoul"

  // 제한
  maxConcurrentHolons: number;

  // 우선순위 (높을수록 우선)
  priority: number;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// 현재 적용 가능한 홀론 제한 조회 (헬퍼)
function getCurrentHolonLimit(organizationId: string): number;
```

### 4.14 Role Prompt Versioning (역할 프롬프트 버전 관리)

```typescript
// 역할 프롬프트 버전
interface RolePromptVersion {
  id: string;
  roleId: string;

  versionNumber: number;         // 1, 2, 3, ...
  systemPrompt: string;          // 해당 버전의 프롬프트

  // 변경 정보
  changeDescription?: string;    // "성능 개선을 위해 응답 형식 수정"
  changeTrigger: 'manual' | 'experiment' | 'improvement_proposal';

  // 실험 연결 (A/B 테스트로 인한 변경 시)
  experimentId?: string;

  // 성과 스냅샷 (버전 생성 시점의 메트릭)
  performanceSnapshot?: Record<string, number>;

  isActive: boolean;             // 현재 사용 중인 버전

  createdAt: Date;
  createdBy?: string;            // holon_id 또는 'user'
}
```

### 4.15 Scaling Rules (스케일링 규칙)

```typescript
type ScalingRuleTargetType = 'team' | 'role';
type ScalingAction = 'scale_up' | 'scale_down' | 'alert' | 'request_approval';

// 자동 스케일링 규칙
interface ScalingRule {
  id: string;
  organizationId: string;

  name: string;
  description?: string;

  // 적용 대상
  targetType: ScalingRuleTargetType;
  targetId?: string;             // 특정 team_id 또는 role_id (null이면 전체)

  // 트리거 조건
  metricDefinitionId: string;    // 관찰할 메트릭
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';  // >, >=, <, <=, ==
  threshold: number;
  evaluationPeriodMinutes: number;  // 평가 기간

  // 액션
  action: ScalingAction;
  actionConfig: ScalingActionConfig;

  // 가드레일
  cooldownMinutes: number;       // 연속 실행 방지
  minHolons: number;             // 최소 홀론 수 (scale_down 제한)
  maxHolons: number;             // 최대 홀론 수 (scale_up 제한)

  isActive: boolean;
  lastTriggeredAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface ScalingActionConfig {
  scaleDelta?: number;           // scale_up/down 시 증감 수
  alertMessage?: string;         // alert 시 메시지
  approvalType?: string;         // request_approval 시 승인 유형
}

// 스케일링 이벤트 로그
interface ScalingEvent {
  id: string;
  scalingRuleId: string;

  triggeredAt: Date;

  // 트리거 시점 상태
  metricValue: number;
  threshold: number;

  // 액션 결과
  action: ScalingAction;
  actionResult: 'success' | 'failed' | 'pending_approval' | 'rejected';
  actionDetails?: Record<string, any>;

  // 결과 (스케일링 시)
  holonsBefore?: number;
  holonsAfter?: number;

  createdAt: Date;
}
```

### 4.16 Experiments (A/B 테스트)

```typescript
type ExperimentType = 'prompt' | 'model' | 'process' | 'config';
type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';

// 실험 정의
interface Experiment {
  id: string;
  organizationId: string;

  name: string;
  description?: string;
  hypothesis?: string;           // 가설

  experimentType: ExperimentType;

  // 대상
  targetRoleId?: string;         // 프롬프트/모델 실험 시
  targetTeamId?: string;         // 프로세스 실험 시

  // 변형 (variants)
  controlConfig: Record<string, any>;    // 대조군 설정
  treatmentConfig: Record<string, any>;  // 실험군 설정

  // 성공 메트릭
  primaryMetricId: string;       // 주요 평가 메트릭
  secondaryMetricIds: string[];  // 보조 메트릭

  // 통계 설정
  sampleSizeTarget?: number;     // 목표 샘플 수
  confidenceLevel: number;       // 0.95 등

  // 기간
  startedAt?: Date;
  endedAt?: Date;

  status: ExperimentStatus;

  // 결과
  results?: ExperimentResults;

  createdAt: Date;
  updatedAt: Date;
}

interface ExperimentResults {
  controlMetrics: Record<string, number>;
  treatmentMetrics: Record<string, number>;
  pValue?: number;
  isSignificant?: boolean;
  recommendedAction?: 'adopt_treatment' | 'keep_control' | 'inconclusive';
  analysisNotes?: string;
}

// 실험 할당 (홀론별)
interface ExperimentAssignment {
  id: string;
  experimentId: string;
  holonId: string;

  variant: 'control' | 'treatment';
  assignedAt: Date;

  // 결과 추적
  metricsCollected: Record<string, number>;
  completedAt?: Date;
}
```

### 4.17 Improvement Proposals (개선 제안)

```typescript
type ProposalType = 'prompt_change' | 'scaling_rule' | 'team_structure' | 'workflow' | 'resource_allocation';
type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'rolled_back';

// 개선 제안 (회고에서 생성, 사용자 승인 필요)
interface ImprovementProposal {
  id: string;
  organizationId: string;

  // 출처
  sourceType: 'retrospective' | 'scaling_event' | 'experiment' | 'manual';
  sourceId?: string;             // retrospective_id, experiment_id 등

  proposalType: ProposalType;
  title: string;
  description: string;
  reasoning: string;             // 제안 근거 (메트릭 분석 등)

  // 적용 대상
  targetType?: string;           // 'role', 'team', 'holon' 등
  targetId?: string;

  // 변경 내용
  currentValue?: Record<string, any>;   // 현재 상태
  proposedValue?: Record<string, any>;  // 제안 상태

  // 예상 효과
  expectedImpact?: string;
  riskLevel: 'low' | 'medium' | 'high';

  status: ProposalStatus;

  // 승인 정보
  reviewedBy?: string;           // 'user' 또는 holon_id
  reviewedAt?: Date;
  reviewNotes?: string;

  // 적용 정보
  appliedAt?: Date;
  rolledBackAt?: Date;
  rollbackReason?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

---

## 5. 핵심 기능

### 5.1 작업 위임 및 분할

#### 판단 프로세스 (하이브리드 방식)

```
1. 홀론이 태스크 수신
   │
2. 복잡도 분석 (LLM 판단)
   ├── 예상 토큰 소모량
   ├── 필요한 도메인 지식
   ├── 예상 소요 시간
   └── 서브태스크 분할 가능성
   │
3. 분기 결정
   ├── 단순 작업 → 직접 수행
   ├── 복잡 작업 → 분할 제안 생성
   │
4. 중요 결정 시 사용자 승인 요청
   ├── 새 홀론 생성
   ├── 비용이 높은 작업
   └── 위험도 높은 작업
   │
5. 승인 후 실행
```

#### 위임 판단 기준

```typescript
interface DelegationCriteria {
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  estimatedTokens: number;
  requiresSpecialization: boolean;
  canBeParallelized: boolean;

  autoDelegate: {
    tokenThreshold: number;
    complexityThreshold: 'moderate' | 'complex';
  };

  requiresApproval: {
    newHolonCreation: boolean;
    estimatedCostAbove: number;
    riskLevel: 'medium' | 'high';
  };
}
```

### 5.2 홀론 간 통신

#### 데이터베이스 기반 메시지 교환

```typescript
// 메시지 발송 (홀론이 API 호출)
async function sendMessage(
  fromHolonId: string,
  toHolonId: string,
  content: string,
  messageType: MessageType
): Promise<Message> {
  const message = await db.insert(messages).values({
    fromType: 'holon',
    fromId: fromHolonId,
    toType: 'holon',
    toId: toHolonId,
    content,
    messageType,
  }).returning();

  // NOTIFY 트리거가 자동으로 수신자에게 알림
  return message[0];
}

// 메시지 수신 대기 (백엔드 서버)
async function listenForMessages(holonId: string) {
  const client = await pool.connect();
  await client.query(`LISTEN holon_message_${holonId}`);

  client.on('notification', async (msg) => {
    const payload = JSON.parse(msg.payload);
    // WebSocket으로 홀론 프로세스에 전달
    notifyHolonProcess(holonId, payload);
  });
}
```

#### 메시지 흐름

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

### 5.3 Human-in-the-Loop

#### 승인 필요 액션

| 액션 | 승인 필요 조건 |
|------|----------------|
| 새 홀론 생성 | 항상 |
| 영구 홀론 삭제 | 항상 |
| 외부 API 호출 | 설정에 따라 |
| 파일 시스템 수정 | 허용 경로 외 접근 시 |
| 높은 비용 작업 | 임계값 초과 시 |

#### 승인 요청 인터페이스

```typescript
interface ApprovalRequest {
  id: string;
  holonId: string;
  requestType: 'holon_creation' | 'holon_deletion' | 'high_cost_action' | 'path_access';

  description: string;
  reasoning: string;

  estimatedCost?: number;
  riskLevel: 'low' | 'medium' | 'high';
  affectedEntities: string[];

  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedAt: Date;
  respondedAt?: Date;
  respondedBy?: string;
  responseNote?: string;
}
```

---

## 6. 웹 UI 설계

### 6.1 주요 화면

#### 6.1.1 조직도 뷰 (메인)
- Argo CD 스타일의 노드 그래프
- 각 홀론을 노드로 표시
- 상태에 따른 색상 구분
  - 녹색: 실행 중 (running)
  - 파란색: 대기 중 (waiting)
  - 회색: 유휴 (idle)
  - 빨간색: 오류 (error)
- 계층 구조 시각화
- 노드 클릭 시 상세 정보 패널

#### 6.1.2 홀론 상세 뷰
- 현재 작업 내용
- 대화 히스토리
- 할당된 태스크
- 자식 홀론 목록
- 실시간 로그 스트림

#### 6.1.3 프로젝트 관리 뷰
- 프로젝트 목록
- 칸반 보드 스타일 태스크 관리
- 진행 상황 대시보드

#### 6.1.4 대화 인터페이스
- 특정 홀론과의 1:1 대화
- 여러 홀론이 포함된 그룹 대화
- 명령어 전송 기능

### 6.2 실시간 업데이트

```typescript
// WebSocket 이벤트
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

## 7. Claude Code 통합

### 7.1 프로세스 실행

```typescript
interface ClaudeCodeConfig {
  command: 'claude';
  args: ['--dangerously-skip-permissions'];

  // 작업 디렉토리
  cwd: string;                   // 홀론별 허용 경로

  // 환경 변수
  env: {
    ANTHROPIC_API_KEY: string;
    HOLON_ID: string;
    HOLON_API_BASE_URL: string;  // 메시지 송수신 API
  };
}
```

### 7.2 홀론 시스템 프롬프트 구조

```markdown
# 홀론 역할 정의

## 당신의 정체성
- 홀론 ID: {holonId}
- 별칭: {alias}
- 조직: {organizationName}
- 상위 홀론: {parentAlias || 'None (루트)'}

## 역할
{userDefinedSystemPrompt}

## 권한
- 접근 가능 경로: {allowedPaths}
- 생성 가능 서브 홀론: {canCreateSubHolons}
- 직접 사용자 대화: {canTalkToUser}

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

### 7.3 메시지 수신 메커니즘

홀론은 주기적으로 API를 호출하거나 stdin을 통해 메시지 수신:

```typescript
// 옵션 1: 폴링 방식
const pollMessages = async (holonId: string) => {
  const response = await fetch(
    `${API_BASE_URL}/messages/inbox?holonId=${holonId}&unreadOnly=true`
  );
  return response.json();
};

// 옵션 2: stdin을 통한 푸시 (서버가 프로세스에 직접 전달)
// 서버 측에서 child_process.stdin.write()로 메시지 전달
```

---

## 8. MVP 구현 계획

### Phase 1: 코어 인프라

#### 목표
- 기본 프로젝트 구조 설정
- 핵심 타입 정의
- PostgreSQL 데이터베이스 설정

#### 산출물
- [ ] 모노레포 설정 (pnpm workspace)
- [ ] TypeScript 설정
- [ ] 핵심 인터페이스 구현 (`packages/core`)
- [ ] Docker Compose 설정 (PostgreSQL)
- [ ] Drizzle ORM 스키마 정의
- [ ] 마이그레이션 스크립트

### Phase 2: 홀론 프로세스 관리

#### 목표
- Claude Code 프로세스 실행/관리
- 홀론 생명주기 관리
- DB 기반 메시지 시스템

#### 산출물
- [ ] 프로세스 매니저
- [ ] 홀론 CRUD 작업
- [ ] 메시지 전달 시스템 (LISTEN/NOTIFY)
- [ ] 상태 동기화

### Phase 3: 백엔드 API

#### 목표
- REST API 구현
- WebSocket 서버
- PostgreSQL 실시간 이벤트 연동

#### 산출물
- [ ] Express/Fastify 서버
- [ ] API 엔드포인트
- [ ] WebSocket + pg LISTEN 통합
- [ ] 기본 에러 핸들링

### Phase 4: 웹 UI

#### 목표
- 조직도 시각화
- 기본 CRUD UI
- 실시간 상태 표시

#### 산출물
- [ ] Next.js 앱 설정
- [ ] 조직도 컴포넌트 (React Flow 활용)
- [ ] 홀론 상세 뷰
- [ ] 대화 인터페이스

### Phase 5: 통합 및 테스트

#### 목표
- 전체 시스템 통합
- E2E 테스트
- 문서화

#### 산출물
- [ ] 통합 테스트
- [ ] 사용자 가이드
- [ ] 배포 스크립트

---

## 9. 기술 스택 요약

| 영역 | 기술 |
|------|------|
| **프론트엔드** | Next.js 14, React 18, TypeScript |
| **상태 관리** | Zustand 또는 Jotai |
| **시각화** | React Flow (조직도), Tailwind CSS |
| **백엔드** | Node.js, Express/Fastify |
| **실시간** | WebSocket + PostgreSQL LISTEN/NOTIFY |
| **데이터베이스** | PostgreSQL 16 |
| **ORM** | Drizzle ORM |
| **프로세스** | Node.js child_process |
| **에이전트** | Claude Code (dangerously 모드) |
| **컨테이너** | Docker, Docker Compose |
| **빌드** | pnpm, Turborepo |

---

## 10. 리스크 및 고려사항

### 10.1 기술적 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Claude Code 프로세스 불안정 | 높음 | 재시작 메커니즘, 상태 DB 저장 |
| DB 연결 풀 고갈 | 중간 | 커넥션 풀링, 제한 설정 |
| API 비용 급증 | 높음 | 동시성 제한, 비용 모니터링 |
| PostgreSQL 성능 | 중간 | 인덱스 최적화, 쿼리 튜닝 |

### 10.2 보안 고려사항

- 홀론별 파일 시스템 접근 제한
- 데이터베이스 접근 권한 분리 (홀론은 API 통해서만 접근)
- 민감 정보 처리 정책
- API 키 관리
- SQL Injection 방지 (ORM 사용)

### 10.3 확장성

현재 MVP는 단일 PostgreSQL 인스턴스 기준. 향후 확장 시:
- Read Replica 추가
- 연결 풀러 (PgBouncer)
- 샤딩 또는 파티셔닝
- Docker Swarm / Kubernetes

---

## 11. 용어 정리

| 용어 | 정의 | 실제 회사 비유 |
|------|------|---------------|
| **Organization** | 최상위 컨테이너, 워크스페이스. 비용 한도 및 리소스 제한 설정 | 회사 |
| **Role** | 역할 템플릿 (시스템 프롬프트, 권한, 의사결정 영역, 자율성 수준, 기본 모델 정의) | 직무 기술서 (Job Description) |
| **Team** | 홀론들의 그룹. 사이클별 예산 및 홀론 수 제한 가능 | 부서, 팀 |
| **Hollon** | Role 기반 에이전트 인스턴스. 영구적/임시적 생명주기. 모델 오버라이드 가능 | 직원 (한 사람) |
| **Sub-Hollon** | 영구 홀론이 생성하는 임시 홀론. 비용/시간/모델 제한 적용 | 임시 외주 인력 |
| **Project** | 목표 달성을 위한 작업 묶음. Linear 스타일 | 프로젝트 |
| **Milestone** | 프로젝트의 중요 이정표 | 마일스톤 |
| **Cycle** | 시간 기반 작업 단위. 예산 추적 포함 | 스프린트 |
| **Task** | 재귀적 작업 단위. Sub-task 지원 | Linear 이슈 |
| **Channel** | 그룹 커뮤니케이션 공간. 스레드 지원 | Slack 채널 |
| **Document** | Markdown 기반 문서. 재귀적 폴더 구조. 버전 관리 | 파일시스템 + Git |
| **Message** | 1:1 커뮤니케이션 | DM |
| **Delegation** | 상위 홀론이 하위 홀론에게 작업 위임 | 업무 위임 |
| **Decision Domain** | 역할이 최종 결정권을 가지는 영역 | 의사결정 권한 범위 |
| **Autonomy Level** | 역할의 자율성 수준 (low/medium/high) | 권한 위임 수준 |
| **Metric** | 성과 측정 지표 정의 및 기록 | KPI |
| **Cycle Retrospective** | 사이클 종료 시 자동 생성되는 회고. 개선 제안 포함 | 스프린트 회고 |
| **Performance Summary** | 홀론/팀의 성과 요약 (비용 포함, 실시간 업데이트) | 성과 대시보드 |
| **Cost Record** | 모든 API 호출 비용 추적 (모델, 토큰, 비용) | 경비 지출 내역 |
| **Team Cycle Budget** | 팀별 사이클 예산 및 홀론 수 제한 | 팀 예산 배정 |
| **Holon Spawn Budget** | 홀론별 서브 홀론 생성 예산 및 제한 | 개인 외주 예산 |
| **Time Limit** | 시간대별 동시 홀론 수 제한 (업무시간/야간/주말 등) | 근무 시간 정책 |
| **Role Prompt Version** | 역할 프롬프트 버전 관리. 실험/개선으로 인한 변경 추적 | 업무 매뉴얼 버전 |
| **Scaling Rule** | 메트릭 기반 자동 스케일링 규칙 (가드레일 포함) | 인력 충원 기준 |
| **Experiment** | A/B 테스트 (프롬프트, 모델, 프로세스) | 파일럿 프로젝트 |
| **Improvement Proposal** | 회고/실험에서 도출된 개선 제안. 사용자 승인 필요 | 개선 제안서 |
| **ModelType** | 사용 가능한 모델 (haiku, sonnet, opus) | 직급/전문성 수준 |

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2024-12-03 | 0.1.0 | 초기 문서 작성 |
| 2024-12-03 | 0.2.0 | PostgreSQL 기반으로 변경, DB 스키마 추가 |
| 2024-12-03 | 0.3.0 | Role 개념 추가 (역할 템플릿과 홀론 인스턴스 분리) |
| 2024-12-03 | 0.4.0 | Team, Channel, Document 추가. Task를 재귀적 구조(Linear 스타일)로 변경 |
| 2024-12-03 | 0.5.0 | Team-Hollon 1:N 관계로 단순화, Milestone/Cycle 추가, Document를 Markdown 파일시스템 스타일로 변경 |
| 2024-12-03 | 0.6.0 | 스타트업 운영 기능 강화: Role에 decision_domains/autonomy_level 추가, Cycle에 goal/retrospective 추가, 성과 측정(Metrics) 시스템 추가 (metric_definitions, metric_records, metric_snapshots, holon_performance_summary, team_performance_summary) |
| 2024-12-03 | 0.7.0 | 자기 개선 시스템 추가: (1) **비용 통제** - Role/Hollon 모델 설정(haiku/sonnet/opus), 비용 기록(cost_records), 팀별 사이클 예산(team_cycle_budgets), 서브 홀론 스폰 예산(holon_spawn_budgets), 시간대별 홀론 제한(organization_time_limits) (2) **피드백 루프** - 회고에서 개선 제안 자동 생성, improvement_proposals 테이블, 사용자 승인 후 적용 (3) **프롬프트 버전 관리** - role_prompt_versions로 변경 추적, 성과 스냅샷 저장 (4) **스케일링 규칙** - 메트릭 기반 자동 스케일링(scaling_rules), 가드레일(cooldown, min/max), 이벤트 로그(scaling_events) (5) **A/B 테스트** - experiments 테이블로 프롬프트/모델/프로세스 실험, 통계적 유의성 검증 |
