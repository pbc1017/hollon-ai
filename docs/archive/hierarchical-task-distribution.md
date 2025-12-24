# 🏗️ 계층적 Task 분배 아키텍처 (Hierarchical Task Distribution)

> **작성일**: 2025-12-10
> **목표**: Goal → Team → Hollon → Sub-Hollon 재귀적 Task 분배 시스템

---

## 🎯 핵심 아이디어

### 현재 문제점 (Flat Structure)

```
Goal 생성
↓
GoalDecompositionService: 30개 Task 생성
↓
ResourcePlannerService: 각 Task를 개별 Hollon에게 직접 할당
└─ DevBot-1: Task 1, 5, 9, 13, 17
└─ DevBot-2: Task 2, 6, 10, 14, 18
└─ ReviewBot: Task 3, 7, 11, 15, 19
└─ ...

문제:
❌ Team 단위 협업 없음 (각자 고립된 Task)
❌ Manager 역할이 에스컬레이션만 처리
❌ Task 재분배 시 전체 재계산 필요
❌ 팀 간 의존성 관리 어려움
❌ 계층적 책임 구조 없음
```

### 제안: 계층적 Task 분배 (Hierarchical Distribution)

```
Goal 생성
↓
GoalDecompositionService: 5개 Team-level Task 생성
└─ Team Task 1: "Knowledge System" → Knowledge Team
    ├─ Subtask 1.1: "KnowledgeExtraction" → DevBot-AI
    │   └─ Sub-subtask 1.1.1: "Planning" → Planner Sub-Hollon (Temporary)
    │   └─ Sub-subtask 1.1.2: "Analysis" → Analyzer Sub-Hollon (Temporary)
    │   └─ Sub-subtask 1.1.3: "Implementation" → Coder Sub-Hollon (Temporary)
    ├─ Subtask 1.2: "VectorSearch" → DevBot-AI
    └─ Subtask 1.3: "KnowledgeGraph" → DevBot-Data
└─ Team Task 2: "Self-Improvement" → Performance Team
    ├─ Subtask 2.1: "PerformanceAnalyzer" → DevBot-Backend
    └─ Subtask 2.2: "PromptOptimizer" → DevBot-Senior

장점:
✅ Team 단위 협업 자연스러움
✅ Manager가 Team Task 분배 + 모니터링
✅ 재분배 시 Team 내부만 조정
✅ 팀 간 의존성 명확
✅ 계층적 책임 구조 명확
✅ 재귀적 확장 가능 (무한 depth 가능)
```

---

## 🏢 계층적 구조 정의

### Level 0: Goal (조직 목표)

```typescript
interface Goal {
  id: string;
  title: 'Phase 4: Knowledge System & Self-Improvement';
  organizationId: string;
  // ...
}
```

### Level 1: Team Task (팀 단위 Task)

```typescript
interface TeamTask extends Task {
  // 팀 전체에게 할당
  assignedTeamId: string; // NEW!
  assignedHollonId: null; // 개별 Hollon 없음

  // Manager가 자동 생성한 subtask들
  subtasks: Task[]; // Level 2 tasks

  // Team Task 메타데이터
  type: TaskType.TEAM_EPIC; // NEW enum value
  depth: 0; // Root task
}
```

**예시:**

- Team Task 1: "Knowledge System Implementation" → Knowledge Team
- Team Task 2: "Self-Improvement Features" → Performance Team
- Team Task 3: "Testing & Documentation" → QA Team

### Level 2: Hollon Task (개별 Hollon Task)

```typescript
interface HollonTask extends Task {
  // 개별 Hollon에게 할당
  assignedHollonId: string;
  assignedTeamId: null;

  // Parent Team Task
  parentTaskId: string;             // Level 1 task

  // 복잡한 경우 Sub-Hollon 생성 가능
  subtasks: Task[];                 // Level 3 tasks (optional)

  type: TaskType.IMPLEMENTATION | TaskType.RESEARCH | ...;
  depth: 1;
}
```

**예시:**

