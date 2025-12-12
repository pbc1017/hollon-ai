# 🤖 Task-Neutral Hollon Organization: Phase 4+ 구현 실험

> **작성일**: 2025-12-12
> **목적**: 범용 Hollon 조직이 Phase 4, 5, 6... 모든 Task를 자율 수행
> **핵심**: Capability 기반 Task 매칭 (Phase 종속 X)
> **참고 문서**: [`../../phases/phase4-revised-plan.md`](../../phases/phase4-revised-plan.md)
> **이전 실험**: [`dogfooding-2-report.md`](./dogfooding-2-report.md)

---

## 🔑 핵심 워크플로우 (Phase 3 완료된 자동화)

### Goal API + Cron 기반 완전 자동화

**Human의 역할**: Goal만 생성! (나머지는 100% 자동)

```bash
# 1. Human: Goal 생성
POST /goals
{
  title: "Phase 4.1: 지식 시스템 구축",
  assignedTeamId: backendEngineering.id,
  assignedHollonId: techLeadAlpha.id  # Manager
}

# 2. 이후 모든 과정 자동화 (GoalAutomationListener)
# ✅ T+1분: Goal → Task 자동 분해 (Manager가 Brain Provider로)
# ✅ T+2분: Task 자동 실행 (각 Hollon이 병렬로)
# ✅ T+3분: 코드 리뷰 및 자동 머지
```

**특징**:

- ❌ **제거**: `POST /orchestration/distribute-to-team` (수동 분배)
- ❌ **제거**: `POST /tasks` (team_epic) (직접 Task 생성)
- ✅ **사용**: `POST /goals` (Goal API)
- ✅ **자동**: GoalAutomationListener (3개 Cron)
- ✅ **Manager**: 각 Team마다 managerHollonId 지정

**참고**: [phase3-completion-analysis.md](../../archive/phase3-completion-analysis.md)

---

## 🎯 실험 목표

**"Hollon이 Hollon을 개발한다"**

Phase 4 (학습 및 성장) 구현을 실제 Hollon 팀에게 맡겨서:

1. 자율적으로 요구사항 분석
2. 코드 설계 및 구현
3. 테스트 작성 및 실행
4. 문서화 및 PR 생성

---

## 📋 Phase 4 구현 범위

### Phase 4.1 (Week 1-2): 지식 시스템

**구현 대상**:

- `KnowledgeExtractionService` (Task → Document 자동 생성)
- `VectorSearchService` (pgvector + OpenAI embedding)
- `KnowledgeGraphService` (document_relationships)
- `PromptComposerService` 통합 (Vector + Graph RAG)

**Acceptance Criteria**:

- [ ] Task 완료 시 Document 자동 생성 (100%)
- [ ] Vector search 정확도 85%+
- [ ] Graph traversal 정확도 80%+
- [ ] PromptComposerService 통합 완료
- [ ] E2E 테스트 통과

### Phase 4.2 (Week 3-4): 실시간 협업 인프라

**구현 대상**:

- `Channel` Entity & Service (그룹 채팅)
- `ContinuousImprovementService` (실시간 성과 분석)
- `MessageListener` 개선 (Channel 통합)

**Acceptance Criteria**:

- [ ] Channel 생성 및 메시지 전송
- [ ] ContinuousImprovementService 매일 실행
- [ ] Task 완료 시 실시간 분석 및 학습
- [ ] Threshold 초과 시 자동 개선 Task 생성
- [ ] E2E 테스트 통과

### Phase 4.3 (Week 5-6): 메모리 및 자기 개선

**구현 대상**:

- `PerformanceAnalyzer` (성과 메트릭 수집)
- `PromptOptimizer` (Prompt 효과 분석)
- `BestPracticeService` (고성과 패턴 학습)

**Acceptance Criteria**:

- [ ] Task 완료 시 메트릭 자동 수집
- [ ] Prompt 효과 분석 (토큰 15% 절감 목표)
- [ ] 베스트 프랙티스 자동 학습
- [ ] E2E 테스트 통과

---

## 🏗️ 조직 구조 (Task-Neutral)

### Organization: Hollon AI Development

**핵심 원칙**:

- ✅ 범용 역할 (Phase 4, 5, 6... 모두 수행 가능)
- ✅ Capability 기반 Task 매칭
- ✅ 재사용 가능한 Hollon

