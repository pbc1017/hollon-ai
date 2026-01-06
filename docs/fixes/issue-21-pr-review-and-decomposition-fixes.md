# Issue #21: PR Review & Task Decomposition Fixes

## Executive Summary

Two critical issues discovered in Phase 4.1:

1. **PR reviews not happening**: Missing `reviewerHollonId` prevents manager review cycle
2. **Tasks failing with no commits**: Missing `ImplementationSpecialist` role causes decomposition failure

This document provides comprehensive solutions with recurrence prevention.

---

## Problem 1: PR Reviews Not Working

### Root Cause Analysis

**Location**: `apps/server/src/modules/orchestration/services/task-execution.service.ts:2364`

```typescript
// ❌ Current code - reviewerHollonId NOT set
await this.taskRepo.update(parentTask.id, {
  status: TaskStatus.READY_FOR_REVIEW,
  assignedHollonId: parentTask.assignedHollonId,
  // reviewerHollonId: MISSING!
});
```

**Impact**: Manager review query cannot find tasks

```typescript
// hollon-orchestrator.service.ts:1075
.andWhere('task.reviewerHollonId = :reviewerId', {
  reviewerId: managerHollon.id,  // ← NULL tasks are filtered out!
})
```

**Affected**: All 14 open PRs have tasks stuck in READY_FOR_REVIEW without reviewerHollonId

---

### Solution 1A: Immediate Fix (One-time)

**Goal**: Restore review flow for existing tasks

**Step 1**: Identify manager for each task

```sql
-- Find tasks in READY_FOR_REVIEW without reviewerHollonId
SELECT
  t.id,
  t.title,
  t.assigned_hollon_id,
  h.name as assignee_name,
  h.team_id,
  team.manager_hollon_id
FROM hollon.tasks t
LEFT JOIN hollon.hollons h ON t.assigned_hollon_id = h.id
LEFT JOIN hollon.teams team ON h.team_id = team.id
WHERE t.status = 'ready_for_review'
  AND t.reviewer_hollon_id IS NULL
ORDER BY t.created_at;
```

**Step 2**: Set reviewerHollonId based on team hierarchy

```sql
-- Set reviewerHollonId to team manager
UPDATE hollon.tasks t
SET reviewer_hollon_id = (
  SELECT team.manager_hollon_id
  FROM hollon.hollons h
  LEFT JOIN hollon.teams team ON h.team_id = team.id
  WHERE h.id = t.assigned_hollon_id
)
WHERE t.status = 'ready_for_review'
  AND t.reviewer_hollon_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM hollon.hollons h
    LEFT JOIN hollon.teams team ON h.team_id = team.id
    WHERE h.id = t.assigned_hollon_id
      AND team.manager_hollon_id IS NOT NULL
  );

-- Log results
SELECT
  COUNT(*) as updated_count,
  STRING_AGG(DISTINCT reviewer_hollon_id::text, ', ') as reviewers
FROM hollon.tasks
WHERE status = 'ready_for_review'
  AND reviewer_hollon_id IS NOT NULL;
```

**Expected Result**:

- 14 tasks updated with reviewerHollonId
- Manager review cycle will pick them up on next run (every 1-2 minutes)

---

### Solution 1B: Permanent Fix (Code Change)

**Goal**: Prevent reviewerHollonId from being NULL in future

**Location**: `apps/server/src/modules/orchestration/services/task-execution.service.ts`

**Change 1**: Set reviewerHollonId when transitioning to READY_FOR_REVIEW

```typescript
// Line 2358-2370
// ✅ NEW CODE - Set reviewerHollonId
async markParentTaskReadyForReview(parentTask: Task): Promise<void> {
  // Determine reviewer (team manager)
  const assignedHollon = await this.hollonRepo.findOne({
    where: { id: parentTask.assignedHollonId },
    relations: ['team'],
  });

  if (!assignedHollon?.team?.managerHollonId) {
    this.logger.warn(
      `Cannot set reviewerHollonId for task ${parentTask.id}: no team manager found`,
    );
    // Fallback: use parent task's creator as reviewer
    const reviewerId = parentTask.creatorHollonId || parentTask.assignedHollonId;

    await this.taskRepo.update(parentTask.id, {
      status: TaskStatus.READY_FOR_REVIEW,
      assignedHollonId: parentTask.assignedHollonId,
      reviewerHollonId: reviewerId,
    });
    return;
  }

  this.logger.log(
    `✅ All ${siblings.length} subtasks completed for parent task ${parentTask.id.slice(0, 8)}, ` +
    `marking as READY_FOR_REVIEW for manager ${assignedHollon.team.managerHollonId.slice(0, 8)} review`,
  );

  // Mark parent task as READY_FOR_REVIEW with reviewerHollonId
  await this.taskRepo.update(parentTask.id, {
    status: TaskStatus.READY_FOR_REVIEW,
    assignedHollonId: parentTask.assignedHollonId,
    reviewerHollonId: assignedHollon.team.managerHollonId, // ✅ SET REVIEWER!
  });

  this.logger.log(
    `Parent task ${parentTask.id.slice(0, 8)} marked as READY_FOR_REVIEW, ` +
    `reviewer: ${assignedHollon.team.managerHollonId.slice(0, 8)}, awaiting manager review before PR creation`,
  );
}
```

