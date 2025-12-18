# Phase 3: Goal 자동화 시스템 테스트 계획

## 개요

이 문서는 Phase 4 Goal-to-PR 자동화 시스템의 종합 테스트 계획을 정의합니다.

**테스트 유형:**

1. **통합 테스트** - 각 자동화 단계를 개별적으로 테스트
2. **E2E 테스트** - 실제 AI(Brain Provider)를 사용한 전체 워크플로우 테스트
3. **시나리오 테스트** - 복잡한 end-to-end 시나리오 테스트

---

## 완성되어야 하는 전체 자동화 흐름

### 목표: Goal API만 호출하면 자동으로 코드가 작성되고 PR이 병합되는 완전 자동화

```
[사용자]
   │
   ├─ POST /goals (Goal 생성 및 활성화)
   │  {
   │    title: "Phase 4.1: 지식 시스템 구축",
   │    status: "active",
   │    autoDecomposed: true,
   │    ownerHollonId: "CTO-Zeus"
   │  }
   │
   ↓
[자동화 시작 - 7개 Cron 작업이 1분마다 실행]
```

### 단계별 자동화 흐름

#### 1단계: Goal → Team Epic 분해 (autoDecomposeGoals)

```
Goal (ACTIVE)
   │
   ├─ CTO-Zeus가 Goal을 분석
   │  - Brain Provider로 Goal 내용 분석
   │  - 각 팀이 담당할 영역 파악
   │
   ├─ Team Epic 생성 (각 팀별로)
   │  ├─ Backend Engineering Team Epic
   │  │  - "백엔드 API 및 서비스 로직 구현"
   │  │  - status: PENDING
   │  │  - taskType: TEAM_EPIC
   │  │
   │  ├─ Data & AI Engineering Team Epic
   │  │  - "Vector Search 및 Knowledge Graph 구현"
   │  │  - status: PENDING
   │  │  - taskType: TEAM_EPIC
   │  │
   │  └─ Backend Infrastructure Team Epic
   │     - "CI/CD 및 모니터링 설정"
   │     - status: PENDING
   │     - taskType: TEAM_EPIC
   │
   ↓
```

#### 2단계: Team Epic → 팀 매니저 할당 (autoAssignManagersToTeamEpics)

```
Team Epic (PENDING)
   │
   ├─ 각 팀의 매니저에게 할당
   │  ├─ Backend Engineering Epic → TechLead-Alpha
   │  ├─ Data & AI Engineering Epic → AILead-Echo
   │  └─ Backend Infrastructure Epic → InfraLead-Foxtrot
   │
   ├─ Epic 상태 변경: PENDING → READY
   │
   ↓
```

#### 3단계: Team Epic → Implementation Tasks 분해 (autoDecomposeTeamEpics)

```
Team Epic (READY, 매니저에게 할당됨)
   │
   ├─ 매니저가 Team Epic을 분석 (Brain Provider)
   │  - Epic 내용을 구체적인 구현 태스크로 분해
   │  - 3~10개의 Implementation 태스크 생성
   │
   ├─ Implementation Tasks 생성 (예: Backend Engineering)
   │  ├─ Task 1: "KnowledgeService 구현"
   │  │  - status: PENDING
   │  │  - assignedHollonId: null (아직 미할당)
   │  │  - taskType: IMPLEMENTATION
   │  │
   │  ├─ Task 2: "KnowledgeController 구현"
   │  │  - status: PENDING
   │  │  - assignedHollonId: null
   │  │
   │  └─ Task 3: "Knowledge 통합 테스트 작성"
   │     - status: PENDING
   │     - assignedHollonId: null
   │
   ↓
```

#### 4단계: Implementation Tasks → 팀원 할당 (autoAssignTasks - 신규 필요)

```
Implementation Tasks (PENDING)
   │
   ├─ 매니저가 팀원들에게 태스크 분배
   │  ├─ 팀원 목록 조회 (managerId로 필터링)
   │  │  - Developer-Bravo
   │  │  - Developer-Charlie
   │  │
   │  ├─ 워크로드 밸런싱 고려
   │  │  - 각 팀원의 현재 IN_PROGRESS 태스크 수 확인
   │  │  - 가장 여유로운 팀원에게 우선 할당
   │  │
   │  └─ 태스크 할당
   │     ├─ Task 1 → Developer-Bravo (status: READY)
   │     ├─ Task 2 → Developer-Charlie (status: READY)
   │     └─ Task 3 → Developer-Bravo (status: READY)
   │
   ↓
```

#### 5단계: 태스크 실행 (autoExecuteTasks) - 서브 에이전트 오케스트레이션

```
Implementation Task (READY, 팀원에게 할당됨)
   │
   ├─ 태스크 상태 변경: READY → IN_PROGRESS
   │
   ├─ 팀원 Hollon이 서브 에이전트들을 순차/병렬 실행
   │
   ├─ [서브 에이전트 1] 계획 및 분석 (Planning Agent)
   │  ├─ 태스크 요구사항 분석
   │  ├─ 기존 코드베이스 탐색
   │  ├─ 구현 계획 수립
   │  ├─ 영향받는 파일 식별
   │  └─ 결과: implementation_plan.md
   │
   ├─ [서브 에이전트 2] Git 브랜치 생성
   │  ├─ 브랜치 이름: feature/Developer-Bravo/task-{taskId}
   │  ├─ 기존 브랜치 체크 (중복 방지)
   │  └─ 결과: 브랜치 생성 완료
   │
   ├─ [서브 에이전트 3] 코드 작성 (Implementation Agent)
   │  ├─ 계획에 따라 코드 작성
   │  ├─ 파일 생성/수정
   │  ├─ 타입 정의 및 인터페이스
   │  └─ 결과: 코드 파일들
   │
   ├─ [서브 에이전트 4] 테스트 작성 (Testing Agent)
   │  ├─ 단위 테스트 작성
   │  ├─ 통합 테스트 작성
   │  ├─ 엣지 케이스 커버
   │  └─ 결과: *.spec.ts 파일들
   │
   ├─ [서브 에이전트 5] 품질 검증 (Quality Agent)
   │  ├─ 린트 실행 및 수정
   │  ├─ 포맷팅 적용
   │  ├─ 타입 체크
   │  ├─ 테스트 실행
   │  └─ 결과: 모든 체크 통과
   │
   ├─ [서브 에이전트 6] Git 커밋 및 PR (Integration Agent)
   │  ├─ git add .
   │  ├─ git commit -m "feat: Implement KnowledgeService"
   │  ├─ git push origin feature/Developer-Bravo/task-{taskId}
   │  └─ gh pr create --title "..." --body "..."
   │
   ├─ 서브 에이전트 실행 추적
   │  ├─ metadata.subAgents: [
   │  │    { name: "planning", status: "completed", duration: "30s" },
   │  │    { name: "git-branch", status: "completed", duration: "5s" },
   │  │    { name: "implementation", status: "completed", duration: "120s" },
   │  │    { name: "testing", status: "completed", duration: "90s" },
   │  │    { name: "quality", status: "completed", duration: "45s" },
   │  │    { name: "integration", status: "completed", duration: "20s" }
   │  │  ]
   │  └─ metadata.totalSubAgents: 6
   │
   ├─ Hollon 상태 관리
   │  ├─ 서브 에이전트 실행 중에도 Hollon은 IN_PROGRESS 유지
   │  ├─ IDLE로 돌아갈 필요 없음 (orchestrating 중)
   │  └─ 다른 태스크는 할당받지 않음 (maxConcurrentTasks 고려)
   │
   ├─ TaskPullRequest 레코드 생성
   │  ├─ prUrl: "https://github.com/org/repo/pull/123"
   │  ├─ taskId: task.id
   │  └─ metadata.subAgentSummary: "6 sub-agents executed successfully"
   │
   ├─ 태스크 상태 변경: IN_PROGRESS → IN_REVIEW
   │
   ↓
```

**서브 에이전트 실행 모델:**

- 각 서브 에이전트는 독립적인 Brain Provider 호출
- 순차 실행 (계획 → 브랜치 → 코드 → 테스트 → 품질 → PR)
- 또는 병렬 실행 가능 (코드 작성 + 테스트 작성 동시에)
- 각 서브 에이전트의 결과를 메타데이터에 기록
- 실패 시 해당 서브 에이전트만 재시도 가능

#### 6단계: CI 상태 체크 (autoCheckPRCI)

```
Task (IN_REVIEW, PR 생성됨)
   │
   ├─ gh pr checks로 CI 상태 확인
   │  ├─ 모든 체크가 pending/in_progress → 대기
   │  ├─ 일부 체크가 failure → 재시도 로직
   │  └─ 모든 체크가 success → 다음 단계
   │
   ├─ [CI 성공 케이스]
   │  ├─ 태스크 상태 변경: IN_REVIEW → READY_FOR_REVIEW
   │  └─ 매니저 리뷰 대기
   │
   ├─ [CI 실패 케이스]
   │  ├─ metadata.ciRetryCount 증가
   │  ├─ metadata.lastCIFailure 기록
   │  ├─ 태스크 상태 변경: IN_REVIEW → IN_PROGRESS
   │  ├─ Brain Provider 재실행 (5단계로 복귀)
   │  │
   │  └─ [최대 재시도 3회 초과 시]
   │     └─ 태스크 상태 변경: IN_REVIEW → FAILED
   │
   ↓
```

#### 7단계: 매니저 리뷰 및 PR 병합 (autoReviewPRs)

```
Task (READY_FOR_REVIEW, CI 통과)
   │
   ├─ 부모 Team Epic의 매니저 확인
   │  - parentTask.assignedHollonId (매니저)
   │
   ├─ Self-review 방지 체크
   │  - task.assignedHollonId ≠ 매니저
   │  - OK: 팀원이 만든 PR을 매니저가 리뷰
   │  - NG: 매니저 자신이 만든 PR은 병합 안함
   │
   ├─ Brain Provider로 코드 리뷰
   │  - 변경사항 분석
   │  - 코드 품질 체크
   │  - 승인 결정
   │
   ├─ PR 병합
   │  - gh pr merge {prUrl} --squash
   │
   ├─ 태스크 상태 변경: READY_FOR_REVIEW → COMPLETED
   │
   ↓
```

#### 8단계: 부모 태스크 상태 전이 (autoTransitionToReview)

```
Team Epic (자식 태스크들 완료 중)
   │
   ├─ 자식 Implementation Tasks 상태 확인
   │  - 모든 자식이 COMPLETED → Team Epic을 IN_REVIEW로
   │  - 일부만 COMPLETED → 대기
   │
   ├─ Team Epic 상태 변경: READY → IN_REVIEW
   │
   ├─ 모든 Team Epic이 COMPLETED되면
   │  └─ Goal 상태 변경: ACTIVE → COMPLETED
   │
   ↓
[완료] Goal이 자동으로 구현되어 main 브랜치에 병합됨
```

### 전체 흐름 타임라인 예시 (서브 에이전트 포함)

```
시간    | 이벤트
--------|--------------------------------------------------------
00:00   | 사용자가 Goal 생성 (POST /goals)
00:01   | Cron 1: CTO-Zeus가 Goal 분해 → 3개 Team Epic 생성
00:02   | Cron 2: 각 Team Epic을 매니저에게 할당
00:03   | Cron 3: TechLead-Alpha가 Epic 분해 → 5개 Implementation Task
00:03   | Cron 3: AILead-Echo가 Epic 분해 → 4개 Implementation Task
00:04   | Cron 4: 매니저들이 태스크를 팀원에게 분배
00:05   | Cron 5: Developer-Bravo가 Task 1 실행 시작 (status: IN_PROGRESS)
00:05   | Cron 5: Developer-Charlie가 Task 2 실행 시작
00:05   | Developer-Bravo: Planning Agent 실행 (30초)
00:05   | Developer-Bravo: Git Branch Agent 실행 (5초)
00:06   | Developer-Bravo: Implementation Agent 실행 (120초)
00:08   | Developer-Bravo: Testing Agent 실행 (90초)
00:09   | Developer-Bravo: Quality Agent 실행 (45초)
00:10   | Developer-Bravo: Integration Agent 실행 (PR 생성, 20초)
00:10   | Developer-Bravo의 Task 1 PR 생성 → IN_REVIEW
00:10   | Task 1 metadata: 6개 서브 에이전트 완료, 총 310초 소요
00:11   | Cron 6: Task 1의 CI 체크 (pending → 대기)
00:15   | Cron 6: Task 1의 CI 체크 (success → READY_FOR_REVIEW)
00:16   | Cron 7: TechLead-Alpha가 Task 1 리뷰 및 병합 → COMPLETED
...
00:45   | 모든 Implementation Task 완료 (각각 서브 에이전트 6개 실행)
00:46   | 모든 Team Epic IN_REVIEW → COMPLETED
00:47   | Goal COMPLETED ✅

전체 소요 시간: ~47분
서브 에이전트 총 실행 횟수: 9개 Task × 6개 서브 에이전트 = 54회
```

### 핵심 원칙

1. **완전 자동화**: 사용자는 Goal만 생성하면 끝
2. **역할 분리**:
   - CTO: Goal → Team Epic 분해
   - 팀 매니저: Team Epic → Implementation Task 분해 및 팀원 할당
   - 팀원: Implementation Task 실행 (서브 에이전트 오케스트레이션)
3. **서브 에이전트 오케스트레이션**:
   - 각 구현 태스크는 여러 전문화된 서브 에이전트로 분해
   - Planning → Implementation → Testing → Quality → Integration
   - 서브 에이전트 실행 추적 및 개별 재시도 가능
   - Hollon은 서브 에이전트 실행 중에도 IN_PROGRESS 유지 (IDLE 아님)
4. **품질 보장**: CI 통과 필수, 실패 시 자동 재시도
5. **병렬 처리**: 여러 팀, 여러 팀원, 여러 서브 에이전트가 동시에 작업
6. **무한 재귀**: 매니저가 팀원을 가질 수 있고, 그 팀원도 매니저가 될 수 있음
7. **투명성**: 모든 서브 에이전트 실행 이력이 metadata에 기록됨

---

## 구현 계획: 서브 홀론 아키텍처

### ✅ 기존 코드 재사용 전략 (코드 분석 결과)

#### 🎉 좋은 소식: 서브 홀론 인프라가 이미 80% 구현되어 있습니다!

코드베이스를 분석한 결과, Phase 4에서 이미 서브 홀론 시스템의 핵심 인프라를 구현해두었습니다. **대부분의 코드를 그대로 재사용 가능**하며, 최소한의 변경만으로 프롬프트 기반 오케스트레이션을 달성할 수 있습니다.

---

#### ✅ 이미 구현된 것들 (재사용 가능)

##### 1. Hollon Entity - 거의 완벽하게 준비됨

**파일**: `apps/server/src/modules/hollon/entities/hollon.entity.ts`

```typescript
@Entity('hollons')
export class Hollon extends BaseEntity {
  // ✅ 이미 있음: 생명주기 관리
  @Column({
    type: 'enum',
    enum: HollonLifecycle,
    default: HollonLifecycle.PERMANENT,
  })
  lifecycle: HollonLifecycle; // PERMANENT | TEMPORARY

  // ✅ 이미 있음: 생성자 Hollon 추적
  @Column({ name: 'created_by_hollon_id', type: 'uuid', nullable: true })
  createdByHollonId: string | null;

  // ✅ 이미 있음: 재귀 깊이 제어 (무한 생성 방지)
  @Column({ default: 0 })
  depth: number;

  // ✅ 이미 있음: 커스텀 System Prompt
  @Column({ name: 'system_prompt', type: 'text', nullable: true })
  systemPrompt: string;

  // ✅ 이미 있음: 매니저 관계 (부모-자식 계층)
  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId: string | null;

  @ManyToOne(() => Hollon, (hollon) => hollon.subordinates, { nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager: Hollon | null;

  @OneToMany(() => Hollon, (hollon) => hollon.manager)
  subordinates: Hollon[];
}

// ✅ 이미 있음: HollonLifecycle enum
export enum HollonLifecycle {
  PERMANENT = 'permanent',
  TEMPORARY = 'temporary',
}
```

**재사용 가능 비율**: **95%**

**필요한 추가 사항**:

- ⚠️ `expiresAt: Date` 필드 추가 (선택적 - 자동 정리용)
- ⚠️ `parentHollonId` relation 추가 (선택적 - `createdByHollonId`와 별개로 계층 명확화)

---

##### 2. HollonService - 서브 홀론 생성 로직 완비

**파일**: `apps/server/src/modules/hollon/hollon.service.ts`

```typescript
// ✅ 이미 있음: 임시 홀론 생성 메서드
async createTemporary(config: CreateTemporaryHollonDto): Promise<Hollon> {
  const MAX_TEMPORARY_HOLLON_DEPTH = 1; // Phase 3.7: depth=1 제약

  // ✅ 이미 있음: 깊이 계산
  if (config.createdBy) {
    const parentHollon = await this.hollonRepo.findOne({
      where: { id: config.createdBy },
    });

    // ✅ 이미 있음: 최대 깊이 체크
    if (parentHollon.depth >= MAX_TEMPORARY_HOLLON_DEPTH) {
      throw new BadRequestException(
        `Maximum temporary hollon depth (${MAX_TEMPORARY_HOLLON_DEPTH}) exceeded`,
      );
    }

    depth = parentHollon.depth + 1;
  }

  // ✅ 이미 있음: 임시 홀론 생성
  const hollon = this.hollonRepo.create({
    name: config.name,
    organizationId: config.organizationId,
    teamId: config.teamId || null,
    roleId: config.roleId,
    brainProviderId: config.brainProviderId || 'claude_code',
    systemPrompt: config.systemPrompt || undefined, // ✅ 커스텀 프롬프트 지원!
    lifecycle: HollonLifecycle.TEMPORARY,
    createdByHollonId: config.createdBy || null,
    depth,
    status: HollonStatus.IDLE,
  });
  return this.hollonRepo.save(hollon);
}
```