```
Organization: Hollon AI
├── Team: Backend Engineering
│   ├── Manager: TechLead-Alpha
│   ├── Senior: BackendDev-Bravo
│   ├── Senior: BackendDev-Charlie
│   └── Junior: BackendDev-Delta
│
├── Team: Data & AI Engineering
│   ├── Manager: AILead-Echo
│   ├── Senior: DataEngineer-Foxtrot
│   └── Senior: MLEngineer-Golf
│
└── Team: Quality & Testing
    ├── Manager: QALead-Hotel
    └── Senior: TestEngineer-India
```

**특징**:

- Phase 4.1 (지식) → Data & AI Engineering + Backend Engineering
- Phase 4.2 (협업) → Backend Engineering
- Phase 4.3 (메모리) → Data & AI Engineering
- Phase 5.1 (CLI) → Backend Engineering
- Phase 5.2 (UI) → Frontend Engineering (필요 시 추가)
- **모든 Phase에 재사용 가능**

---

## 📊 실험 설계

### 실험 단계

| Stage         | Activity                                 | Duration | Output                   |
| ------------- | ---------------------------------------- | -------- | ------------------------ |
| **Setup**     | Organization, Teams, Roles, Hollons 생성 | 1 day    | 9 Hollons                |
| **Phase 4.1** | 지식 시스템 구현                         | 2 weeks  | Working Knowledge System |
| **Phase 4.2** | 협업 인프라 구현                         | 2 weeks  | Working Collaboration    |
| **Phase 4.3** | 메모리 시스템 구현                       | 2 weeks  | Working Memory System    |
| **Review**    | 결과 분석 및 보고서 작성                 | 3 days   | Dogfooding Report        |

**총 기간**: 약 6-7주

---

## 🎯 Task-Neutral Hollon 역할 정의

### Team 1: Backend Engineering

#### TechLead-Alpha (Manager)

**Role**: Technical Lead / Backend Architect
**Capabilities**:

- `system-design` - 시스템 아키텍처 설계
- `backend-architecture` - 백엔드 구조 설계
- `task-distribution` - Task 분해 및 분배
- `code-review` - 코드 리뷰
- `typescript`, `nestjs` - 기술 스택

**Personality**:

> "저는 기술적 리더십을 발휘하여 시스템을 설계하고, 팀원들에게 적절한 Task를 배분합니다. 요구사항을 분석하고 최적의 아키텍처를 제안합니다."

**수행 가능 Task**:

- Phase 4.1: KnowledgeExtractionService 아키텍처 설계
- Phase 4.2: Channel 시스템 설계
- Phase 4.3: PerformanceAnalyzer 설계
- Phase 5.1: HollonActionsController 설계
- 모든 백엔드 아키텍처 설계

---

#### BackendDev-Bravo (Senior Developer)

**Role**: Senior Backend Developer
**Capabilities**:

- `typescript`, `nestjs` - NestJS 백엔드 개발
- `database-design` - DB 스키마 설계
- `api-development` - RESTful API 개발
- `event-driven` - 이벤트 기반 아키텍처

**Personality**:

> "저는 백엔드 시스템을 구현합니다. TypeScript와 NestJS를 활용하여 확장 가능하고 유지보수하기 쉬운 코드를 작성합니다."

**수행 가능 Task**:

- Phase 4.1: KnowledgeExtractionService 구현
- Phase 4.2: Channel Entity & Service 구현
- Phase 5.1: Hollon CLI Backend API 구현
- 모든 NestJS 서비스 구현

---

#### BackendDev-Charlie (Senior Developer)

**Role**: Senior Backend Developer (Event & Integration)
**Capabilities**:

- `typescript`, `nestjs`
- `event-emitter` - 이벤트 처리
- `message-queue` - 메시지 큐 (RabbitMQ 등)
- `integration` - 외부 시스템 통합

**Personality**:

> "저는 이벤트 기반 시스템과 외부 연동을 담당합니다. Listener, Queue, Integration을 구현합니다."

**수행 가능 Task**:

- Phase 4.2: MessageListener 개선
- Phase 4.2: ContinuousImprovementService (@OnEvent)
- Phase 5.3: GitHub/Slack Integration
- 모든 이벤트 처리 및 외부 연동

---

#### BackendDev-Delta (Junior Developer)

**Role**: Junior Backend Developer
**Capabilities**:

- `typescript`, `nestjs`
- `unit-testing` - 단위 테스트 작성
- `documentation` - API 문서화

**Personality**:

> "저는 주니어 개발자로서 단위 테스트 작성과 문서화를 담당합니다. 시니어 개발자의 코드를 학습하며 성장합니다."

**수행 가능 Task**:

- 모든 Phase의 단위 테스트 작성
- API 문서 작성
- 간단한 CRUD 구현