**Change 2**: Add validation to prevent NULL reviewerHollonId

```typescript
// NEW: Add validation in TaskService or as database constraint
async validateReadyForReview(task: Task): Promise<void> {
  if (task.status === TaskStatus.READY_FOR_REVIEW && !task.reviewerHollonId) {
    throw new Error(
      `Task ${task.id} transitioned to READY_FOR_REVIEW without reviewerHollonId! ` +
      `This prevents manager review cycle from finding the task.`,
    );
  }
}
```

**Change 3**: Add database constraint (optional but recommended)

```typescript
// NEW MIGRATION: Add check constraint
export class AddReviewerHollonIdConstraint1736600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE hollon.tasks
      ADD CONSTRAINT check_ready_for_review_has_reviewer
      CHECK (
        status != 'ready_for_review' OR reviewer_hollon_id IS NOT NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE hollon.tasks
      DROP CONSTRAINT IF EXISTS check_ready_for_review_has_reviewer;
    `);
  }
}
```

---

### Solution 1C: Testing & Monitoring

**Test 1**: Unit test for reviewerHollonId assignment

```typescript
// apps/server/src/modules/orchestration/services/task-execution.service.spec.ts
describe('markParentTaskReadyForReview', () => {
  it('should set reviewerHollonId to team manager when marking READY_FOR_REVIEW', async () => {
    const parentTask = createMockTask({ id: 'parent-1' });
    const teamManager = createMockHollon({ id: 'manager-1' });
    const assignedHollon = createMockHollon({
      id: 'worker-1',
      team: { managerHollonId: teamManager.id },
    });

    await service.markParentTaskReadyForReview(parentTask);

    expect(taskRepo.update).toHaveBeenCalledWith(
      parentTask.id,
      expect.objectContaining({
        status: TaskStatus.READY_FOR_REVIEW,
        reviewerHollonId: teamManager.id, // ✅ Must be set!
      }),
    );
  });

  it('should throw error if no team manager found', async () => {
    const parentTask = createMockTask({ id: 'parent-1' });
    const assignedHollon = createMockHollon({
      id: 'worker-1',
      team: { managerHollonId: null }, // ❌ No manager
    });

    // Should use fallback or throw error
    await expect(
      service.markParentTaskReadyForReview(parentTask),
    ).rejects.toThrow(/no team manager found/);
  });
});
```

**Test 2**: Integration test for manager review cycle

```typescript
// apps/server/test/orchestration/manager-review-cycle.e2e-spec.ts
describe('Manager Review Cycle (Fix #21)', () => {
  it('should find and review tasks with reviewerHollonId set', async () => {
    // 1. Create task and mark READY_FOR_REVIEW
    const task = await createTask({ assignedHollonId: worker.id });
    await taskExecutionService.markParentTaskReadyForReview(task);

    // 2. Verify reviewerHollonId is set
    const updatedTask = await taskRepo.findOne({ where: { id: task.id } });
    expect(updatedTask.reviewerHollonId).toBe(manager.id);
    expect(updatedTask.status).toBe(TaskStatus.READY_FOR_REVIEW);

    // 3. Run manager review cycle
    await orchestratorService.handleManagerReviewCycle(manager);

    // 4. Verify task was found and processed
    const reviewedTask = await taskRepo.findOne({ where: { id: task.id } });
    expect(reviewedTask.status).toBe(TaskStatus.IN_REVIEW);
  });
});
```

**Monitoring**: Add metric tracking

```typescript
// NEW: Track reviewerHollonId assignment success rate
this.logger.log(
  `Metrics: Tasks marked READY_FOR_REVIEW with reviewerHollonId: ${withReviewer}/${total}`,
);