- Subtask 1.1: "KnowledgeExtractionService" → DevBot-AI
- Subtask 1.2: "VectorSearchService" → DevBot-AI
- Subtask 1.3: "KnowledgeGraphService" → DevBot-Data

### Level 3: Sub-Hollon Task (Temporary Hollon Task)

```typescript
interface SubHollonTask extends Task {
  // Temporary Sub-Hollon에게 할당
  assignedHollonId: string; // Temporary hollon

  // Parent Hollon Task
  parentTaskId: string; // Level 2 task

  type: TaskType.PLANNING | TaskType.ANALYSIS | TaskType.IMPLEMENTATION;
  depth: 2; // Sub-task
}
```

**예시:**

- Sub-subtask 1.1.1: "[Planning] KnowledgeExtraction" → Planner Sub-Hollon
- Sub-subtask 1.1.2: "[Analysis] KnowledgeExtraction" → Analyzer Sub-Hollon
- Sub-subtask 1.1.3: "[Implementation] KnowledgeExtraction" → Coder Sub-Hollon

---

## 👔 Manager 역할 재정의

### 현재 Manager 역할 (Phase 3.5)

```typescript
// Manager의 역할: 에스컬레이션만 처리
class EscalationService {
  async handleEscalation(task: Task, reason: string) {
    // 1. Manager 찾기
    const manager = await this.findManager(task.assignedHollon);

    // 2. Manager에게 알림
    await this.notifyManager(manager, task, reason);

    // 3. 인간 승인 대기
    await this.waitForHumanApproval();
  }
}
```

### 새로운 Manager 역할 (계층적 분배)

```typescript
class ManagerService {
  /**
   * 1. Team Task 분배 (Primary Responsibility)
   */
  async distributeTeamTask(teamTask: Task): Promise<Task[]> {
    // Team Task를 팀원들에게 분배
    const team = await this.getTeam(teamTask.assignedTeamId);
    const manager = team.manager;

    // Manager의 Brain Provider 호출
    const prompt = `
      Team Task: ${teamTask.title}
      Description: ${teamTask.description}

      Team Members:
      ${team.members.map((h) => `- ${h.name} (${h.role.capabilities})`)}

      Please break this down into subtasks and assign to team members.
      Consider:
      1. Each member's skills and current workload
      2. Dependencies between subtasks
      3. Parallel execution opportunities
    `;

    const response = await this.brainProvider.execute(manager, prompt);

    // Subtask 생성 및 할당
    const subtasks = await this.createSubtasks(teamTask, response);

    return subtasks;
  }

  /**
   * 2. 팀 진행 상황 모니터링
   */
  async monitorTeamProgress(teamTask: Task): Promise<void> {
    const subtasks = await this.getSubtasks(teamTask.id);

    const stats = {
      total: subtasks.length,
      completed: subtasks.filter((t) => t.status === TaskStatus.COMPLETED)
        .length,
      blocked: subtasks.filter((t) => t.status === TaskStatus.BLOCKED).length,
      inProgress: subtasks.filter((t) => t.status === TaskStatus.IN_PROGRESS)
        .length,
    };

    // 이상 징후 감지
    if (stats.blocked > 2) {
      await this.handleBlockedTasks(teamTask, subtasks);
    }

    // 진행률 업데이트
    const progress = (stats.completed / stats.total) * 100;
    await this.updateTeamTaskProgress(teamTask.id, progress);
  }

  /**
   * 3. 에스컬레이션 처리 (기존 역할)
   */
  async handleEscalation(
    task: Task,
    reason: string,
    hollonId: string,
  ): Promise<void> {
    const hollon = await this.getHollon(hollonId);
    const manager = await this.findManager(hollon);

    // Manager에게 문제 상황 전달
    const prompt = `
      Hollon ${hollon.name} escalated task ${task.id}:

      Task: ${task.title}
      Reason: ${reason}

      Options:
      1. Reassign to another team member
      2. Break down into smaller subtasks
      3. Escalate to human

      What should we do?
    `;

    const decision = await this.brainProvider.execute(manager, prompt);

    // 결정 실행
    await this.executeDecision(task, decision);
  }

  /**
   * 4. Task 재분배 (NEW!)
   */
  async redistributeTasks(teamTask: Task, reason: string): Promise<void> {
    const team = await this.getTeam(teamTask.assignedTeamId);
    const manager = team.manager;

    const subtasks = await this.getSubtasks(teamTask.id);
    const workloads = await this.calculateWorkloads(team.members);

    const prompt = `
      Team Task progress issue: ${reason}

      Current assignments:
      ${subtasks.map((t) => `- ${t.title} → ${t.assignedHollon.name} (${t.status})`)}

      Workloads:
      ${workloads.map((w) => `- ${w.hollon.name}: ${w.taskCount} tasks`)}

      Please suggest task reassignments to balance workload and resolve blockers.
    `;

    const plan = await this.brainProvider.execute(manager, prompt);

    // 재할당 실행
    await this.executeReassignments(plan);
  }
}
```