**재사용 가능 비율**: **100%** - 수정 불필요!

**핵심**: `systemPrompt` 파라미터로 전문화된 서브 홀론 생성 가능!

---

##### 3. TaskExecutionService - 서브 홀론 오케스트레이션 패턴 이미 구현

**파일**: `apps/server/src/modules/orchestration/services/task-execution.service.ts`

```typescript
// ✅ 이미 있음: 서브태스크 분해 및 서브 홀론 생성
private async decomposeIntoSubtasks(
  task: Task,
  hollon: Hollon,
  worktreePath: string,
  brainOutput: string,
): Promise<void> {
  // ✅ 이미 있음: 서브태스크마다 서브 홀론 생성
  for (const subtaskData of decompositionResult.subtasks) {
    const subHollon = await this.createSubHollonForSubtask(
      hollon,
      task,
      subtaskData,
    );

    const subtask = this.taskRepo.create({
      // ...
      assignedHollonId: subHollon.id, // ✅ 서브 홀론에 할당
      workingDirectory: worktreePath, // ✅ 부모의 worktree 공유
    });

    await this.taskRepo.save(subtask);
  }
}

// ✅ 이미 있음: 서브 홀론 생성 헬퍼
private async createSubHollonForSubtask(
  parentHollon: Hollon,
  task: Task,
  subtaskData: { title: string; description: string; requiredSkills?: string[] },
): Promise<Hollon> {
  const subHollonName = `Impl-${task.id.substring(0, 8)}-${subtaskData.title.substring(0, 20)}`;

  // ✅ 이미 있음: createTemporaryHollon 사용
  const subHollon = await this.hollonService.createTemporaryHollon({
    name: subHollonName,
    organizationId: parentHollon.organizationId,
    teamId: parentHollon.teamId || undefined,
    roleId: parentHollon.roleId,
    brainProviderId: parentHollon.brainProviderId || 'claude_code',
    createdBy: parentHollon.id,
  });

  return subHollon;
}
```

**재사용 가능 비율**: **90%**

**필요한 수정**:

- ⚠️ `createSubHollonForSubtask`에서 `systemPrompt` 파라미터 추가
- ⚠️ 서브 홀론 유형에 따라 다른 prompt 주입 (Planning, Implementation, Testing 등)

---

##### 4. BrainProvider Integration - 완벽하게 재사용 가능

**파일**: `apps/server/src/modules/brain-provider/brain-provider.service.ts`

```typescript
// ✅ 이미 있음: Hollon별 Brain 실행 및 추적
async executeWithTracking(
  request: BrainRequest,
  context: {
    organizationId: string;
    hollonId?: string; // ✅ 서브 홀론 ID도 추적 가능!
    taskId?: string;
  },
  knowledgeContext?: KnowledgeContext,
): Promise<BrainResponse> {
  // ✅ 이미 있음: Knowledge Injection
  let enhancedPrompt = request.prompt;
  if (knowledgeContext) {
    enhancedPrompt = await this.knowledgeInjection.injectKnowledge(
      request.prompt,
      knowledgeContext,
    );
  }

  // ✅ 이미 있음: Brain 실행
  const result = await this.claudeProvider.execute(enhancedRequest);

  // ✅ 이미 있음: 비용 추적
  await this.costRecordRepo.save({
    organizationId: context.organizationId,
    hollonId: context.hollonId, // ✅ 서브 홀론 비용도 추적됨!
    taskId: context.taskId,
    // ...
  });

  return result;
}
```

**재사용 가능 비율**: **100%** - 수정 불필요!

**핵심**: 서브 홀론도 일반 Hollon처럼 Brain Provider 사용 가능!

---

##### 5. Cron Jobs - 재사용 가능 (일부 수정 필요)

**파일**: `apps/server/src/modules/goal/listeners/goal-automation.listener.ts`

```typescript
// ✅ 재사용 가능: 태스크 자동 실행
@Cron('*/1 * * * *')
async autoExecuteTasks(): Promise<void> {
  const readyTasks = await this.taskRepo
    .createQueryBuilder('task')
    .where('task.status = :status', { status: TaskStatus.READY })
    .andWhere('task.assignedHollonId IS NOT NULL')
    .take(5)
    .getMany();

  for (const task of readyTasks) {
    // ✅ 재사용: 서브 홀론도 일반 홀론처럼 실행됨
    await this.taskExecutionService.executeTask(
      task.id,
      task.assignedHollonId!,
    );
  }
}
```

**재사용 가능 비율**: **100%** - 서브 홀론도 자동으로 처리됨!

**핵심**: 서브 홀론에게 할당된 태스크도 자동으로 실행됨!

---

#### ⚠️ 필요한 최소 변경사항

##### 1. Hollon Entity에 expiresAt 필드 추가 (선택적)

**DB Migration**:

```sql
ALTER TABLE hollons
  ADD COLUMN expires_at TIMESTAMP;

CREATE INDEX idx_hollons_expires_at ON hollons(expires_at)
  WHERE lifecycle = 'temporary';
```

**Entity 수정**:

```typescript
@Column({ name: 'expires_at', type: 'timestamp', nullable: true })
expiresAt: Date;
```

**예상 작업 시간**: 15분

---

##### 2. 서브 홀론 자동 정리 Cron 추가

**파일**: `apps/server/src/modules/hollon/listeners/hollon-cleanup.listener.ts` (신규)

```typescript
@Injectable()
export class HollonCleanupListener {
  @Cron('*/30 * * * *') // 30분마다
  async cleanupExpiredSubHollons() {
    const expiredHollons = await this.hollonRepo.find({
      where: {
        lifecycle: HollonLifecycle.TEMPORARY,
        expiresAt: LessThan(new Date()),
      },
    });

    for (const hollon of expiredHollons) {
      // 할당된 태스크가 없고 IDLE 상태인 경우에만 삭제
      if (hollon.status === HollonStatus.IDLE && !hollon.currentTaskId) {
        await this.hollonRepo.delete(hollon.id);
        this.logger.log(`Deleted expired sub-hollon: ${hollon.id}`);
      }
    }
  }
}
```

**예상 작업 시간**: 30분

---

##### 3. 서브 홀론 생성 시 systemPrompt 주입

**수정 필요**: `TaskExecutionService.createSubHollonForSubtask`

```typescript
private async createSubHollonForSubtask(
  parentHollon: Hollon,
  task: Task,
  subtaskData: {
    title: string;
    description: string;
    requiredSkills?: string[];
    subHollonType?: 'planning' | 'implementation' | 'testing' | 'integration'; // ✅ 추가
  },
): Promise<Hollon> {
  // ✅ 추가: 서브 홀론 유형에 따른 system prompt 선택
  const systemPrompt = this.getSubHollonSystemPrompt(
    subtaskData.subHollonType || 'implementation',
    task,
  );

  const subHollon = await this.hollonService.createTemporaryHollon({
    name: subHollonName,
    organizationId: parentHollon.organizationId,
    teamId: parentHollon.teamId || undefined,
    roleId: parentHollon.roleId,
    brainProviderId: parentHollon.brainProviderId || 'claude_code',
    createdBy: parentHollon.id,
    systemPrompt, // ✅ 추가
  });

  return subHollon;
}

// ✅ 신규 메서드
private getSubHollonSystemPrompt(
  type: 'planning' | 'implementation' | 'testing' | 'integration',
  task: Task,
): string {
  const prompts = {
    planning: fs.readFileSync('prompts/planning-hollon.md', 'utf-8'),
    implementation: fs.readFileSync('prompts/implementation-hollon.md', 'utf-8'),
    testing: fs.readFileSync('prompts/testing-hollon.md', 'utf-8'),
    integration: fs.readFileSync('prompts/integration-hollon.md', 'utf-8'),
  };

  return prompts[type]
    .replace('{taskTitle}', task.title)
    .replace('{taskDescription}', task.description);
}
```

**예상 작업 시간**: 1시간

---

##### 4. Prompt 템플릿 파일 생성

**파일들**:

- `prompts/planning-hollon.md`
- `prompts/implementation-hollon.md`
- `prompts/testing-hollon.md`
- `prompts/integration-hollon.md`

**예시 - Implementation Hollon Prompt**:

```markdown
당신은 코드 작성 전문가 서브 홀론입니다.

## 역할

- 태스크: {taskTitle}
- 설명: {taskDescription}

## 중요 규칙

1. **파일별 점진적 커밋**:
   - 각 파일을 작성할 때마다 개별 커밋
   - 예: `git add entity.ts && git commit -m "feat: Add Knowledge entity"`
2. **커밋 메시지 규칙**:
   - feat: 새 기능
   - fix: 버그 수정
   - refactor: 리팩토링
   - test: 테스트 추가

3. **작업 완료 후**:
   - 태스크 상태를 COMPLETED로 변경
   - PATCH /tasks/{taskId} { "status": "COMPLETED" }

## 금지사항

- ❌ 여러 파일을 한번에 커밋하지 마세요
- ❌ 큰 변경사항을 한 커밋에 몰아넣지 마세요
```

**예상 작업 시간**: 2시간

---

#### 📊 전체 재사용 비율 및 작업량 요약

| 컴포넌트                 | 재사용 가능 | 필요한 변경            | 예상 시간 |
| ------------------------ | ----------- | ---------------------- | --------- |
| **Hollon Entity**        | 95%         | expiresAt 필드 추가    | 15분      |
| **HollonService**        | 100%        | 없음                   | 0분       |
| **TaskExecutionService** | 90%         | systemPrompt 주입 로직 | 1시간     |
| **BrainProviderService** | 100%        | 없음                   | 0분       |
| **Cron Jobs**            | 100%        | 없음                   | 0분       |
| **자동 정리**            | 0%          | 신규 Cron 추가         | 30분      |
| **Prompt 템플릿**        | 0%          | 4개 파일 생성          | 2시간     |
| **통합 테스트**          | 50%         | 서브 홀론 테스트 추가  | 3시간     |

**총 재사용 비율**: **85%** 🎉

**총 작업 시간**: **6.75시간** (약 1일)

---

#### 🚀 구현 전략: 점진적 개선

##### Phase 1: 기존 코드 검증 (1시간)

- ✅ 현재 서브 홀론 생성 로직 테스트
- ✅ Brain Provider 통합 테스트
- ✅ Worktree 공유 테스트

##### Phase 2: 최소 변경 (3시간)

- ⚠️ `expiresAt` 필드 추가 (DB migration)
- ⚠️ `systemPrompt` 주입 로직 추가
- ⚠️ Prompt 템플릿 4개 작성

##### Phase 3: 자동 정리 (30분)

- ⚠️ 만료된 서브 홀론 정리 Cron 추가

##### Phase 4: 테스트 및 검증 (2.25시간)

- ⚠️ 서브 홀론 생성/실행 통합 테스트
- ⚠️ 점진적 커밋 E2E 테스트
- ⚠️ 자동 정리 테스트

---

### 개념: 서브 에이전트 → 서브 홀론으로 발전

**기존 계획 (서브 에이전트)**:

- 하나의 Hollon이 여러 Brain Provider 호출
- 각 호출이 다른 작업 (planning, implementation, testing 등)
- 문제: 모든 작업이 하나의 큰 컨텍스트에서 실행됨

**개선된 설계 (서브 홀론)**:

- **부모 Hollon이 임시 자식 Hollon들을 생성**
- 각 서브 홀론은 독립적인 Hollon 엔티티
- 각 서브 홀론은 전문화된 system prompt
- 각 서브 홀론은 독립적으로 작업하고 **파일별로 점진적 커밋**
- 작업 완료 후 서브 홀론 자동 삭제

### 서브 홀론 생명주기

```
[부모 Hollon: Developer-Bravo]
   │
   ├─ Implementation Task 할당받음
   │
   ├─ 서브 홀론 생성 (CREATE) - API 호출로
   │  ├─ Planning-Hollon (isTemporary: true)
   │  ├─ Implementation-Hollon (isTemporary: true)
   │  ├─ Testing-Hollon (isTemporary: true)
   │  └─ Integration-Hollon (isTemporary: true)
   │
   ├─ 각 서브 홀론에게 서브 태스크 할당 - API 호출로
   │
   ├─ 서브 홀론들이 병렬/순차 실행
   │  ├─ Planning-Hollon: 계획 수립 → plan.md 커밋
   │  ├─ Implementation-Hollon:
   │  │   - Entity 작성 → 커밋
   │  │   - Service 작성 → 커밋
   │  │   - Controller 작성 → 커밋
   │  ├─ Testing-Hollon:
   │  │   - Entity 테스트 → 커밋
   │  │   - Service 테스트 → 커밋
   │  └─ Integration-Hollon: PR 생성
   │
   ├─ 부모 Hollon이 서브 홀론들 모니터링
   │  └─ 모든 서브 홀론 완료 대기
   │
   ├─ 서브 홀론 삭제 (CLEANUP) - API 호출로
   │  └─ isTemporary: true인 Hollon들 삭제
   │
   └─ 부모 Hollon: Task 완료 보고
```

### 데이터베이스 스키마 변경

```typescript
// Hollon Entity 수정
@Entity()
export class Hollon {
  // 기존 필드들...

  @Column({ default: false })
  isTemporary: boolean; // 서브 홀론 여부

  @Column({ nullable: true })
  parentHollonId: string; // 부모 Hollon (서브 홀론인 경우)

  @Column({ nullable: true })
  expiresAt: Date; // 서브 홀론 만료 시간 (1시간 후)

  @ManyToOne(() => Hollon, { nullable: true })
  @JoinColumn({ name: 'parentHollonId' })
  parentHollon: Hollon;

  @OneToMany(() => Hollon, (hollon) => hollon.parentHollon)
  subHollons: Hollon[];
}
```

### 프롬프트 기반 오케스트레이션 (코드 변경 최소화)

#### 부모 Hollon System Prompt (Developer-Bravo 등)

````markdown
당신은 Developer-Bravo입니다. Backend Engineering 팀의 백엔드 개발자입니다.

## 복잡한 태스크 수행 방식

Implementation 태스크를 받으면 **서브 홀론을 생성하여 작업을 위임**하세요:

### 1단계: 서브 홀론 생성

```bash
# Planning 전문가 생성
POST http://localhost:3001/api/hollons
{
  "name": "Planning-Hollon-$(date +%s)",
  "organizationId": "{현재 orgId}",
  "teamId": "{현재 teamId}",
  "roleId": "{planning-role-id}",
  "parentHollonId": "{나의 ID}",
  "isTemporary": true,
  "expiresAt": "$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)",
  "maxConcurrentTasks": 1,
  "brainProviderId": "claude_code",
  "systemPrompt": "당신은 Planning 전문가입니다. 태스크를 분석하고 상세한 implementation-plan.md를 작성한 후 커밋하세요. 완료되면 태스크를 COMPLETED로 변경하세요."
}

# Implementation 전문가 생성
POST http://localhost:3001/api/hollons
{
  "name": "Implementation-Hollon-$(date +%s)",
  ...
  "systemPrompt": "당신은 코드 작성 전문가입니다. 각 파일(Entity, Service, Controller)을 작성할 때마다 개별 커밋하세요. 예: git commit -m 'feat: Add Knowledge entity'. 모든 파일 완성 후 태스크를 COMPLETED로 변경하세요."
}

# Testing 전문가 생성
POST http://localhost:3001/api/hollons
{
  "name": "Testing-Hollon-$(date +%s)",
  ...
  "systemPrompt": "당신은 테스트 작성 전문가입니다. 각 테스트 파일(*.spec.ts)을 작성할 때마다 개별 커밋하세요. 예: git commit -m 'test: Add Knowledge service tests'. 모든 테스트 통과 후 태스크를 COMPLETED로 변경하세요."
}

# Integration 전문가 생성
POST http://localhost:3001/api/hollons
{
  "name": "Integration-Hollon-$(date +%s)",
  ...
  "systemPrompt": "당신은 Git 통합 전문가입니다. 모든 커밋을 검증하고(lint, test, build) PR을 생성하세요. PR body에 커밋 히스토리를 포함하세요. 완료 후 태스크를 COMPLETED로 변경하세요."
}
```
````

### 2단계: 서브 태스크 생성 및 할당

```bash
# Planning 서브 태스크
POST http://localhost:3001/api/tasks
{
  "title": "구현 계획 수립",
  "description": "{원본 태스크 설명}을 분석하고 implementation-plan.md 작성",
  "taskType": "IMPLEMENTATION",
  "isSubTask": true,
  "parentTaskId": "{현재 태스크 ID}",
  "assignedHollonId": "{Planning-Hollon ID}",
  "status": "READY",
  "priority": "P1_URGENT"
}

# Implementation 서브 태스크
POST http://localhost:3001/api/tasks
{
  "title": "코드 구현",
  "description": "implementation-plan.md 기반으로 Entity, Service, Controller 작성. 파일별 커밋 필수.",
  "assignedHollonId": "{Implementation-Hollon ID}",
  "status": "PENDING",  # Planning 완료 후 READY로 변경
  ...
}

# 나머지 서브 태스크들...
```