---

### Team 2: Data & AI Engineering

#### AILead-Echo (Manager)

**Role**: AI/ML Engineering Lead
**Capabilities**:

- `machine-learning` - ML 시스템 설계
- `vector-databases` - Vector DB (pgvector 등)
- `llm-integration` - LLM 통합
- `data-architecture` - 데이터 아키텍처

**Personality**:

> "저는 AI/ML 시스템을 설계하고, 데이터 파이프라인을 구축합니다. Vector RAG, Graph RAG, Prompt 최적화 등을 담당합니다."

**수행 가능 Task**:

- Phase 4.1: VectorSearchService 아키텍처
- Phase 4.3: PromptOptimizer 설계
- Phase 5.1: Knowledge Search CLI 설계
- 모든 AI/ML 관련 아키텍처

---

#### DataEngineer-Foxtrot (Senior Developer)

**Role**: Senior Data Engineer
**Capabilities**:

- `typescript`, `nestjs`
- `pgvector` - PostgreSQL Vector Extension
- `graph-databases` - 그래프 DB
- `data-pipeline` - 데이터 파이프라인

**Personality**:

> "저는 데이터 엔지니어로서 Vector 검색, Graph 탐색, 데이터 파이프라인을 구축합니다."

**수행 가능 Task**:

- Phase 4.1: VectorSearchService 구현
- Phase 4.1: KnowledgeGraphService 구현
- Phase 4.3: 메트릭 수집 파이프라인
- 모든 데이터 처리 및 저장

---

#### MLEngineer-Golf (Senior Developer)

**Role**: Senior ML Engineer
**Capabilities**:

- `typescript`, `nestjs`
- `openai-api` - OpenAI API 통합
- `prompt-engineering` - Prompt 엔지니어링
- `embeddings` - Embedding 생성

**Personality**:

> "저는 ML 엔지니어로서 LLM 통합, Embedding 생성, Prompt 최적화를 담당합니다."

**수행 가능 Task**:

- Phase 4.1: OpenAI Embedding 통합
- Phase 4.3: PromptOptimizer 구현
- Phase 4.3: BestPracticeService 구현
- 모든 LLM 관련 기능

---

### Team 3: Quality & Testing

#### QALead-Hotel (Manager)

**Role**: QA Engineering Lead
**Capabilities**:

- `test-strategy` - 테스트 전략 수립
- `e2e-testing` - E2E 테스트 설계
- `quality-assurance` - 품질 보증

**Personality**:

> "저는 QA 리더로서 테스트 전략을 수립하고, 품질을 보증합니다. E2E 테스트 시나리오를 설계합니다."

**수행 가능 Task**:

- 모든 Phase의 E2E 테스트 전략
- 품질 검증 및 승인
- 테스트 커버리지 관리

---

#### TestEngineer-India (Senior Developer)

**Role**: Senior Test Engineer
**Capabilities**:

- `typescript`
- `jest` - Jest 테스트 프레임워크
- `e2e-testing` - Playwright 등
- `integration-testing` - 통합 테스트

**Personality**:

> "저는 테스트 엔지니어로서 E2E 테스트와 통합 테스트를 작성합니다. 모든 기능이 정상 작동하는지 검증합니다."

**수행 가능 Task**:

- 모든 Phase의 E2E 테스트 작성
- Integration 테스트 작성
- 테스트 자동화

---

## 📝 Task 구조 (Capability-based Matching)

### Goal (Level 0) - Cron 기반 자동 분해

```typescript
// Phase 4.1 Goal (Goal API 사용!)
{
  title: "Phase 4.1: 지식 시스템 구축",
  description: "Task 완료 후 자동으로 지식이 축적되고, 다음 Task 실행 시 자동으로 참조되는 시스템 구현",
  assignedTeamId: backendEngineering.id,  // 범용 팀!
  assignedHollonId: techLeadAlpha.id,     // Manager에게 배정
  acceptanceCriteria: [
    "KnowledgeExtractionService 구현",
    "VectorSearchService 구현",
    "KnowledgeGraphService 구현",
    "PromptComposerService 통합",
    "E2E 테스트 통과"
  ],
  metadata: {
    requiredSkills: ["typescript", "nestjs", "vector-databases", "llm-integration"]
  }
}

// GoalAutomationListener (Cron) 자동 처리:
// 1. T+1분: autoDecomposeGoals() → Goal을 Task들로 분해
// 2. T+2분: autoExecuteTasks() → 각 Task 실행
// 3. T+3분: autoReviewTasks() → 코드 리뷰 및 머지
// → Human은 Goal만 생성하면 끝!
```

