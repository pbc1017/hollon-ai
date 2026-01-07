# Phase 4.1 Execution Status Log

> **Start Date**: 2025-12-24
> **Purpose**: Validate Phase 4.1 automated execution via Goal API
> **CTO**: CTO-Zeus (`f583b5b0-74c1-4276-9771-c10a3269fd8c`)
> **Organization**: Hollon AI Development (`9f0d4ead-fb19-4df1-a1e7-f634e0e69665`)

---

## Fixes Applied

| Commit  | Fix   | Description                                                                                         |
| ------- | ----- | --------------------------------------------------------------------------------------------------- |
| ea4b167 | #1    | Subtasks inherit parent's worktree at execution time (not creation time)                            |
| ea4b167 | #2    | Worktrees created at git root (`hollon-ai/.git-worktrees/`), not `apps/server/`                     |
| ea4b167 | #3    | CI retry fetches actual logs via `gh run view --log-failed`                                         |
| ea4b167 | #4    | Retry limit increased from 3 to 5                                                                   |
| ea4b167 | #5    | After 5 retries: task → BLOCKED for manager intervention                                            |
| d4ebd7e | #2.1  | Use `git rev-parse --show-toplevel` to detect actual git root (fixes `apps/` vs `hollon-ai/` issue) |
| 58838a3 | #11   | 3-layer worktree protection: cleanup all tasks, verify path exists, fail if cwd missing             |
| c184767 | #12   | Use `os.tmpdir()` + `disallowedTools` for analysis-only Brain Provider calls                        |
| 1d93145 | #13   | Reuse existing PR during CI retry instead of failing with "already exists" error                    |
| 7eb8bf3 | #14   | Normalize CI state comparison to lowercase (gh CLI returns uppercase SUCCESS/FAILURE)               |
| N/A     | #22   | Add parent-child unblock logic to PR merge workflow (replaced by Fix #25)                           |
| N/A     | #23   | Remove --auto flag from gh pr merge (requires branch protection rules)                              |
| 0a3c12d | #24   | Auto-resolve merge conflicts: check mergeable before CI, rebase + force push                        |
| 199536e | #25   | Auto-complete Team Epic when all children complete (during PR merge, not cron)                      |
| ceaad88 | #27.3 | Construct worktree path from task/hollon IDs when workingDirectory missing                          |
| 0c5412b | #27.4 | Merge-time conflict detection + manager re-review on success (second timing point)                  |
| cba3454 | #28   | Handle uncommitted changes before rebase in conflict resolution (stash/pop workflow)                |
| TBD     | #29   | Transaction for PR record + task status update, Orphaned PR sync cron (5분 주기)                    |

---

## Pre-Test Setup

| Item                          | Status | Notes                                                      |
| ----------------------------- | ------ | ---------------------------------------------------------- |
| CI on main                    | ✅     | Fix #11 (58838a3) passed CI                                |
| Temp hollons removed          | ✅     | 14 impl-\* hollons deleted                                 |
| Hollon status reset           | ✅     | 10 hollons, all idle                                       |
| Projects/Goals/Tasks cleared  | ✅     | 142 tasks, 1 goal, 12 projects deleted                     |
| Git cleanup                   | ✅     | 154 branches, all worktrees removed                        |
| Organization workingDirectory | ✅     | `/Users/perry/Documents/Development/hollon-ai/apps/server` |
| OpenAI API Key                | ⏳     | Currently dummy key                                        |

---

## Goal to Create

```json
{
  "organizationId": "9f0d4ead-fb19-4df1-a1e7-f634e0e69665",
  "ownerHollonId": "f583b5b0-74c1-4276-9771-c10a3269fd8c",
  "title": "Phase 4.1: Knowledge System",
  "description": "Implement knowledge accumulation system. Reference: docs/phases/phase4-revised-plan.md Phase 4.1 section. Target: KnowledgeExtractionService, VectorSearchService, KnowledgeGraphService, PromptComposerService integration",
  "successCriteria": [
    "KnowledgeExtractionService implemented",
    "VectorSearchService implemented (accuracy 85%+)",
    "KnowledgeGraphService implemented",
    "PromptComposerService integration complete",
    "E2E tests 90%+ pass"
  ],
  "status": "active"
}
```

---

## Test Run Log

| Time (KST) | Event                       | Status | Notes                                      |
| ---------- | --------------------------- | ------ | ------------------------------------------ |
| 15:02      | Server started              | ✅     | pnpm dev on apps/server                    |
| 15:04      | Goal created                | ✅     | ID: `772083e6-33a8-431d-aff9-d9b56bf8c94b` |
| 15:06      | CTO decomposition started   | ✅     | GoalAutomationListener triggered           |
| 15:07      | Projects/Team Epics created | ✅     | 6 projects, 29 tasks created               |
| 15:08      | Task execution started      | ✅     | BackendDev-Charlie working, 3 worktrees    |
| 15:15      | Code generation active      | ✅     | 8+ Claude processes, commits in progress   |
| 15:30      | Issue #12 발견              | ⚠️     | main repo에 vector-search 파일 생성됨      |
| 15:45      | Fix #12 적용                | ✅     | os.tmpdir() + disallowedTools 적용         |
| 15:50      | 서버 재시작, PR 3개 확인    | ✅     | Main repo 오염 없음, 3 hollons 작업 중     |

---

## Current Status (2026-01-07 13:40 KST)

| Metric               | Count |
| -------------------- | ----- |
| Open PRs             | 32    |
| - CLEAN              | 1     |
| - UNSTABLE (CI Fail) | 3     |
| - CONFLICTING        | 1     |
| - UNKNOWN            | 27    |
| Tasks IN_REVIEW      | 4     |

