# Phase 3: 전략-실행 연결 - 상세 계획

> **핵심 목표**: 고수준 목표가 실행 가능한 태스크로 자동 분해되고, 홀론이 자율적으로 프로젝트를 수행할 수 있는 시스템 구축

---

## 관련 문서 참조

- **핵심 개념**: [ssot.md](./ssot.md) - 비전, 원칙, 작동 방식
- **구현 명세**: [blueprint.md](./blueprint.md) - DB 스키마, TypeScript 코드, API 정의
- **다음 단계**: [phase4-dogfood-plan.md](./phase4-dogfood-plan.md) - Phase 4 Dogfooding 계획

---

## ⚠️ Critical Success Factor

**Phase 3 완료 시 달성 목표**: Phase 4를 홀론 팀에게 자율적으로 맡길 수 있는 상태

Phase 3는 "자율성 도구"를 만드는 단계입니다. 이 도구들이 제대로 작동해야 Phase 4부터 홀론이 진정으로 자율적으로 일할 수 있습니다.

### Phase 4 Dogfooding을 위한 필수 요구사항

1. ✅ **GoalDecompositionService**: 고수준 목표 → 35개 Task 자동 생성
2. ✅ **DependencyAnalyzer**: Task 간 의존성 그래프 자동 분석
3. ✅ **ResourcePlanner**: Skill 기반 최적 Hollon 할당
4. ✅ **PriorityRebalancerService**: 실시간 우선순위 자동 조정
5. ✅ **UncertaintyDecisionService**: 불확실한 결정 시 Spike POC 자동 실행
6. ✅ **PivotResponseService**: 전략 변경 시 영향 분석 및 대응

---

## 완료 기준

Phase 3 완료 시 다음이 가능해야 합니다:

- [ ] **목표 입력 → 프로젝트/태스크 자동 생성** (GoalDecomposition)
  - Milestone은 선택적 그룹핑으로 자동 또는 수동 생성 가능
- [ ] **Task 의존성 자동 분석 및 실행 순서 결정** (DependencyAnalyzer)
- [ ] **Hollon 역량 기반 자동 할당** (ResourcePlanner)
- [ ] **실시간 진행도 모니터링 및 우선순위 재조정** (PriorityRebalancer)
- [ ] **불확실성 자동 감지 및 Spike 생성** (UncertaintyDecision)
- [ ] **피벗 선언 시 영향 분석 자동화** (PivotResponse)

**검증 방법**: Phase 4 목표를 입력했을 때 35개 Task가 자동으로 생성되고, 의존성 그래프와 함께 5명의 Hollon에게 자동 할당되어야 함.

---

## ssot.md 커버리지

Phase 3 완료 시 ssot.md 달성률: **약 85%**

| ssot.md 섹션            | Phase 3 커버리지 | 비고                                   |
| ----------------------- | ---------------- | -------------------------------------- |
| 1. 비전 & 핵심 개념     | ✅ 기반 전제     | 변경 없음                              |
| 2. 시스템 아키텍처      | ✅ 100%          | -                                      |
| 3. 핵심 엔티티          | ✅ 85%           | Goal 엔티티 추가                       |
| 4. 시스템 작동 방식     | ✅ 80%           | 4.1~4.3 전체 흐름 완성                 |
| 5. 핵심 원칙            | ✅ 70%           | RAG는 Phase 4                          |
| 6. 자율 운영 정책       | ✅ 90%           | 6.2~6.7 대부분 구현                    |
| **7. LLM 한계 대응**    | **✅ 80%**       | **Phase 3 핵심 범위**                  |
| 8. 협업 및 커뮤니케이션 | ✅ 90%           | Phase 2 완료                           |
| 9. 기술 스택            | ✅ 100%          | -                                      |
| 10. 용어 정리           | ✅ 참조용        | Goal, GoalDecomposition, Pivot 등 추가 |

**Phase 3에서 구현되는 LLM 한계 대응**:

- ✅ GoalDecompositionService (장기 계획 능력 부족 대응)
- ✅ UncertaintyDecisionService (불확실성 처리)
- ⏭️ FactCheckService (Phase 4 - 할루시네이션 대응)
- ⏭️ Vector/Graph RAG (Phase 4 - 지식 관리)

