# Phase 1: MVP 코어 (자율 실행 엔진) - 상세 계획

> **핵심 목표**: 홀론이 태스크를 자율적으로 Pull → 실행 → 완료하는 사이클 구현

---

## 완료 기준

- [ ] 단일 홀론이 태스크를 Pull하여 Brain Provider(Claude Code)로 실행
- [ ] 결과물 품질 검증 및 실패 시 재시도/에스컬레이션
- [ ] 비용 한도 초과 시 작업 중단
- [ ] 생성된 코드 컴파일/테스트 검증 통과
- [ ] 2개 홀론 동시 운영 스모크 테스트 통과

---

## Week 1-2: 인프라 및 데이터 계층

### Week 1: 프로젝트 설정

#### Day 1-2: 모노레포 초기화
```
hollon-ai/
├── apps/
│   ├── server/          # NestJS 백엔드
│   └── web/             # Next.js (Phase 5에서 구현, 스켈레톤만)
├── packages/
│   └── shared/          # 공통 타입, 유틸리티
├── docker/
│   └── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

**작업 목록**:
- [ ] pnpm workspace 설정
- [ ] Turborepo 설정 (빌드/린트/테스트 파이프라인)
- [ ] ESLint + Prettier 공통 설정
- [ ] TypeScript 설정 (strict mode)
- [ ] .env 구조 설계 (dev/prod)

#### Day 3-4: Docker 및 데이터베이스
```yaml
# docker/docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: hollon
      POSTGRES_USER: hollon
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

**작업 목록**:
- [ ] Docker Compose 설정 (PostgreSQL 16 + pgvector)
- [ ] 데이터베이스 초기화 스크립트
- [ ] pgvector extension 활성화
- [ ] 연결 테스트

#### Day 5: NestJS 프로젝트 구조
```
apps/server/src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/
│   ├── filters/
│   │   └── all-exceptions.filter.ts
│   ├── guards/
│   └── interceptors/
│       └── logging.interceptor.ts
├── config/
│   ├── configuration.ts
│   ├── database.config.ts
│   └── validation.ts
└── modules/
    └── health/
        └── health.controller.ts
```

**작업 목록**:
- [ ] NestJS 프로젝트 생성
- [ ] 공통 모듈 구조 설정
- [ ] ConfigModule 설정 (@nestjs/config)
- [ ] Health check 엔드포인트
- [ ] 로깅 인터셉터

---

### Week 2: 핵심 엔티티 및 CRUD

#### Day 1-2: TypeORM 엔티티 정의

**우선순위 엔티티** (Phase 1 필수):
1. `Organization`
2. `BrainProviderConfig`
3. `Role`
4. `Team`
5. `Hollon`
6. `Project`
7. `Task` (+ `TaskDependency`)
8. `Document`
9. `CostRecord`
10. `ApprovalRequest`

**작업 목록**:
- [ ] Organization 엔티티 + 마이그레이션
- [ ] BrainProviderConfig 엔티티 + 마이그레이션
- [ ] Role 엔티티 + 마이그레이션
- [ ] Team 엔티티 + 마이그레이션
- [ ] Hollon 엔티티 + 마이그레이션
- [ ] Project + Cycle + Milestone 엔티티
- [ ] Task 엔티티 (depth, affected_files 포함)
- [ ] Document 엔티티 (Memory 기능 포함)
- [ ] CostRecord 엔티티
- [ ] ApprovalRequest 엔티티

#### Day 3-4: CRUD API

**모듈별 기본 API**:
```
POST   /api/organizations
GET    /api/organizations/:id
PATCH  /api/organizations/:id

POST   /api/organizations/:orgId/roles
POST   /api/organizations/:orgId/teams
POST   /api/organizations/:orgId/hollons
POST   /api/organizations/:orgId/projects

POST   /api/projects/:projectId/tasks
GET    /api/projects/:projectId/tasks
PATCH  /api/tasks/:id
```