---

## 🔄 재귀적 Task 분배 플로우

### Overall Flow

```
Goal 생성 (인간)
↓
[Level 1] GoalDecompositionService
  → Team Task 생성 (5개)
  → 각 Team에게 할당
↓
[Level 2] ManagerService (각 팀의 Manager)
  → Team Task를 Hollon Task로 분해 (3-7개/팀)
  → 팀원들에게 할당
↓
[Level 3] HollonOrchestratorService (각 Hollon)
  → 복잡도 체크
  ├─ 단순 Task → 직접 실행
  └─ 복잡 Task → Sub-Hollon Task 생성 (3개)
      → Temporary Sub-Hollon에게 할당
↓
[Level 4+] 재귀 가능 (필요 시)
  → Sub-Hollon도 복잡도 체크
  → 더 세분화 가능 (depth 제한 필요)
```

### Detailed Flow with Examples

#### Level 1: Goal → Team Tasks

```typescript
// GoalDecompositionService.decomposeGoal()
async decomposeGoal(goalId: string): Promise<DecompositionResult> {
  const goal = await this.goalRepo.findOne({ where: { id: goalId } });

  // Brain Provider 호출: Team-level 분해
  const prompt = `
    Goal: ${goal.title}

    Organization structure:
    - Knowledge Team (AI/Data specialists)
    - Performance Team (Backend engineers)
    - QA Team (Testing specialists)

    Break this goal into 3-5 team-level tasks.
    Each task should be assignable to one team.
  `;

  const response = await this.brainProvider.execute(prompt);

  // Team Task 생성
  const teamTasks = await this.createTeamTasks(goal, response);

  return {
    teamTasks,
    projectId: newProject.id,
  };
}

// 결과 예시:
teamTasks = [
  {
    id: "task-1",
    title: "Knowledge System Implementation",
    assignedTeamId: "knowledge-team",
    assignedHollonId: null,  // Team 전체
    type: TaskType.TEAM_EPIC,
    depth: 0,
  },
  {
    id: "task-2",
    title: "Self-Improvement Features",
    assignedTeamId: "performance-team",
    assignedHollonId: null,
    type: TaskType.TEAM_EPIC,
    depth: 0,
  },
  // ...
];
```

#### Level 2: Team Task → Hollon Tasks

```typescript
// ManagerService.distributeTeamTask()
async distributeTeamTask(teamTaskId: string): Promise<Task[]> {
  const teamTask = await this.taskRepo.findOne({
    where: { id: teamTaskId },
    relations: ['assignedTeam', 'assignedTeam.manager', 'assignedTeam.members'],
  });

  const team = teamTask.assignedTeam;
  const manager = team.manager;

  // Manager의 Brain Provider 호출
  const prompt = `
    Team Task: ${teamTask.title}
    Description: ${teamTask.description}

    Your team:
    ${team.members.map(m => `
      - ${m.name}
        Role: ${m.role.name}
        Skills: ${m.role.capabilities.join(', ')}
        Current workload: ${m.currentTaskCount} tasks
    `).join('\n')}

    Break this into subtasks (3-7 tasks) and assign to team members.
    Format:
    - Task title
    - Assigned to: [member name]
    - Description
    - Dependencies (if any)
  `;

  const response = await this.brainProvider.execute(manager, prompt);

  // Subtask 생성
  const subtasks = await this.createSubtasksFromResponse(
    teamTask,
    response,
    team,
  );

  return subtasks;
}

// 결과 예시:
subtasks = [
  {
    id: "subtask-1-1",
    title: "KnowledgeExtractionService",
    parentTaskId: "task-1",
    assignedHollonId: "devbot-ai",
    assignedTeamId: null,
    type: TaskType.IMPLEMENTATION,
    depth: 1,
  },
  {
    id: "subtask-1-2",
    title: "VectorSearchService",
    parentTaskId: "task-1",
    assignedHollonId: "devbot-ai",
    type: TaskType.IMPLEMENTATION,
    depth: 1,
  },
  // ...
];
```