if (withReviewer < total) {
  this.logger.error(
    `⚠️  ${total - withReviewer} tasks marked READY_FOR_REVIEW without reviewerHollonId! Fix #21 recurrence!`,
  );
}
```

---

## Problem 2: Tasks Failing with No Commits

### Root Cause Analysis

**Location**: `apps/server/src/modules/orchestration/services/hollon-orchestrator.service.ts`

**Flow**:

1. Brain decides to decompose task → `DECOMPOSE_TASK`
2. System queries for `ImplementationSpecialist` role
3. Role not found → decomposition fails
4. Task doesn't decompose AND doesn't execute directly
5. No commits made → PR creation fails

**Log Evidence**:

```
🤖 Brain's decomposition decision:
   Should decompose: true

[WARN] Role ImplementationSpecialist not found for organization ...

⚠️  PR creation failed: No commits to create PR -
    task made no changes
```

**Affected Tasks**:

- `Add repository tests`
- `Create VectorSearchService with dependency injection setup`
- `Add placeholder methods and service documentation`

All assigned to MLEngineer-Golf

---

### Solution 2A: Immediate Fix (One-time)

**Goal**: Create missing roles for decomposition

**Step 1**: Check current roles

```sql
-- List all roles and their availability for temporary hollons
SELECT
  name,
  available_for_temporary_hollon,
  organization_id,
  COUNT(*) OVER (PARTITION BY organization_id) as org_role_count
FROM hollon.roles
ORDER BY organization_id, name;
```

**Step 2**: Create missing ImplementationSpecialist role

```sql
-- Insert ImplementationSpecialist role for each organization
INSERT INTO hollon.roles (
  id,
  name,
  description,
  system_prompt,
  capabilities,
  available_for_temporary_hollon,
  organization_id
)
SELECT
  gen_random_uuid(),
  'ImplementationSpecialist',
  'Specialist role for implementing specific code changes based on detailed specifications',
  'You are an implementation specialist. Focus on writing clean, tested code that exactly matches the given specifications. Follow the project''s coding standards and patterns.',
  ARRAY['typescript', 'implementation', 'testing', 'code-quality'],
  true,
  org.id
FROM hollon.organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM hollon.roles r
  WHERE r.name = 'ImplementationSpecialist'
    AND r.organization_id = org.id
);
```

**Step 3**: Retry failed tasks

```sql
-- Reset tasks that failed due to missing role
UPDATE hollon.tasks
SET
  status = 'ready',
  error_message = NULL,
  retry_count = 0,
  blocked_until = NULL
WHERE error_message LIKE '%Role%not found%'
   OR (status = 'completed' AND metadata->>'hasCommits' = 'false');

-- Count affected tasks
SELECT COUNT(*) as tasks_to_retry
FROM hollon.tasks
WHERE status = 'ready'
  AND updated_at > NOW() - INTERVAL '1 day';
```

---

### Solution 2B: Permanent Fix (Code Change)

**Goal**: Prevent silent failures when roles are missing

**Change 1**: Add fallback when role not found

```typescript
// apps/server/src/modules/orchestration/services/task-execution.service.ts
// Line ~450 where role lookup happens