### Capability-based Task 매칭

Manager Hollon이 **requiredSkills 기반**으로 자율 분배:

#### Phase 4.1 Subtasks

| Subtask                  | Required Capabilities                  | → Assigned Hollon                        | Reason          |
| ------------------------ | -------------------------------------- | ---------------------------------------- | --------------- |
| KnowledgeExtraction 구현 | `typescript`, `nestjs`, `event-driven` | **BackendDev-Charlie**                   | Event 처리 전문 |
| VectorSearch 구현        | `pgvector`, `data-pipeline`            | **DataEngineer-Foxtrot**                 | Vector DB 전문  |
| KnowledgeGraph 구현      | `graph-databases`, `data-pipeline`     | **DataEngineer-Foxtrot**                 | Graph DB 전문   |
| PromptComposer 통합      | `system-design`, `llm-integration`     | **TechLead-Alpha** + **MLEngineer-Golf** | 아키텍처 + LLM  |
| E2E 테스트               | `e2e-testing`                          | **TestEngineer-India**                   | 테스트 전문     |

#### Phase 4.2 Subtasks

| Subtask                    | Required Capabilities                     | → Assigned Hollon                            | Reason         |
| -------------------------- | ----------------------------------------- | -------------------------------------------- | -------------- |
| Channel Entity 구현        | `typescript`, `nestjs`, `database-design` | **BackendDev-Bravo**                         | DB 스키마 전문 |
| ContinuousImprovement 구현 | `event-driven`, `llm-integration`         | **BackendDev-Charlie** + **MLEngineer-Golf** | Event + LLM    |
| MessageListener 개선       | `event-emitter`, `integration`            | **BackendDev-Charlie**                       | Event 전문     |
| E2E 테스트                 | `e2e-testing`                             | **TestEngineer-India**                       | 테스트 전문    |

#### Phase 4.3 Subtasks

| Subtask                  | Required Capabilities                   | → Assigned Hollon        | Reason            |
| ------------------------ | --------------------------------------- | ------------------------ | ----------------- |
| PerformanceAnalyzer 구현 | `data-pipeline`, `metrics`              | **DataEngineer-Foxtrot** | 데이터 파이프라인 |
| PromptOptimizer 구현     | `llm-integration`, `prompt-engineering` | **MLEngineer-Golf**      | Prompt 전문       |
| BestPractice 구현        | `machine-learning`, `llm-integration`   | **AILead-Echo**          | ML 아키텍처       |
| E2E 테스트               | `e2e-testing`                           | **TestEngineer-India**   | 테스트 전문       |

**핵심**:

- ✅ Hollon은 Phase에 종속되지 않음
- ✅ Task의 `requiredSkills`와 Hollon의 `capabilities` 매칭
- ✅ Phase 4, 5, 6... 모두 동일한 팀으로 수행 가능

---

## 🔬 실험 프로세스

### 1. Setup (Day 1) - Task-Neutral Organization

```bash
# 1. Organization 생성
POST /organizations
{
  name: "Hollon AI Development",
  description: "범용 Hollon 조직 (Phase 4, 5, 6... 모두 수행)"
}

# 2. Teams 생성 (기능별, Phase별 아님!)
POST /teams
{
  name: "Backend Engineering",
  organizationId: org.id,
  description: "백엔드 시스템 개발 (NestJS, API, DB)"
}

POST /teams
{
  name: "Data & AI Engineering",
  organizationId: org.id,
  description: "데이터 파이프라인, Vector/Graph RAG, LLM 통합"
}

POST /teams
{
  name: "Quality & Testing",
  organizationId: org.id,
  description: "E2E 테스트, 품질 보증"
}

# 3. Roles 생성 (범용 역할!)
POST /roles
{
  name: "Technical Lead",
  capabilities: ["system-design", "backend-architecture", "task-distribution"],
  organizationId: org.id
}

POST /roles
{
  name: "Senior Backend Developer",
  capabilities: ["typescript", "nestjs", "database-design", "api-development"],
  organizationId: org.id
}

POST /roles
{
  name: "Senior Data Engineer",
  capabilities: ["pgvector", "graph-databases", "data-pipeline"],
  organizationId: org.id
}

POST /roles
{
  name: "Senior ML Engineer",
  capabilities: ["llm-integration", "prompt-engineering", "openai-api"],
  organizationId: org.id
}

POST /roles
{
  name: "QA Lead",
  capabilities: ["test-strategy", "e2e-testing", "quality-assurance"],
  organizationId: org.id
}

# 4. Hollons 생성 (총 9명)
POST /hollons
{
  name: "TechLead-Alpha",
  roleId: technicalLeadRole.id,
  teamId: backendTeam.id,
  personality: "기술적 리더십을 발휘하여 시스템을 설계하고..."
}

POST /hollons
{
  name: "BackendDev-Bravo",
  roleId: seniorBackendRole.id,
  teamId: backendTeam.id,
  personality: "백엔드 시스템을 구현합니다..."
}

# (나머지 7명 생성...)

# 5. Manager 지정
PATCH /teams/{backendTeam.id}
{
  managerHollonId: techLeadAlpha.id
}

PATCH /teams/{dataAITeam.id}
{
  managerHollonId: aiLeadEcho.id
}

PATCH /teams/{qaTeam.id}
{
  managerHollonId: qaLeadHotel.id
}
```