#### Level 3: Hollon Task → Sub-Hollon Tasks

```typescript
// HollonOrchestratorService.handleComplexTask() (이미 구현됨!)
async handleComplexTask(task: Task, hollon: Hollon): Promise<boolean> {
  // 복잡도 체크
  const isComplex = await this.isTaskComplex(task, hollon);
  if (!isComplex) return false;

  // Sub-Hollon 생성
  const plannerHollon = await this.hollonService.createTemporary({
    name: `Planner-${task.id.substring(0, 8)}`,
    organizationId: hollon.organizationId,
    teamId: hollon.teamId,
    roleId: await this.findOrCreateRole('Planner'),
    createdBy: hollon.id,
  });

  // Sub-subtask 생성
  const subSubtasks = await this.subtaskService.createSubtasks(task.id, [
    {
      title: `[Planning] ${task.title}`,
      assignedHollonId: plannerHollon.id,
      type: TaskType.PLANNING,
      depth: 2,  // Sub-task
    },
    // ...
  ]);

  return true;
}
```

---

## 📊 Entity 변경사항

### Task Entity 확장

```typescript
// apps/server/src/modules/task/entities/task.entity.ts

export enum TaskType {
  TEAM_EPIC = 'team_epic', // NEW! Level 1
  PLANNING = 'planning',
  ANALYSIS = 'analysis',
  IMPLEMENTATION = 'implementation',
  REVIEW = 'review',
  // ...
}

@Entity('tasks')
export class Task extends BaseEntity {
  // 기존 필드들...

  // Team 할당 (Level 1 tasks)
  @Column({ name: 'assigned_team_id', type: 'uuid', nullable: true })
  assignedTeamId: string | null;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_team_id' })
  assignedTeam: Team;

  // Hollon 할당 (Level 2+ tasks)
  @Column({ name: 'assigned_hollon_id', type: 'uuid', nullable: true })
  assignedHollonId: string | null;

  // 계층 구조
  @Column({ default: 0 })
  depth: number; // 0=Team Task, 1=Hollon Task, 2=Sub-Hollon Task, ...

  @Column({
    type: 'enum',
    enum: TaskType,
    default: TaskType.IMPLEMENTATION,
  })
  type: TaskType;

  // ⚠️ 중요: assignedTeamId와 assignedHollonId는 배타적
  // - Team Task: assignedTeamId O, assignedHollonId X
  // - Hollon Task: assignedTeamId X, assignedHollonId O
}
```

### Team Entity 확장

```typescript
// apps/server/src/modules/organization/entities/team.entity.ts

@Entity('teams')
export class Team extends BaseEntity {
  // 기존 필드들...

  // Manager Hollon (필수)
  @Column({ name: 'manager_hollon_id', type: 'uuid', nullable: true })
  managerHollonId: string | null;

  @ManyToOne(() => Hollon, { nullable: true })
  @JoinColumn({ name: 'manager_hollon_id' })
  manager: Hollon;

  // Team 멤버들
  @OneToMany(() => Hollon, (hollon) => hollon.team)
  members: Hollon[];

  // Team에 할당된 Task들
  @OneToMany(() => Task, (task) => task.assignedTeam)
  assignedTasks: Task[];
}
```

---

## 🔧 서비스 계층 설계