### Recent PR Activity

| PR   | Status      | Task Status | Result                                     |
| ---- | ----------- | ----------- | ------------------------------------------ |
| #197 | ✅ MERGED   | `completed` | Analyze KnowledgeGraphModule structure     |
| #192 | ✅ MERGED   | `completed` | Review VectorSearchModule implementation   |
| #180 | CONFLICTING | `blocked`   | Merge conflicts - Brain Provider 해결 필요 |
| #159 | CONFLICTING | `blocked`   | Merge conflicts - Brain Provider 해결 필요 |

### 주요 Blocked 원인 분석

1. **Merge Conflicts (PR #159, #180)**
   - GitHub에서 `mergeStateStatus: DIRTY`, `mergeable: CONFLICTING` 상태
   - 워크트리에서 uncommitted changes로 인해 rebase 실패 → Fix #28로 해결
   - 그러나 여전히 actual merge conflicts 존재 (Brain Provider 해결 필요)

2. **UNKNOWN Mergeable Status (다수 PRs)**
   - GitHub API에서 `mergeable: UNKNOWN` 반환
   - GitHub이 mergeable 상태를 계산 중이거나 만료된 상태

---

## Hollons (10)

| Name                 | Role                | Status  |
| -------------------- | ------------------- | ------- |
| CTO-Zeus             | CTO                 | idle    |
| TechLead-Alpha       | Manager - Backend   | idle    |
| AILead-Echo          | Manager - Data & AI | idle    |
| InfraLead-Hotel      | Manager - Infra     | idle    |
| BackendDev-Bravo     | Senior Backend      | working |
| BackendDev-Charlie   | Senior Backend      | working |
| BackendDev-Delta     | Junior Backend      | idle    |
| DataEngineer-Foxtrot | Senior Data         | idle    |
| MLEngineer-Golf      | Senior ML           | idle    |
| DevOps-India         | Senior DevOps       | working |

---

## Issues Found

### Issue #12: Main Repo Pollution via Missing workingDirectory

**발견 시간**: 2025-12-24 15:30 KST

**증상**:

- `apps/server/src/modules/vector-search/` 디렉토리가 main repo에 untracked 상태로 생성됨
- 모든 worktree에는 해당 파일 없음

**근본 원인**:

- `manager.service.ts`에서 Brain Provider 호출 시 `workingDirectory`와 `disallowedTools` 누락
- `ProcessManagerService.spawn()`에서 `cwd` 없으면 `process.cwd()` (main repo)로 fallback

**영향받는 코드**:

```typescript
// manager.service.ts:274, 426
context: {
  hollonId: manager.id,
  taskId: teamTask.id,
  // ❌ workingDirectory 없음!
},
// ❌ disallowedTools 없음!
```

**해결 방안 (Fix #12)**:

| 방안                   | 설명                                                    | 권장        |
| ---------------------- | ------------------------------------------------------- | ----------- |
| A. ProcessManager 레벨 | `cwd` 없으면 `os.tmpdir()` 기본값 사용                  | ✅ 권장     |
| B. 각 서비스 수정      | 모든 호출에 `workingDirectory` + `disallowedTools` 추가 | 누락 가능성 |

**권장 수정 (방안 A)**:

```typescript
// process-manager.service.ts
const cwd = options.cwd || os.tmpdir(); // 기존: process.cwd()
```

**이유**:

- 한 곳에서 모든 케이스 해결
- 향후 새로운 서비스 추가 시 자동 보호
- 파일 생성이 필요한 구현 태스크는 항상 worktreePath를 명시적으로 전달

**상태**: ✅ 수정 완료 (c184767)

---

### Issue #13: CI Retry Fails Due to "PR Already Exists" Error

**발견 시간**: 2025-12-24 16:00 KST

**증상**:

- PR이 있는 Task 3개가 모두 `ready` 상태에서 진행되지 않음
- CI가 통과한 PR도 `IN_REVIEW`로 전환되지 않아 manager review가 trigger 되지 않음
- `autoCheckPRCI`가 `IN_REVIEW` 상태만 확인하므로 `ready` 상태의 Task는 무시됨

**근본 원인**:

1. CI 실패 시 `autoCheckPRCI`가 Task를 `READY`로 설정
2. `runCycle()` 호출 → Hollon이 Task를 다시 실행
3. `createPullRequest()`가 기존 PR 확인 없이 `gh pr create` 호출
4. `gh pr create` 실패: "a pull request for branch xxx already exists"
5. 예외 발생 → Task 실행 실패 → `READY` 상태 유지
6. Task가 `IN_REVIEW`가 아니므로 `autoCheckPRCI`가 무시

**영향받는 코드**:

```typescript
// task-execution.service.ts:1917
const { stdout } = await execAsync(
  `gh pr create --title "${task.title}" --body "${prBody}" --base ${baseBranch}`,
  // ❌ 기존 PR 존재 여부 확인 없음!
);
```

**해결 (Fix #13)**:

```typescript
// Fix #13: Check if PR already exists for this branch (CI retry case)
try {
  const { stdout: existingPR } = await execAsync(
    `gh pr view ${currentBranch} --json url --jq '.url'`,
    { cwd: worktreePath },
  );

  if (existingPR.trim()) {
    this.logger.log(
      `Fix #13: PR already exists, reusing: ${existingPR.trim()}`,
    );
    return existingPR.trim();
  }
} catch {
  // No existing PR, proceed to create one
}
```

**추가 수정**: `savePRRecord`에서도 중복 체크 추가

**상태**: ✅ 수정 완료 (1d93145)

---

### Issue #14: CI State Case Sensitivity Bug

**발견 시간**: 2025-12-24 16:10 KST

**증상**:

- CI가 모두 통과한 PR도 "CI checks failed" 로그 출력
- Task가 `READY_FOR_REVIEW`로 전환되지 않고 계속 `READY` 상태 유지

**근본 원인**:

- `gh pr checks --json` 명령은 state를 대문자로 반환 (`SUCCESS`, `FAILURE`)
- `autoCheckPRCI` 코드는 소문자로 비교 (`'success'`)
- 대소문자 불일치로 모든 CI가 실패로 감지됨

**영향받는 코드**:

```typescript
const hasFailedChecks = checks.some(
  (check) => check.state !== 'success', // ❌ 'SUCCESS'와 비교 필요
);
```

**해결 (Fix #14)**:

```typescript
// Fix #14: Normalize to lowercase for comparison
const normalizedChecks = checks.map((check) => ({
  ...check,
  state: check.state?.toLowerCase() || '',
}));