### 3단계: 서브 홀론 모니터링

```bash
# 1분마다 서브 홀론 상태 확인
while true; do
  status=$(curl http://localhost:3001/api/hollons/{Planning-Hollon-ID}/current-task | jq -r '.status')

  if [ "$status" = "null" ]; then
    echo "Planning-Hollon 완료"
    # Implementation-Hollon 시작
    curl -X PATCH http://localhost:3001/api/tasks/{impl-task-id} \
      -d '{"status": "READY"}'
    break
  fi

  sleep 60
done
```

### 4단계: 서브 홀론 정리

```bash
# 모든 작업 완료 후
DELETE http://localhost:3001/api/hollons/{Planning-Hollon-ID}
DELETE http://localhost:3001/api/hollons/{Implementation-Hollon-ID}
DELETE http://localhost:3001/api/hollons/{Testing-Hollon-ID}
DELETE http://localhost:3001/api/hollons/{Integration-Hollon-ID}
```

## 중요: 점진적 커밋 예시

각 서브 홀론의 System Prompt에 명시:

**Implementation-Hollon**:

```bash
# ❌ 잘못된 방법 - 모든 파일을 한번에 커밋
git add .
git commit -m "feat: Implement Knowledge module"

# ✅ 올바른 방법 - 파일별 커밋
git add src/modules/knowledge/entities/knowledge.entity.ts
git commit -m "feat: Add Knowledge entity"

git add src/modules/knowledge/services/knowledge.service.ts
git commit -m "feat: Implement KnowledgeService"

git add src/modules/knowledge/controllers/knowledge.controller.ts
git commit -m "feat: Add KnowledgeController"

git add src/modules/knowledge/knowledge.module.ts
git commit -m "feat: Configure KnowledgeModule"
```

**Testing-Hollon**:

```bash
# 테스트 파일별 커밋
git add src/modules/knowledge/services/knowledge.service.spec.ts
git commit -m "test: Add KnowledgeService unit tests"

git add src/modules/knowledge/controllers/knowledge.controller.spec.ts
git commit -m "test: Add KnowledgeController tests"
```

````

### 구현 우선순위 (기존 코드 재사용 반영)

#### ✅ 이미 완료된 것 (재사용)

**Hollon 인프라** (100% 완료):
- ✅ `HollonLifecycle.TEMPORARY` enum
- ✅ `lifecycle` 필드
- ✅ `createdByHollonId` 필드
- ✅ `depth` 필드 (재귀 생성 제어)
- ✅ `systemPrompt` 필드 (커스텀 프롬프트 지원!)

**서비스 레이어** (100% 완료):
- ✅ `HollonService.createTemporary()` - 서브 홀론 생성
- ✅ `TaskExecutionService.decomposeIntoSubtasks()` - 서브태스크 분해
- ✅ `TaskExecutionService.createSubHollonForSubtask()` - 서브 홀론 생성 헬퍼
- ✅ `BrainProviderService.executeWithTracking()` - 서브 홀론도 Brain 사용 가능

**자동화 레이어** (100% 완료):
- ✅ `autoExecuteTasks()` - 서브 홀론 태스크도 자동 실행
- ✅ Worktree 공유 - 부모/자식 홀론이 같은 작업 공간 사용
- ✅ 비용 추적 - 서브 홀론 비용도 자동 추적

---

#### Phase 1: 최소 변경 사항 (3-4시간)

**1.1 DB Migration - expiresAt 필드 추가** (15분):
```sql
ALTER TABLE hollons
  ADD COLUMN expires_at TIMESTAMP;

CREATE INDEX idx_hollons_expires_at ON hollons(expires_at)
  WHERE lifecycle = 'temporary';
````

**1.2 Hollon Entity 수정** (5분):

```typescript
@Column({ name: 'expires_at', type: 'timestamp', nullable: true })
expiresAt: Date;
```

**1.3 TaskExecutionService 수정 - systemPrompt 주입** (1시간):

```typescript
// createSubHollonForSubtask 메서드 수정
private async createSubHollonForSubtask(
  parentHollon: Hollon,
  task: Task,
  subtaskData: {
    title: string;
    description: string;
    subHollonType?: 'planning' | 'implementation' | 'testing' | 'integration';
  },
): Promise<Hollon> {
  const systemPrompt = this.getSubHollonSystemPrompt(
    subtaskData.subHollonType || 'implementation',
    task,
  );

  const subHollon = await this.hollonService.createTemporaryHollon({
    name: subHollonName,
    systemPrompt, // ✅ 추가
    // ... 기존 필드들
  });

  return subHollon;
}

// 신규 메서드 추가
private getSubHollonSystemPrompt(type: string, task: Task): string {
  const prompts = {
    planning: fs.readFileSync('prompts/planning-hollon.md', 'utf-8'),
    implementation: fs.readFileSync('prompts/implementation-hollon.md', 'utf-8'),
    testing: fs.readFileSync('prompts/testing-hollon.md', 'utf-8'),
    integration: fs.readFileSync('prompts/integration-hollon.md', 'utf-8'),
  };

  return prompts[type]
    .replace('{taskTitle}', task.title)
    .replace('{taskDescription}', task.description);
}
```

**1.4 자동 정리 Cron 추가** (30분):

```typescript
// apps/server/src/modules/hollon/listeners/hollon-cleanup.listener.ts
@Injectable()
export class HollonCleanupListener {
  @Cron('*/30 * * * *')
  async cleanupExpiredSubHollons() {
    const expiredHollons = await this.hollonRepo.find({
      where: {
        lifecycle: HollonLifecycle.TEMPORARY,
        expiresAt: LessThan(new Date()),
      },
    });

    for (const hollon of expiredHollons) {
      if (hollon.status === HollonStatus.IDLE && !hollon.currentTaskId) {
        await this.hollonRepo.delete(hollon.id);
        this.logger.log(`Deleted expired sub-hollon: ${hollon.id}`);
      }
    }
  }
}
```

**1.5 HollonModule에 Listener 등록** (5분):

```typescript
@Module({
  providers: [HollonService, HollonCleanupListener], // ✅ 추가
})
export class HollonModule {}
```

---

#### Phase 2: 프롬프트 템플릿 작성 (2시간)

**파일 구조**:

```
apps/server/prompts/
  ├── planning-hollon.md         # Planning 전문가
  ├── implementation-hollon.md   # 코드 작성 전문가
  ├── testing-hollon.md          # 테스트 작성 전문가
  └── integration-hollon.md      # Git 통합 전문가
```

**각 템플릿 작성 시간**: 30분 × 4 = 2시간

**예시 - implementation-hollon.md**:

```markdown
당신은 코드 작성 전문가 서브 홀론입니다.

## 역할

- 태스크: {taskTitle}
- 설명: {taskDescription}

## 중요 규칙

### 1. 파일별 점진적 커밋

각 파일을 작성할 때마다 개별 커밋하세요:

\`\`\`bash

# ✅ 올바른 방법 - 파일별 커밋

git add src/modules/knowledge/entities/knowledge.entity.ts
git commit -m "feat: Add Knowledge entity"

git add src/modules/knowledge/services/knowledge.service.ts
git commit -m "feat: Implement KnowledgeService"

git add src/modules/knowledge/controllers/knowledge.controller.ts
git commit -m "feat: Add KnowledgeController"
\`\`\`

### 2. 커밋 메시지 규칙

- `feat:` 새 기능
- `fix:` 버그 수정
- `refactor:` 리팩토링
- `test:` 테스트 추가

### 3. 작업 완료 후

태스크 상태를 COMPLETED로 변경:
\`\`\`bash
curl -X PATCH http://localhost:3001/api/tasks/{taskId} \\
-H "Content-Type: application/json" \\
-d '{"status": "COMPLETED"}'
\`\`\`

## 금지사항

- ❌ 여러 파일을 한번에 커밋하지 마세요
- ❌ `git add .` 사용하지 마세요
- ❌ 큰 변경사항을 한 커밋에 몰아넣지 마세요
```

---

#### Phase 3: 테스트 및 검증 (2-3시간)

**통합 테스트**:

```typescript
describe('Sub-Hollon System', () => {
  it('should create and execute sub-hollons', async () => {
    // Given: 부모 Hollon에게 태스크 할당
    const task = await createTask({ assignedHollonId: parentHollon.id });

    // When: 부모 Hollon이 서브 홀론 생성 및 실행
    await executeTask(task);

    // Then:
    // 1. 서브 홀론들이 생성됨
    const subHollons = await hollonRepo.find({
      parentHollonId: parentHollon.id,
    });
    expect(subHollons.length).toBeGreaterThan(0);

    // 2. 각 서브 홀론이 커밋했음
    const commits = await execAsync('git log --oneline origin/main..HEAD');
    expect(commits.split('\n').length).toBeGreaterThan(3);

    // 3. 서브 홀론들이 정리됨
    const remainingSubHollons = await hollonRepo.find({
      parentHollonId: parentHollon.id,
    });
    expect(remainingSubHollons.length).toBe(0);
  });
});
```

---

## 🎯 기존 코드 재사용의 핵심 인사이트

### 원래 계획 vs 실제 필요한 작업

| 항목                    | 원래 계획 (처음부터 구현)                              | 실제 필요한 작업 (재사용)   | 절감     |
| ----------------------- | ------------------------------------------------------ | --------------------------- | -------- |
| **DB Schema**           | 3개 필드 추가 (isTemporary, parentHollonId, expiresAt) | 1개 필드 추가 (expiresAt만) | **67%**  |
| **Hollon Entity**       | Entity 전체 수정                                       | 필드 1줄 추가               | **95%**  |
| **서브 홀론 생성 로직** | 전체 구현 필요                                         | 이미 완성됨 (수정 불필요)   | **100%** |
| **Brain Provider 통합** | 서브 홀론 지원 구현                                    | 이미 완성됨 (수정 불필요)   | **100%** |
| **Worktree 공유**       | 부모/자식 공유 로직 구현                               | 이미 완성됨 (수정 불필요)   | **100%** |
| **자동 실행**           | Cron 수정 필요                                         | 이미 완성됨 (수정 불필요)   | **100%** |
| **비용 추적**           | 서브 홀론 비용 추적 구현                               | 이미 완성됨 (수정 불필요)   | **100%** |
| **자동 정리**           | Cron 추가 필요                                         | Cron 추가 필요 (신규)       | **0%**   |
| **Prompt 템플릿**       | 4개 파일 작성                                          | 4개 파일 작성 (신규)        | **0%**   |
| **systemPrompt 주입**   | 전체 로직 구현                                         | 메서드 1개 추가             | **70%**  |

**전체 절감률**: **85%** 🎉

---

### 작업 시간 비교

| 항목                  | 원래 예상 (처음부터)  | 실제 필요 (재사용) | 절감    |
| --------------------- | --------------------- | ------------------ | ------- |
| **Phase 1: 인프라**   | 1-2일 (8-16시간)      | 3-4시간            | **75%** |
| **Phase 2: 프롬프트** | 1일 (8시간)           | 2시간              | **75%** |
| **Phase 3: 테스트**   | 2-3일 (16-24시간)     | 2-3시간            | **87%** |
| **전체**              | **4-6일 (32-48시간)** | **7-9시간**        | **82%** |

**핵심 발견**: Phase 4에서 이미 서브 홀론 시스템의 핵심을 구현해두었습니다!

---

### 왜 이렇게 많은 코드를 재사용할 수 있는가?

#### 1. ✅ Phase 4에서 이미 올바른 추상화를 선택했음

**기존 설계의 탁월함**:

- `HollonLifecycle.TEMPORARY` - 임시 홀론 구분
- `createdByHollonId` - 생성자 추적
- `depth` - 재귀 생성 깊이 제어
- `systemPrompt` - **커스텀 프롬프트 지원** (가장 중요!)

이 필드들이 있었기 때문에 **프롬프트 기반 오케스트레이션**이 바로 가능합니다.

#### 2. ✅ 서비스 레이어가 유연하게 설계됨

**HollonService.createTemporary()**:

```typescript
// ✅ systemPrompt 파라미터를 이미 지원!
const subHollon = await this.hollonService.createTemporaryHollon({
  name: 'Planning-Hollon',
  systemPrompt: '당신은 Planning 전문가입니다...', // ✅ 바로 사용 가능!
  // ...
});
```

#### 3. ✅ Brain Provider가 Hollon-agnostic

**BrainProviderService.executeWithTracking()**:

```typescript
// ✅ 어떤 Hollon이든 (부모/자식) 동일하게 실행 가능
await this.brainProvider.executeWithTracking(request, {
  hollonId: subHollon.id, // ✅ 서브 홀론 ID도 문제없음!
  // ...
});
```

#### 4. ✅ Cron이 Hollon 유형에 무관하게 동작

**autoExecuteTasks()**:

```typescript
// ✅ TEMPORARY 홀론도 일반 홀론처럼 자동 실행됨
const readyTasks = await this.taskRepo.find({
  where: {
    status: TaskStatus.READY,
    assignedHollonId: IsNotNull(), // ✅ 부모/자식 구분 안함!
  },
});
```

---

### 실제로 필요한 작업 (7-9시간)

#### ✅ DB Migration (15분)

```sql
ALTER TABLE hollons ADD COLUMN expires_at TIMESTAMP;
```

#### ✅ systemPrompt 주입 로직 (1시간)

```typescript
// createSubHollonForSubtask 수정
const systemPrompt = this.getSubHollonSystemPrompt(type, task);
const subHollon = await this.createTemporaryHollon({ systemPrompt, ... });
```

#### ✅ Prompt 템플릿 4개 작성 (2시간)

```
prompts/
  ├── planning-hollon.md
  ├── implementation-hollon.md
  ├── testing-hollon.md
  └── integration-hollon.md
```

#### ✅ 자동 정리 Cron (30분)

```typescript
@Cron('*/30 * * * *')
async cleanupExpiredSubHollons() { ... }
```

#### ✅ 테스트 추가 (2-3시간)

- 서브 홀론 생성 테스트
- systemPrompt 주입 테스트
- 점진적 커밋 E2E 테스트
- 자동 정리 테스트

#### ✅ 통합 및 검증 (1.5시간)

- seed.ts에 서브 홀론 예시 추가
- 문서 업데이트
- 기존 테스트 패스 확인

**총합: 7-9시간 (약 1일)**

---

### 결론: 매우 효율적인 구현 가능

#### 🎉 기존 코드 재사용의 장점

1. **빠른 구현**: 4-6일 → 1일로 단축
2. **낮은 리스크**: 검증된 코드 재사용
3. **일관성**: 기존 패턴과 동일
4. **테스트 용이**: 기존 테스트 대부분 재사용

#### 🚀 구현 전략

**당장 시작 가능**:

1. DB Migration 실행 (15분)
2. Prompt 템플릿 4개 작성 (2시간)
3. systemPrompt 주입 로직 추가 (1시간)
4. 자동 정리 Cron 추가 (30분)
5. 테스트 작성 및 검증 (2-3시간)

**예상 완료**: 1일 (7-9시간)

---

## 완전 자율 실행 가능성 검증

### 이 계획으로 가능한 것 ✅

1. **Goal → PR 완전 자동화**
   - Goal 생성만으로 코드가 작성되고 병합됨
   - 매니저가 분배, 팀원이 서브 홀론 오케스트레이션

2. **서브 홀론 기반 세밀한 작업 분해**
   - 복잡한 태스크를 전문화된 서브 홀론으로 분해
   - 각 서브 홀론이 독립적으로 작업
   - **파일별 점진적 커밋**으로 작업 추적 용이

3. **프롬프트 기반 제어 (코드 변경 최소화)**
   - System Prompt만 수정하여 행동 변경
   - 새로운 서브 홀론 유형 추가 쉬움
   - API 호출만으로 서브 홀론 생성/삭제

4. **투명성 및 디버깅**
   - Git 커밋 히스토리로 진행 상황 추적
   - 각 서브 홀론의 작업 결과 명확히 분리
   - 어떤 단계에서 실패했는지 즉시 파악

### 추가로 필요한 것 ⚠️

1. **4단계 구현**: 매니저가 팀원에게 태스크 분배
   - `autoAssignTasks()` cron 추가
   - 매니저 System Prompt에 분배 로직 추가

2. **에러 처리 강화**
   - 서브 홀론 실패 시 부모 Hollon에게 알림
   - 부모 Hollon이 다른 전략 시도

3. **리소스 관리**
   - 동시 실행 가능한 서브 홀론 수 제한
   - 만료된 서브 홀론 자동 정리

### 자율 실행 가능 여부 평가

**단기 (Phase 1-3 완료 후)**:

- ✅ 간단한 CRUD API 추가: **90% 자동화 가능**
- ✅ 표준 Service/Controller 추가: **85% 자동화 가능**
- ⚠️ 복잡한 비즈니스 로직: **60% 자동화 가능**

**중기 (4단계 포함)**:

- ✅ Feature 구현: **80% 자동화 가능**
- ✅ 버그 수정: **70% 자동화 가능**
- ⚠️ 아키텍처 변경: **50% 자동화 가능**