### 1. TeamTaskDistributionService (NEW!)

```typescript
@Injectable()
export class TeamTaskDistributionService {
  /**
   * Team Task를 팀원들에게 분배
   */
  async distributeToTeam(teamTaskId: string): Promise<Task[]> {
    const teamTask = await this.getTeamTask(teamTaskId);
    const team = teamTask.assignedTeam;
    const manager = team.manager;

    // Manager가 분배 계획 수립
    const plan = await this.createDistributionPlan(teamTask, team, manager);

    // Subtask 생성
    const subtasks = await this.createSubtasks(teamTask, plan);

    // 각 팀원에게 할당
    await this.assignSubtasks(subtasks, plan.assignments);

    return subtasks;
  }

  /**
   * Manager가 분배 계획 수립
   */
  private async createDistributionPlan(
    teamTask: Task,
    team: Team,
    manager: Hollon,
  ): Promise<DistributionPlan> {
    // Manager의 Brain Provider 호출
    const context = await this.buildContext(teamTask, team);
    const prompt = this.buildDistributionPrompt(teamTask, team, context);

    const response = await this.brainProvider.execute(manager, prompt);

    // 응답 파싱
    const plan = this.parseDistributionPlan(response);

    return plan;
  }

  /**
   * 분배 계획 검증
   */
  private async validatePlan(plan: DistributionPlan): Promise<boolean> {
    // 1. 모든 팀원이 유효한지
    // 2. 의존성이 순환하지 않는지
    // 3. Workload가 균형있는지
    // 4. 필요한 스킬이 매칭되는지

    return true;
  }
}
```

### 2. ManagerService 확장

```typescript
@Injectable()
export class ManagerService {
  /**
   * 팀 진행 상황 모니터링 (Cron)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async monitorAllTeams(): Promise<void> {
    const teams = await this.teamRepo.find({
      relations: ['manager', 'assignedTasks'],
    });

    for (const team of teams) {
      const teamTasks = team.assignedTasks.filter(
        (t) =>
          t.type === TaskType.TEAM_EPIC && t.status !== TaskStatus.COMPLETED,
      );

      for (const teamTask of teamTasks) {
        await this.monitorTeamTask(teamTask, team);
      }
    }
  }

  /**
   * Team Task 진행 상황 모니터링
   */
  private async monitorTeamTask(teamTask: Task, team: Team): Promise<void> {
    const subtasks = await this.getSubtasks(teamTask.id);

    const stats = {
      total: subtasks.length,
      completed: subtasks.filter((t) => t.status === TaskStatus.COMPLETED)
        .length,
      blocked: subtasks.filter((t) => t.status === TaskStatus.BLOCKED).length,
      failed: subtasks.filter((t) => t.status === TaskStatus.FAILED).length,
    };

    // 진행률 업데이트
    const progress = (stats.completed / stats.total) * 100;
    await this.updateProgress(teamTask.id, progress);

    // 이상 징후 감지
    if (stats.blocked >= 2) {
      await this.handleBlockedSubtasks(teamTask, team, subtasks);
    }

    if (stats.failed >= 3) {
      await this.handleFailedSubtasks(teamTask, team, subtasks);
    }
  }

  /**
   * Blocked subtask 처리
   */
  private async handleBlockedSubtasks(
    teamTask: Task,
    team: Team,
    subtasks: Task[],
  ): Promise<void> {
    const blockedTasks = subtasks.filter(
      (t) => t.status === TaskStatus.BLOCKED,
    );

    const manager = team.manager;

    const prompt = `
      Team Task "${teamTask.title}" has ${blockedTasks.length} blocked subtasks:

      ${blockedTasks
        .map(
          (t) => `
        - ${t.title}
          Assigned: ${t.assignedHollon.name}
          Blocked reason: ${t.blockedReason}
      `,
        )
        .join('\n')}

      Team members availability:
      ${team.members
        .map(
          (m) => `
        - ${m.name}: ${m.currentTaskCount} active tasks
      `,
        )
        .join('\n')}

      What should we do?
      Options:
      1. Reassign to less busy members
      2. Break down into smaller tasks
      3. Request collaboration between members
      4. Escalate to human
    `;

    const decision = await this.brainProvider.execute(manager, prompt);

    await this.executeDecision(teamTask, decision);
  }

  /**
   * Task 재분배
   */
  async redistributeSubtasks(
    teamTaskId: string,
    reason: string,
  ): Promise<void> {
    const teamTask = await this.getTeamTask(teamTaskId);
    const team = teamTask.assignedTeam;
    const manager = team.manager;

    const subtasks = await this.getSubtasks(teamTaskId);
    const workloads = await this.calculateWorkloads(team.members);

    const prompt = `
      Redistributing subtasks for "${teamTask.title}"
      Reason: ${reason}

      Current state:
      ${subtasks
        .map(
          (t) => `
        - ${t.title}
          Status: ${t.status}
          Assigned: ${t.assignedHollon?.name || 'Unassigned'}
      `,
        )
        .join('\n')}

      Workloads:
      ${workloads
        .map(
          (w) => `
        - ${w.hollon.name}: ${w.taskCount} tasks (${w.completionRate}% completion)
      `,
        )
        .join('\n')}

      Suggest task reassignments to:
      1. Balance workload
      2. Resolve blockers
      3. Match skills better
    `;

    const plan = await this.brainProvider.execute(manager, prompt);

    await this.executeReassignments(teamTask, plan);
  }
}
```