### 2. Phase 4.1 Kickoff (Day 2) - Goal API & Cron Automation

```bash
# Goal 생성 (Phase 3 완료된 Goal API 사용!)
POST /goals
{
  title: "Phase 4.1: 지식 시스템 구축",
  description: "Task 완료 후 자동으로 지식이 축적되고, 다음 Task 실행 시 자동으로 참조되는 시스템 구현\n\n참고: docs/phases/phase4-revised-plan.md의 Phase 4.1 섹션",
  assignedTeamId: backendEngineering.id,  // 범용 팀!
  assignedHollonId: techLeadAlpha.id,     // Manager에게 배정
  acceptanceCriteria: [
    "KnowledgeExtractionService 구현 완료",
    "VectorSearchService 구현 (정확도 85%+)",
    "KnowledgeGraphService 구현 완료",
    "PromptComposerService 통합 완료",
    "E2E 테스트 90%+ 통과"
  ],
  metadata: {
    requiredSkills: [
      "typescript",
      "nestjs",
      "vector-databases",  // → DataEngineer-Foxtrot 매칭
      "llm-integration",   // → MLEngineer-Golf 매칭
      "event-driven"       // → BackendDev-Charlie 매칭
    ]
  }
}

# 이후 자동 워크플로우 (GoalAutomationListener - Phase 3 완료)
#
# T+0분: Goal 생성 완료
#
# T+1분: GoalAutomationListener.autoDecomposeGoals() (Cron)
#   → GoalDecompositionService.decomposeGoal()
#   → TechLead-Alpha (Manager)가 Brain Provider로 분해:
#      1. phase4-revised-plan.md 읽기
#      2. Subtask 분해 (Task 엔티티 생성)
#      3. 각 Subtask의 requiredSkills 분석
#      4. Capability 매칭으로 팀원 자동 배정:
#         - Task: "KnowledgeExtraction 구현" → BackendDev-Charlie
#         - Task: "VectorSearch 구현" → DataEngineer-Foxtrot
#         - Task: "KnowledgeGraph 구현" → DataEngineer-Foxtrot
#         - Task: "PromptComposer 통합" → MLEngineer-Golf
#         - Task: "E2E 테스트" → TestEngineer-India
#
# T+2분: GoalAutomationListener.autoExecuteTasks() (Cron)
#   → TaskExecutionService.executeTask() (각 assignedHollonId)
#   → Git worktree 생성, 코드 작성, PR 생성
#
# T+3분: GoalAutomationListener.autoReviewTasks() (Cron)
#   → 코드 리뷰 및 자동 머지
#
# 총 소요 시간: ~6분 (Goal 생성 → Task 완료)
#
# ✅ 장점:
# - Human 개입 없음 (Goal 생성만 하면 끝!)
# - Cron이 자동으로 분해, 실행, 리뷰
# - Manager Hollon이 자율적으로 팀원 배정
# - Capability 기반 매칭 (requiredSkills)
#
# 결과: 3개 팀이 자동으로 협업하여 Phase 4.1 완성!
# - Backend Engineering: 전체 조율 (TechLead-Alpha)
# - Data & AI Engineering: Vector/Graph/LLM
# - Quality & Testing: 테스트
```

### 3. 자동 워크플로우 (GoalAutomationListener - Phase 3 완료)

**핵심**: Human은 Goal만 생성하면, Cron이 자동으로 분해 → 실행 → 리뷰!

#### GoalAutomationListener 3-Cron 시스템