---

## 핵심 원칙 (ssot.md 기반)

### Goal 기반 작업 분해

ssot.md 4.1 전체 실행 흐름에서:

```
업무 시작
  1. 인간이 Goal 설정 ("사용자 인증 기능 구현")
  2. Goal → Project → Task 자동 분해  ⬅️ Phase 3 구현
     - Milestone은 Task의 선택적 그룹핑으로 자동/수동 생성
  3. Task가 Task Pool에 등록
```

### 불확실성 의사결정 (ssot.md 8.5)

**자율 결정 가능 조건** (모두 충족 시):

1. 되돌릴 수 있는가? ✅
2. 비용 한도 내인가? ✅
3. 외부 영향 없는가? ✅

하나라도 No → 🧑 인간 에스컬레이션

**Time-boxed 실험 (Spike)**: 불확실성 해소를 위해 시간/비용 제한 내 실험 수행

### Pivot 대응 (ssot.md 4.5)

```
[전략 변경] → 인간이 Pivot 선언
    │
    ├─ 영향 분석 (자율)              ⬅️ Phase 3 구현
    ├─ 작업 중단 (자율)              ⬅️ Phase 3 구현
    ├─ 자산 분류 (자율): 재활용/보관/폐기
    └─ 새 방향 실행 (인간 승인 후)
```

---

## Week 13-14: 목표 관리 시스템

### Week 13: Goal Entity 및 데이터 모델

#### Day 1-2: Goal Entity 및 마이그레이션

**작업 목록**:

- [ ] `goals` 테이블 마이그레이션 추가
- [ ] `goal_key_results` 테이블 마이그레이션 추가
- [ ] `goal_progress_records` 테이블 마이그레이션 추가

**구현 상세**:

```sql
-- goals 테이블 (OKR 구조)
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

    -- 측정 기준
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
    decomposition_strategy VARCHAR(50),  -- 'task_based', 'milestone_based', 'hybrid'

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_goals_org ON goals(organization_id);
CREATE INDEX idx_goals_team ON goals(team_id);
CREATE INDEX idx_goals_parent ON goals(parent_goal_id);
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_goals_owner ON goals(owner_hollon_id);

-- Key Results (Goals의 하위 항목으로도 사용 가능)
CREATE TABLE goal_key_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,

    title VARCHAR(500) NOT NULL,
    description TEXT,

    metric VARCHAR(100) NOT NULL,
    target_value DECIMAL(15, 4) NOT NULL,
    current_value DECIMAL(15, 4) DEFAULT 0,
    unit VARCHAR(50),

    -- 진행도 자동 계산
    progress_percent DECIMAL(5, 2) DEFAULT 0.0,

    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'failed', 'cancelled')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_key_results_goal ON goal_key_results(goal_id);

-- Goal 진행도 기록 (시계열 추적)
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
```

**검증**:

```bash
pnpm exec typeorm migration:generate src/migrations/CreateGoalTables
pnpm exec typeorm migration:run
```

#### Day 3-4: Goal Service 구현

**작업 목록**:

- [ ] `src/modules/goal/goal.module.ts` 생성
- [ ] `src/modules/goal/entities/goal.entity.ts` 생성
- [ ] `src/modules/goal/entities/goal-key-result.entity.ts` 생성
- [ ] `src/modules/goal/goal.service.ts` 구현
- [ ] `src/modules/goal/goal.controller.ts` 구현

**GoalService 핵심 메서드**:

```typescript
@Injectable()
export class GoalService {
  constructor(
    @InjectRepository(Goal)
    private goalRepo: Repository<Goal>,
    @InjectRepository(GoalKeyResult)
    private keyResultRepo: Repository<GoalKeyResult>,
    @InjectRepository(GoalProgressRecord)
    private progressRepo: Repository<GoalProgressRecord>,
  ) {}

  /**
   * Goal 생성
   */
  async create(dto: CreateGoalDto): Promise<Goal> {
    const goal = this.goalRepo.create({
      ...dto,
      status: 'draft',
      progressPercent: 0,
    });

    return this.goalRepo.save(goal);
  }

  /**
   * Goal 진행도 계산 (하위 Task 기반)
   */
  async calculateProgress(goalId: string): Promise<number> {
    // 관련 Task 조회
    const tasks = await this.taskRepo.find({
      where: { goalId },
    });

    if (tasks.length === 0) return 0;

    const completedTasks = tasks.filter((t) => t.status === TaskStatus.DONE);
    const progressPercent = (completedTasks.length / tasks.length) * 100;

    // Goal 업데이트
    await this.goalRepo.update(goalId, {
      progressPercent,
      currentValue: completedTasks.length,
    });

    // 진행도 기록
    await this.progressRepo.save({
      goalId,
      progressPercent,
      currentValue: completedTasks.length,
      recordedAt: new Date(),
    });

    return progressPercent;
  }

  /**
   * Goal 상태 변경
   */
  async updateStatus(goalId: string, status: GoalStatus): Promise<Goal> {
    await this.goalRepo.update(goalId, {
      status,
      ...(status === 'completed' && { completedAt: new Date() }),
    });

    return this.findOne(goalId);
  }

  /**
   * 하위 Goal 조회 (계층 구조)
   */
  async getChildren(goalId: string): Promise<Goal[]> {
    return this.goalRepo.find({
      where: { parentGoalId: goalId },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  /**
   * Goal 진행도 히스토리
   */
  async getProgressHistory(
    goalId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<GoalProgressRecord[]> {
    const query = this.progressRepo
      .createQueryBuilder('progress')
      .where('progress.goalId = :goalId', { goalId })
      .orderBy('progress.recordedAt', 'DESC');

    if (startDate) {
      query.andWhere('progress.recordedAt >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('progress.recordedAt <= :endDate', { endDate });
    }

    return query.getMany();
  }
}
```

#### Day 5: Goal Controller 및 API

**작업 목록**:

- [ ] REST API 엔드포인트 구현
- [ ] DTO 클래스 작성
- [ ] Swagger 문서화

**API 엔드포인트**:

```typescript
@Controller('api/goals')
export class GoalController {
  // POST /api/goals - Goal 생성
  // GET /api/goals - Organization/Team의 Goal 목록
  // GET /api/goals/:id - Goal 상세
  // PATCH /api/goals/:id - Goal 업데이트
  // DELETE /api/goals/:id - Goal 삭제
  // POST /api/goals/:id/activate - Goal 활성화
  // GET /api/goals/:id/progress - 진행도 히스토리
  // POST /api/goals/:id/key-results - Key Result 추가
}
```

---

### Week 14: Goal 추적 및 리뷰 자동화

#### Day 1-2: GoalTrackingService 구현

**작업 목록**:

- [ ] `src/modules/goal/services/goal-tracking.service.ts` 생성
- [ ] 자동 진행도 업데이트 로직
- [ ] Key Result 자동 계산

**GoalTrackingService**:

```typescript
@Injectable()
export class GoalTrackingService {
  constructor(
    private goalService: GoalService,
    private taskService: TaskService,
    @InjectRepository(Goal)
    private goalRepo: Repository<Goal>,
  ) {}

  /**
   * Goal 진행도 자동 업데이트 (Cron)
   * 매시간 실행
   */
  @Cron('0 * * * *') // 매시간
  async updateAllGoalProgress(): Promise<void> {
    const activeGoals = await this.goalRepo.find({
      where: { status: In(['active', 'paused']) },
    });

    for (const goal of activeGoals) {
      try {
        await this.goalService.calculateProgress(goal.id);
      } catch (error) {
        this.logger.error(`Failed to update goal ${goal.id}`, error);
      }
    }
  }

  /**
   * 특정 Task 완료 시 관련 Goal 업데이트
   */
  async onTaskCompleted(taskId: string): Promise<void> {
    const task = await this.taskService.findOne(taskId);

    // Task와 연결된 Goal이 있는지 확인
    // Project → Goal 매핑을 통해 찾음
    const goals = await this.findGoalsByTask(task);

    for (const goal of goals) {
      await this.goalService.calculateProgress(goal.id);

      // 100% 달성 시 자동 완료
      if (goal.progressPercent >= 100) {
        await this.goalService.updateStatus(goal.id, 'completed');
      }
    }
  }

  /**
   * 목표 달성 위험도 분석
   */
  async analyzeGoalRisk(goalId: string): Promise<GoalRiskAnalysis> {
    const goal = await this.goalService.findOne(goalId);

    if (!goal.targetDate) {
      return { riskLevel: 'unknown', reason: 'No target date set' };
    }

    const now = new Date();
    const targetDate = new Date(goal.targetDate);
    const totalDays = differenceInDays(targetDate, goal.startDate);
    const elapsedDays = differenceInDays(now, goal.startDate);
    const remainingDays = differenceInDays(targetDate, now);

    const expectedProgress = (elapsedDays / totalDays) * 100;
    const actualProgress = goal.progressPercent;
    const progressGap = actualProgress - expectedProgress;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';

    if (remainingDays < 0) {
      riskLevel = 'critical'; // 기한 초과
    } else if (progressGap < -30) {
      riskLevel = 'critical'; // 30% 이상 뒤처짐
    } else if (progressGap < -15) {
      riskLevel = 'high';
    } else if (progressGap < -5) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return {
      riskLevel,
      progressGap,
      remainingDays,
      expectedProgress,
      actualProgress,
      recommendation: this.getRecommendation(riskLevel, progressGap),
    };
  }

  private getRecommendation(riskLevel: string, progressGap: number): string {
    if (riskLevel === 'critical') {
      return 'Immediate action required. Consider extending deadline or reducing scope.';
    } else if (riskLevel === 'high') {
      return 'Increase priority and allocate more resources.';
    } else if (riskLevel === 'medium') {
      return 'Monitor closely and address blockers.';
    } else {
      return 'On track. Continue current pace.';
    }
  }
}
```

#### Day 3-4: GoalReviewService 구현

**작업 목록**:

- [ ] `src/modules/goal/services/goal-review.service.ts` 생성
- [ ] 주간 Goal 리뷰 자동화
- [ ] Document 자동 생성

**GoalReviewService**:

```typescript
@Injectable()
export class GoalReviewService {
  constructor(
    private goalService: GoalService,
    private goalTrackingService: GoalTrackingService,
    private documentService: DocumentService,
  ) {}

  /**
   * 주간 Goal 리뷰 (매주 금요일 17:00)
   */
  @Cron('0 17 * * 5') // 금요일 17:00
  async weeklyGoalReview(): Promise<void> {
    const organizations = await this.orgRepo.find();

    for (const org of organizations) {
      try {
        await this.runGoalReview(org.id);
      } catch (error) {
        this.logger.error(`Goal review failed for org ${org.id}`, error);
      }
    }
  }

  /**
   * Organization의 Goal 리뷰 실행
   */
  private async runGoalReview(organizationId: string): Promise<void> {
    const activeGoals = await this.goalRepo.find({
      where: {
        organizationId,
        status: In(['active', 'paused']),
      },
      relations: ['keyResults', 'owner'],
    });

    // 리스크 분석
    const goalsWithRisk = await Promise.all(
      activeGoals.map(async (goal) => ({
        goal,
        risk: await this.goalTrackingService.analyzeGoalRisk(goal.id),
      })),
    );

    // 리스크 레벨별 분류
    const criticalGoals = goalsWithRisk.filter(
      (g) => g.risk.riskLevel === 'critical',
    );
    const highRiskGoals = goalsWithRisk.filter(
      (g) => g.risk.riskLevel === 'high',
    );
    const onTrackGoals = goalsWithRisk.filter(
      (g) => g.risk.riskLevel === 'low',
    );

    // 리뷰 문서 생성
    const reviewDocument = this.generateReviewDocument({
      organizationId,
      totalGoals: activeGoals.length,
      criticalGoals,
      highRiskGoals,
      onTrackGoals,
      reviewDate: new Date(),
    });

    // Document 저장
    await this.documentService.create({
      organizationId,
      name: `Goal Review - ${format(new Date(), 'yyyy-MM-dd')}`,
      docType: 'meeting',
      scope: 'organization',
      scopeId: organizationId,
      content: reviewDocument,
      autoGenerated: true,
      keywords: ['goal', 'review', 'weekly', 'okr'],
      importance: 7,
    });

    // Critical Goal은 인간에게 알림
    if (criticalGoals.length > 0) {
      await this.notifyHumans(organizationId, criticalGoals);
    }
  }

  /**
   * 리뷰 문서 생성
   */
  private generateReviewDocument(data: GoalReviewData): string {
    const {
      totalGoals,
      criticalGoals,
      highRiskGoals,
      onTrackGoals,
      reviewDate,
    } = data;

    return `# Weekly Goal Review - ${format(reviewDate, 'yyyy-MM-dd')}