async decomposeTask(task: Task, hollon: Hollon): Promise<void> {
  // ... existing decomposition logic ...

  for (const subtaskSpec of decomposition.subtasks) {
    // Try to find role
    const role = availableRoles.find((r) => r.name === subtaskSpec.roleName);

    if (!role) {
      this.logger.warn(
        `Role ${subtaskSpec.roleName} not found - using fallback role or direct execution`,
      );

      // ✅ OPTION A: Use fallback role (same as parent hollon)
      const fallbackRole = hollon.role;

      // ✅ OPTION B: Use generic ImplementationSpecialist if available
      const fallbackRole = availableRoles.find(r =>
        r.name === 'ImplementationSpecialist' ||
        r.name === 'Engineer'
      ) || hollon.role;

      this.logger.log(
        `Using fallback role ${fallbackRole.name} for subtask "${subtaskSpec.title}"`,
      );

      // Continue with fallback role instead of skipping
      // ... create subtask with fallbackRole ...
      continue;
    }

    // ... rest of subtask creation logic ...
  }

  // ✅ NEW: Check if ANY subtasks were created
  if (subtaskMap.size === 0) {
    this.logger.error(
      `Decomposition failed: No subtasks created for task ${task.id}! ` +
      `All roles were missing. Falling back to direct execution.`,
    );

    // Fall back to direct execution
    return this.executeTaskDirectly(task, hollon);
  }
}
```

**Change 2**: Better error handling in handleComplexTask

```typescript
// hollon-orchestrator.service.ts handleComplexTask method
private async handleComplexTask(task: Task, hollon: Hollon): Promise<boolean> {
  try {
    // ... existing logic ...

    // NEW: Validate roles are available
    if (availableRoles.length === 0) {
      this.logger.warn(
        'No roles available for temporary hollons - falling back to direct execution',
      );
      return false; // ✅ Fallback works correctly
    }

    // ... decomposition logic ...

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // ✅ NEW: Specific handling for role-related errors
    if (errorMessage.includes('Role') && errorMessage.includes('not found')) {
      this.logger.warn(
        `Task ${task.id} decomposition failed due to missing roles. ` +
        `Falling back to direct execution.`,
      );
      return false; // Fallback to direct execution
    }

    // ... existing error handling ...
  }
}
```

**Change 3**: Ensure required roles exist at startup

```typescript
// NEW SERVICE: RoleValidationService
@Injectable()
export class RoleValidationService implements OnModuleInit {
  private readonly logger = new Logger(RoleValidationService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  async onModuleInit() {
    await this.ensureRequiredRoles();
  }

  private async ensureRequiredRoles(): Promise<void> {
    const requiredRoles = [
      'ImplementationSpecialist',
      'Engineer', // Fallback
      'Code Reviewer',
    ];

    const organizations = await this.orgRepo.find();

    for (const org of organizations) {
      for (const roleName of requiredRoles) {
        const exists = await this.roleRepo.findOne({
          where: { name: roleName, organizationId: org.id },
        });

        if (!exists) {
          this.logger.warn(
            `Required role "${roleName}" missing for org ${org.id}. ` +
              `Creating with default configuration...`,
          );

          await this.createDefaultRole(roleName, org.id);
        }
      }
    }

    this.logger.log('✅ All required roles validated');
  }

  private async createDefaultRole(
    roleName: string,
    orgId: string,
  ): Promise<void> {
    const roleConfig = this.getDefaultRoleConfig(roleName);

    const role = this.roleRepo.create({
      name: roleName,
      organizationId: orgId,
      availableForTemporaryHollon: true,
      ...roleConfig,
    });

    await this.roleRepo.save(role);
    this.logger.log(`Created role "${roleName}" for organization ${orgId}`);
  }

  private getDefaultRoleConfig(roleName: string) {
    const configs = {
      ImplementationSpecialist: {
        description: 'Specialist for implementing code changes',
        systemPrompt:
          'You are an implementation specialist. Write clean, tested code.',
        capabilities: ['typescript', 'implementation', 'testing'],
      },
      Engineer: {
        description: 'General-purpose engineer role',
        systemPrompt:
          'You are a software engineer. Implement features following best practices.',
        capabilities: ['typescript', 'implementation', 'general'],
      },
      'Code Reviewer': {
        description: 'Specialist for reviewing code changes',
        systemPrompt:
          'You are a code reviewer. Review for quality, security, and best practices.',
        capabilities: ['code-review', 'quality-assurance'],
      },
    };

    return (
      configs[roleName] || {
        description: `Default ${roleName} role`,
        systemPrompt: `You are a ${roleName}.`,
        capabilities: ['general'],
      }
    );
  }
}
```

---

### Solution 2C: Testing & Monitoring

**Test 1**: Role fallback logic

```typescript
describe('Task Decomposition with Missing Roles (Fix #21)', () => {
  it('should fall back to direct execution when role not found', async () => {
    const task = createMockTask({ estimatedComplexity: 'high' });
    const hollon = createMockHollon({ roleId: 'engineer-role' });

    // Mock: No ImplementationSpecialist role available
    jest.spyOn(roleRepo, 'find').mockResolvedValue([]);

    const result = await orchestrator.handleComplexTask(task, hollon);

    // Should return false to trigger direct execution fallback
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No roles available')
    );
  });

  it('should use fallback role when specific role not found', async () => {
    const task = createMockTask();
    const engineer Role = createMockRole({ name: 'Engineer' });

    // Mock: Only Engineer role available (no ImplementationSpecialist)
    jest.spyOn(roleRepo, 'find').mockResolvedValue([engineerRole]);

    // Brain suggests ImplementationSpecialist but it doesn't exist
    const decomposition = {
      subtasks: [{
        roleName: 'ImplementationSpecialist',
        title: 'Test task',
      }],
    };

    await service.decomposeTask(task, hollon, decomposition);

    // Should use Engineer as fallback
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('Using fallback role Engineer')
    );
  });
});
```

**Test 2**: Role validation on startup

```typescript
describe('RoleValidationService (Fix #21)', () => {
  it('should create missing required roles on module init', async () => {
    const org = createMockOrganization();

    // Mock: No roles exist
    jest.spyOn(roleRepo, 'findOne').mockResolvedValue(null);

    await roleValidationService.onModuleInit();

    // Should create ImplementationSpecialist, Engineer, Code Reviewer
    expect(roleRepo.save).toHaveBeenCalledTimes(3);
    expect(roleRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ImplementationSpecialist' }),
    );
  });
});
```

**Monitoring**: Track decomposition failures

```typescript
// Add metric in task-execution.service.ts
private async decomposeTask(...) {
  const metricsStart = {
    taskId: task.id,
    requestedRoles: decomposition.subtasks.map(s => s.roleName),
  };

  try {
    // ... decomposition logic ...

    this.logger.log(
      `✅ Decomposition success: ${subtaskMap.size}/${decomposition.subtasks.length} subtasks created`,
    );
  } catch (error) {
    this.logger.error(
      `❌ Decomposition failed for task ${task.id}: ${error.message}`,
      {
        requestedRoles: metricsStart.requestedRoles,
        availableRoles: availableRoles.map(r => r.name),
        error: error.message,
      }
    );
    throw error;
  }
}
```

---

## Implementation Checklist

### Phase 1: Immediate Fixes (No Code Changes)

- [ ] Run SQL to set reviewerHollonId for 14 READY_FOR_REVIEW tasks
- [ ] Verify manager review cycle picks up tasks (check logs in 2 minutes)
- [ ] Run SQL to create ImplementationSpecialist role for all organizations
- [ ] Reset failed tasks to READY status for retry
- [ ] Monitor next 10 task executions for successful decomposition

### Phase 2: Code Changes (Permanent Fixes)

- [ ] **Fix #21-A**: Update task-execution.service.ts to set reviewerHollonId
- [ ] **Fix #21-B**: Add fallback logic when roles are missing
- [ ] **Fix #21-C**: Create RoleValidationService with onModuleInit
- [ ] **Fix #21-D**: Add database constraint for reviewerHollonId (optional)
- [ ] Write unit tests for reviewerHollonId assignment
- [ ] Write unit tests for role fallback logic
- [ ] Write integration test for manager review cycle

### Phase 3: Testing & Validation

- [ ] Run all unit tests and verify passing
- [ ] Run integration tests for both scenarios
- [ ] Manual test: Create task, decompose, verify reviewerHollonId set
- [ ] Manual test: Decompose with missing role, verify fallback works
- [ ] Load test: 20 concurrent tasks with reviews

### Phase 4: Monitoring & Documentation

- [ ] Add metrics dashboard for reviewerHollonId assignment rate
- [ ] Add alerts for decomposition failures due to missing roles
- [ ] Update team runbook with troubleshooting steps
- [ ] Document required roles in README

---

## Expected Outcomes

### Immediate (After Phase 1)

- ✅ 14 open PRs will be reviewed by managers within 2 minutes
- ✅ Failed tasks will retry and complete successfully
- ✅ No more "No commits to create PR" errors

### Long-term (After Phase 2-4)

- ✅ 100% of READY_FOR_REVIEW tasks have reviewerHollonId set
- ✅ 0 decomposition failures due to missing roles
- ✅ Automatic role creation on system startup
- ✅ Graceful fallback when unexpected roles are missing
- ✅ Comprehensive test coverage prevents recurrence

---

## Rollback Plan

If issues occur after deployment:

### Rollback Fix #21-A (reviewerHollonId)

```sql
-- Revert to manual review assignment
UPDATE hollon.tasks
SET reviewer_hollon_id = NULL
WHERE status = 'ready_for_review'
  AND updated_at > NOW() - INTERVAL '1 hour';
```

### Rollback Fix #21-B (Role fallback)

- Revert code changes
- Ensure ImplementationSpecialist role exists in all organizations
- No data changes needed

### Rollback Fix #21-C (RoleValidationService)

- Remove service from module imports
- No impact on existing data

---

## Timeline

- **Phase 1 (Immediate)**: 30 minutes
- **Phase 2 (Code Changes)**: 4-6 hours
- **Phase 3 (Testing)**: 2-3 hours
- **Phase 4 (Monitoring)**: 1-2 hours

**Total**: 1-2 days for complete solution with testing and monitoring