```typescript
// apps/server/src/modules/goal/listeners/goal-automation.listener.ts
@Injectable()
export class GoalAutomationListener {
  // Cron 1: 매 1분마다 Goal → Task 자동 분해
  @Cron('*/1 * * * *')
  async autoDecomposeGoals(): Promise<void> {
    // 1. status='pending' Goal 조회
    const pendingGoals = await this.goalService.findPendingGoals();

    // 2. Manager Hollon이 Brain Provider로 분해
    for (const goal of pendingGoals) {
      await this.goalDecompositionService.decomposeGoal(goal.id);
      // → Task 엔티티들 생성 (assignedHollonId 포함)
    }
  }

  // Cron 2: 매 2분마다 Task 자동 실행
  @Cron('*/2 * * * *')
  async autoExecuteTasks(): Promise<void> {
    // 1. status='todo' Task 조회
    const todoTasks = await this.taskService.findTodoTasks();

    // 2. 각 Hollon이 Brain Provider로 실행
    for (const task of todoTasks) {
      await this.taskExecutionService.executeTask(task.id);
      // → Git worktree 생성, 코드 작성, PR 생성
    }
  }

  // Cron 3: 매 3분마다 코드 리뷰 및 머지
  @Cron('*/3 * * * *')
  async autoReviewTasks(): Promise<void> {
    // 1. status='in_review' Task 조회
    const reviewTasks = await this.taskService.findInReviewTasks();

    // 2. 코드 리뷰 및 자동 머지
    for (const task of reviewTasks) {
      await this.codeReviewService.reviewAndMerge(task.id);
      // → 테스트 통과 시 자동 머지
    }
  }
}
```

#### 완전 자동화 워크플로우

```
T+0분  : Human이 POST /goals 호출
         └─ Goal 생성 (status='pending')

T+1분  : Cron 1 실행 (autoDecomposeGoals)
         └─ TechLead-Alpha (Manager)가 Brain Provider 호출
            ├─ phase4-revised-plan.md 읽기
            ├─ Subtask 5개 분해
            │  ├─ Task 1: "KnowledgeExtraction 구현" → BackendDev-Charlie
            │  ├─ Task 2: "VectorSearch 구현" → DataEngineer-Foxtrot
            │  ├─ Task 3: "KnowledgeGraph 구현" → DataEngineer-Foxtrot
            │  ├─ Task 4: "PromptComposer 통합" → MLEngineer-Golf
            │  └─ Task 5: "E2E 테스트" → TestEngineer-India
            └─ Task 엔티티 생성 (status='todo', assignedHollonId 포함)

T+2분  : Cron 2 실행 (autoExecuteTasks)
         └─ 각 Hollon이 Brain Provider 호출
            ├─ BackendDev-Charlie: KnowledgeExtraction 구현 시작
            ├─ DataEngineer-Foxtrot: VectorSearch 구현 시작
            ├─ MLEngineer-Golf: PromptComposer 통합 시작
            └─ (각자 Git worktree에서 병렬 작업)

T+2시간: Task 완료 (평균)
         └─ status='in_review', PR 생성

T+3분  : Cron 3 실행 (autoReviewTasks)
         └─ CodeReviewService.reviewAndMerge()
            ├─ CI 테스트 통과 확인
            ├─ 코드 리뷰 (Brain Provider)
            └─ 자동 머지 (승인 시)

완료!
```

**핵심 장점**:

- ✅ Human 개입 없음 (Goal 생성만!)
- ✅ Cron이 모든 단계 자동화
- ✅ Manager가 자율 분해 및 배정
- ✅ 병렬 실행 (Git worktree 격리)

---

### 4. 개발 사이클 (2주)

**매일** (Cron 자동 실행):

- 매 1분: Goal → Task 분해 (필요 시)
- 매 2분: Task 실행 (Hollon들)
- 매 3분: 코드 리뷰 및 머지
- 완료 시 Document 자동 생성 (Phase 4.1 구현 후)
- Manager가 진행 상황 모니터링

**매주**:

- Manager가 주간 리포트 생성
- 블로커 식별 및 해결
- 필요 시 Task 재분배

### 5. 검증 (Phase 종료 시)

```bash
# E2E 테스트 실행
pnpm --filter @hollon-ai/server test:e2e phase4.1

# 성공 기준 체크
- [ ] Task 완료 시 Document 생성 확인
- [ ] Vector search 정확도 85%+ 확인
- [ ] Graph traversal 정확도 80%+ 확인
- [ ] 모든 E2E 테스트 통과
```

---

## 📊 측정 지표

### 자율성 지표