## Executive Summary

- **Total Active Goals**: ${totalGoals}
- **Critical Risk**: ${criticalGoals.length} goals ⚠️
- **High Risk**: ${highRiskGoals.length} goals
- **On Track**: ${onTrackGoals.length} goals ✅

## Critical Goals (Immediate Action Required)

${criticalGoals
  .map(
    ({ goal, risk }) => `
### ${goal.title}

- **Progress**: ${goal.progressPercent.toFixed(1)}% (Expected: ${risk.expectedProgress.toFixed(1)}%)
- **Gap**: ${risk.progressGap.toFixed(1)}%
- **Remaining Days**: ${risk.remainingDays}
- **Owner**: ${goal.owner?.name || 'Unassigned'}
- **Recommendation**: ${risk.recommendation}
`,
  )
  .join('\n')}

## High Risk Goals

${highRiskGoals
  .map(
    ({ goal, risk }) => `
- **${goal.title}**: ${goal.progressPercent.toFixed(1)}% (Gap: ${risk.progressGap.toFixed(1)}%)
`,
  )
  .join('\n')}

## On Track Goals

${onTrackGoals
  .slice(0, 5)
  .map(
    ({ goal }) => `
- **${goal.title}**: ${goal.progressPercent.toFixed(1)}%
`,
  )
  .join('\n')}

${onTrackGoals.length > 5 ? `\n... and ${onTrackGoals.length - 5} more goals on track\n` : ''}

## Recommended Actions

${this.generateRecommendations(criticalGoals, highRiskGoals)}

---

*🤖 Generated automatically by GoalReviewService*
`;
  }

  private generateRecommendations(
    criticalGoals: GoalWithRisk[],
    highRiskGoals: GoalWithRisk[],
  ): string {
    const recommendations: string[] = [];

    if (criticalGoals.length > 0) {
      recommendations.push(
        '1. **Address Critical Goals**: Schedule immediate review meetings for critical goals',
      );
    }

    if (highRiskGoals.length > 0) {
      recommendations.push(
        '2. **Rebalance Priorities**: Increase priority for high-risk goals',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'All goals are on track. Continue current execution.',
      );
    }

    return recommendations.join('\n');
  }

  /**
   * 인간에게 알림 (Critical Goals)
   */
  private async notifyHumans(
    organizationId: string,
    criticalGoals: GoalWithRisk[],
  ): Promise<void> {
    // ApprovalRequest 또는 Message를 통해 알림
    // 구현은 Phase 1-2의 기존 패턴 사용
  }
}
```

#### Day 5: 테스트 작성

**작업 목록**:

- [ ] `goal.service.spec.ts` - 단위 테스트
- [ ] `goal-tracking.service.spec.ts` - 단위 테스트
- [ ] `goal-review.service.spec.ts` - 단위 테스트
- [ ] `goal.e2e-spec.ts` - E2E 테스트

**테스트 커버리지 목표**: 90% 이상

---

## Week 15-16: 목표 → 태스크 분해 ⭐

> **주의**: 이 주차는 Phase 3에서 가장 중요합니다. Phase 4 Dogfooding의 핵심 기능입니다.

### Week 15: GoalDecompositionService 핵심 구현