### 3. HollonExecutionService 통합

```typescript
@Injectable()
export class HollonExecutionService {
  /**
   * Team Task 자동 분배 (Level 1 → Level 2)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async distributeTeamTasks(): Promise<void> {
    // Team Task 중 아직 분배 안 된 것 찾기
    const teamTasks = await this.taskRepo.find({
      where: {
        type: TaskType.TEAM_EPIC,
        status: TaskStatus.READY,
        assignedTeamId: Not(IsNull()),
        assignedHollonId: IsNull(),
      },
      relations: ['assignedTeam', 'assignedTeam.manager', 'subtasks'],
    });

    for (const teamTask of teamTasks) {
      // Subtask가 없으면 Manager에게 분배 요청
      if (!teamTask.subtasks || teamTask.subtasks.length === 0) {
        this.logger.log(
          `Distributing team task ${teamTask.id} to team ${teamTask.assignedTeam.name}`,
        );

        await this.teamDistributionService.distributeToTeam(teamTask.id);
      }
    }
  }

  /**
   * 기존 로직: Hollon Task 자동 실행 (Level 2+)
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async executeAssignedHollons(): Promise<void> {
    // 기존 로직 유지
    // IDLE + assignedHollonId 있는 Task 실행
    // ...
  }
}
```

---

## 🎯 구현 우선순위

### Phase 1: 기본 계층 구조 (1주)

**P0 (필수):**

1. **Entity 확장** (1일)
   - Task.assignedTeamId 추가
   - Task.type에 TEAM_EPIC 추가
   - Team.managerHollonId 추가
   - Migration 작성

2. **TeamTaskDistributionService** (2일)
   - distributeToTeam() 구현
   - createDistributionPlan() 구현
   - Manager Brain Provider 통합

3. **GoalDecompositionService 수정** (1일)
   - Team-level 분해로 변경
   - Team 할당 로직 추가

4. **HollonExecutionService 통합** (1일)
   - distributeTeamTasks() Cron 추가
   - Team Task → Hollon Task 자동 분배

5. **테스트** (2일)
   - 통합 테스트: Goal → Team Task → Hollon Task
   - E2E 테스트: 전체 플로우

### Phase 2: Manager 강화 (1주)

**P1 (중요):**

1. **ManagerService 확장** (3일)
   - monitorTeamTask() 구현
   - handleBlockedSubtasks() 구현
   - redistributeSubtasks() 구현

2. **재분배 로직** (2일)
   - Workload 계산
   - 최적 할당 알고리즘
   - 의존성 고려

3. **테스트** (2일)
   - Manager 모니터링 테스트
   - 재분배 시나리오 테스트

