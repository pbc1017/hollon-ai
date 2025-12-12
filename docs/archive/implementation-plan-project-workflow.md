# Phase 3.11: Project-Based Workflow Implementation Plan

> **Phase 3.11**: Hollon별 Git Worktree 재사용 + 브랜치명 개선 + E2E 테스트

---

## 🎯 목표

1. **Git Worktree 효율화**: 홀론당 1개 워크트리 재사용 (Task별 생성/삭제 → Hollon별 재사용)
2. **브랜치명 개선**: `feature/task-{id}` → `feature/{hollonName}/task-{id}` (작업자 명확화)
3. **E2E 테스트**: 실제 LLM 호출 포함 전체 워크플로우 검증
4. **SSOT 준수**: 임시 Hollon 패턴 사용 (CEO 홀론 개념 없음)

---

## 📊 현재 구조 (As-Is: Phase 3.10)

```
User creates Task directly (or via Goal Decomposition)
  ↓
Manager pulls TEAM_EPIC → TeamTaskDistribution (Phase 3.8)
  ↓
Dev Hollons pull subtasks
  ↓
TaskExecutionService.executeTask()
  - Worktree per task: worktree-{taskId} (생성/삭제 반복) ❌
  - Branch: feature/task-{taskId} (작업자 불명확) ❌
  ↓
All subtasks done → READY_FOR_REVIEW (Phase 3.10)
  ↓
Manager reviews → complete/rework/add_tasks/redirect
```

**문제점**:

1. ❌ Worktree가 Task마다 생성/삭제 (비효율)
2. ❌ 브랜치명에 작업자 정보 없음 (`feature/task-{id}`)
3. ❌ 동일 홀론이 여러 태스크 수행 시 워크트리 재생성

---

## 🎨 변경 구조 (To-Be: Phase 3.11)

```
User creates Project
  ↓
User triggers "Analyze Project" (임시 Hollon 사용) ✨
  → 임시 Hollon 생성 (ProjectAnalyzer role)
  → LLM analyzes → creates TEAM_EPIC Task
  → 임시 Hollon 자동 삭제 (SSOT 6.2)
  ↓
Manager pulls TEAM_EPIC → TeamTaskDistribution (Phase 3.8)
  ↓
Dev Hollons pull subtasks
  ↓
TaskExecutionService.executeTask() [개선됨]
  - Worktree per hollon: worktree-{hollonId} (재사용) ✅
  - Branch: feature/{hollonName}/task-{taskId} (작업자 명확) ✅
  - 동일 워크트리에서 브랜치만 전환 ✅
  ↓
All subtasks done → READY_FOR_REVIEW (Phase 3.10)
  ↓
Manager reviews → complete/rework/add_tasks/redirect
```

**개선점**:

1. ✅ Hollon당 1개 워크트리 재사용 (50%+ 효율 향상)
2. ✅ 브랜치명에 홀론 이름 포함 (`feature/DevBot-AI/task-abc123`)
3. ✅ 파일시스템 기반 상태 추적 (DB 변경 없음)
4. ✅ SSOT 준수 (임시 홀론 패턴)

---

## 🔄 전체 플로우 (SSOT 기준)

### Phase 1: Project 생성 (사용자)

```
POST /api/projects
{
  "name": "사용자 인증 시스템 구축",
  "description": "JWT, OAuth 기반 인증",
  "organizationId": "org-1",
  "repositoryUrl": "https://github.com/org/repo",
  "workingDirectory": "/path/to/repo"
}

→ Project 생성 (DB only, workingDirectory 저장)
```

### Phase 2: Project 분석 (임시 Hollon) ✨

```
POST /api/projects/{projectId}/analyze

→ 임시 Hollon 생성 (ProjectAnalyzer role)
  ├─ organizationId
  ├─ roleId: project-analyzer
  └─ isTemporary: true

→ LLM 분석
  ├─ Project description 읽기
  ├─ Repository 구조 분석 (선택)
  └─ TEAM_EPIC Task 생성
      ├─ type: TEAM_EPIC
      ├─ projectId: project-1
      ├─ assignedTeamId: team-1 (Engineering)
      └─ description: "인증 시스템 구현..."

→ 임시 Hollon 자동 삭제 (SSOT 6.2 임시 홀론 패턴)
```