#### Day 1-2: GoalDecompositionService 기본 구조

**작업 목록**:

- [ ] `src/modules/goal/services/goal-decomposition.service.ts` 생성
- [ ] Brain Provider 연동
- [ ] 프롬프트 템플릿 설계

**GoalDecompositionService**:

```typescript
@Injectable()
export class GoalDecompositionService {
  constructor(
    private goalService: GoalService,
    private brainProviderFactory: BrainProviderFactory,
    private taskService: TaskService,
    private projectService: ProjectService,
    @InjectRepository(Goal)
    private goalRepo: Repository<Goal>,
  ) {}

  /**
   * Goal을 Task로 자동 분해
   * Phase 4 Dogfooding의 핵심 기능
   *
   * Input: "Phase 4 목표: 학습 및 성장 시스템 구축"
   * Output: 35개 Task + 의존성 그래프
   */
  async decomposeGoal(
    goalId: string,
    options?: DecompositionOptions,
  ): Promise<DecompositionResult> {
    const goal = await this.goalService.findOne(goalId);

    // 1. Brain Provider 선택
    const brainProvider = await this.brainProviderFactory.getProvider(
      goal.organizationId,
      { preferredModel: 'claude-3.5-sonnet' },
    );

    // 2. 컨텍스트 수집 (기존 패턴 포함)
    const context = await this.gatherContext(goal);
    // context.existingPatterns: 기존 서비스 패턴 (HollonService, RoleService 등)

    // 3. LLM 프롬프트 생성 및 실행
    const prompt = this.buildDecompositionPrompt(goal, context);
    const llmResponse = await brainProvider.generateText({
      prompt,
      temperature: 0.3, // 일관성 중시
      maxTokens: 8000,
    });

    // 4. LLM 응답 파싱
    const decomposition = this.parseDecompositionResponse(llmResponse);

    // 5. Project/Task 생성 (Milestone은 선택적)
    const result = await this.createWorkItems(goal, decomposition);

    // 6. Goal 업데이트
    await this.goalRepo.update(goalId, {
      autoDecomposed: true,
      decompositionStrategy: decomposition.strategy,
    });

    return result;
  }
}
```

#### Day 3-5: 프롬프트 엔지니어링 및 최적화

**작업 목록**:

- [ ] 프롬프트 템플릿 A/B 테스트
- [ ] Few-shot Examples 추가
- [ ] 에러 핸들링 및 재시도 로직

---

### Week 16: DependencyAnalyzer 및 ResourcePlanner

#### Day 1-2: DependencyAnalyzer 구현

**작업 목록**:

- [ ] `src/modules/task/services/dependency-analyzer.service.ts` 생성
- [ ] 그래프 알고리즘 구현 (Topological Sort)
- [ ] 병렬 실행 가능 Task 그룹화

#### Day 3-5: ResourcePlanner 구현

**작업 목록**:

- [ ] `src/modules/task/services/resource-planner.service.ts` 생성
- [ ] Skill 기반 Hollon 매칭 알고리즘
- [ ] 워크로드 밸런싱

---

## Week 17-18: 동적 우선순위 및 전략 변경 대응

### Week 17: PriorityRebalancerService 구현

#### Day 1-3: 실시간 우선순위 재조정

**작업 목록**:

- [ ] `src/modules/task/services/priority-rebalancer.service.ts` 생성
- [ ] 진행도 기반 우선순위 자동 조정
- [ ] 병목 감지 및 대응

#### Day 4-5: UncertaintyDecisionService 구현

**작업 목록**:

- [ ] `src/modules/decision/services/uncertainty-decision.service.ts` 생성
- [ ] 불확실성 감지 로직
- [ ] Spike Task 자동 생성

---

### Week 18: PivotResponseService 구현

#### Day 1-3: 전략 변경 대응 시스템

**작업 목록**:

- [ ] `src/modules/pivot/pivot.module.ts` 생성
- [ ] `src/modules/pivot/entities/pivot.entity.ts` 생성
- [ ] `src/modules/pivot/services/pivot-response.service.ts` 구현

#### Day 4-5: Pivot API 및 테스트