**작업 목록**:
- [ ] OrganizationModule (CRUD)
- [ ] RoleModule (CRUD)
- [ ] TeamModule (CRUD)
- [ ] HollonModule (CRUD + status 관리)
- [ ] ProjectModule (CRUD)
- [ ] TaskModule (CRUD + 의존성 관리)
- [ ] DocumentModule (CRUD + 검색)

#### Day 5: 시드 데이터 및 테스트

**시드 데이터**:
```typescript
// 테스트용 초기 데이터
const seedOrg = {
  name: "Hollon-AI Dev",
  contextPrompt: "우리는 고품질 소프트웨어를 만드는 팀입니다...",
  costLimitDailyCents: 10000,  // $100/day
};

const seedRole = {
  name: "BackendEngineer",
  systemPrompt: "당신은 TypeScript/NestJS 전문 백엔드 엔지니어입니다...",
  capabilities: ["typescript", "nestjs", "postgresql"],
};
```

**작업 목록**:
- [ ] 시드 스크립트 작성
- [ ] E2E 테스트 설정 (Jest + Supertest)
- [ ] 기본 CRUD 테스트 케이스

---

## Week 3-4: Brain Provider 및 오케스트레이션

### Week 3: Brain Provider

#### Day 1-2: 인터페이스 및 팩토리

```typescript
// brain-provider.interface.ts
interface IBrainProvider {
  execute(request: BrainRequest): Promise<BrainResponse>;
  getStatus(): ProviderStatus;
  terminate(): Promise<void>;
}

interface BrainRequest {
  systemPrompt: string;
  messages: Message[];
  workingDirectory?: string;
  timeout?: number;
}

interface BrainResponse {
  content: string;
  tokensUsed: number;
  costCents: number;
  executionTimeMs: number;
}
```

**작업 목록**:
- [ ] IBrainProvider 인터페이스 정의
- [ ] BrainProviderFactory 구현
- [ ] BaseBrainProvider 추상 클래스

#### Day 3-5: ClaudeCodeProvider 구현

```typescript
// claude-code.provider.ts
@Injectable()
export class ClaudeCodeProvider implements IBrainProvider {
  private process: ChildProcess | null = null;

  async execute(request: BrainRequest): Promise<BrainResponse> {
    // 1. Claude Code CLI 프로세스 생성
    // 2. 프롬프트 전달 (stdin)
    // 3. 결과 수집 (stdout)
    // 4. 타임아웃 처리
    // 5. 비용 계산
  }
}
```

**핵심 구현 사항**:
- [ ] Claude Code CLI 프로세스 관리
- [ ] stdin/stdout 스트림 처리
- [ ] 타임아웃 및 강제 종료
- [ ] 결과 파싱 (JSON 추출)
- [ ] 에러 핸들링
- [ ] 비용 추정 로직

---

### Week 4: 오케스트레이션

#### Day 1-2: PromptComposerService

```typescript
// prompt-composer.service.ts
@Injectable()
export class PromptComposerService {
  /**
   * 6계층 프롬프트 합성
   */
  async compose(hollon: Hollon, task: Task): Promise<string> {
    const layers = await Promise.all([
      this.getOrganizationContext(hollon.organizationId),
      this.getTeamContext(hollon.teamId),
      this.getRolePrompt(hollon.roleId),
      this.getHollonCustomPrompt(hollon),
      this.getRelevantMemories(task),
      this.getTaskContext(task),
    ]);

    return this.mergePromptLayers(layers);
  }
}
```

**작업 목록**:
- [ ] 6계층 프롬프트 합성 로직
- [ ] Document 검색 (keywords 기반)
- [ ] 컨텍스트 길이 제한 처리
- [ ] 프롬프트 템플릿 관리

#### Day 3-4: TaskPoolService