### Phase 3: 고도화 (선택)

**P2 (권장):**

1. **Manager Dashboard**
   - 팀 진행률 시각화
   - Workload 밸런스 차트

2. **자동 협업 조정**
   - Blocked task 자동 협업 요청
   - Pair programming 제안

3. **학습 기반 할당**
   - 과거 성과 기반 할당
   - 스킬 매칭 최적화

---

## 📈 예상 효과

### Before (Flat Structure)

```
문제점:
❌ 팀 협업 없음
❌ Manager 역할 제한적
❌ 재분배 어려움
❌ 확장성 낮음

지표:
- 자율성: 85%
- Manager 활용도: 20% (에스컬레이션만)
- Task 재분배 성공률: 50%
- 팀 협업: 거의 없음
```

### After (Hierarchical Structure)

```
개선:
✅ 팀 단위 협업 자연스러움
✅ Manager 핵심 역할 (분배 + 모니터링)
✅ 재분배 효율적 (팀 내부만)
✅ 무한 확장 가능

지표:
- 자율성: 95% (Manager 자동 분배)
- Manager 활용도: 80% (분배 + 모니터링 + 재분배)
- Task 재분배 성공률: 85%
- 팀 협업: 활발 (Manager 조율)
```

---

## 🚧 구현 시 고려사항

### 1. Depth 제한

```typescript
// Task depth 무한 증가 방지
const MAX_TASK_DEPTH = 3; // Team → Hollon → Sub-Hollon

if (task.depth >= MAX_TASK_DEPTH) {
  throw new Error('Maximum task depth exceeded');
}
```

### 2. Circular Dependency 방지

```typescript
// Subtask가 parent를 의존하면 안 됨
async validateDependencies(task: Task): Promise<boolean> {
  const ancestors = await this.getAncestors(task.id);
  const ancestorIds = new Set(ancestors.map(t => t.id));

  for (const dep of task.dependencies) {
    if (ancestorIds.has(dep.id)) {
      throw new Error('Circular dependency detected');
    }
  }

  return true;
}
```

### 3. Manager 부재 시 Fallback

```typescript
// Manager가 없는 팀은 어떻게 처리?
if (!team.manager) {
  // Fallback 1: 가장 senior hollon을 임시 manager로
  const seniorHollon = await this.findSeniorHollon(team);

  // Fallback 2: 인간에게 알림
  if (!seniorHollon) {
    await this.notifyHuman(`Team ${team.name} has no manager`);
    return;
  }
}
```

### 4. Team Task 진행률 계산

```typescript
// Team Task 진행률 = Subtask 진행률의 평균
async calculateTeamTaskProgress(teamTaskId: string): Promise<number> {
  const subtasks = await this.getSubtasks(teamTaskId);

  if (subtasks.length === 0) return 0;

  const totalProgress = subtasks.reduce((sum, t) => {
    if (t.status === TaskStatus.COMPLETED) return sum + 100;
    if (t.status === TaskStatus.IN_PROGRESS) return sum + 50;
    return sum;
  }, 0);

  return totalProgress / subtasks.length;
}
```

---

## ✅ 최종 체크리스트

### Phase 1 완료 기준

- [ ] Task.assignedTeamId 필드 추가
- [ ] TaskType.TEAM_EPIC enum 추가
- [ ] Team.managerHollonId 추가
- [ ] TeamTaskDistributionService 구현
- [ ] GoalDecompositionService 수정 (Team-level)
- [ ] HollonExecutionService.distributeTeamTasks() 추가
- [ ] 통합 테스트: Goal → Team Task → Hollon Task

### Phase 2 완료 기준

- [ ] ManagerService.monitorTeamTask() 구현
- [ ] ManagerService.redistributeSubtasks() 구현
- [ ] Blocked subtask 자동 처리
- [ ] Workload 밸런스 자동 조정
- [ ] 통합 테스트: Manager 모니터링 + 재분배

---

**문서 버전**: 1.0
**최종 업데이트**: 2025-12-10
**작성자**: Claude
**상태**: 설계 완료, 구현 대기 중