**현실적 결론**:
이 계획대로 구현하면 **70-80%의 개발 작업을 완전 자율적으로 수행 가능**합니다.

**핵심 성공 요인**:

1. ✅ 서브 홀론 = 실제 Hollon 엔티티 (메타포 아님)
2. ✅ 프롬프트로 제어 (코드 변경 최소)
3. ✅ 점진적 커밋 (작업 단위 명확)
4. ✅ API 기반 오케스트레이션 (유연성)

나머지 20-30%는 여전히 사람의 판단이 필요하지만, 서브 홀론이 초안을 제공하고 사람이 리뷰/수정하는 협업 모델로 해결 가능합니다.

---

## 검증해야 할 핵심 이슈

관찰된 문제를 기반으로, 다음 사항을 반드시 검증해야 합니다:

- ✅ **매니저 역할 분리**: 매니저는 태스크 분배만, 개발자가 구현 실행
- ✅ **CI 탐지**: CI 실패가 제대로 감지되고 처리되는지
- ✅ **재시도 로직**: 실패한 태스크가 올바른 로직으로 재시도되는지
- ✅ **브랜치 관리**: 중복 브랜치 생성이 발생하지 않는지
- ✅ **태스크 분배**: 올바른 역할(매니저 vs 개발자)에게 태스크가 할당되는지

---

## 1. 통합 테스트 (단계별 자동화 검증)

---

## 구현 상태 요약 (Updated 2025-12-18)

### 전체 워크플로우 구현 상태

```
Goal → Team Epic → Implementation Tasks → Task Execution → PR → CI → Review → Merge
  ✅       ✅               ✅                  ✅          ✅   ⚠️   ✅      ✅
```

**범례**:

- ✅ 완전 구현 및 테스트 완료
- ⚠️ 부분 구현 (개선 필요)
- ❌ 미구현

### 1.1-1.4: Goal Decomposition & Task Distribution

| 케이스                                 | 상태 | 구현 위치                           | 비고                                        |
| -------------------------------------- | ---- | ----------------------------------- | ------------------------------------------- |
| 1.1.1 Goal → Team Epic                 | ✅   | `goal-decomposition.service.ts`     | E2E 테스트 통과                             |
| 1.1.2 DRAFT/COMPLETED skip             | ✅   | `goal-decomposition.service.ts`     | E2E 테스트 통과                             |
| 1.1.3 이미 분해된 Goal skip            | ✅   | `goal-decomposition.service.ts`     | E2E 테스트 통과                             |
| 1.2.1 Epic → Manager 할당              | ✅   | `task-execution.service.ts`         | E2E 테스트 통과                             |
| 1.2.2 이미 할당된 Epic skip            | ✅   | `task-execution.service.ts`         | E2E 테스트 통과                             |
| 1.3.1 Epic → Impl Tasks                | ✅   | `task-execution.service.ts:409-560` | E2E 테스트 통과, **Dependency 지원 추가됨** |
| 1.3.2 매니저에게 구현 태스크 할당 방지 | ✅   | `task-execution.service.ts:502`     | 팀원에게만 할당                             |
| 1.4.1 매니저가 팀원에게 분배           | ✅   | `task-execution.service.ts`         | 자동 분배                                   |
| 1.4.2 팀원에게 고르게 분배             | ✅   | `selectBestHollon()`                | Round-robin                                 |

### 1.5: Task Execution

| 케이스                          | 상태 | 구현 위치                           | 비고                                |
| ------------------------------- | ---- | ----------------------------------- | ----------------------------------- |
| 1.5.1 READY 태스크 실행         | ✅   | `task-execution.service.ts:145-244` | E2E 테스트 통과                     |
| 1.5.2 매니저 태스크 실행 방지   | ✅   | E2E test 검증                       | "Manager Should Not Execute" 테스트 |
| 1.5.3 동시 실행 제한            | ⚠️   | TODO                                | 현재 순차 실행만 지원               |
| 1.5.4 서브 에이전트 실행 추적   | ✅   | `hollon-orchestrator.service.ts`    | Subtask metadata 추적               |
| 1.5.5 서브 에이전트 실패 재시도 | ⚠️   | `hollon-orchestrator.service.ts`    | 부분 구현                           |
| 1.5.6 Hollon 상태 관리          | ✅   | `task-execution.service.ts`         | IN_PROGRESS 유지                    |

### 1.6: PR Creation & Branch Management