### Phase 3: Manager 배분 (Phase 3.8)

```
Manager Hollon pulls TEAM_EPIC
  ↓
TeamTaskDistributionService.distributeToTeam()
  ↓
LLM analyzes team members + task
  ↓
서브태스크 3개 생성
  ├─ Subtask 1: "JWT 인증" → DevBot-AI (dev-1)
  ├─ Subtask 2: "OAuth 통합" → DevBot-Data (dev-2)
  └─ Subtask 3: "테스트 작성" → QA-Bot (qa-1)

Parent Task → PENDING (서브태스크 완료 대기)
```

### Phase 4: Dev Hollon 작업 [Phase 3.11 핵심 개선] ✨

```
Dev Hollon #1 (DevBot-AI)
  ↓
pullNextTask() → Subtask 1 획득
  ↓
TaskExecutionService.executeTask(taskId, hollonId)
  ↓
1. getOrCreateWorktree(hollon, project) [NEW]
   ├─ worktreePath = `{workingDirectory}/../.git-worktrees/worktree-{hollonId}`
   ├─ if (!exists) → git worktree add
   └─ if (exists) → git fetch origin (재사용)

2. createBranch(hollon, task, worktreePath) [NEW]
   ├─ sanitize hollon.name (특수문자 → -)
   ├─ branchName = `feature/{sanitizedName}/task-{taskId.slice(0,8)}`
   └─ git checkout -b {branchName} origin/main

3. executeBrainProvider(hollon, task, worktreePath)
   ├─ Prompt composition (SSOT 4.2: 6 layers)
   ├─ Claude Code CLI 실행
   ├─ 코드 생성 + 커밋
   └─ Return result

4. createPullRequest(hollon, task, worktreePath, branchName) [UPDATED]
   ├─ git push -u origin {branchName}
   ├─ PR title: `[{hollon.name}] {task.title}`
   └─ PR body: hollon info + task details

5. Task status → IN_REVIEW

Dev Hollon #1이 Subtask 2를 나중에 받으면?
  → SAME worktreePath 재사용 (워크트리 생성 스킵)
  → NEW branch: feature/DevBot-AI/task-{taskId2}
```

### Phase 5: Review Cycle (Phase 3.10)

```
모든 서브태스크 COMPLETED
  ↓
Parent Task → READY_FOR_REVIEW
  ↓
Manager Hollon pulls (Priority 0)
  ↓
Task status → IN_REVIEW
  ↓
LLM Review (4가지 결정)
  ├─ complete: Parent COMPLETED, 임시 홀론 정리
  ├─ rework: 특정 서브태스크 READY로 재설정
  ├─ add_tasks: 추가 서브태스크 생성
  └─ redirect: 일부 서브태스크 취소
```

---

## 🛠️ 구현 변경사항

### 1. TaskExecutionService 개선

**File**: `apps/server/src/modules/orchestration/services/task-execution.service.ts`

#### 새 메서드 추가 (~80 lines)

```typescript
/**
 * Hollon별 워크트리 확보 (재사용 전략)
 */
private async getOrCreateWorktree(
  hollon: Hollon,
  project: Project,
): Promise<string> {
  const worktreePath = path.join(
    project.workingDirectory,
    '..',
    '.git-worktrees',
    `worktree-${hollon.id.slice(0, 8)}`,
  );

  const exists = await this.worktreeExists(worktreePath);

  if (!exists) {
    this.logger.log(`Creating new worktree for hollon ${hollon.name}`);
    await execAsync(
      `mkdir -p ${path.dirname(worktreePath)} && git worktree add ${worktreePath}`,
      { cwd: project.workingDirectory },
    );
  } else {
    this.logger.log(`Reusing existing worktree for hollon ${hollon.name}`);
    await execAsync(`git fetch origin`, { cwd: worktreePath });
  }

  return worktreePath;
}

/**
 * 워크트리 존재 확인
 */
private async worktreeExists(worktreePath: string): Promise<boolean> {
  try {
    await execAsync(`test -d ${worktreePath}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Hollon 이름 포함 브랜치 생성
 */