const hasFailedChecks = normalizedChecks.some(
  (check) => check.state !== 'success',
);
```

**상태**: ✅ 수정 완료 (7eb8bf3)

---

### Issue #25: Team Epic Deadlock - All Root Tasks Stuck in BLOCKED

**발견 시간**: 2026-01-06 11:40 KST

**증상**:

- 6개의 Team Epic (depth=0) 모두 BLOCKED 상태
- 169개의 ready 태스크가 Epic 의존성으로 인해 진행 불가
- 33개 완료된 태스크 있지만 Epic은 여전히 BLOCKED

**근본 원인**:

- Goal 분해 시 Team Epic이 일반 태스크처럼 실행됨
- Epic이 IN_PROGRESS 상태로 2+ 시간 stuck
- Timeout 메커니즘이 Epic을 BLOCKED로 마킹
- Epic의 자식 태스크들이 완료되어도 Epic 상태가 자동으로 COMPLETED로 변경되지 않음
- 전체 의존성 그래프가 deadlock 상태

**해결 (Fix #25)**:

```typescript
// code-review.service.ts:506-602
private async checkAndCompleteParentEpic(completedTask: Task): Promise<void> {
  // 1. Check if task has parent Epic (depth=0)
  if (!completedTask.parentTaskId) return;

  const parentTask = await this.taskRepo.findOne({
    where: { id: completedTask.parentTaskId },
  });

  if (parentTask.depth !== 0) return; // Not a Team Epic

  // 2. Query all children of Epic
  const allChildren = await this.taskRepo.find({
    where: { parentTaskId: parentTask.id },
  });

  // 3. Check if ALL children are COMPLETED
  const allChildrenCompleted = allChildren.every(
    (child) => child.status === TaskStatus.COMPLETED,
  );

  if (!allChildrenCompleted) return;

  // 4. Mark Epic as COMPLETED
  parentTask.status = TaskStatus.COMPLETED;
  parentTask.completedAt = new Date();

  // Clear blocked reason
  if (parentTask.metadata) {
    delete parentTask.metadata.blockedReason;
    delete parentTask.metadata.escalatedAt;
  }

  await this.taskRepo.save(parentTask);

  // 5. Unblock dependent tasks
  await this.unblockDependentTasks(parentTask);
}
```

**구현 위치**:

- `mergePullRequest()` 메소드에서 태스크 완료 후 자동 호출
- 새 cron 없이 기존 PR merge 플로우에 통합
- Line 291: `await this.checkAndCompleteParentEpic(pr.task);`

**예상 효과**:

- PR 머지 시 자식 태스크 완료 → Epic 완료 체크 → 자동 완료
- Dependency graph deadlock 해소
- 169개 ready 태스크가 unblock되어 실행 가능

**상태**: ✅ 수정 완료 (199536e), 테스트 대기 중 (다음 PR 머지 시 확인)

---

### System Kickstart (2026-01-06 12:18 KST)

**상황**: Fix #25 구현 후에도 시스템이 태스크를 실행하지 않음

**근본 원인 분석**:

1. **6개 Team Epic이 BLOCKED 상태로 deadlock 발생**
   - 모든 Epic이 timeout으로 BLOCKED 상태
   - 자식 태스크 대부분 미완료 (Epic 1: 2/22, Epic 2-6: 0-1 completed)

2. **208개의 leftover Git 브랜치**
   - 이전 worktree 정리 시 브랜치는 삭제하지 않음
   - 모든 태스크 실행이 `fatal: branch already exists` 에러로 실패

3. **85개 태스크가 exponential backoff로 차단**
   - Git 브랜치 충돌로 인한 연속 실패
   - `blocked_until` 필드로 14~54분 대기 중

**해결 조치**:

```sql
-- 1. Team Epic 수동 완료
UPDATE hollon.tasks
SET status = 'completed', completed_at = NOW(),
    metadata = metadata || '{"manuallyCompleted": true}'::jsonb
            - 'blockedReason' - 'escalatedAt'
WHERE depth = 0 AND parent_task_id IS NULL AND status = 'blocked';
-- Result: 6 Epics completed

-- 2. Git 브랜치 정리
git worktree list | grep "\.git-worktrees" | awk '{print $1}' |
  xargs -I {} git worktree remove --force {}
git worktree prune
git branch | grep -E "(feature/|wt-hollon-)" |
  xargs -n 1 git branch -D
-- Result: 208 branches deleted

-- 3. blocked_until 초기화
UPDATE hollon.tasks
SET blocked_until = NULL, error_message = NULL,
    retry_count = 0, last_failed_at = NULL