**작업 목록**:

- [ ] `src/modules/pivot/pivot.controller.ts` 구현
- [ ] Pivot REST API
- [ ] E2E 테스트

---

## Week 19: 통합 테스트 및 Phase 4 준비

### Week 19 Day 1-3: End-to-End 시나리오 테스트

**작업 목록**:

- [ ] `phase3-e2e.spec.ts` 작성
- [ ] Goal → Task 분해 전체 흐름 테스트
- [ ] Pivot 전체 흐름 테스트

**E2E 테스트 시나리오**:

```typescript
describe('Phase 3 E2E: Goal Decomposition to Execution', () => {
  it('should decompose Phase 4 goal into 35 tasks and assign to 5 hollons', async () => {
    // 1. Goal 생성
    const goal = await goalService.create({
      organizationId: testOrg.id,
      teamId: testTeam.id,
      title: 'Phase 4: Learning & Growth System',
      description:
        'Implement hollon onboarding, knowledge management, and performance analysis',
      goalType: 'objective',
      targetDate: addWeeks(new Date(), 8),
      priority: 'high',
    });

    // 2. Goal 분해
    const decomposition = await goalDecompositionService.decomposeGoal(goal.id);

    expect(decomposition.tasksCreated).toBeGreaterThanOrEqual(30);
    expect(decomposition.tasksCreated).toBeLessThanOrEqual(50);
    expect(decomposition.projectsCreated).toBeGreaterThanOrEqual(1);

    // 3. 의존성 분석
    const analysis = await dependencyAnalyzer.analyzeProject(
      decomposition.projects[0].id,
    );

    expect(analysis.executionOrder.length).toBe(decomposition.tasksCreated);
    expect(analysis.criticalPath.tasks.length).toBeGreaterThan(0);

    // 4. Hollon 할당
    const assignment = await resourcePlanner.assignProject(
      decomposition.projects[0].id,
    );

    expect(assignment.assignedTasks).toBeGreaterThan(20);
    expect(assignment.unassignedTasks).toBeLessThan(5);

    // 5. 우선순위 재조정
    const rebalance = await priorityRebalancerService.rebalanceProject(
      decomposition.projects[0].id,
    );

    expect(rebalance.totalAdjustments).toBeGreaterThan(0);

    // 6. Goal 진행도 추적
    await goalTrackingService.updateAllGoalProgress();

    const updatedGoal = await goalService.findOne(goal.id);
    expect(updatedGoal.progressPercent).toBe(0); // 아직 Task 완료 안됨
  });

  it('should handle strategic pivot with asset classification', async () => {
    // 1. 프로젝트 및 Task 생성
    const project = await projectService.create({
      organizationId: testOrg.id,
      teamId: testTeam.id,
      name: 'Old Direction Project',
      description: 'Original strategic direction',
      status: 'in_progress',
    });

    const tasks = await Promise.all([
      taskService.create({
        projectId: project.id,
        title: 'Completed Task',
        status: TaskStatus.DONE,
      }),
      taskService.create({
        projectId: project.id,
        title: 'In Progress Task',
        status: TaskStatus.IN_PROGRESS,
      }),
      taskService.create({
        projectId: project.id,
        title: 'Ready Task',
        status: TaskStatus.READY,
      }),
    ]);

    // 2. Pivot 선언
    const pivot = await pivotResponseService.declarePivot({
      organizationId: testOrg.id,
      projectId: project.id,
      title: 'Strategic Pivot',
      description: 'Old direction description',
      newDirection: 'New strategic direction',
      reason: 'Market feedback indicates different approach needed',
      proposedBy: 'user-123',
    });

    expect(pivot.impactAnalysis.affectedTasks).toBe(3);
    expect(pivot.assetClassification).toBeDefined();

    // 3. Pivot 승인 및 실행
    await pivotResponseService.executePivot(pivot.id, 'user-123');

    // 4. 자산 상태 검증
    const updatedTasks = await taskService.findByProject(project.id);

    const completedTask = updatedTasks.find(
      (t) => t.title === 'Completed Task',
    );
    expect(completedTask.status).toBe(TaskStatus.DONE); // Reused

    const inProgressTask = updatedTasks.find(
      (t) => t.title === 'In Progress Task',
    );
    expect(inProgressTask.status).toBe(TaskStatus.CANCELLED); // Stopped
  });
});
```