private async createBranch(
  hollon: Hollon,
  task: Task,
  worktreePath: string,
): Promise<string> {
  // 특수문자 제거
  const sanitizedName = hollon.name.replace(/[^a-zA-Z0-9-]/g, '-');
  const branchName = `feature/${sanitizedName}/task-${task.id.slice(0, 8)}`;

  await execAsync(`git checkout -b ${branchName} origin/main`, {
    cwd: worktreePath,
  });

  this.logger.log(`Branch created: ${branchName}`);
  return branchName;
}

/**
 * 브랜치 정리 (실패 시)
 */
private async cleanupBranch(
  worktreePath: string,
  branchName: string,
): Promise<void> {
  try {
    await execAsync(`git checkout main`, { cwd: worktreePath });
    await execAsync(`git branch -D ${branchName}`, { cwd: worktreePath });
    this.logger.log(`Branch ${branchName} cleaned up`);
  } catch (error) {
    this.logger.warn(`Failed to cleanup branch: ${error.message}`);
  }
}
```

#### executeTask 메서드 수정 (~10 line changes)

```typescript
async executeTask(
  taskId: string,
  hollonId: string,
): Promise<{ prUrl: string; worktreePath: string }> {
  // ... (existing: task, hollon 로드)

  let worktreePath: string;
  let branchName: string;

  try {
    // ✅ NEW: Hollon별 워크트리 확보
    worktreePath = await this.getOrCreateWorktree(hollon, task.project);

    // ✅ NEW: Hollon 이름 포함 브랜치 생성
    branchName = await this.createBranch(hollon, task, worktreePath);

    // Existing: Brain execution
    await this.executeBrainProvider(hollon, task, worktreePath);

    // ✅ UPDATED: PR creation with hollon info
    const prUrl = await this.createPullRequest(
      hollon,
      task,
      worktreePath,
      branchName,
    );

    // Existing: Code review request
    await this.requestCodeReview(task, prUrl, hollonId);

    return { prUrl, worktreePath };
  } catch (error) {
    // ✅ NEW: Branch cleanup (워크트리는 유지)
    if (worktreePath && branchName) {
      await this.cleanupBranch(worktreePath, branchName).catch(() => {});
    }
    throw error;
  }
}
```

### 2. createPullRequest 개선

```typescript
private async createPullRequest(
  hollon: Hollon,
  task: Task,
  worktreePath: string,
  branchName: string,
): Promise<string> {
  // Push branch
  await execAsync(`git push -u origin ${branchName}`, {
    cwd: worktreePath,
  });

  // ✅ PR title에 hollon 이름 포함
  const prTitle = `[${hollon.name}] ${task.title}`;

  // ✅ PR body에 hollon 정보 추가
  const prBody = this.buildPRBody(hollon, task);

  const { stdout } = await execAsync(
    `gh pr create --title "${prTitle}" --body "${prBody}" --base main`,
    { cwd: worktreePath },
  );

  return stdout.trim();
}