WHERE status IN ('ready', 'pending') AND blocked_until IS NOT NULL;
-- Result: 83 tasks unblocked
```

**결과**:

| Metric               | Before | After |
| -------------------- | ------ | ----- |
| Team Epics BLOCKED   | 6      | 0     |
| Team Epics COMPLETED | 0      | 6     |
| Executable Tasks     | 0      | 74    |
| Git Branches         | 208    | 0     |
| Tasks IN_PROGRESS    | 0      | 10    |
| Claude Processes     | 0      | 7     |

**시스템 상태 (12:18 KST)**:

- ✅ 10개 태스크 실행 중 (동시 실행 한도 도달)
- ✅ 7개 Claude 프로세스 활성
- ✅ 74개 실행 가능한 태스크 대기
- ✅ Fix #25가 향후 Epic 자동 완료 처리

**실행 중인 태스크**:

1. BackendDev-Bravo: Generate and test database migrations
2. DevOps-India: Create PromptComposer DTOs
3. DataEngineer-Foxtrot: Core Knowledge Graph Implementation
4. BackendDev-Charlie: Foundation Setup
5. BackendDev-Delta: Foundation: Core Module
6. MLEngineer-Golf: Add Repository Unit Tests
7. TechLead-Alpha: Define Knowledge entity
8. DataEngineer-Foxtrot: Setup Vector Search Infrastructure
9. BackendDev-Charlie: Implement edge case handling
10. DevOps-India: Implement conversation message extraction

---

**Last Updated**: 2026-01-06T12:18:00+09:00

---

### Issue #26: Epic Completion and Branch Cleanup Missing in autoMergePullRequest

**발견 시간**: 2026-01-07 00:30 KST

**증상**:

1. 6개 Team Epic이 수동으로 COMPLETED 처리됨 (자동 완료 안 됨)
2. 136개 Git 브랜치가 누적 (워크트리는 제거되었으나 브랜치는 남음)
3. 8개 BLOCKED 태스크가 COMPLETED 의존성을 가지고 있음에도 unblock 안 됨

**근본 원인**:

1. **autoMergePullRequest에 checkAndCompleteParentEpic 누락**
   - mergePullRequest (line 289)에는 있었으나
   - autoMergePullRequest (line 1338-1345)에는 없었음
   - Epic 완료가 자동 머지 시에만 작동 안 함

2. **cleanupTaskWorktree가 브랜치 삭제 안 함**
   - 워크트리만 `git worktree remove --force`
   - 브랜치는 남아있음
   - 주기적 정리 메커니즘 없음

**영향받는 코드**:

```typescript
// autoMergePullRequest (line 1334)
if (completedTask) {
  await this.checkAndTriggerParentTask(completedTask);
}
// ❌ checkAndCompleteParentEpic 호출 없음!

// cleanupTaskWorktree (line 1540-1557)
await execAsync(`git worktree remove ${worktreePath} --force`);
// ❌ 브랜치 삭제 없음!
```

**해결 (Fix #26)**:

```typescript
// 1. autoMergePullRequest에 Epic 완료 체크 추가 (line 1337-1339)
if (completedTask) {
  await this.checkAndTriggerParentTask(completedTask);
}

// Fix #26: Check if parent Epic should be completed
if (completedTask) {
  await this.checkAndCompleteParentEpic(completedTask);
}

// 2. cleanupTaskWorktree에 브랜치 삭제 추가 (line 1540-1571)
// Get branch name before removing worktree
let branchName: string | null = null;
try {
  const { stdout } = await execAsync(
    `git -C "${worktreePath}" rev-parse --abbrev-ref HEAD`,
  );
  branchName = stdout.trim();
} catch {}

// Remove worktree
await execAsync(`git worktree remove "${worktreePath}" --force`);

// Delete the branch
if (branchName && branchName !== 'main' && branchName !== 'HEAD') {
  await execAsync(`git branch -D "${branchName}"`);
}
```

**수동 정리 실행**:

```bash
# 1. 모든 워크트리 제거
git worktree list | grep ".git-worktrees" | awk '{print $1}' | \
  xargs -I {} git worktree remove --force {}
git worktree prune

# 2. 모든 로컬 브랜치 삭제 (feature/, wt-hollon- 패턴)
git branch | grep -E "(feature/|wt-hollon-)" | xargs -n 1 git branch -D

# 3. Completed 의존성 수동 unblock
WITH tasks_to_unblock AS (
  SELECT DISTINCT t.id
  FROM tasks t
  JOIN task_dependencies td ON t.id = td.task_id
  JOIN tasks dt ON td.depends_on_id = dt.id
  WHERE t.status = 'blocked' AND dt.status = 'completed'
)
UPDATE tasks
SET status = 'ready',
    metadata = metadata - 'blockedReason' - 'escalatedAt'