```typescript
// task-pool.service.ts
@Injectable()
export class TaskPoolService {
  async pullNextTask(hollonId: string): Promise<Task | null> {
    // 1. 직접 할당된 태스크
    // 2. 동일 파일 작업 태스크 (우선 배정)
    // 3. 팀의 미할당 태스크
    // 4. Role 매칭 태스크
    // + 파일 충돌 체크
    // + 의존성 체크
  }

  async claimTask(task: Task, hollonId: string): Promise<Task> {
    // 원자적 할당 (race condition 방지)
  }
}
```

**작업 목록**:
- [ ] pullNextTask 구현 (우선순위 로직)
- [ ] 원자적 태스크 할당
- [ ] 파일 충돌 방지 로직
- [ ] 의존성 체크 쿼리

#### Day 5: HollonOrchestratorService

```typescript
// hollon-orchestrator.service.ts
@Injectable()
export class HollonOrchestratorService {
  /**
   * 홀론 실행 사이클
   */
  async runCycle(hollonId: string): Promise<void> {
    // 1. 태스크 Pull
    const task = await this.taskPool.pullNextTask(hollonId);
    if (!task) return;

    // 2. 프롬프트 합성
    const prompt = await this.promptComposer.compose(hollon, task);

    // 3. Brain 실행
    const result = await this.brain.execute({ ... });

    // 4. 결과 검증 (QualityGate)
    const validation = await this.qualityGate.validate(result, task);

    // 5. 분기 처리
    if (validation.passed) {
      await this.completeTask(task, result);
    } else if (validation.shouldRetry) {
      await this.retryTask(task);
    } else {
      await this.escalate(task, validation.reason);
    }
  }
}
```

**작업 목록**:
- [ ] 실행 사이클 메인 루프
- [ ] 상태 전이 관리
- [ ] 결과물 저장 (Document 생성)
- [ ] 비용 기록

---

## Week 5-6: 품질 및 안전장치

### Week 5: QualityGate 및 Escalation

#### Day 1-2: QualityGateService

```typescript
// quality-gate.service.ts
@Injectable()
export class QualityGateService {
  async validate(result: BrainResponse, task: Task): Promise<ValidationResult> {
    const checks = await Promise.all([
      this.checkResultExists(result),
      this.checkFormatCompliance(result, task),
      this.checkCodeQuality(result),      // lint, compile
      this.checkTestsPassing(result),     // test execution
      this.checkCostWithinBudget(result),
    ]);

    return this.aggregateResults(checks);
  }
}
```

**작업 목록**:
- [ ] 결과물 존재 검증
- [ ] 포맷 준수 검증
- [ ] 코드 품질 검증 (lint 실행)
- [ ] 테스트 실행 검증
- [ ] 비용 검증

#### Day 3-4: EscalationService

```typescript
// escalation.service.ts
@Injectable()
export class EscalationService {
  async escalate(request: EscalationRequest): Promise<void> {
    const level = request.level || 1;

    switch (level) {
      case 1: return this.selfResolve(request);
      case 2: return this.teamCollaboration(request);
      case 3: return this.teamLeaderDecision(request);
      case 4: return this.organizationLevel(request);
      case 5: return this.humanIntervention(request);
    }
  }
}
```

**작업 목록**:
- [ ] 5단계 에스컬레이션 로직
- [ ] 재시도 메커니즘 (Level 1)
- [ ] 팀 내 협업 요청 (Level 2)
- [ ] 인간 승인 요청 (Level 5)
- [ ] 에스컬레이션 기록 저장

#### Day 5: SubtaskCreationService

**작업 목록**:
- [ ] 서브태스크 생성 (depth 제한)
- [ ] 개수 제한 체크
- [ ] 부모 태스크 상태 관리

---

### Week 6: LLM 한계 대응 및 통합

#### Day 1-2: TaskAnalyzerService

```typescript
// task-analyzer.service.ts
@Injectable()
export class TaskAnalyzerService {
  async analyze(task: Task, hollon: Hollon): Promise<TaskAnalysis> {
    // 1. 휴리스틱 복잡도 계산
    // 2. 필요시 LLM 기반 심층 분석
    // 3. 분할 필요 여부 판단
  }
}
```