private buildPRBody(hollon: Hollon, task: Task): string {
  const sections: string[] = [];

  sections.push(`## Task: ${task.title}\n`);
  sections.push(`**Assigned to**: ${hollon.name} (${hollon.role?.name})\n`);
  sections.push(`**Project**: ${task.project.name}\n`);

  if (task.description) {
    sections.push(`### Description\n${task.description}\n`);
  }

  sections.push(`### Task ID\n${task.id}\n`);
  sections.push(`---\n🤖 Generated by Hollon AI (${hollon.name})`);

  return sections.join('\n').replace(/"/g, '\\"');
}
```

---

## 📝 E2E 테스트 시나리오

**File**: `apps/server/test/integration/phase3.11-project-workflow.integration-spec.ts`

````typescript
describe('Phase 3.11: Project-Based Workflow', () => {
  const USE_REAL_LLM = process.env.HOLLON_E2E_REAL_LLM === 'true';

  beforeEach(() => {
    if (!USE_REAL_LLM) {
      jest.spyOn(brainProvider, 'executeWithTracking').mockResolvedValue({
        output: '```typescript\n// Generated code\n```',
        success: true,
        duration: 1000,
        cost: { inputTokens: 100, outputTokens: 50, totalCostCents: 0.01 },
      });
    }
  });

  it('should complete full project workflow', async () => {
    // 1. User creates Project
    const project = await createProject({
      name: 'Test Project',
      organizationId,
      repositoryUrl: 'https://github.com/test/repo',
      workingDirectory: testRepoPath,
    });

    // 2. Analyze Project with temporary Hollon
    const parentTask = await createParentTaskWithLLM(project);
    expect(parentTask.type).toBe(TaskType.TEAM_EPIC);

    // 3. Manager distributes
    await managerHollon.runCycle();

    // 4. Dev Hollons work
    await devHollonAlice.runCycle(); // Creates worktree-{aliceId}
    await devHollonBob.runCycle(); // Creates worktree-{bobId}
    await devHollonAlice.runCycle(); // Reuses worktree-{aliceId} ✨

    // 5. Verify Git workflow
    const aliceWorktree = getWorktreePath(devHollonAlice.id);
    expect(await worktreeExists(aliceWorktree)).toBe(true);

    const branches = await getBranches(testRepoPath);
    expect(branches).toContain(`feature/${devHollonAlice.name}/task-`);

    // 6. Review Cycle
    await completeAllSubtasks(subtasks);
    await managerHollon.runCycle();

    expect(parentTask.status).toBe(TaskStatus.COMPLETED);
  });
});
````

---

## 👥 사람과의 상호작용 (Phase 3.11 이후)

### ✅ 기존 Escalation 시스템 (그대로 사용 가능)

**File**: `apps/server/src/modules/orchestration/services/escalation.service.ts`

**5단계 Escalation** (SSOT 6.3):

```
Level 1: Self Resolve (재시도, 대안 탐색)
Level 2: Team Collaboration (팀 내 Hollon 도움 요청)
Level 3: Team Leader (Manager 판단)
Level 4: Organization Level
Level 5: Human Intervention ✨ (ApprovalRequest 생성)
```

**Escalation Triggers** (Phase 3.11에서도 동일):

1. **Task 실패 3회 이상** → Level 3 (Team Leader)
2. **비용 초과** → Level 5 (Human Intervention)
3. **복잡도 초과** → Level 4 (Organization)
4. **Git 충돌 해결 불가** → Level 2 → Level 3
5. **Worktree 생성 실패** → Level 3

### ✅ ApprovalRequest Entity (그대로 사용)

**File**: `apps/server/src/modules/escalation/entities/approval-request.entity.ts`

```typescript
export enum ApprovalType {
  COST_OVERRIDE = 'cost_override',
  TASK_COMPLEXITY = 'task_complexity',
  QUALITY_ISSUE = 'quality_issue',
  ESCALATION_L5 = 'escalation_l5',
  OTHER = 'other',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}
```

### Phase 3.11 추가 Escalation 케이스

**1. Worktree 충돌**

```typescript
// TaskExecutionService에서
try {
  worktreePath = await this.getOrCreateWorktree(hollon, project);
} catch (error) {
  // Worktree 생성 실패 → Escalation Level 3
  await escalationService.escalate({
    taskId,
    hollonId,
    reason: `Worktree creation failed: ${error.message}`,
    level: EscalationLevel.TEAM_LEADER,
  });
}
```

**2. Git 작업 실패**

```typescript
try {
  branchName = await this.createBranch(hollon, task, worktreePath);
} catch (error) {
  // 브랜치 생성 실패 → Escalation Level 2 (팀 협업)
  await escalationService.escalate({
    taskId,
    hollonId,
    reason: `Branch creation failed: ${error.message}`,
    level: EscalationLevel.TEAM_COLLABORATION,
  });
}
```

**3. PR 생성 실패**

```typescript
try {
  prUrl = await this.createPullRequest(hollon, task, worktreePath, branchName);
} catch (error) {
  // PR 생성 실패 → Escalation Level 5 (인간 개입)
  // GitHub 토큰 문제일 가능성
  await escalationService.escalate({
    taskId,
    hollonId,
    reason: `PR creation failed: ${error.message}`,
    level: EscalationLevel.HUMAN_INTERVENTION,
    metadata: { errorType: 'github_api_error' },
  });
}
```

### 사람 개입이 필요한 상황 (SSOT 6.2 기준)