FROM tasks_to_unblock
WHERE tasks.id = tasks_to_unblock.id;
-- Result: 8 tasks unblocked
```

**결과**:

| Metric           | Before | After |
| ---------------- | ------ | ----- |
| BLOCKED 태스크   | 260    | 251   |
| READY 태스크     | 172    | 181   |
| COMPLETED 태스크 | 71     | 74    |
| 로컬 Git 브랜치  | 137    | 0     |
| 활성 워크트리    | 52     | 1     |

**예상 효과**:

- 향후 PR 머지 시 Epic 자동 완료 작동
- 브랜치 누적 방지
- unblockDependentTasks 로직이 정상 작동하면 자동 unblock

**상태**: ✅ 수정 완료 (dd49e38), 수동 정리 완료

---

### Issue #27: Main Branch Pollution and Missing Merge Conflict Resolution

**발견 시간**: 2026-01-07 00:50 KST

**증상**:

1. Main 브랜치에 `INTERFACE_DOCUMENTATION.md` 같은 파일이 오염됨 (워크트리에서 작업했어야 하는 파일)
2. Brain Provider를 통한 merge conflict 자동 해결이 TODO 상태로 미구현 (line 1518-1524)
3. 워크트리에서 생성된 feature 브랜치에 main 디렉토리에서 commit 가능

**근본 원인**:

1. **Main 브랜치 오염**:
   - Task `6b6ba359`의 `INTERFACE_DOCUMENTATION.md` 파일이 main 디렉토리에 먼저 생성됨 (`2026-01-07 00:51:10`)
   - 워크트리에는 1분 26초 후에 생성됨 (`2026-01-07 00:52:36`)
   - Claude Code가 워크트리가 아닌 main 디렉토리에서 파일 생성
   - Pre-commit hook이 워크트리 검증 안 함

2. **Merge Conflict 미해결**:
   - `autoResolveConflicts` 메소드에서 Brain Provider 호출 부분이 TODO로 남음
   - 충돌 발생 시 수동 개입 필요
   - CI retry 로직과 유사한 패턴으로 구현 가능

**영향받는 코드**:

```typescript
// goal-automation.listener.ts:1518-1524 (Before Fix #27)
// TODO: Use Brain Provider to resolve conflicts
// 1. Read conflict files
// 2. Build prompt with task context + conflict markers
// 3. Call Brain Provider to edit files
// 4. Stage resolved files
// 5. Continue rebase
```

**해결 (Fix #27)**:

#### Part 1: Brain Provider Merge Conflict Resolution

**1. resolveConflictsWithBrain 메소드 구현** (lines 1586-1668):

```typescript
private async resolveConflictsWithBrain(
  task: Task,
  conflictFiles: string[],
  worktreePath: string,
): Promise<boolean> {
  // Read all conflict files
  const conflictContents: Array<{ file: string; content: string }> = [];
  for (const file of conflictFiles) {
    const { stdout } = await execAsync(`cat "${file}"`, { cwd: worktreePath });
    conflictContents.push({ file, content: stdout });
  }

  // Build prompt with task context and conflict markers
  const prompt = this.buildConflictResolutionPrompt(task, conflictContents);

  // Execute Brain Provider with 5-minute timeout
  const result = await this.brainProvider.executeWithTracking(
    {
      prompt,
      context: { workingDirectory: worktreePath, taskId: task.id },
      options: { timeoutMs: 300000 },
    },
    { organizationId: task.organizationId, taskId: task.id },
  );

  if (!result.success) return false;

  // Stage all resolved files
  for (const { file } of conflictContents) {
    await execAsync(`git add "${file}"`, { cwd: worktreePath });
  }

  return true;
}
```

**2. buildConflictResolutionPrompt 메소드 구현** (lines 1670-1726):

```typescript
private buildConflictResolutionPrompt(
  task: Task,
  conflictContents: Array<{ file: string; content: string }>,
): string {
  return `
# Merge Conflict Resolution Task

You need to resolve merge conflicts in the following files for task: **${task.title}**

## Instructions

1. **Analyze each conflict**:
   - <<<<<<< HEAD marks the current branch changes
   - ======= separates the two versions
   - >>>>>>> marks the incoming changes from main branch

2. **Resolve conflicts intelligently**:
   - Keep changes that align with the task requirements
   - Preserve important functionality from both sides when possible
   - Remove conflict markers
   - Ensure the code is syntactically correct

3. **Edit each file** to remove conflict markers and merge the changes properly
`.trim();
}
```

**3. autoResolveConflicts에 통합** (lines 1520-1546):

```typescript
// 8. Fix #27: Attempt Brain Provider conflict resolution
const resolved = await this.resolveConflictsWithBrain(
  task,
  conflictFiles,
  worktreePath,
);

if (!resolved) {
  this.logger.error(
    `Brain Provider failed to resolve conflicts - aborting rebase`,
  );
  await execAsync(`git rebase --abort`, { cwd: worktreePath });
  return false;
}

// 9. Conflicts resolved - continue rebase
this.logger.log(`Continuing rebase after conflict resolution...`);
await execAsync(`git rebase --continue`, { cwd: worktreePath });

// 10. Force push resolved changes
this.logger.log(`Force pushing resolved changes...`);
await execAsync(`git push --force-with-lease`, { cwd: worktreePath });

this.logger.log(
  `✅ Successfully resolved conflicts and updated PR #${pr.prNumber}`,
);
return true;
```

#### Part 2: Pre-commit Hook for Worktree Validation

**파일**: `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Fix #27: Worktree path validation
# Prevent commits on feature branches from main directory (only allow from worktrees)

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)

# Check if we're in a worktree
if [ -f "$GIT_DIR" ]; then
  # This is a worktree (git dir is a file pointing to the actual git dir)
  IN_WORKTREE=true
else
  IN_WORKTREE=false
fi

# Check if this is a hollon-generated feature branch
if echo "$BRANCH" | grep -qE "^feature/(MLEngineer|Frontend|Backend|AILead|QALead|TechLead|CTO)-"; then
  if [ "$IN_WORKTREE" = false ]; then
    echo "❌ ERROR: Cannot commit to hollon-generated feature branch ($BRANCH) from main directory!"
    echo ""
    echo "This branch was created by a hollon in a worktree."
    echo "Commits should only be made from the worktree to prevent main branch pollution."
    echo ""
    echo "Current directory: $(pwd)"
    echo "Git dir: $GIT_DIR"
    echo ""
    echo "If you need to work on this task, please use the worktree or switch to main branch."
    exit 1
  fi
fi