### Week 19 Day 4-5: Phase 4 Readiness 검증

**작업 목록**:

- [ ] Phase 4 Dogfooding 준비 상태 검증
- [ ] 6가지 필수 서비스 동작 확인
- [ ] 문서화 완료

**검증 체크리스트**:

```typescript
describe('Phase 4 Dogfooding Readiness', () => {
  it('✅ GoalDecompositionService: should auto-generate 35 tasks from high-level goal', async () => {
    const goal = await createPhase4Goal();
    const result = await goalDecompositionService.decomposeGoal(goal.id);

    expect(result.tasksCreated).toBeGreaterThanOrEqual(30);
  });

  it('✅ DependencyAnalyzer: should create accurate dependency graph', async () => {
    const project = await createTestProject();
    const analysis = await dependencyAnalyzer.analyzeProject(project.id);

    expect(analysis.executionOrder).toBeDefined();
    expect(analysis.criticalPath).toBeDefined();
  });

  it('✅ ResourcePlanner: should match tasks to hollon skills', async () => {
    const project = await createTestProject();
    const assignment = await resourcePlanner.assignProject(project.id);

    expect(assignment.assignedTasks).toBeGreaterThan(0);
  });

  it('✅ PriorityRebalancerService: should adjust priorities in real-time', async () => {
    const project = await createTestProject();
    const result = await priorityRebalancerService.rebalanceProject(project.id);

    expect(result.totalAdjustments).toBeGreaterThan(0);
  });

  it('✅ UncertaintyDecisionService: should handle technical decisions via Spike tasks', async () => {
    const task = await createTestTask();
    const result = await uncertaintyDecisionService.detectUncertainty(task.id, {
      unknownTechnology: 'WebRTC',
    });

    expect(result.hasUncertainty).toBe(true);
    expect(result.decision).toBe('create_spike');
  });

  it('✅ PivotResponseService: should analyze strategy change impacts', async () => {
    const pivot = await pivotResponseService.declarePivot({
      organizationId: testOrg.id,
      title: 'Test Pivot',
      description: 'Old',
      newDirection: 'New',
      reason: 'Test',
      proposedBy: 'user-123',
    });

    expect(pivot.impactAnalysis).toBeDefined();
    expect(pivot.assetClassification).toBeDefined();
  });
});
```

---

## 마무리

### 완료 기준 재확인

Phase 3 완료 시:

- [x] **목표 입력 → 프로젝트/태스크 자동 생성** (GoalDecompositionService)
  - Milestone은 선택적 그룹핑
- [x] **Task 의존성 자동 분석 및 실행 순서 결정** (DependencyAnalyzer)
- [x] **Hollon 역량 기반 자동 할당** (ResourcePlanner)
- [x] **실시간 진행도 모니터링 및 우선순위 재조정** (PriorityRebalancerService)
- [x] **불확실성 자동 감지 및 Spike 생성** (UncertaintyDecisionService)
- [x] **피벗 선언 시 영향 분석 자동화** (PivotResponseService)

### Phase 4 Dogfooding 준비 완료

Phase 3가 완료되면:

1. ✅ "Phase 4: Learning & Growth" 목표 입력
2. ✅ GoalDecompositionService가 35개 Task 자동 생성
3. ✅ DependencyAnalyzer가 의존성 그래프 생성
4. ✅ ResourcePlanner가 5명의 Hollon에게 자동 할당
5. ✅ 홀론 팀이 75-80% 자율성으로 Phase 4 개발 시작
6. ✅ 인간은 주 5-8시간만 Spot Check 및 최종 승인

**다음 단계**: [phase4-dogfood-plan.md](./phase4-dogfood-plan.md)로 이동하여 Dogfooding 2 실행

---

_🤖 This is the complete Phase 3 implementation plan ensuring Phase 4 Dogfooding readiness._