| 상황               | Escalation Level | ApprovalRequest Type | 예시                 |
| ------------------ | ---------------- | -------------------- | -------------------- |
| GitHub 토큰 만료   | 5 (Human)        | OTHER                | PR 생성 불가         |
| 비용 초과          | 5 (Human)        | COST_OVERRIDE        | LLM 비용 한도 초과   |
| 복잡도 초과        | 4 → 5            | TASK_COMPLEXITY      | 서브태스크 10개 초과 |
| Git 충돌 해결 불가 | 3 → 5            | QUALITY_ISSUE        | Merge conflict       |
| Worktree 공간 부족 | 5 (Human)        | OTHER                | Disk full            |

---

## 🔍 검증 포인트

### 1. Worktree 재사용

- [ ] 동일 홀론이 여러 태스크 수행 시 워크트리 재사용
- [ ] 다른 홀론은 독립적인 워크트리 사용
- [ ] 워크트리 충돌 없음

### 2. 브랜치 전략

- [ ] 브랜치명에 홀론 이름 포함
- [ ] 특수문자 제거 (sanitization)
- [ ] PR에서 작업자 명확히 확인

### 3. Escalation 통합

- [ ] Worktree 생성 실패 시 Escalation
- [ ] Git 작업 실패 시 Escalation
- [ ] PR 생성 실패 시 ApprovalRequest 생성
- [ ] 인간 승인/거부 처리

### 4. E2E 테스트

- [ ] Mock LLM: <10초 실행
- [ ] Real LLM: 45-120초 실행 (HOLLON_E2E_REAL_LLM=true)
- [ ] 전체 워크플로우 검증
- [ ] Cleanup 정상 작동

---

## 📊 예상 효과

| 항목          | Before (Phase 3.10) | After (Phase 3.11)           | 개선           |
| ------------- | ------------------- | ---------------------------- | -------------- |
| 워크트리 효율 | Task마다 생성/삭제  | Hollon당 1개 재사용          | ✅ 50%+ 절약   |
| 브랜치 추적성 | `feature/task-abc`  | `feature/DevBot-AI/task-abc` | ✅ 작업자 명확 |
| Escalation    | 기존 5단계 사용     | Git 실패 케이스 추가         | ✅ 안정성 향상 |
| 사람 개입     | ApprovalRequest     | 동일 (재사용)                | ✅ 호환성 유지 |
| 테스트        | Mock만              | Mock + Real LLM              | ✅ 검증 강화   |

---

## 🚀 구현 순서

1. ✅ **설계 문서 작성** (현재)
2. **TaskExecutionService 개선**
   - getOrCreateWorktree()
   - createBranch()
   - cleanupBranch()
3. **PR 생성 로직 업데이트**
   - 홀론 이름 포함
   - PR body 개선
4. **Escalation 통합**
   - Git 실패 케이스 추가
   - ApprovalRequest 연동
5. **E2E 테스트 작성**
   - Mock LLM 버전
   - Real LLM 버전 (옵션)
6. **기존 테스트 수정**
7. **SSOT 문서 업데이트**

---

## 🎯 SSOT 준수 체크리스트

- ✅ **3. 핵심 엔티티**: Organization, Team, Hollon, Project, Task
- ✅ **4.1 전체 실행 흐름**: 직접 Task 생성 (Project 포함)
- ✅ **4.3 태스크 처리 분기**: TeamTaskDistribution (Phase 3.8)
- ✅ **4.3 리뷰 사이클**: READY_FOR_REVIEW → IN_REVIEW (Phase 3.10)
- ✅ **6.2 인간-홀론 역할**: 임시 홀론 생성/삭제 (자율)
- ✅ **6.3 에스컬레이션 계층**: 5단계 (기존 시스템 재사용)
- ✅ **10. 용어**: Temporary Hollon, Sub-Hollon, Escalation

---

## 📚 관련 문서

- **SSOT**: `/docs/ssot.md`
- **Phase 3.8**: TeamTaskDistribution (서브태스크 배분)
- **Phase 3.10**: Parent Hollon Review Cycle
- **Phase 3.11 Plan**: `/.claude/plans/iridescent-discovering-thimble.md`