**작업 목록**:
- [ ] 휴리스틱 복잡도 계산
- [ ] LLM 기반 분석 (선택적)
- [ ] 서브태스크 제안 로직

#### Day 3: DecisionLogService

```typescript
// decision-log.service.ts
@Injectable()
export class DecisionLogService {
  async logDecision(decision: Decision): Promise<void> {
    // 중요 결정 기록
  }

  async findSimilarDecisions(context: string): Promise<Decision[]> {
    // 유사 결정 검색 (일관성 유지)
  }
}
```

**작업 목록**:
- [ ] 결정 기록 저장
- [ ] 유사 결정 검색 (키워드 기반)
- [ ] 일관성 체크 로직

#### Day 4: CostTrackingService

```typescript
// cost-tracking.service.ts
@Injectable()
export class CostTrackingService {
  async recordCost(record: CostRecord): Promise<void> { }

  async checkBudget(orgId: string): Promise<BudgetStatus> {
    // 일일/월간 예산 체크
  }

  async shouldStop(orgId: string): Promise<boolean> {
    // 예산 초과 시 true
  }
}
```

**작업 목록**:
- [ ] 비용 기록
- [ ] 일일/월간 예산 체크
- [ ] 알림 트리거 (80% 도달 시)
- [ ] 작업 중단 로직

#### Day 5: 통합 테스트

**검증 시나리오**:
```
시나리오 1: Happy Path
  1. Organization, Role, Team, Hollon 생성
  2. Project, Task 생성
  3. Hollon 실행 사이클 시작
  4. Task Pull → 실행 → 완료
  5. Document (결과물) 생성 확인

시나리오 2: 품질 실패 → 재시도
  1. 의도적으로 실패하는 Task 생성
  2. QualityGate 실패 확인
  3. 재시도 3회 확인
  4. Escalation 발생 확인

시나리오 3: 비용 초과
  1. 낮은 비용 한도 설정
  2. 한도 초과 시 작업 중단 확인

시나리오 4: 2개 홀론 동시 운영
  1. 2개 Hollon 생성
  2. 5개 Task 생성
  3. 동시에 실행 사이클 시작
  4. 파일 충돌 없이 처리 확인
```

**작업 목록**:
- [ ] E2E 테스트 시나리오 구현
- [ ] 통합 테스트 실행
- [ ] 버그 수정 및 안정화

---

## 기술 스택 (Phase 1)

| 영역 | 기술 | 버전 |
|------|------|------|
| Runtime | Node.js | 20 LTS |
| Package Manager | pnpm | 8.x |
| Monorepo | Turborepo | 1.x |
| Backend | NestJS | 10.x |
| ORM | TypeORM | 0.3.x |
| Database | PostgreSQL | 16 |
| Vector | pgvector | 0.5.x |
| Testing | Jest | 29.x |
| Container | Docker Compose | 2.x |

---

## 리스크 및 완화 계획

| 리스크 | 확률 | 영향 | 완화 계획 |
|--------|------|------|----------|
| Claude Code CLI 호출 불안정 | 중간 | 높음 | 타임아웃, 재시도, 프로세스 격리 |
| 비용 예측 어려움 | 높음 | 중간 | 보수적 예산 설정, 모니터링 |
| QualityGate 오탐/미탐 | 중간 | 중간 | 단계적 검증, 인간 검토 병행 |
| 태스크 경합 | 낮음 | 낮음 | 원자적 할당, 충돌 방지 |

---

## 일일 체크포인트

매일 종료 시 확인:
- [ ] 오늘 계획한 작업 완료 여부
- [ ] 발견된 이슈 및 블로커
- [ ] 내일 우선순위

---

## Phase 1 완료 후 다음 단계

Phase 2 준비:
- 실시간 통신 (WebSocket)
- 정기 회의 자동화
- 3+ 홀론 협업 테스트