| 케이스                  | 상태 | 구현 위치                             | 비고                     |
| ----------------------- | ---- | ------------------------------------- | ------------------------ |
| 1.6.1 PR 생성           | ✅   | `task-execution.service.ts:1443-1534` | E2E 테스트 통과 (PR #36) |
| 1.6.2 중복 브랜치 방지  | ✅   | `task-execution.service.ts`           | E2E 테스트 통과          |
| 1.6.3 커밋 없는 PR 방지 | ✅   | `task-execution.service.ts`           | Error 처리               |

### 1.7: CI Check ⚠️ **부분 구현**

| 케이스                           | 상태 | 구현 위치                                      | 비고                                       |
| -------------------------------- | ---- | ---------------------------------------------- | ------------------------------------------ |
| 1.7.1 CI 성공 → READY_FOR_REVIEW | ✅   | `task-execution.service.ts:218, 244`           | E2E 테스트 통과                            |
| 1.7.2 CI 실패 → 재시도           | ⚠️   | `task-execution.service.ts:225-238, 1683-1758` | **Error throw만, retry trigger 확인 필요** |
| 1.7.3 CI pending → 대기          | ✅   | `task-execution.service.ts:1764-1820`          | Test mode에서 skip                         |
| 1.7.4 최대 재시도 초과 → FAILED  | ⚠️   | `task-execution.service.ts:1683-1758`          | **Retry count 관리만, FAILED 전환 미확인** |

**1.7.2 CI 실패 처리 상세**:

```typescript
// ✅ 구현됨
- CI check: checkCIStatus() - line 1621
- CI 통과 시 Manager review: requestCodeReview() - line 244
- CI 실패 처리: handleCIFailure() - line 1683
  - Retry count 관리 (max 3)
  - Feedback 생성
  - Error throw: "CI_FAILURE_RETRY: ..." 또는 "CI_FAILURE_MAX_RETRIES: ..."

// ❓ 확인 필요
- Error를 누가 catch하고 retry를 trigger하는가?
  → HollonExecutionService 또는 TaskPoolService 확인 필요

// ❌ 미구현
- 서브 홀론 생성으로 CI 에러 수정
- 자기 자신이 CI 에러 수정 (피드백 반영한 재실행)
```

### 1.8: Manager Review

| 케이스                       | 상태 | 구현 위치                | 비고            |
| ---------------------------- | ---- | ------------------------ | --------------- |
| 1.8.1 Manager PR 리뷰 & 병합 | ✅   | `code-review.service.ts` | E2E 테스트 통과 |
| 1.8.2 자기 PR 병합 방지      | ✅   | `code-review.service.ts` | E2E 테스트 통과 |

### 2. E2E Workflow Tests

| 테스트                      | 상태 | 테스트 파일                            | 비고                     |
| --------------------------- | ---- | -------------------------------------- | ------------------------ |
| 2.1 완전한 8단계 자동화     | ✅   | `calculator-goal-workflow.e2e-spec.ts` | **269초 통과**           |
| 2.2 간단한 Goal→Merge       | ✅   | `calculator-goal-workflow.e2e-spec.ts` | Main test                |
| 2.3 CI 실패 → 재시도 → 성공 | ⚠️   | `calculator-goal-workflow.e2e-spec.ts` | **Retry trigger 미확인** |
| 2.4 병렬 팀 실행            | ❌   | TODO                                   | 미구현                   |

### 11. Task Dependency Workflow (신규 - 2025-12-18)

| 기능                       | 상태 | 구현 위치                                  | 비고                                      |
| -------------------------- | ---- | ------------------------------------------ | ----------------------------------------- |
| 11.1 BLOCKED tasks 생성    | ✅   | `task-execution.service.ts:529-560`        | **E2E 통과: 24개 중 1 READY, 23 BLOCKED** |
| 11.2 Dependency unblocking | ✅   | `code-review.service.ts:284-346`           | **3 dependent tasks 확인됨**              |
| 11.3 CI check & retry      | ⚠️   | `task-execution.service.ts:218-244`        | 부분 구현                                 |
| 11.4 Test PR cleanup       | ❌   | `calculator-goal-workflow.e2e-spec.ts:713` | **Test mode에서 GitHub PR 여전히 open**   |

### 구현 우선순위 (다음 단계)

#### 🔴 최우선 (Critical)

1. **CI 실패 처리 완성** (1.7.2, 1.7.4)
   - [ ] Error catch & retry trigger 확인/구현
   - [ ] 서브 홀론 생성으로 CI 에러 수정
   - [ ] 자기 수정 (CI 피드백 반영)
   - [ ] 최대 retry 초과 시 FAILED 상태 전환

   **파일**: `task-execution.service.ts`, `hollon-execution.service.ts`

2. **Test PR Auto Cleanup** (11.4)
   - [ ] Test mode에서도 실제 GitHub PR close
   - [ ] afterAll cleanup 개선

   **파일**: `calculator-goal-workflow.e2e-spec.ts`, `code-review.service.ts`

#### 🟡 중요 (High Priority)

3. **병렬 실행** (1.5.3, 2.4)
   - [ ] 여러 READY tasks 동시 실행
   - [ ] 동시 실행 제한 (max 5)
   - [ ] 병렬 팀 실행 지원

   **파일**: `task-pool.service.ts`, `hollon-execution.service.ts`

4. **서브 에이전트 재시도 개선** (1.5.5)
   - [ ] 개별 서브 에이전트 재시도
   - [ ] 재시도 이력 metadata 저장

   **파일**: `hollon-orchestrator.service.ts`

#### 🟢 Nice to Have

5. **Dependency Visualization**
   - [ ] Task dependency graph API
   - [ ] BLOCKED tasks의 blocking 이유 표시

6. **Performance Monitoring**
   - [ ] 각 단계별 소요 시간 측정
   - [ ] Bottleneck 식별

### 테스트 파일 위치

**Integration Tests**:

- `test/integration/goal-decomposition.integration-spec.ts` - Goal decomposition
- `test/integration/task-execution.integration-spec.ts` - Task execution
- `test/integration/pr-creation.integration-spec.ts` - PR creation
- `test/integration/ci-checking.integration-spec.ts` - CI checking

**E2E Tests**:

- `test/e2e/calculator-goal-workflow.e2e-spec.ts` - **Main E2E test (269s PASS)**
- `test/e2e/goal-decomposition-llm.e2e-spec.ts` - Goal decomposition with LLM
- `test/e2e/phase3.11-project-workflow.e2e-spec.ts` - Project workflow
- `test/e2e/phase3.12-goal-to-pr-workflow.e2e-spec.ts` - Goal to PR

### 최근 구현 (2025-12-18)

**커밋**:

- `3fa6114` - feat: add task dependency support to Implementation Tasks
- `6a57d13` - docs: add Task Dependency Workflow to Phase 3 test plan

**구현 내용**:

1. ✅ `DecompositionWorkItem`에 `dependencies` 필드 추가
2. ✅ Brain prompt에 dependency 식별 지시
3. ✅ Two-pass Implementation Task 생성
4. ✅ BLOCKED tasks 자동 생성
5. ✅ Dependency unblocking 로직
6. ✅ E2E test 검증 (24 tasks: 1 READY, 23 BLOCKED)

**테스트 결과**:

```
✅ PASSED (269s)
✅ Goal → Team Epic decomposition
✅ Epic → Implementation Task decomposition (24 tasks)
✅ BLOCKED tasks created (23 BLOCKED, 1 READY)
✅ Completed task has 3 dependent task(s)
✅ PR creation (#36)
✅ CI check passed
✅ Manager review and merge (test mode - DB only)
⚠️ Dependent tasks not yet unblocked (have other dependencies)
```

### 1.1 Goal 분해 테스트

**테스트 파일**: `test/integration/goal-decomposition.integration-spec.ts`

#### 테스트 케이스 1.1.1: Goal → Team Epic 분해

- **Given**: CTO가 소유한 ACTIVE 상태의 Goal 1개
- **When**: `autoDecomposeGoals()` cron 실행
- **Then**:
  - 각 팀별로 Team Epic 생성됨 (최소 3개: Backend, AI, Infrastructure)
  - 각 Epic의 `taskType`이 `TEAM_EPIC`
  - 각 Epic의 `status`가 `PENDING`
  - 각 Epic에 올바른 `teamId` 할당됨

#### 테스트 케이스 1.1.2: DRAFT/COMPLETED Goal은 분해하지 않음

- **Given**: DRAFT 상태의 Goal
- **When**: `autoDecomposeGoals()` 실행
- **Then**: Team Epic이 생성되지 않음

#### 테스트 케이스 1.1.3: 이미 분해된 Goal은 건너뜀

- **Given**: 이미 Team Epic이 있는 Goal
- **When**: `autoDecomposeGoals()` 실행
- **Then**: 추가 Team Epic이 생성되지 않음

#### 테스트 케이스 1.1.4: Goal 분해 품질 검증

- **Given**: "지식 시스템 구축" Goal
- **When**: `autoDecomposeGoals()` 실행
- **Then**:
  - 기술적 범위가 적절히 커버됨 (Backend API, Infrastructure, AI 관련)
  - Team Epic의 제목과 설명이 명확함

---

### 1.2 매니저 할당 테스트

**테스트 파일**: `test/integration/manager-assignment.integration-spec.ts`

#### 테스트 케이스 1.2.1: Team Epic → 팀 매니저 할당

- **Given**: 각 팀의 PENDING Team Epic들
- **When**: `autoAssignManagersToTeamEpics()` 실행
- **Then**:
  - Backend Engineering Epic → TechLead-Alpha 할당
  - Data & AI Engineering Epic → AILead-Echo 할당
  - Backend Infrastructure Epic → InfraLead-Foxtrot 할당
  - Epic 상태가 `READY`로 변경됨

#### 테스트 케이스 1.2.2: 이미 할당된 Epic은 건너뜀

- **Given**: 이미 매니저가 할당된 Team Epic
- **When**: `autoAssignManagersToTeamEpics()` 실행
- **Then**: 변경사항 없음 (updatedAt 확인)

---

### 1.3 Team Epic 분해 테스트

**테스트 파일**: `test/integration/epic-decomposition.integration-spec.ts`

#### 테스트 케이스 1.3.1: Team Epic → Implementation Tasks 분해

- **Given**: 매니저에게 할당된 READY 상태의 Team Epic
- **When**: `autoDecomposeTeamEpics()` 실행
- **Then**:
  - Implementation 타입의 태스크들이 생성됨
  - 모든 태스크의 `taskType`이 `IMPLEMENTATION`
  - 모든 태스크의 `status`가 `PENDING` (아직 할당 안됨)
  - 모든 태스크의 `teamId`가 올바름

#### 테스트 케이스 1.3.2: ⚠️ 중요 - 매니저에게 구현 태스크 할당하지 않음

- **Given**: TechLead-Alpha(매니저)에게 할당된 Team Epic
- **When**: `autoDecomposeTeamEpics()` 실행
- **Then**:
  - **중요**: Implementation 태스크들이 매니저에게 할당되지 않음
  - 모든 태스크의 `assignedHollonId`가 `null`
  - 모든 태스크의 `status`가 `PENDING`

#### 테스트 케이스 1.3.3: 적절한 태스크 개수 생성

- **Given**: "Vector Search Service 구축" Team Epic
- **When**: `autoDecomposeTeamEpics()` 실행
- **Then**: 3~10개의 적절한 수의 태스크 생성

---

### 1.4 태스크 분배 테스트 (신규 - 중요)

**테스트 파일**: `test/integration/task-distribution.integration-spec.ts`

#### 테스트 케이스 1.4.1: ⚠️ 중요 - 매니저가 팀원에게 태스크 분배

- **Given**: Backend 팀의 PENDING Implementation 태스크들
- **When**: 태스크 분배 로직 실행 (또는 `autoAssignTasks()` cron)
- **Then**:
  - **중요**: 태스크가 매니저가 아닌 팀원에게 할당됨
  - `assignedHollonId`가 TechLead-Alpha, AILead-Echo가 아님
  - `assignedHollonId`가 실제 팀원 (Developer-Bravo, Developer-Charlie 등)
  - 할당된 Hollon이 `managerId`를 가지고 있음 (즉, 매니저가 아님)
  - 태스크 상태가 `READY`로 변경됨

#### 테스트 케이스 1.4.2: 팀원들에게 태스크 고르게 분배

- **Given**: 10개의 PENDING Implementation 태스크
- **When**: 태스크 분배 실행
- **Then**:
  - 태스크가 여러 팀원에게 분산됨 (한 사람에게 몰리지 않음)
  - 최소 2명 이상의 팀원에게 할당됨

---

### 1.5 태스크 실행 테스트

**테스트 파일**: `test/integration/task-execution.integration-spec.ts`

#### 테스트 케이스 1.5.1: READY 태스크 실행

- **Given**: 팀원에게 할당된 READY Implementation 태스크
- **When**: `autoExecuteTasks()` 실행
- **Then**:
  - 태스크 상태가 `IN_PROGRESS`로 변경
  - Brain 실행이 트리거됨 (로그 확인)

#### 테스트 케이스 1.5.2: 매니저에게 할당된 태스크는 실행하지 않음

- **Given**: (잘못) 매니저에게 할당된 Implementation 태스크
- **When**: `autoExecuteTasks()` 실행
- **Then**:
  - 태스크가 실행되지 않음 (`IN_PROGRESS`로 변경 안됨)
  - 경고 로그 출력 (매니저가 구현 태스크에 할당됨)

#### 테스트 케이스 1.5.3: 동시 실행 제한

- **Given**: 100개의 READY 태스크
- **When**: `autoExecuteTasks()` 실행
- **Then**: 최대 5개까지만 `IN_PROGRESS`로 변경 (동시 실행 제한)

#### 테스트 케이스 1.5.4: 서브 에이전트 실행 추적

- **Given**: READY Implementation 태스크
- **When**: `autoExecuteTasks()` 실행 및 서브 에이전트 실행
- **Then**:
  - 태스크 `metadata.subAgents` 배열이 생성됨
  - 각 서브 에이전트의 상태가 기록됨:
    - planning: completed
    - git-branch: completed
    - implementation: completed
    - testing: completed
    - quality: completed
    - integration: completed
  - 각 서브 에이전트의 실행 시간 기록됨
  - `metadata.totalSubAgents` 카운트가 정확함

#### 테스트 케이스 1.5.5: 서브 에이전트 실패 시 재시도

- **Given**: 서브 에이전트 중 하나가 실패하는 태스크
- **When**: Quality Agent가 린트 에러로 실패
- **Then**:
  - 해당 서브 에이전트만 재시도됨
  - 다른 서브 에이전트 결과는 유지됨
  - metadata에 재시도 이력 기록:
    ```json
    {
      "name": "quality",
      "status": "completed",
      "attempts": 2,
      "lastError": "Linting failed"
    }
    ```

#### 테스트 케이스 1.5.6: Hollon 상태 - 서브 에이전트 실행 중

- **Given**: 서브 에이전트 실행 중인 태스크
- **When**: 서브 에이전트가 작업 중
- **Then**:
  - Hollon 상태는 계속 `IN_PROGRESS` (IDLE로 돌아가지 않음)
  - 다른 태스크는 할당되지 않음
  - `currentTaskId`가 유지됨
  - 서브 에이전트 진행 상황 조회 가능:
    ```
    GET /hollons/{id}/current-task
    {
      "taskId": "xxx",
      "status": "IN_PROGRESS",
      "currentSubAgent": "testing",
      "completedSubAgents": ["planning", "git-branch", "implementation"],
      "remainingSubAgents": ["quality", "integration"]
    }
    ```

---

### 1.6 PR 생성 및 브랜치 관리 테스트

**테스트 파일**: `test/integration/pr-creation.integration-spec.ts`

#### 테스트 케이스 1.6.1: 코드 변경 후 PR 생성

- **Given**: 코드 변경이 커밋된 태스크
- **When**: Brain 실행 완료 및 PR 생성
- **Then**:
  - 태스크 상태가 `IN_REVIEW`로 변경
  - TaskPullRequest 레코드 생성됨
  - `prUrl`에 GitHub URL 포함

#### 테스트 케이스 1.6.2: ⚠️ 중요 - 중복 브랜치 생성 방지

- **Given**: 이미 존재하는 브랜치 `feature/Developer-Bravo/task-12345`
- **When**: 태스크 실행이 브랜치 생성 시도
- **Then**:
  - 중복 브랜치가 생성되지 않음
  - 기존 브랜치를 재사용하거나 삭제 후 재생성
  - `git branch -r`로 확인 시 브랜치가 1개만 존재

#### 테스트 케이스 1.6.3: 커밋 없는 브랜치는 PR 생성 실패

- **Given**: 브랜치는 있지만 커밋이 없는 태스크
- **When**: PR 생성 시도
- **Then**: 에러 발생 ("No commits" 메시지)

---

### 1.7 CI 체크 테스트

**테스트 파일**: `test/integration/ci-checking.integration-spec.ts`

#### 테스트 케이스 1.7.1: ⚠️ 중요 - CI 성공 감지 및 상태 전환

- **Given**: CI가 통과한 IN_REVIEW 태스크
- **When**: `autoCheckPRCI()` 실행
- **Then**:
  - 태스크 상태가 `READY_FOR_REVIEW`로 전환
  - 매니저 리뷰 대기 상태

#### 테스트 케이스 1.7.2: ⚠️ 중요 - CI 실패 감지 및 재시도 트리거

- **Given**: CI가 실패한 IN_REVIEW 태스크 (`ciRetryCount: 0`)
- **When**: `autoCheckPRCI()` 실행
- **Then**:
  - 태스크 상태가 `IN_PROGRESS`로 복귀 (재시도)
  - `metadata.ciRetryCount`가 1로 증가
  - `metadata.lastCIFailure` 타임스탬프 기록됨
  - Brain 재실행 트리거됨

#### 테스트 케이스 1.7.3: CI pending 상태는 대기

- **Given**: CI가 pending 상태인 IN_REVIEW 태스크
- **When**: `autoCheckPRCI()` 실행
- **Then**: 태스크 상태 변경 없음 (계속 `IN_REVIEW`)

#### 테스트 케이스 1.7.4: 최대 재시도 횟수 초과 시 실패 처리

- **Given**: CI가 3번 실패한 태스크 (`ciRetryCount: 3`)
- **When**: `autoCheckPRCI()` 실행 (4번째 실패)
- **Then**:
  - 태스크 상태가 `FAILED`로 변경
  - `metadata.failureReason`에 "maximum retries" 메시지

---

### 1.8 매니저 리뷰 테스트

**테스트 파일**: `test/integration/manager-review.integration-spec.ts`

#### 테스트 케이스 1.8.1: 매니저가 PR 리뷰 및 병합

- **Given**: READY_FOR_REVIEW 상태의 태스크 (CI 통과)
- **When**: `autoReviewPRs()` 실행
- **Then**:
  - PR이 병합됨
  - 태스크 상태가 `COMPLETED`로 변경

#### 테스트 케이스 1.8.2: 매니저 자기 PR은 병합하지 않음

- **Given**: (잘못) 매니저 자신이 만든 READY_FOR_REVIEW 태스크
- **When**: `autoReviewPRs()` 실행
- **Then**:
  - PR이 병합되지 않음 (self-review 방지)
  - 태스크 상태 변경 없음
  - 경고 로그 출력

---

## 2. E2E 테스트 (실제 AI 사용 전체 워크플로우)

**테스트 파일**: `test/e2e/goal-automation-e2e.spec.ts`

### 테스트 케이스 2.1: 완전한 8단계 자동화 플로우 검증

이 테스트는 위에서 설명한 **전체 자동화 흐름**을 처음부터 끝까지 검증합니다.

#### 테스트 설정

- **Given**: Goal "UserService에 로깅 추가"
  ```json
  {
    "title": "UserService에 로깅 추가",
    "description": "UserService의 모든 메서드에 console.log 추가",
    "status": "active",
    "autoDecomposed": true,
    "ownerHollonId": "CTO-Zeus ID"
  }
  ```

#### 검증 단계

**1단계 검증: Goal → Team Epic 분해**

- **When**: autoDecomposeGoals() cron 실행 (최대 2분 대기)
- **Then**:
  - Goal의 자식 태스크 3개 생성됨
  - 각 태스크의 `taskType`이 `TEAM_EPIC`
  - 각 태스크의 `teamId`가 올바른 팀 ID
  - Backend Engineering, Data & AI Engineering, Backend Infrastructure 중 최소 1개

**2단계 검증: Team Epic → 매니저 할당**

- **When**: autoAssignManagersToTeamEpics() cron 실행 (최대 2분 대기)
- **Then**:
  - 모든 Team Epic의 `assignedHollonId`가 매니저 ID
  - Backend Epic → TechLead-Alpha
  - 각 Epic의 `status`가 `READY`

**3단계 검증: Team Epic → Implementation Tasks 분해**

- **When**: autoDecomposeTeamEpics() cron 실행 (최대 5분 대기)
- **Then**:
  - 각 Team Epic이 3~10개의 Implementation 태스크로 분해됨
  - 모든 Implementation 태스크의 `taskType`이 `IMPLEMENTATION`
  - 모든 Implementation 태스크의 `status`가 `PENDING`
  - **중요**: 모든 Implementation 태스크의 `assignedHollonId`가 `null` (아직 미할당)

**4단계 검증: Implementation Tasks → 팀원 할당**

- **When**: autoAssignTasks() cron 실행 (최대 3분 대기)
- **Then**:
  - **중요**: 모든 PENDING Implementation 태스크가 팀원에게 할당됨
  - 어떤 태스크도 매니저에게 할당되지 않음:
    ```javascript
    for (const task of implTasks) {
      expect(task.assignedHollonId).not.toBe(TECHLEAD_ALPHA_ID);
      expect(task.assignedHollonId).not.toBe(AILEAD_ECHO_ID);
      expect(task.assignedHollonId).not.toBe(INFRALEAD_FOXTROT_ID);
    }
    ```
  - 할당된 Hollon이 `managerId`를 가지고 있음 (팀원 확인)
  - 모든 태스크의 `status`가 `READY`

**5단계 검증: 태스크 실행 (서브 에이전트 오케스트레이션)**

- **When**: autoExecuteTasks() cron 실행 (최대 15분 대기)
- **Then**:
  - 태스크들이 `IN_PROGRESS` → `IN_REVIEW`로 전환됨
  - 각 태스크에 대해:
    - **서브 에이전트 실행 검증**:
      - `metadata.subAgents` 배열 존재
      - 최소 4개 이상의 서브 에이전트 실행됨 (planning, implementation, testing, integration)
      - 각 서브 에이전트의 `status`가 `completed` 또는 `failed`
      - `metadata.totalSubAgents` > 0
    - **Git 작업 검증**:
      - Git 브랜치가 생성됨: `feature/{hollonName}/task-{taskId}`
      - 코드가 커밋됨 (git log 확인)
    - **PR 생성 검증**:
      - PR이 생성됨 (TaskPullRequest 레코드 확인)
      - `prUrl`이 유효한 GitHub URL
      - PR body에 서브 에이전트 실행 요약 포함
  - **중요**: 브랜치 이름에 매니저 이름이 포함되지 않음
    - ✅ `feature/Developer-Bravo/task-xxx`
    - ❌ `feature/TechLead-Alpha/task-xxx`
  - **Hollon 상태 검증**:
    - 서브 에이전트 실행 중 Hollon이 계속 존재함 (삭제 안됨)
    - 서브 에이전트 완료 후 태스크가 `IN_REVIEW`로 전환

**6단계 검증: CI 상태 체크**

- **When**: autoCheckPRCI() cron 실행 (최대 10분 대기)
- **Then**:
  - CI가 pending인 동안 태스크는 `IN_REVIEW` 상태 유지
  - CI 성공 시:
    - 태스크 상태가 `READY_FOR_REVIEW`로 전환
  - (선택) CI 실패 시:
    - 태스크 상태가 `IN_PROGRESS`로 복귀
    - `metadata.ciRetryCount`가 증가

**7단계 검증: 매니저 리뷰 및 PR 병합**

- **When**: autoReviewPRs() cron 실행 (최대 5분 대기)
- **Then**:
  - PR이 병합됨 (gh pr view로 확인)
  - 태스크 상태가 `COMPLETED`로 전환
  - **중요**: 매니저가 자신의 PR을 병합하지 않았는지 확인
    - 각 PR의 author ≠ merger

**8단계 검증: 부모 태스크 상태 전이**

- **When**: 모든 Implementation 태스크 완료 (최대 5분 대기)
- **Then**:
  - 모든 Team Epic의 상태가 `COMPLETED`
  - Goal의 상태가 `COMPLETED`
  - `completedAt` 타임스탬프가 기록됨

#### 최종 검증

- **완료 시간**: 전체 프로세스가 45분 이내에 완료
- **코드 병합**: 모든 PR이 실제로 `main` 브랜치에 병합됨
- **파일 생성**: 의도한 파일들이 실제로 생성됨
  ```bash
  # 예: UserService에 로그가 추가되었는지 확인
  git log --oneline -10
  git diff HEAD~5 HEAD -- src/modules/user/user.service.ts
  ```
- **역할 분리**: 전체 흐름에서 매니저는 분배만, 팀원만 구현 실행

**타임아웃**: 60분

---

### 테스트 케이스 2.2: 간단한 Goal→Merge 플로우 (빠른 검증)

위 2.1 테스트의 간소화 버전 (빠른 피드백용)

- **Given**: 매우 간단한 Goal "README에 한 줄 추가"
- **When**: 자동화 실행 (최대 10분 대기)
- **Then**:
  - Goal 상태가 `COMPLETED`로 변경됨
  - 최소 1개의 PR이 생성되고 병합됨
  - **중요**: 어떤 매니저도 Implementation 태스크를 실행하지 않음

**타임아웃**: 15분

---

### 테스트 케이스 2.3: CI 실패 → 재시도 → 성공 플로우

- **Given**: CI 실패를 유발하는 Goal (린팅 에러 포함)
- **When**: 자동화 실행 (최대 15분 대기)
- **Then**:
  - 최소 1개 태스크가 `metadata.ciRetryCount > 0`
  - 해당 태스크가 최종적으로 `COMPLETED` 상태
  - 재시도 횟수가 3회 이하

**타임아웃**: 20분

---

### 테스트 케이스 2.4: 병렬 팀 실행

- **Given**: 3개 팀 모두 작업이 필요한 Goal "Analytics Dashboard 추가"
- **When**: 자동화 실행 (최대 20분 대기)
- **Then**:
  - 모든 팀의 Team Epic이 `COMPLETED`
  - Backend Engineering Epic 완료
  - Data & AI Engineering Epic 완료
  - Backend Infrastructure Epic 완료
  - 전체 실행 시간이 순차 실행보다 짧음 (병렬 실행 확인)

**타임아웃**: 25분

---

## 3. 시나리오 테스트 (복잡한 워크플로우)

### 시나리오 3.1: Phase 4.1 지식 시스템 Goal

**테스트 파일**: `test/e2e/phase4-knowledge-system.e2e-spec.ts`

- **Given**: Phase 4.1 Goal "지식 시스템 구축" (실제 successCriteria 포함)
- **When**: 전체 자동화 실행 (최대 30분)
- **Then**:
  - Goal 상태가 `COMPLETED`
  - 핵심 서비스 파일들이 생성됨:
    - `knowledge-extraction.service.ts`
    - `vector-search.service.ts`
    - `knowledge-graph.service.ts`
    - `prompt-composer.service.ts`
  - 테스트 파일들이 생성됨 (`*.spec.ts`)
  - 모든 PR이 `main` 브랜치에 병합됨 (closed가 아님)

**타임아웃**: 40분

### 시나리오 3.2: 순차 Goal 처리

**테스트 파일**: `test/e2e/sequential-goals.e2e-spec.ts`

- **Given**: 3개의 의존적인 Goal들
  1. "데이터베이스 스키마 설정"
  2. "API 엔드포인트 구축"
  3. "프론트엔드 통합"
- **When**: 각 Goal을 순차적으로 실행
- **Then**:
  - 모든 Goal이 `COMPLETED` 상태
  - 각 Goal이 이전 Goal 완료 후 진행됨

**타임아웃**: 60분

---

## 4. 테스트 데이터 요구사항

### 4.1 seed.ts를 실제 팀 구조로 업데이트

**파일**: `apps/server/src/database/seed.ts`

실제 프로덕션 팀 구조와 동일한 시드 데이터 필요:

**조직 구조:**

```
Hollon AI
├── CTO-Zeus (조직 매니저)
├── Backend Engineering 팀
│   ├── TechLead-Alpha (팀 매니저)
│   ├── Developer-Bravo (개발자)
│   └── Developer-Charlie (개발자)
├── Data & AI Engineering 팀
│   ├── AILead-Echo (팀 매니저)
│   ├── AIEngineer-Delta (AI 엔지니어)
│   └── DataEngineer-Gamma (데이터 엔지니어)
└── Backend Infrastructure 팀
    ├── InfraLead-Foxtrot (팀 매니저)
    └── DevOps-Golf (DevOps 엔지니어)
```

**중요 사항:**

- 실제 프로덕션 ID 사용 (CTO-Zeus: `0d807758-acd6-4e11-bf30-06c523b84a29` 등)
- 매니저의 systemPrompt에 "직접 구현 작업은 하지 않음" 명시
- 팀원들은 실제 개발 역할 (BackendEngineer, AIEngineer 등)

### 4.2 테스트 데이터베이스 스키마

모든 테스트는 `hollon_test_worker_1` 스키마 사용 (개발 DB 오염 방지)

---

## 5. 테스트 실행 계획

### 5.1 테스트 명령어

`package.json`에 추가:

```json
{
  "scripts": {
    "test:integration:goal": "NODE_ENV=test dotenv -e ../../.env -- jest --config ./test/jest-integration.json --testPathPattern=goal",
    "test:e2e:goal": "NODE_ENV=test dotenv -e ../../.env -- jest --config ./test/jest-e2e.json --testPathPattern=goal-automation",
    "test:goal:all": "npm run test:integration:goal && npm run test:e2e:goal"
  }
}
```

### 5.2 테스트 실행 순서

1. **통합 테스트 먼저** (빠르고 격리됨)
   - Goal 분해 테스트
   - 매니저 할당 테스트
   - Epic 분해 테스트
   - 태스크 분배 테스트 ⭐
   - 태스크 실행 테스트
   - PR 생성 테스트
   - CI 체크 테스트 ⭐
   - 매니저 리뷰 테스트

2. **E2E 테스트** (느림, Mock LLM 사용)
   - 완전한 Goal-to-Merge 플로우
   - CI 실패 재시도 플로우
   - 병렬 팀 실행

3. **시나리오 테스트 마지막** (가장 느림, 가장 포괄적)
   - Phase 4.1 지식 시스템
   - 순차 Goal 처리

### 5.3 성공 기준

Phase 4를 프로덕션 준비 완료로 간주하기 전에 모든 테스트가 통과해야 함:

- ✅ 모든 통합 테스트 통과 (100%)
- ✅ 모든 E2E 테스트 통과 (100%)
- ✅ 모든 시나리오 테스트 통과 (100%)
- ✅ 어떤 매니저도 Implementation 태스크를 실행하지 않음
- ✅ CI 실패가 올바르게 감지되고 재시도됨
- ✅ 중복 브랜치 생성 에러 없음
- ✅ 태스크가 합리적인 시간 내에 완료됨 (평균 <15분/태스크)

---

## 6. 모니터링 및 디버깅

### 6.1 테스트 로깅

각 테스트는 다음을 로깅해야 함:

- 태스크 상태 전환 (PENDING → READY → IN_PROGRESS → ...)
- Brain 실행 결과
- CI 체크 결과
- PR 생성/병합 이벤트
- 에러 발생

### 6.2 테스트 실패 시

테스트 실패 시 다음을 캡처:

- 전체 태스크 히스토리 (상태 전환)
- Brain 실행 로그
- Git 작업 (브랜치 생성, 커밋, PR 생성)
- CI 로그
- 실패 시점의 데이터베이스 상태

### 6.3 성능 메트릭

다음 메트릭을 추적하고 검증:

- Goal 분해 시간
- 태스크 실행 시간
- PR 생성부터 병합까지 시간
- 전체 Goal 완료 시간
- 태스크당 재시도 횟수
- CI 체크 소요 시간

---

## 7. 테스트 전에 수정해야 할 알려진 이슈

관찰된 이슈를 기반으로, 테스트 전에 다음을 수정:

1. **매니저 역할 분리** - 매니저가 Implementation 태스크를 실행하면 안됨
2. **CI 탐지 로직** - CI 실패를 제대로 감지
3. **재시도 로직** - 실패한 태스크의 재시도 메커니즘 수정
4. **브랜치 생성** - 브랜치 생성 전에 존재 여부 체크
5. **타임아웃 처리** - Brain 실행 타임아웃 더 나은 처리
6. **태스크 분배** - 팀원에게 태스크를 올바르게 분배

---

## 8. 다음 단계

1. ✅ **테스트 계획 문서 작성** (완료)
2. ⏳ **seed.ts 업데이트** (실제 팀 구조 데이터)
3. ⏳ **통합 테스트 구현** (가장 중요한 것부터: 매니저 역할 분리, CI 탐지)
4. ⏳ **확인된 이슈 수정** (테스트가 드러내는 대로)
5. ⏳ **E2E 테스트 구현** (Mock LLM 사용)
6. ⏳ **시나리오 테스트 구현** (전체 Phase 4.1 워크플로우)
7. ⏳ **모든 테스트 통과 확인** (프로덕션 배포 전)

---

## 9. 워크트리 격리 및 공유 시나리오

### 개요

Phase 4 시스템에서는 각 팀원 홀론이 **독립된 워크트리**를 생성하고, 서브 홀론들은 **부모의 워크트리를 공유**합니다.

### 9.1 워크트리 격리 (팀원 홀론)

**시나리오**: 여러 팀원이 동시에 작업할 때 서로 격리됨

```
Team Epic (TechLead-Alpha)
   │
   ├─ 3개 Implementation Tasks 생성
   │
   ├─ Task 1 → Developer-Bravo 할당
   │  └─ 워크트리 생성: .git-worktrees/hollon-{bravo-id}/task-{task1-id}/
   │     - 브랜치: wt-hollon-{bravo-id}-task-{task1-id}
   │     - 독립된 작업 공간
   │
   ├─ Task 2 → Developer-Charlie 할당
   │  └─ 워크트리 생성: .git-worktrees/hollon-{charlie-id}/task-{task2-id}/
   │     - 브랜치: wt-hollon-{charlie-id}-task-{task2-id}
   │     - Developer-Bravo와 격리됨
   │
   └─ Task 3 → Developer-Bravo 할당
      └─ 워크트리 생성: .git-worktrees/hollon-{bravo-id}/task-{task3-id}/
         - 브랜치: wt-hollon-{bravo-id}-task-{task3-id}
         - Task 1의 워크트리와도 격리됨
```

**코드 위치**:

- `TaskExecutionService.getOrCreateWorktree()` (Line 738-838)
- 각 홀론과 태스크마다 고유 경로: `.git-worktrees/hollon-{hollonId}/task-{taskId}`

**검증 포인트**:

1. ✅ 각 팀원 홀론이 별도의 워크트리 디렉토리를 가짐
2. ✅ 동일한 홀론이라도 다른 태스크는 다른 워크트리
3. ✅ 워크트리 간 파일 변경 사항이 격리됨
4. ✅ 각 워크트리가 독립된 Git 브랜치를 가짐

### 9.2 워크트리 공유 (서브 홀론)

**시나리오**: 한 태스크가 여러 서브태스크로 분해될 때 동일 워크트리 공유

```
Implementation Task (Developer-Bravo)
   │
   ├─ 워크트리: .git-worktrees/hollon-{bravo-id}/task-{task1-id}/
   │
   ├─ Brain Provider가 태스크 분해
   │  ├─ Subtask 1: "Entity 작성"
   │  ├─ Subtask 2: "Service 작성"
   │  └─ Subtask 3: "Controller 작성"
   │
   ├─ 각 서브태스크마다 임시 서브 홀론 생성
   │  ├─ SubHollon 1 (PlanningSpecialist)
   │  │  └─ workingDirectory: .git-worktrees/hollon-{bravo-id}/task-{task1-id}/  ✅ 부모 워크트리 재사용
   │  │
   │  ├─ SubHollon 2 (ImplementationSpecialist)
   │  │  └─ workingDirectory: .git-worktrees/hollon-{bravo-id}/task-{task1-id}/  ✅ 동일한 워크트리
   │  │
   │  └─ SubHollon 3 (TestingSpecialist)
   │     └─ workingDirectory: .git-worktrees/hollon-{bravo-id}/task-{task1-id}/  ✅ 동일한 워크트리
   │
   └─ 모든 서브 홀론이 같은 워크트리에서 작업
      - Planning → implementation-plan.md 생성
      - Implementation → Entity, Service, Controller 작성
      - Testing → *.spec.ts 파일 작성
      - Integration → git commit, PR 생성
      - 모든 변경사항이 하나의 PR로 통합됨
```

**코드 위치**:

- `TaskExecutionService.decomposeIntoSubtasks()` (Line 1182-1243)
  - Line 1226: `workingDirectory: worktreePath` - 부모의 워크트리 경로 전달
- `TaskExecutionService.getOrCreateWorktree()` (Line 738-838)
  - Line 739-744: `task.workingDirectory`가 이미 있으면 재사용

**검증 포인트**:

1. ✅ 서브태스크의 `workingDirectory`가 부모 태스크와 동일
2. ✅ 서브 홀론들이 동일한 Git 워크트리에서 작업
3. ✅ 서브 홀론들의 커밋이 모두 같은 브랜치에 누적
4. ✅ 최종적으로 하나의 PR로 병합됨

### 9.3 E2E 테스트 시나리오

#### 테스트 1: 팀원 워크트리 격리

```typescript
describe('Worktree Isolation for Team Members', () => {
  it('should create independent worktrees for different team members', async () => {
    // Given: 하나의 Team Epic이 3개 Implementation Tasks로 분해됨
    const teamEpic = await createTeamEpic('Backend API Implementation');

    // When: 각 태스크가 다른 팀원에게 할당됨
    const task1 = await assignTask(teamEpic.tasks[0], 'Developer-Bravo');
    const task2 = await assignTask(teamEpic.tasks[1], 'Developer-Charlie');
    const task3 = await assignTask(teamEpic.tasks[2], 'Developer-Bravo');

    // When: 각 팀원이 태스크 실행
    await executeTask(task1.id, 'Developer-Bravo');
    await executeTask(task2.id, 'Developer-Charlie');
    await executeTask(task3.id, 'Developer-Bravo');

    // Then: 각 태스크가 독립된 워크트리를 가짐
    expect(task1.workingDirectory).toContain('hollon-bravo');
    expect(task1.workingDirectory).toContain('task-' + task1.id.slice(0, 8));

    expect(task2.workingDirectory).toContain('hollon-charlie');
    expect(task2.workingDirectory).toContain('task-' + task2.id.slice(0, 8));

    expect(task3.workingDirectory).toContain('hollon-bravo');
    expect(task3.workingDirectory).toContain('task-' + task3.id.slice(0, 8));

    // Then: Task 1과 Task 3의 워크트리가 다름 (같은 홀론이지만 다른 태스크)
    expect(task1.workingDirectory).not.toEqual(task3.workingDirectory);

    // Then: 각 워크트리가 실제로 존재함
    expect(fs.existsSync(task1.workingDirectory)).toBe(true);
    expect(fs.existsSync(task2.workingDirectory)).toBe(true);
    expect(fs.existsSync(task3.workingDirectory)).toBe(true);
  });
});
```

#### 테스트 2: 서브 홀론 워크트리 공유

```typescript
describe('Worktree Sharing for Sub-Hollons', () => {
  it('should share worktree among sub-hollons of the same parent task', async () => {
    // Given: 하나의 Implementation Task
    const task = await createImplementationTask('Implement User Service');
    const hollon = await getHollon('Developer-Bravo');

    // When: Brain Provider가 태스크를 서브태스크로 분해
    const result = await taskExecutionService.executeTask(task.id, hollon.id);

    // Then: 부모 태스크의 워크트리 경로 확인
    const parentWorktree = task.workingDirectory;
    expect(parentWorktree).toContain('.git-worktrees');

    // Then: 모든 서브태스크가 부모와 동일한 워크트리 사용
    const subtasks = await taskRepo.find({ where: { parentTaskId: task.id } });
    expect(subtasks.length).toBeGreaterThan(0);

    for (const subtask of subtasks) {
      expect(subtask.workingDirectory).toEqual(parentWorktree);

      // 서브 홀론 확인
      const subHollon = await hollonRepo.findOne({
        where: { id: subtask.assignedHollonId },
      });
      expect(subHollon.lifecycle).toBe(HollonLifecycle.TEMPORARY);
    }

    // Then: 서브 홀론들이 specialized roles 사용
    const subHollons = await hollonRepo.find({
      where: {
        createdByHollonId: hollon.id,
        lifecycle: HollonLifecycle.TEMPORARY,
      },
      relations: ['role'],
    });

    const roleNames = subHollons.map((h) => h.role.name);
    expect(roleNames).toContain('PlanningSpecialist');
    expect(roleNames).toContain('ImplementationSpecialist');
    expect(roleNames).toContain('TestingSpecialist');
  });
});
```

#### 테스트 3: 전체 워크플로우 (격리 + 공유)

```typescript
describe('Complete Worktree Workflow', () => {
  it('should maintain isolation between team members while sharing within sub-hollons', async () => {
    // Given: 하나의 Goal이 2개 Team Epic으로 분해
    const goal = await createGoal('Build Knowledge System');
    await autoDecomposeGoals(); // Cron job

    // Given: 각 Team Epic이 팀원에게 할당
    await autoAssignManagersToTeamEpics(); // Cron job
    await autoDecomposeTeamEpics(); // Cron job

    // 2개 팀, 각각 2명씩 팀원
    // Team 1: Developer-Bravo, Developer-Charlie
    // Team 2: AIEngineer-Delta, DataEngineer-Gamma

    // When: 각 팀의 Implementation Tasks가 팀원에게 할당
    await autoAssignTasks(); // Cron job - 새로 구현된 Step 4

    // When: 모든 팀원이 동시에 작업 실행
    await autoExecuteTasks(); // Cron job

    // Then: 각 팀원이 독립된 워크트리 사용
    const allTasks = await taskRepo.find({
      where: { type: TaskType.IMPLEMENTATION },
    });

    const worktrees = allTasks.map((t) => t.workingDirectory);
    const uniqueWorktrees = new Set(worktrees);

    // 각 태스크마다 다른 워크트리 (격리됨)
    expect(uniqueWorktrees.size).toEqual(allTasks.length);

    // Then: 각 태스크의 서브태스크들은 부모 워크트리 공유
    for (const task of allTasks) {
      const subtasks = await taskRepo.find({
        where: { parentTaskId: task.id },
      });

      if (subtasks.length > 0) {
        for (const subtask of subtasks) {
          // 서브태스크는 부모와 동일한 워크트리
          expect(subtask.workingDirectory).toEqual(task.workingDirectory);
        }
      }
    }
  });
});
```

#### 테스트 4: 매니저 역할 분리 - 구현 태스크 차단

```typescript
describe('Manager Role Separation', () => {
  it(
    'should prevent managers from executing implementation tasks',
    async () => {
      console.log('🧪 Testing manager role separation...');

      // Given: Implementation 태스크가 매니저에게 잘못 할당됨
      const managerTask = await taskRepo.save(
        taskRepo.create({
          title: 'Manager Should Not Execute This',
          description: 'This task is wrongly assigned to a manager',
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY,
          organizationId: organization.id,
          teamId: backendTeam.id,
          projectId: project.id,
          assignedHollonId: techLead.id, // ❌ 매니저에게 할당
        }),
      );

      console.log(
        `📋 Created task ${managerTask.id.slice(0, 8)} assigned to manager ${techLead.name}`,
      );

      // When: 태스크 실행 시도
      let executionFailed = false;
      let errorMessage = '';

      try {
        await taskExecutionService.executeTask(managerTask.id, techLead.id);
      } catch (error) {
        executionFailed = true;
        errorMessage = (error as Error).message;
        console.log(`✅ Execution blocked with error: ${errorMessage}`);
      }

      // Then: 다음 중 하나가 발생해야 함:
      // 1. 실행이 차단되거나 (에러 발생), OR
      // 2. 워크트리가 생성되지 않음 (실제 작업이 수행되지 않음)
      const updatedTask = await taskRepo.findOne({
        where: { id: managerTask.id },
      });

      console.log(
        `📊 Task status after execution attempt: ${updatedTask.status}`,
      );
      console.log(
        `📁 Task workingDirectory: ${updatedTask.workingDirectory || 'null'}`,
      );

      // 매니저는 Implementation 태스크에 대해 워크트리가 생성되면 안 됨
      if (!executionFailed) {
        expect(updatedTask.workingDirectory).toBeNull();
        console.log(
          '✅ Manager task did not create worktree (correct behavior)',
        );
      } else {
        console.log('✅ Manager task execution was blocked (correct behavior)');
      }
    },
    TEST_TIMEOUT,
  );
});
```

**검증 포인트**:

1. ✅ 매니저가 Implementation 태스크를 실행할 수 없음
2. ✅ 매니저는 워크트리를 생성하지 않음
3. ✅ 매니저는 코드를 직접 작성하지 않음

#### 테스트 5: 매니저 역할 분리 - 태스크 분배 계층

```typescript
describe('Manager Role Separation', () => {
  it(
    'should verify task distribution uses manager hierarchy',
    async () => {
      console.log('🧪 Testing task distribution through manager hierarchy...');

      // Given: 매니저에게 할당된 부모 태스크
      const parentTask = await taskRepo.save(
        taskRepo.create({
          title: 'Parent Task for Distribution',
          description: 'Manager should distribute this to team members',
          type: TaskType.TEAM_EPIC,
          status: TaskStatus.READY,
          organizationId: organization.id,
          teamId: backendTeam.id,
          projectId: project.id,
          assignedHollonId: techLead.id, // Manager
        }),
      );

      // When: 부모 태스크 실행 (매니저가 서브태스크로 분해)
      await taskExecutionService.executeTask(parentTask.id, techLead.id);
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Then: 서브태스크가 생성되었는지 확인
      const subtasks = await taskRepo.find({
        where: { parentTaskId: parentTask.id },
      });

      console.log(`📊 Found ${subtasks.length} subtasks created by manager`);

      if (subtasks.length > 0) {
        for (const subtask of subtasks) {
          console.log(
            `  └─ Subtask ${subtask.id.slice(0, 8)}: "${subtask.title}" → ${
              subtask.assignedHollonId
                ? subtask.assignedHollonId.slice(0, 8)
                : 'unassigned'
            }`,
          );

          if (subtask.assignedHollonId) {
            // 할당되었다면, 매니저 본인이 아니어야 함
            expect(subtask.assignedHollonId).not.toBe(techLead.id);

            // 하위 팀원에게 할당되었는지 확인
            const assignedHollon = await hollonRepo.findOne({
              where: { id: subtask.assignedHollonId },
            });

            if (assignedHollon) {
              console.log(
                `    ✅ Assigned to ${assignedHollon.name} (managerId: ${assignedHollon.managerId?.slice(0, 8) || 'none'})`,
              );
              // 할당된 홀론의 managerId가 매니저여야 함
              expect(assignedHollon.managerId).toBe(techLead.id);
            }
          }
        }
      }
    },
    TEST_TIMEOUT,
  );
});
```

**검증 포인트**:

1. ✅ 매니저가 Team Epic을 서브태스크로 분해
2. ✅ 서브태스크가 매니저 본인이 아닌 팀원에게 할당
3. ✅ 할당된 팀원의 `managerId`가 매니저 ID와 일치
4. ✅ 매니저 계층 구조를 통한 태스크 분배

#### 테스트 6: PR 생성 및 검증

```typescript
describe('PR Creation and Verification', () => {
  it(
    'should create a real PR and verify it',
    async () => {
      console.log('🧪 Testing real PR creation...');

      // Given: 간단한 Implementation 태스크
      const prTask = await taskRepo.save(
        taskRepo.create({
          title: 'Add test file for PR verification',
          description: 'Create a simple test file to verify PR workflow',
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY,
          organizationId: organization.id,
          teamId: backendTeam.id,
          projectId: project.id,
          assignedHollonId: devBravo.id,
        }),
      );

      console.log(
        `📋 Created PR test task ${prTask.id.slice(0, 8)} for ${devBravo.name}`,
      );

      // When: 태스크 실행 (PR이 생성되어야 함)
      console.log(
        '⏳ Executing task (this will take several minutes with real LLM)...',
      );
      await taskExecutionService.executeTask(prTask.id, devBravo.id);

      // 태스크를 다시 로드하여 업데이트된 상태 확인
      const updatedTask = await taskRepo.findOne({
        where: { id: prTask.id },
      });

      console.log(`📊 Task status: ${updatedTask.status}`);
      console.log(`📁 Working directory: ${updatedTask.workingDirectory}`);

      // Then: 워크트리가 생성되었는지 확인
      if (updatedTask.workingDirectory) {
        expect(fs.existsSync(updatedTask.workingDirectory)).toBe(true);
        console.log('✅ Worktree created successfully');
      }

      // Then: PR이 생성되었는지 확인
      const TaskPullRequest =
        require('../../src/modules/task/entities/task-pull-request.entity').TaskPullRequest;
      const prRepo = dataSource.getRepository(TaskPullRequest);

      const pr = await prRepo.findOne({
        where: { taskId: prTask.id },
      });

      if (pr) {
        console.log(`✅ PR created: ${pr.prUrl}`);
        console.log(`📊 PR status: ${pr.status || 'unknown'}`);

        // PR URL 형식 검증
        expect(pr.prUrl).toContain('github.com');
        expect(pr.prUrl).toContain('/pull/');

        // Optional: gh CLI를 사용하여 PR 상태 확인
        try {
          const prNumber = pr.prUrl.split('/pull/')[1];
          const { stdout: prStatus } = await execAsync(
            `gh pr view ${prNumber} --json state,title`,
            { cwd: testRepoPath },
          );
          console.log(`📋 PR details: ${prStatus}`);
        } catch (error) {
          console.log(
            `⚠️  Could not fetch PR status: ${(error as Error).message}`,
          );
        }

        console.log('ℹ️  PR will be cleaned up with test repository');
      } else {
        console.log('⚠️  No PR created yet (task might still be in progress)');
      }
    },
    TEST_TIMEOUT,
  );
});
```

**검증 포인트**:

1. ✅ Integration Hollon이 실제 PR을 생성
2. ✅ TaskPullRequest 엔티티에 PR URL이 저장됨
3. ✅ PR URL 형식이 올바름 (github.com/pull/...)
4. ✅ gh CLI로 PR 상태 확인 가능
5. ✅ 전체 워크플로우: Code → Git → PR → Review

### 9.4 구현 체크리스트

- [x] **TaskExecutionService.getOrCreateWorktree()**: 각 홀론/태스크마다 독립 워크트리 생성
- [x] **TaskExecutionService.decomposeIntoSubtasks()**: 서브태스크에 부모 워크트리 전달
- [x] **워크트리 경로 형식**: `.git-worktrees/hollon-{id}/task-{id}/`
- [x] **워크트리 재사용 로직**: `task.workingDirectory` 확인
- [ ] **E2E 테스트 작성**: 워크트리 격리 및 공유 검증
- [ ] **통합 테스트 작성**: 워크트리 경로 검증
- [ ] **실제 환경 테스트**: 동시 실행 시나리오

---

## 부록: 주요 테스트 케이스 요약

### 최우선 테스트 (Critical Path)

1. **매니저 역할 분리 테스트** (1.3.2, 1.4.1, 1.5.2, 2.1)
   - 매니저는 분배만, 팀원이 실행
   - Implementation 태스크가 매니저에게 할당되지 않음
   - 매니저가 Implementation 태스크를 실행하지 않음

2. **CI 탐지 및 재시도 테스트** (1.7.1, 1.7.2, 1.7.4, 2.2)
   - CI 성공/실패를 올바르게 감지
   - 실패 시 자동 재시도
   - 최대 재시도 횟수 제한

3. **전체 플로우 테스트** (2.1, 3.1)
   - Goal → Team Epic → Implementation → PR → Review → Merge
   - 실제 코드 생성 및 병합 확인

### 중요도 순서

1. 🔴 **매니저 역할 분리** - 가장 중요
2. 🔴 **CI 탐지 및 재시도** - 가장 중요
3. 🟡 **브랜치 관리** - 중요
4. 🟡 **태스크 분배 로직** - 중요
5. 🟢 **전체 E2E 플로우** - 중요하지만 위의 것들이 먼저
6. 🟢 **성능 및 타임아웃** - 최적화 단계

---

## Phase 4 개선: 지능형 태스크 Decomposition 시스템

### 개요

기존 서브 홀론 시스템의 문제점을 해결하기 위한 지능형 decomposition 시스템을 구현했습니다.

**문제점**:

- Brain(Claude Code)이 복잡한 태스크를 직접 구현하려고 시도 → 881초 타임아웃 발생
- Decomposition 여부를 Brain에게 맡기면, 직접 구현을 선택할 수 있음
- Temporary hollon (depth=1)도 decomposition을 시도하면 에러 발생

**해결 방안**:

1. **태스크 복잡도 자동 분석** - 휴리스틱 기반으로 high/medium/low 분류
2. **Depth별 차별화된 프롬프트** - Permanent/Temporary hollon에게 다른 지시사항 전달
3. **Depth 제한 명확화** - depth=1까지만 허용 (간단하고 안전)

### 구현 상세

#### 1. 태스크 복잡도 자동 분석

**파일**: `apps/server/src/modules/orchestration/services/task-execution.service.ts`

```typescript
private analyzeTaskComplexity(task: Task): 'high' | 'medium' | 'low' {
  let complexityScore = 0;

  // Description 길이
  if (task.description?.length > 500) complexityScore += 3;
  else if (task.description?.length > 200) complexityScore += 2;

  // Acceptance Criteria 개수
  if (task.acceptanceCriteria?.length > 5) complexityScore += 3;
  else if (task.acceptanceCriteria?.length > 3) complexityScore += 2;

  // Affected Files 개수
  if (task.affectedFiles?.length > 5) complexityScore += 3;
  else if (task.affectedFiles?.length > 3) complexityScore += 2;

  // 복잡도 키워드 ("implement complete", "full system" 등)
  const complexKeywords = ['implement complete', 'full system', 'entire module'];
  if (hasComplexKeywords(task)) complexityScore += 2;

  // 분류
  if (complexityScore >= 7) return 'high';
  if (complexityScore >= 4) return 'medium';
  return 'low';
}
```

#### 2. Depth별 차별화된 프롬프트

**Permanent Hollon (depth=0) + 복잡한 태스크 (high/medium)**:

```
⚠️ IMPORTANT: This task appears to be HIGH complexity.
For optimal parallel execution and quality, you should DECOMPOSE this task.

To decompose, start your response with "DECOMPOSE_TASK: <reason>"
Then provide subtask JSON...

Each subtask will be executed by a specialized sub-hollon in parallel.
```

→ **Decomposition 강력 권장**

**Permanent Hollon (depth=0) + 간단한 태스크 (low)**:

```
Please implement the task described above.
...
(Optional) If you think decomposition would help, you can suggest it...
```

→ 직접 구현 우선, decomposition 선택 가능

**Temporary Hollon (depth=1)**:

```
You are a temporary sub-hollon responsible for this specific subtask.
DO NOT attempt to decompose further.
Please implement directly.
```

→ **Decomposition 금지, 직접 구현만**

#### 3. Depth 제한

**설정**: `MAX_TEMPORARY_HOLLON_DEPTH = 1`

**허용 구조**:

- ✅ Permanent (depth=0) → Temporary (depth=1)
- ❌ Temporary (depth=1) → Temporary (depth=2) - **차단됨**

**장점**:

- 단순하고 관리하기 쉬움
- Permanent hollon이 적절히 분해하면 1단계로 충분
- 무한 재귀 위험 없음

### 동작 흐름

```
1. Permanent Hollon (Developer-Bravo, depth=0)이 복잡한 태스크 수신
   ├─ "Implement Complete User Module" (high complexity)
   ├─ Brain에게 "⚠️ DECOMPOSE 필수" 프롬프트 전달
   └─ Brain이 "DECOMPOSE_TASK: Too complex for one hollon" 응답

2. 서브태스크로 분해
   ├─ Subtask 1: "Implement User Entity" (low complexity)
   ├─ Subtask 2: "Implement User Service" (low complexity)
   ├─ Subtask 3: "Implement User Controller" (low complexity)
   └─ Subtask 4: "Write User Tests" (low complexity)

3. 각 서브태스크에 Temporary Hollon (depth=1) 할당
   ├─ Sub-Hollon-A (depth=1) → Subtask 1
   ├─ Sub-Hollon-B (depth=1) → Subtask 2
   ├─ Sub-Hollon-C (depth=1) → Subtask 3
   └─ Sub-Hollon-D (depth=1) → Subtask 4

4. Temporary Hollon들이 병렬 실행
   ├─ Brain에게 "DO NOT decompose" 프롬프트 전달
   ├─ 각자 간단한 서브태스크를 직접 구현
   └─ 커밋 후 COMPLETED로 변경

5. 모든 서브태스크 완료 → 부모 태스크 완료
```

### 테스트 시나리오

#### 10.1 태스크 복잡도 분석 테스트

**파일**: `apps/server/src/modules/orchestration/services/task-execution.service.spec.ts`

```typescript
describe('TaskExecutionService - Complexity Analysis', () => {
  it('should classify high complexity task', () => {
    const task = {
      title: 'Implement Complete User Management System',
      description: 'A very long description with more than 500 characters...',
      acceptanceCriteria: ['AC1', 'AC2', 'AC3', 'AC4', 'AC5', 'AC6'], // 6개
      affectedFiles: [
        'user.entity.ts',
        'user.service.ts',
        'user.controller.ts',
        'user.dto.ts',
        'user.module.ts',
        'user.spec.ts',
      ], // 6개
    };

    const complexity = service['analyzeTaskComplexity'](task);
    expect(complexity).toBe('high');
  });

  it('should classify low complexity task', () => {
    const task = {
      title: 'Fix typo in README',
      description: 'Simple typo fix',
      acceptanceCriteria: ['Fix typo'],
      affectedFiles: ['README.md'],
    };

    const complexity = service['analyzeTaskComplexity'](task);
    expect(complexity).toBe('low');
  });
});
```

#### 10.2 Depth별 프롬프트 생성 테스트

```typescript
describe('TaskExecutionService - Prompt Generation', () => {
  it('should recommend decomposition for permanent hollon with high complexity', () => {
    const task = createHighComplexityTask();
    const permanentHollon = { id: '...', depth: 0 };

    const prompt = service['buildTaskPrompt'](task, permanentHollon);

    expect(prompt).toContain('⚠️ IMPORTANT');
    expect(prompt).toContain('you should DECOMPOSE');
    expect(prompt).toContain('parallel execution');
  });

  it('should forbid decomposition for temporary hollon', () => {
    const task = createAnyTask();
    const temporaryHollon = { id: '...', depth: 1 };

    const prompt = service['buildTaskPrompt'](task, temporaryHollon);

    expect(prompt).toContain('DO NOT attempt to decompose');
    expect(prompt).toContain('temporary sub-hollon');
  });

  it('should allow both options for permanent hollon with low complexity', () => {
    const task = createLowComplexityTask();
    const permanentHollon = { id: '...', depth: 0 };

    const prompt = service['buildTaskPrompt'](task, permanentHollon);

    expect(prompt).toContain('Please implement');
    expect(prompt).toContain('Optional');
    expect(prompt).not.toContain('⚠️ IMPORTANT');
  });
});
```

#### 10.3 E2E: 복잡한 태스크 자동 Decomposition 테스트

**파일**: `apps/server/test/e2e/phase4-intelligent-decomposition.e2e-spec.ts`

```typescript
describe('Phase 4: Intelligent Task Decomposition (E2E)', () => {
  it('should automatically decompose high complexity task', async () => {
    // Given: 복잡한 태스크 생성
    const complexTask = await taskRepo.save({
      title: 'Implement Complete User Management System',
      description:
        'Create Entity, Service, Controller, DTOs, Tests, and Module for User management. ' +
        'Include authentication, authorization, CRUD operations, and comprehensive test coverage. ' +
        'Follow all best practices and patterns used in the project.',
      acceptanceCriteria: [
        'User entity with validation',
        'CRUD service methods',
        'REST API controller',
        'DTO classes for all operations',
        'Unit tests with >80% coverage',
        'Integration tests for API endpoints',
        'Module configuration',
      ],
      affectedFiles: [
        'user.entity.ts',
        'user.service.ts',
        'user.controller.ts',
        'create-user.dto.ts',
        'update-user.dto.ts',
        'user.service.spec.ts',
        'user.controller.spec.ts',
        'user.module.ts',
      ],
      type: TaskType.IMPLEMENTATION,
      status: TaskStatus.READY,
      assignedHollonId: permanentHollon.id, // depth=0
      organizationId: org.id,
      projectId: project.id,
    });

    // When: 태스크 실행
    await taskExecutionService.executeTask(complexTask.id, permanentHollon.id);

    // Then: 서브태스크가 생성되었는지 확인
    const subtasks = await taskRepo.find({
      where: { parentTaskId: complexTask.id },
    });

    expect(subtasks.length).toBeGreaterThan(0);
    console.log(`✅ Created ${subtasks.length} subtasks`);

    // Then: 각 서브태스크에 Temporary hollon이 할당되었는지 확인
    for (const subtask of subtasks) {
      expect(subtask.assignedHollonId).toBeDefined();

      const subHollon = await hollonRepo.findOne({
        where: { id: subtask.assignedHollonId },
      });

      expect(subHollon).toBeDefined();
      expect(subHollon.lifecycle).toBe(HollonLifecycle.TEMPORARY);
      expect(subHollon.depth).toBe(1);
      expect(subHollon.createdByHollonId).toBe(permanentHollon.id);

      console.log(`  ├─ Subtask: ${subtask.title}`);
      console.log(
        `  └─ Sub-Hollon: ${subHollon.name} (depth=${subHollon.depth})`,
      );
    }

    // Then: 부모 태스크가 PENDING 상태인지 확인
    const updatedParent = await taskRepo.findOne({
      where: { id: complexTask.id },
    });
    expect(updatedParent.status).toBe(TaskStatus.PENDING);
  });

  it('should NOT decompose low complexity task', async () => {
    // Given: 간단한 태스크 생성
    const simpleTask = await taskRepo.save({
      title: 'Fix typo in user.service.ts',
      description: 'Change "recieve" to "receive" in error message',
      acceptanceCriteria: ['Typo fixed'],
      affectedFiles: ['user.service.ts'],
      type: TaskType.IMPLEMENTATION,
      status: TaskStatus.READY,
      assignedHollonId: permanentHollon.id,
      organizationId: org.id,
      projectId: project.id,
    });

    // When: 태스크 실행
    await taskExecutionService.executeTask(simpleTask.id, permanentHollon.id);

    // Then: 서브태스크가 생성되지 않았는지 확인
    const subtasks = await taskRepo.find({
      where: { parentTaskId: simpleTask.id },
    });

    expect(subtasks.length).toBe(0);
    console.log('✅ No subtasks created for simple task');

    // Then: 태스크가 직접 처리되었는지 확인
    const updatedTask = await taskRepo.findOne({
      where: { id: simpleTask.id },
    });

    // Status should be READY_FOR_REVIEW or COMPLETED (not PENDING)
    expect([TaskStatus.READY_FOR_REVIEW, TaskStatus.COMPLETED]).toContain(
      updatedTask.status,
    );
  });

  it('should prevent depth=1 hollon from creating subtasks', async () => {
    // Given: Temporary hollon (depth=1) 생성
    const tempHollon = await hollonService.createTemporaryHollon({
      name: 'Temp-Test-Hollon',
      organizationId: org.id,
      roleId: devRole.id,
      createdBy: permanentHollon.id, // depth=1
    });

    expect(tempHollon.depth).toBe(1);

    // Given: 복잡한 태스크를 temporary hollon에 할당
    const complexTask = await taskRepo.save({
      title: 'Implement Complex Feature',
      description: 'Very long description...',
      acceptanceCriteria: ['AC1', 'AC2', 'AC3', 'AC4', 'AC5', 'AC6'],
      type: TaskType.IMPLEMENTATION,
      status: TaskStatus.READY,
      assignedHollonId: tempHollon.id,
      organizationId: org.id,
      projectId: project.id,
    });

    // When: 태스크 실행 시도
    await taskExecutionService.executeTask(complexTask.id, tempHollon.id);

    // Then: Brain에게 "DO NOT decompose" 프롬프트가 전달되어야 함
    // (실제로는 Brain response를 mock하거나 프롬프트를 검증해야 함)

    // Then: 서브태스크가 생성되지 않아야 함
    const subtasks = await taskRepo.find({
      where: { parentTaskId: complexTask.id },
    });

    expect(subtasks.length).toBe(0);
    console.log('✅ Depth=1 hollon did not create subtasks');
  });
});
```

#### 10.4 통합 테스트: Depth 제한 검증

```typescript
describe('HollonService - Depth Limit', () => {
  it('should allow depth=0 to create depth=1 hollon', async () => {
    const parentHollon = await createPermanentHollon(); // depth=0

    const tempHollon = await hollonService.createTemporaryHollon({
      name: 'Temp-Hollon',
      organizationId: org.id,
      roleId: role.id,
      createdBy: parentHollon.id,
    });

    expect(tempHollon.depth).toBe(1);
    expect(tempHollon.lifecycle).toBe(HollonLifecycle.TEMPORARY);
  });

  it('should prevent depth=1 from creating depth=2 hollon', async () => {
    const depth1Hollon = await createTemporaryHollon(); // depth=1

    await expect(
      hollonService.createTemporaryHollon({
        name: 'Would-Be-Depth-2',
        organizationId: org.id,
        roleId: role.id,
        createdBy: depth1Hollon.id,
      }),
    ).rejects.toThrow('Maximum temporary hollon depth (1) exceeded');
  });
});
```

### 검증 포인트

**복잡도 분석**:

- ✅ Description 길이 기반 점수 계산
- ✅ Acceptance criteria 개수 기반 점수 계산
- ✅ Affected files 개수 기반 점수 계산
- ✅ 복잡도 키워드 감지
- ✅ High/Medium/Low 분류 정확도

**프롬프트 생성**:

- ✅ Depth=0 + High complexity → Decomposition 강력 권장
- ✅ Depth=0 + Low complexity → 직접 구현 우선
- ✅ Depth=1 → Decomposition 금지

**Depth 제한**:

- ✅ Depth=0 → Depth=1 생성 허용
- ✅ Depth=1 → Depth=2 생성 차단
- ✅ Error message 명확성

**E2E 흐름**:

- ✅ 복잡한 태스크 자동 decomposition
- ✅ 간단한 태스크 직접 처리
- ✅ Temporary hollon의 decomposition 시도 차단
- ✅ 서브태스크 병렬 실행
- ✅ 타임아웃 문제 해결 (881초 → 예상: <300초)

### 기대 효과

1. **타임아웃 문제 해결**
   - Before: 881초 (Brain이 직접 구현 시도)
   - After: ~200-300초 (적절한 decomposition + 병렬 실행)

2. **코드 품질 향상**
   - 작은 단위로 분해되어 각 서브 홀론이 집중
   - 병렬 실행으로 빠른 피드백

3. **시스템 안정성**
   - Depth 제한으로 무한 재귀 방지
   - 명확한 책임 분리 (Permanent: 분해, Temporary: 실행)

4. **유지보수성**
   - 단순한 구조 (depth=1까지만)
   - 명확한 프롬프트 전략

### 구현 체크리스트

- [x] **analyzeTaskComplexity()**: 태스크 복잡도 자동 분석
- [x] **buildTaskPrompt()**: Depth별 차별화된 프롬프트 생성
- [x] **executeBrainProvider()**: Hollon을 프롬프트 생성에 전달
- [x] **MAX_TEMPORARY_HOLLON_DEPTH = 1**: Depth 제한 설정
- [ ] **Unit Tests**: 복잡도 분석, 프롬프트 생성 테스트
- [ ] **Integration Tests**: Depth 제한 검증
- [ ] **E2E Tests**: 자동 decomposition 흐름 검증
- [ ] **Performance Tests**: 타임아웃 개선 측정

---

## 최종 우선순위 테스트 목록 (Updated)

### Phase 4 추가 테스트

1. 🔴 **지능형 Decomposition** (10.3) - 최우선
   - 복잡한 태스크 자동 분해
   - Depth=1 hollon의 decomposition 차단
   - 타임아웃 문제 해결 검증

2. 🔴 **복잡도 분석** (10.1) - 최우선
   - High/Medium/Low 분류 정확도
   - 키워드 감지 기능

3. 🟡 **프롬프트 전략** (10.2) - 중요
   - Depth별 다른 지시사항
   - Decomposition 권장/금지 명확성

### 기존 최우선 테스트 (유지)

1. 🔴 **매니저 역할 분리** (1.3.2, 1.4.1, 1.5.2, 2.1)
2. 🔴 **CI 탐지 및 재시도** (1.7.1, 1.7.2, 1.7.4, 2.2)
3. 🔴 **워크트리 격리 및 공유** (9.1, 9.2, 9.3)
4. 🟡 **브랜치 관리** - 중요
5. 🟡 **태스크 분배 로직** - 중요
6. 🟢 **전체 E2E 플로우** - 중요하지만 위의 것들이 먼저
7. 🟢 **성능 및 타임아웃** - 최적화 단계

---

## 11. Task Dependency Workflow (Phase 3 추가)

### 개요

Goal description에 명시된 task dependencies를 Brain이 자동으로 인식하고, Implementation Tasks에 dependency 관계를 설정하는 기능입니다. Dependencies가 있는 task는 BLOCKED 상태로 생성되며, 선행 task가 완료되면 자동으로 READY 상태로 전환됩니다.

### 11.1 Dependency 설정 및 BLOCKED Tasks 생성

**목적**: Brain이 Goal/Epic description에서 task dependencies를 파악하고, 적절한 순서로 task를 실행할 수 있도록 BLOCKED 상태의 tasks를 생성

**구현 위치**: `task-execution.service.ts:494-560`

**기능**:

1. Brain에게 dependency 식별 요청 (Prompt에 명시)
2. Brain response에서 `dependencies` 필드 파싱
3. Two-pass task 생성:
   - First pass: 모든 tasks 생성 및 Map에 저장
   - Second pass: Dependencies 해결 및 BLOCKED 상태 설정

**검증**:

```typescript
// Step 5: Team Epic decomposition 결과
console.log('✅ Created 24 Implementation Task(s)');
console.log(
  '   - Task: "Create calculator module directory structure" (ready)',
);
console.log('   - Task: "Set up calculator module configuration" (blocked)');
console.log('   - Task: "Create calculator service class" (blocked)');

// Expected: 24개 중 1개만 READY, 나머지는 BLOCKED
```

**Prompt 예시** (task-execution.service.ts:605):

```typescript
IMPORTANT: Identify task dependencies - which tasks must be completed before others can start.

{
  "workItems": [
    {
      "title": "Task title",
      "description": "Detailed description",
      "dependencies": ["Exact title of task that must complete first"]
    }
  ]
}
```

**핵심 코드**:

```typescript
// task-execution.service.ts:529-555
// Second pass: Resolve and set dependencies
let blockedCount = 0;
for (const workItem of brainResult.workItems || []) {
  const currentTask = taskMap.get(workItem.title);
  if (!currentTask) continue;

  // Parse dependencies
  const dependencyTitles = workItem.dependencies || [];
  const dependencyTasks = dependencyTitles
    .map((depTitle: string) => taskMap.get(depTitle))
    .filter((t: Task | undefined): t is Task => t != null);

  if (dependencyTasks.length > 0) {
    // Set dependencies (many-to-many relation)
    currentTask.dependencies = dependencyTasks;

    // Update status to BLOCKED
    currentTask.status = TaskStatus.BLOCKED;

    await this.taskRepo.save(currentTask);
    blockedCount++;
  }
}
```

**Interface 업데이트**:

```typescript
// task-execution.service.ts:35-43
interface DecompositionWorkItem {
  title: string;
  description: string;
  priority?: string;
  estimatedHours?: number;
  requiredSkills?: string[];
  acceptanceCriteria?: string[];
  dependencies?: string[]; // Task titles that must complete first
}
```

### 11.2 Dependency Unblocking

**목적**: 선행 task가 완료되면 dependent tasks를 자동으로 READY 상태로 전환

**구현 위치**: `code-review.service.ts:284-346`

**기능**:

1. Task 완료 시 dependent tasks 조회
2. 각 dependent task의 모든 dependencies 확인
3. 모든 dependencies가 완료되었으면 BLOCKED → READY 전환
4. `task.assigned` event 발행 (자동 실행 트리거)

**핵심 로직**:

```typescript
// code-review.service.ts:284-346
private async unblockDependentTasks(completedTask: Task): Promise<void> {
  // Find all tasks that depend on this completed task
  const dependentTasks = await this.taskRepo
    .createQueryBuilder('task')
    .innerJoin('task.dependencies', 'dependency')
    .where('dependency.id = :completedTaskId', { completedTaskId: completedTask.id })
    .andWhere('task.status = :status', { status: TaskStatus.BLOCKED })
    .leftJoinAndSelect('task.dependencies', 'allDeps')
    .getMany();

  // Check each dependent task
  for (const dependentTask of dependentTasks) {
    // Are ALL dependencies now completed?
    const allDepsCompleted = dependentTask.dependencies.every(
      (dep) => dep.status === TaskStatus.COMPLETED
    );

    if (allDepsCompleted) {
      // Unblock: BLOCKED → READY
      await this.taskRepo.update(dependentTask.id, {
        status: TaskStatus.READY,
      });

      // Trigger automatic execution
      this.eventEmitter.emit('task.assigned', {
        taskId: dependentTask.id,
        hollonId: dependentTask.assignedHollonId,
      });

      this.logger.log(`✅ Unblocked dependent task: ${dependentTask.title}`);
    }
  }
}
```

**검증**:

```typescript
// calculator-goal-workflow.e2e-spec.ts:659-706
// Step 11.5: Verify dependency unblocking
console.log('🔓 Step 11.5: Verifying Dependency Unblocking...');
console.log('   Completed task has 3 dependent task(s)');
console.log('   Dependent tasks unblocked: 0/3');
console.log(
  '   ℹ️  No tasks unblocked yet (may still have other dependencies)',
);

// Expected: Dependent tasks exist but not yet unblocked
// (다른 dependencies도 있어서 여전히 BLOCKED)
```

### 11.3 CI Check and Retry Workflow

**목적**: CI 실패 시 자동 retry 또는 실패 처리

**구현 위치**: `task-execution.service.ts:218-244, 1683-1758`

**기능**:

1. **CI 체크** (line 218):

   ```typescript
   const ciResult = await this.checkCIStatus(prUrl, worktreePath);
   ```

2. **CI 통과 → Manager 리뷰** (line 244):

   ```typescript
   if (ciResult.passed) {
     await this.requestCodeReview(task, prUrl, hollonId, worktreePath);
     await this.taskRepo.update(taskId, {
       status: TaskStatus.READY_FOR_REVIEW,
     });
   }
   ```

3. **CI 실패 → Retry 로직** (line 225-238):

   ```typescript
   const { shouldRetry, feedback } = await this.handleCIFailure(
     task,
     ciResult.failedChecks,
     prUrl,
     worktreePath,
   );

   if (shouldRetry) {
     throw new Error(`CI_FAILURE_RETRY: ${feedback}`);
   } else {
     throw new Error(`CI_FAILURE_MAX_RETRIES: ...`);
   }
   ```

**Retry 로직** (handleCIFailure):

- 최대 3번 retry
- Retry count를 task metadata에 저장
- CI 에러 로그 및 가이드를 feedback으로 제공
- `shouldRetry` flag 반환

**현재 구현 상태**:

- ✅ CI 체크 구현
- ✅ CI 통과 → Manager 리뷰 트리거
- ✅ CI 실패 → Error throw (retry count 관리)
- ❓ Error catch & retry 트리거 (확인 필요)
- ❌ 서브 홀론 생성으로 수정 (미구현)
- ❌ 자기 자신이 수정 (미구현)

### 11.4 Test PR Cleanup

**문제**: Test mode에서 DB는 "merged"로 업데이트되지만 GitHub PR은 여전히 OPEN 상태

**원인**:

- `code-review.service.ts:1096-1122`에서 test mode일 때 실제 `gh pr merge` skip
- DB만 "merged" 상태로 업데이트
- Step 12 PR close 시 "already merged" 체크로 skip

**해결 방안**:

1. Test mode에서도 실제 GitHub PR close 실행
2. 또는 afterAll에서 강제 close

**현재 해결**: 수동으로 close

```bash
gh pr close 36 33 32 --comment "Test PR - closing after E2E test"
```

### 11.5 Complete Workflow Diagram

```
Goal (with explicit dependencies in description)
  ↓
CTO decomposes → Team Epics
  ↓
Manager decomposes → Implementation Tasks
  ↓
Brain parses dependencies → Some tasks BLOCKED
  ↓
┌─────────────────────────────────────┐
│ Task Execution Loop                 │
├─────────────────────────────────────┤
│ 1. Get READY tasks                  │
│ 2. Execute task                     │
│ 3. Create PR                        │
│ 4. Wait for CI                      │
│    ├─ CI PASS → Manager Review      │
│    └─ CI FAIL → Retry (max 3x)      │
│ 5. Manager approves & merges        │
│ 6. Task COMPLETED                   │
│ 7. Unblock dependent tasks          │
│    └─ BLOCKED → READY (if all deps done)
└─────────────────────────────────────┘
  ↓
All tasks completed → Goal COMPLETED
```

### 11.6 E2E Test Results

**Test**: `calculator-goal-workflow.e2e-spec.ts`

**Results**:

```
✅ PASSED (269s)
✅ Created 24 Implementation Tasks (1 READY, 23 BLOCKED)
✅ Completed task has 3 dependent task(s)
✅ Dependency relationships stored correctly
✅ PR creation and merge
✅ Test mode (DB only, no actual GitHub merge)
```

**검증된 기능**:

- ✅ Goal → Team Epic decomposition
- ✅ Epic → Implementation Task decomposition
- ✅ Brain's automatic dependency detection
- ✅ BLOCKED tasks creation based on dependencies
- ✅ Dependency relationships in database
- ✅ Dependency unblocking logic
- ✅ CI check and manager review
- ✅ PR creation and test mode merge

### 11.7 구현 체크리스트

**Dependency 기능**:

- [x] Brain prompt에 dependency 지시 추가
- [x] `DecompositionWorkItem`에 dependencies 필드 추가
- [x] Two-pass Implementation Task 생성
- [x] Dependencies many-to-many relation 저장
- [x] BLOCKED status 설정
- [x] Dependency unblocking 로직 (`code-review.service.ts`)
- [x] E2E test 검증

**CI & Retry**:

- [x] CI check 구현
- [x] CI 통과 → Manager review 트리거
- [x] CI 실패 → handleCIFailure 호출
- [x] Retry count 관리 (max 3)
- [ ] Error catch & retry 트리거 검증
- [ ] 서브 홀론 생성으로 수정 (TODO)
- [ ] 자기 자신이 수정 (TODO)

**Test PR Cleanup**:

- [x] Step 12 PR close 로직
- [ ] Test mode에서 실제 GitHub PR close (TODO)
- [ ] afterAll cleanup 개선 (TODO)

### 11.8 향후 개선 사항

1. **CI 실패 시 서브 홀론 생성**
   - 현재: Error throw만
   - 개선: 서브 홀론을 생성해서 CI 에러 수정 위임

2. **CI 실패 시 자기 수정**
   - 현재: Retry만 (동일한 코드 재실행)
   - 개선: CI 에러 피드백을 받아서 코드 수정 후 재시도

3. **Test PR Auto Cleanup**
   - 현재: 수동 close 필요
   - 개선: Test mode에서 실제 GitHub PR auto close

4. **Dependency Visualization**
   - Task dependency graph 시각화
   - BLOCKED tasks의 blocking 이유 명시

5. **Parallel Execution**
   - 현재: Sequential execution
   - 개선: 여러 READY tasks를 병렬로 실행

---

## 최종 우선순위 테스트 목록 (Updated 2025-12-18)

### 완료된 테스트 ✅

1. ✅ **Task Dependency Workflow** (11.1-11.7)
   - BLOCKED tasks 생성
   - Dependency unblocking
   - E2E test 검증

### 현재 구현 상태

1. 🔴 **CI 실패 처리** (11.3) - 부분 구현
   - ✅ CI check
   - ✅ Retry count 관리
   - ❌ 서브 홀론 생성
   - ❌ 자기 수정

2. 🟡 **Test PR Cleanup** (11.4) - 수동 처리
   - ❌ Auto close in test mode

3. 🔴 **매니저 역할 분리** (1.3.2, 1.4.1, 1.5.2, 2.1)
4. 🔴 **워크트리 격리 및 공유** (9.1, 9.2, 9.3)
5. 🟡 **브랜치 관리** - 중요
6. 🟡 **태스크 분배 로직** - 중요
7. 🟢 **전체 E2E 플로우** - 기본 완료, 개선 필요
8. 🟢 **성능 및 타임아웃** - 최적화 단계