# Warn if committing to main from non-worktree (but don't block - user might be doing manual work)
if [ "$BRANCH" = "main" ] && [ "$IN_WORKTREE" = false ]; then
  echo "⚠️  WARNING: Committing to main branch from main directory"
  echo "   This is allowed, but make sure you're not accidentally polluting main with worktree changes."
  echo ""
fi

npx lint-staged
```

**워크트리 감지 로직**:

- 워크트리에서는 `.git`이 파일 (실제 git dir을 가리키는 포인터)
- Main repo에서는 `.git`이 디렉토리
- Feature 브랜치 패턴: `^feature/(MLEngineer|Frontend|Backend|AILead|QALead|TechLead|CTO)-`

**즉시 조치**:

```bash
# 오염된 파일 제거
rm /Users/perry/Documents/Development/hollon-ai/apps/server/src/modules/knowledge-graph/INTERFACE_DOCUMENTATION.md

# Pre-commit hook 실행 권한 부여
chmod +x .husky/pre-commit
```

**예상 효과**:

1. **Merge Conflict 자동 해결**:
   - PR rebase 중 충돌 발생 시 Brain Provider가 자동으로 해결
   - 수동 개입 없이 충돌 해결 → rebase continue → force push
   - CI retry 로직과 동일한 패턴 적용

2. **Main 브랜치 오염 방지**:
   - Feature 브랜치에 main 디렉토리에서 commit 시도하면 차단
   - Main 브랜치는 경고만 표시 (수동 작업 허용)
   - 워크트리 격리 강화

#### Part 3: Worktree Path Construction Fix

**파일**: `apps/server/src/modules/goal/listeners/goal-automation.listener.ts`

**문제점**:

- 일부 태스크의 `workingDirectory` 메타데이터가 손실되거나 설정되지 않음
- 워크트리 경로를 찾을 수 없어서 conflict resolution 실패

**해결** (commit ceaad88):

```typescript
// If workingDirectory is not set, construct it from task and hollon IDs
if (!worktreePath) {
  if (!task.assignedHollonId) {
    this.logger.error(
      `Task ${task.id} has no workingDirectory and no assigned hollon`,
    );
    return false;
  }

  const hollonShortId = task.assignedHollonId.split('-')[0];
  const taskShortId = task.id.split('-')[0];
  const gitRoot = await execAsync('git rev-parse --show-toplevel').then((r) =>
    r.stdout.trim(),
  );
  worktreePath = path.join(
    gitRoot,
    '.git-worktrees',
    `hollon-${hollonShortId}`,
    `task-${taskShortId}`,
  );

  this.logger.log(
    `Fix #27 (part 3): Constructed worktree path from IDs: ${worktreePath}`,
  );
}
```

#### Part 4: Merge-Time Conflict Detection and Manager Re-Review

**파일**: `apps/server/src/modules/collaboration/services/code-review.service.ts`

**배경**:

- Part 1의 Brain Provider conflict resolution은 PR 생성 직후 (CI 실행 전)에만 작동
- Main 브랜치가 업데이트되면서 PR 머지 직전에 새로운 conflict 발생 가능
- **사용자 요구사항**: 자동 해결 성공 시에도 바로 머지하지 말고 매니저 리뷰 받기

**구현** (commit 0c5412b):

**1. Merge-time conflict detection** (mergePullRequest lines 244-321):

```typescript
// Fix #27 (Part 4): Final mergeable check before merge (second timing point)
if (pr.prUrl && process.env.NODE_ENV !== 'test') {
  this.logger.log(`Performing final mergeable check before merge: ${pr.prUrl}`);

  try {
    const mergeableStatus = await this.checkPRMergeable(pr.prUrl);

    if (mergeableStatus === 'CONFLICTING') {
      this.logger.warn(
        `PR #${pr.prNumber} has merge conflicts before merge, attempting auto-resolution...`,
      );

      // Attempt auto-conflict resolution with Brain Provider
      const resolved = await this.autoResolveConflictsBeforeMerge(pr.task, pr);

      if (!resolved) {
        // Conflict resolution failed - request manual intervention
        pr.status = PullRequestStatus.CHANGES_REQUESTED;
        pr.reviewComments =
          '[MERGE CONFLICT] Merge conflicts detected before merge. Automatic resolution failed.';
        await this.prRepo.save(pr);

        pr.task.status = TaskStatus.READY;
        await this.taskRepo.save(pr.task);

        throw new Error(
          'Merge conflicts detected and automatic resolution failed.',
        );
      }

      // Conflict resolution succeeded - request manager re-review (user requirement!)
      this.logger.log(
        `✅ Conflicts resolved for PR #${pr.prNumber} before merge. Requesting manager re-review...`,
      );

      pr.status = PullRequestStatus.READY_FOR_REVIEW;
      pr.reviewComments =
        '[AUTO-RESOLVED] Merge conflicts were automatically resolved by Brain Provider before merge. Please review the resolution before approving.';
      await this.prRepo.save(pr);

      throw new Error(
        'Merge conflicts were automatically resolved. Manager re-review required before merge.',
      );
    }
  } catch (error) {
    // Re-throw our custom errors, log other errors
    if (error instanceof Error && error.message.includes('Merge conflicts')) {
      throw error;
    }
    this.logger.warn(`Could not verify mergeable status: ${error}`);
  }
}
```

**2. Helper methods**:

```typescript
// Check if PR is mergeable using gh CLI
private async checkPRMergeable(prUrl: string): Promise<string> {
  const { stdout } = await execAsync(
    `gh pr view ${prUrl} --json mergeable,mergeStateStatus`,
  );
  const prStatus = JSON.parse(stdout.trim());

  if (prStatus.mergeable === 'CONFLICTING' || prStatus.mergeStateStatus === 'DIRTY') {
    return 'CONFLICTING';
  }

  return 'MERGEABLE';
}