| Metric             | Target | Measurement                                |
| ------------------ | ------ | ------------------------------------------ |
| **Task 자동 분해** | 90%+   | Manager가 Human 개입 없이 분해한 Task 비율 |
| **자율 완료율**    | 80%+   | Human 개입 없이 완료된 Task 비율           |
| **블로커 해결**    | 70%+   | Hollon 스스로 해결한 블로커 비율           |

### 품질 지표

| Metric              | Target | Measurement                     |
| ------------------- | ------ | ------------------------------- |
| **테스트 커버리지** | 80%+   | 작성된 코드의 테스트 커버리지   |
| **버그 발생률**     | <10%   | 완료된 Task 대비 버그 발생 비율 |
| **코드 품질**       | Good+  | SonarQube 기준                  |

### 효율성 지표

| Metric        | Target | Measurement                                     |
| ------------- | ------ | ----------------------------------------------- |
| **개발 속도** | 1.5x+  | Human 대비 속도 (상대 비교)                     |
| **비용 효율** | 2x+    | Human 대비 비용 (Brain Provider 호출 비용 포함) |

---

## 🚧 예상되는 도전 과제

### 1. 복잡한 요구사항 이해

**문제**: Phase 4 문서가 상세하지만, Hollon이 전체 맥락을 이해하지 못할 수 있음

**해결책**:

- 문서를 섹션별로 분해하여 제공
- Manager에게 "요구사항 질문" 기회 부여
- Human이 초기 Q&A 세션 진행

### 2. 아키텍처 결정

**문제**: Vector RAG + Graph RAG 통합 방식 등 고수준 설계 결정 필요

**해결책**:

- Manager Hollon에게 "Design Document 작성" Task 부여
- Human이 Design Review 수행 (Approval Request)
- 승인 후 구현 진행

### 3. 테스트 작성

**문제**: 단위 테스트와 E2E 테스트를 적절히 작성하는지 검증 필요

**해결책**:

- Acceptance Criteria에 "테스트 커버리지 80%+" 명시
- Code Review Task에서 테스트 검증
- 필요 시 테스트 전문 Hollon 추가

---

## 🎯 성공 기준

### Minimum Success (최소 성공)

- [ ] Phase 4.1, 4.2, 4.3 중 **최소 1개** 완료
- [ ] 완료된 Phase의 E2E 테스트 **80%+ 통과**
- [ ] Human 개입 **30% 미만**

### Target Success (목표 성공)

- [ ] Phase 4.1, 4.2 **완료**
- [ ] 완료된 Phase의 E2E 테스트 **90%+ 통과**
- [ ] Human 개입 **20% 미만**
- [ ] 자율 Goal 생성 **시도** (Phase 4.3 일부 구현 시)

### Stretch Success (초과 성공)

- [ ] Phase 4.1, 4.2, 4.3 **모두 완료**
- [ ] 모든 E2E 테스트 **95%+ 통과**
- [ ] Human 개입 **10% 미만**
- [ ] Hollon이 Phase 5 계획 제안

---

## 📅 타임라인

```
Week 1: Setup + Phase 4.1 Kickoff
├── Day 1: Organization, Teams, Roles, Hollons 생성
├── Day 2-3: Phase 4.1 Team Epic 생성 및 분배
├── Day 4-5: 개발 시작 (KnowledgeExtraction, VectorSearch)
└── Week Review

Week 2-3: Phase 4.1 개발
├── KnowledgeExtractionService 구현
├── VectorSearchService 구현
├── KnowledgeGraphService 구현
├── PromptComposerService 통합
└── E2E 테스트

Week 4: Phase 4.2 Kickoff
├── Day 1: Phase 4.2 Team Epic 생성
├── Day 2-5: Channel, ContinuousImprovement 구현
└── Week Review

Week 5-6: Phase 4.2 개발 + Phase 4.3 Kickoff
├── Phase 4.2 완료
├── Phase 4.3 시작
└── Final Review

Week 7: 결과 분석 및 보고서 작성
```

---

## 📝 문서화

### 자동 생성 문서 (Hollon이 생성)

1. **Design Document**: Manager가 아키텍처 설계 문서 작성
2. **API Documentation**: Developer가 API 문서 자동 생성
3. **Test Report**: E2E 테스트 결과 리포트
4. **Weekly Progress Report**: Manager가 주간 진행 보고서 작성

### Human 작성 문서

1. **Dogfooding Report**: 실험 결과 분석 및 학습 사항
2. **Hollon Performance Review**: 각 Hollon의 성과 평가
3. **Improvement Recommendations**: 시스템 개선 제안

---

## 🎯 Task-Neutral Approach의 핵심 장점

### 1. 재사용성 (Reusability)

**기존 (Phase 종속)**:

```
Phase 4 완료 → KnowledgeArchitect-AI, VectorEngineer-AI 등 9명 폐기
Phase 5 시작 → UIArchitect-AI, FrontendDev-AI 등 새로 9명 생성
→ 총 18명 Hollon 필요!
```

**Task-Neutral (범용)**:

```
Phase 4, 5, 6... → 동일한 9명 Hollon 계속 사용
→ 총 9명 Hollon만 필요!
```

**절감 효과**:

- Hollon 생성 비용 50% 감소
- 학습 데이터 누적 (Phase 4 경험 → Phase 5에 활용)
- 팀 시너지 (같은 팀이 계속 협업)

---

### 2. 확장성 (Scalability)

**Hollon 추가 시**:

```typescript
// Backend Team에 주니어 개발자 추가
POST /hollons
{
  name: "BackendDev-Juliet",
  roleId: juniorBackendRole.id,
  teamId: backendEngineering.id,
  capabilities: ["typescript", "nestjs", "unit-testing"]
}

// 즉시 Phase 4, 5, 6 모든 Task에 투입 가능!
```

**Team 추가 시**:

```typescript
// Frontend Team 추가 (Phase 5.2 UI 준비)
POST /teams
{
  name: "Frontend Engineering",
  organizationId: org.id,
  description: "웹 UI 개발 (Next.js, React)"
}

// 9명 → 13명으로 확장, 모든 Phase 대응 가능
```

---

### 3. 유연성 (Flexibility)

**Capability 기반 매칭**:

```typescript
// Task 생성 시
{
  title: "새로운 기능 구현",
  requiredSkills: ["typescript", "nestjs", "websocket"]
}

// 시스템이 자동으로:
// 1. websocket capability 보유 Hollon 검색
// 2. BackendDev-Charlie 발견 (event-driven, websocket)
// 3. 자동 배정
// → Phase 번호와 무관하게 작동!
```

---

### 4. 현실성 (Realism)

**실제 소프트웨어 조직과 유사**:

```
실제 회사:
├── Backend Team → 모든 백엔드 기능 담당 (Phase 구분 X)
├── Frontend Team → 모든 프론트엔드 기능 담당
└── QA Team → 모든 테스트 담당

Hollon AI (Task-Neutral):
├── Backend Engineering → Phase 4, 5, 6 모든 백엔드
├── Data & AI Engineering → Phase 4, 5, 6 모든 AI/ML
└── Quality & Testing → Phase 4, 5, 6 모든 테스트
```

---

### 5. 학습 및 성장 (Learning & Growth)

**경험 누적**:

```
Phase 4.1: VectorSearch 구현 (DataEngineer-Foxtrot)
→ Document 생성: "pgvector 최적화 방법"

Phase 4.3: PerformanceAnalyzer 구현 (DataEngineer-Foxtrot)
→ 이전 경험 참조: "pgvector 쿼리 최적화"

Phase 5.1: Knowledge Search CLI (DataEngineer-Foxtrot)
→ 누적 경험 활용: "Vector 검색 베스트 프랙티스"
```

**팀 시너지**:

```
TechLead-Alpha + DataEngineer-Foxtrot:
→ Phase 4.1에서 협업 경험
→ Phase 4.3에서 더 효율적으로 협업
→ Phase 5.1에서 완벽한 호흡
```

---

### 6. 비교표

| Aspect        | Phase-Specific          | Task-Neutral            |
| ------------- | ----------------------- | ----------------------- |
| **Hollon 수** | 27명 (9명 x 3 Phase)    | 9명                     |
| **생성 비용** | 높음                    | 낮음                    |
| **학습 누적** | 없음 (Phase마다 초기화) | 있음 (지속 성장)        |
| **확장성**    | 낮음 (Phase마다 재설계) | 높음 (Hollon/Team 추가) |
| **유지보수**  | 복잡 (Phase별 관리)     | 간단 (통합 관리)        |
| **현실성**    | 낮음 (실제 조직과 다름) | 높음 (실제 조직 유사)   |

---

## 🔗 관련 문서

- 📋 [Phase 4 상세 계획](../../phases/phase4-revised-plan.md)
- 🎯 [SSOT](../../principles/ssot.md)
- 📊 [이전 Dogfooding 실험](./dogfooding-2-report.md)
- 🏗️ [DDD Refactoring](../ddd-refactoring/ddd-refactoring-plan.md)

---

**문서 버전**: 1.0
**작성일**: 2025-12-12
**작성자**: Human + Claude Code
**상태**: 계획 (실행 대기)