// Get list of conflicting files
private async getConflictingFiles(worktreePath: string): Promise<string[]> {
  const { stdout } = await execAsync(
    `git diff --name-only --diff-filter=U`,
    { cwd: worktreePath },
  );
  return stdout.trim().split('\n').filter((file) => file.length > 0);
}

// Attempt to auto-resolve conflicts before merge
private async autoResolveConflictsBeforeMerge(
  task: Task,
  pr: TaskPullRequest,
): Promise<boolean> {
  // 1. Construct or retrieve worktree path (same logic as Part 3)
  // 2. Recreate worktree if needed
  // 3. Fetch latest main and rebase
  // 4. Detect conflicts
  // 5. Call Brain Provider (TODO - placeholder for now)
  // 6. Return true if resolved, false otherwise

  // Currently returns false (Brain Provider integration pending)
  return false;
}
```

**타이밍 포인트 비교**:

| Timing Point | Location           | When                     | Purpose                               |
| ------------ | ------------------ | ------------------------ | ------------------------------------- |
| **Timing 1** | `autoCheckPRCI`    | PR 생성 직후, CI 실행 전 | 초기 conflict 방지                    |
| **Timing 2** | `mergePullRequest` | CI 통과 후, 머지 직전    | Main 업데이트로 인한 새 conflict 방지 |

**핵심 차이점**:

- Timing 1: 자동 해결 후 CI 재실행
- Timing 2: 자동 해결 후 **매니저 리뷰 요청** (바로 머지하지 않음)

**상태**: ✅ Part 3-4 구현 완료 (ceaad88, 0c5412b)

**미구현 사항**:

- Brain Provider integration in `code-review.service.ts` (placeholder method `resolveConflictsWithBrainProvider` returns false)
- 실제 conflict resolution은 수동 개입 필요

---

### Issue #28: Uncommitted Changes Block Rebase in Conflict Resolution

**발견 시간**: 2026-01-07 09:30 KST

**증상**:

- autoCheckPRCI가 merge conflict 해결을 시도할 때 rebase 실패
- 에러 메시지: `rebase 할 수 없습니다: 인덱스에 커밋하지 않은 변경 사항이 있습니다`
- PR #159, #180 등 여러 PR이 CONFLICTING 상태로 blocked 유지
- 워크트리에 uncommitted changes가 있어 rebase 불가

**근본 원인**:

- 워크트리에서 작업 중 uncommitted changes가 남아있음
- `git rebase origin/main` 명령은 working tree가 clean해야 실행 가능
- 이전 작업에서 남은 변경사항이나 Brain Provider가 생성한 파일이 uncommitted 상태로 남음

**영향받는 코드**:

```typescript
// goal-automation.listener.ts (before fix)
// 4. Rebase on main
this.logger.log(`Attempting rebase on origin/main...`);
try {
  await execAsync(`git rebase origin/main`, { cwd: worktreePath });
  // ❌ uncommitted changes가 있으면 실패!
```

**해결 (Fix #28)**:

```typescript
// goal-automation.listener.ts:1618-1662
// 4. Check for uncommitted changes and stash if needed
const { stdout: statusCheck } = await execAsync(
  `git status --porcelain`,
  { cwd: worktreePath },
);
const hasUncommittedChanges = statusCheck.trim().length > 0;

if (hasUncommittedChanges) {
  this.logger.log(
    `Found uncommitted changes, stashing before rebase...`,
  );
  await execAsync(
    `git stash push -m "autoCheckPRCI: temp stash for rebase"`,
    { cwd: worktreePath },
  );
}

// 5. Rebase on main
this.logger.log(`Attempting rebase on origin/main...`);
try {
  await execAsync(`git rebase origin/main`, { cwd: worktreePath });
  this.logger.log(`✅ Rebase successful without conflicts`);

  // 6. Restore stashed changes if we stashed
  if (hasUncommittedChanges) {
    this.logger.log(`Restoring stashed changes...`);
    try {
      await execAsync(`git stash pop`, { cwd: worktreePath });
    } catch (stashPopError) {
      this.logger.warn(
        `Failed to pop stash (may have conflicts): ${stashPopError instanceof Error ? stashPopError.message : 'Unknown error'}`,
      );
      // Continue anyway - the rebase succeeded
    }
  }

  // 7. Force push (since rebase rewrites history)
  this.logger.log(`Force pushing resolved changes...`);
  await execAsync(`git push --force-with-lease`, { cwd: worktreePath });
```

**변경 사항 요약**:

1. Rebase 전에 `git status --porcelain`으로 uncommitted changes 확인
2. 변경사항이 있으면 `git stash push`로 임시 저장
3. Rebase 수행
4. Rebase 성공 후 `git stash pop`으로 변경사항 복원
5. Stash pop 실패 시 경고만 출력하고 계속 진행 (rebase는 성공했으므로)

**예상 효과**:

- Uncommitted changes가 있어도 rebase 가능
- Conflict resolution workflow가 더 robust해짐
- 이전에 stuck되었던 PR들이 다시 처리 가능

**남은 이슈**:

- PR #159, #180은 여전히 actual merge conflicts 존재
- Brain Provider를 통한 conflict resolution이 필요하지만 현재 placeholder 상태
- 실제 conflict 파일을 Brain Provider가 수정하고 commit하는 로직 구현 필요

**상태**: ✅ 수정 완료 (cba3454)

---

### Issue #29: Orphaned PRs - Tasks with PRs not in IN_REVIEW status

**발견 시간**: 2026-01-07 13:15 KST

**증상**:

- GitHub에 PR이 존재하지만 해당 태스크가 `in_review` 상태가 아님
- `blocked`, `in_progress`, `waiting_for_hollon` 등 다른 상태로 남아있음
- `autoCheckPRCI` cron이 이 태스크들을 무시함

**영향받는 태스크**:

| Task ID  | PR # | 발견 시 상태       | PR 상태 |
| -------- | ---- | ------------------ | ------- |
| 61af2f9b | #197 | in_progress        | CLEAN   |
| f5b1688c | #192 | in_progress        | CLEAN   |
| 131f0155 | #172 | blocked            | CLEAN   |
| 315e03d8 | #120 | blocked            | CLEAN   |
| 8407e733 | #145 | blocked            | CLEAN   |
| 4242eac6 | #112 | blocked            | CLEAN   |
| f329e52c | #105 | waiting_for_hollon | CLEAN   |

**근본 원인**:

1. PR 생성 후 태스크 상태 업데이트 전에 에러/서버 크래시 발생
2. 외부 API (GitHub PR 생성)와 DB 업데이트가 트랜잭션으로 묶이지 않음
3. GitHub PR은 생성되었지만 DB 상태는 이전 상태로 남음

**임시 해결**:

```bash
# 수동으로 태스크 상태 in_review로 전환
curl -X PATCH "http://localhost:3001/api/tasks/{task_id}" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_review"}'
```

**결과**:

| Task ID  | 전환 후 상태                 | 최종 상태        |
| -------- | ---------------------------- | ---------------- |
| 61af2f9b | in_review → ready_for_review | ✅ **completed** |
| f5b1688c | in_review → ready_for_review | ✅ **completed** |
| 131f0155 | in_review → ready_for_review | ✅ **completed** |
| 315e03d8 | in_review → ready_for_review | ✅ **completed** |
| 8407e733 | in_review → ready_for_review | ✅ **completed** |
| 4242eac6 | in_review → ready_for_review | ✅ **completed** |
| f329e52c | in_review → ready_for_review | ✅ **completed** |

**재발 방지 권장안**:

1. **트랜잭션 적용** (중요도: 높음)

   ```typescript
   // PR 레코드 저장 + 태스크 상태 업데이트를 트랜잭션으로 묶기
   await this.dataSource.transaction(async (manager) => {
     await manager.save(TaskPullRequest, { taskId, prUrl, ... });
     await manager.update(Task, taskId, { status: TaskStatus.IN_REVIEW });
   });
   ```

2. **Orphaned PR Sync Cron** (중요도: 중간)
   ```typescript
   @Cron('*/5 * * * *')
   async syncOrphanedPRTasks(): Promise<void> {
     // PR이 있지만 IN_REVIEW가 아닌 태스크 찾아서 자동 전환
   }
   ```

**영구적 해결 구현 (Fix #29)**:

1. **트랜잭션 적용** (`code-review.service.ts`)

   ```typescript
   // PR 저장 + Task 상태 업데이트를 원자적으로 처리
   const pr = await this.dataSource.transaction(async (manager) => {
     const prRepository = manager.getRepository(TaskPullRequest);
     const newPr = await prRepository.save({
       taskId: dto.taskId,
       prNumber: dto.prNumber,
       ...
     });

     const taskRepository = manager.getRepository(Task);
     await taskRepository.update(dto.taskId, {
       status: TaskStatus.IN_REVIEW,
     });

     return newPr;
   });
   ```

2. **Orphaned PR Sync Cron** (`goal-automation.listener.ts`)

   ```typescript
   @Cron('*/5 * * * *') // 5분마다
   async syncOrphanedPRs(): Promise<void> {
     // PR이 있지만 IN_REVIEW/READY_FOR_REVIEW/COMPLETED/BLOCKED가 아닌 태스크
     const orphanedPRs = await this.prRepo
       .createQueryBuilder('pr')
       .leftJoinAndSelect('pr.task', 'task')
       .where('task.status NOT IN (:...expectedStatuses)', {
         expectedStatuses: ['in_review', 'ready_for_review', 'completed', 'blocked'],
       })
       .getMany();

     // 자동으로 IN_REVIEW로 전환
     for (const pr of orphanedPRs) {
       await this.taskRepo.update(pr.task.id, { status: TaskStatus.IN_REVIEW });
     }
   }
   ```

**상태**: ✅ 수동 해결 완료 + 영구적 수정 구현 완료

---

### PR Cleanup (2026-01-07 13:20 KST)

**정리한 PR**:

| PR   | 이유                              | 조치   |
| ---- | --------------------------------- | ------ |
| #196 | impl-\* hollon (삭제됨)           | Closed |
| #115 | impl-\* hollon (삭제됨)           | Closed |
| #97  | impl-\* hollon (삭제됨)           | Closed |
| #101 | 중복 (task-d6718ea6, #180과 동일) | Closed |
| #176 | 중복 (task-67fec5f3, #178과 동일) | Closed |

**PR 상태 (정리 후)**:

| 상태     | 개수 | 설명           |
| -------- | ---- | -------------- |
| DIRTY    | 17   | Merge conflict |
| UNSTABLE | 12   | CI 실패        |
| CLEAN    | 0    | 모두 머지됨    |

**머지된 PR (자동화)**:

| PR   | 머지 시간 | 태스크                       |
| ---- | --------- | ---------------------------- |
| #197 | 13:25:33  | Analyze KnowledgeGraphModule |
| #192 | 13:26:04  | Review VectorSearchModule    |

---

**Last Updated**: 2026-01-07T13:40:00+09:00
