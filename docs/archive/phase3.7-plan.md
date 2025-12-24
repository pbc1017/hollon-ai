# 🚀 Phase 3.7: 완전 자율 실행 인프라 구축

> **작성일**: 2025-12-10
> **목표**: Phase 4를 100% 자율 실행하기 위한 필수 인프라 및 안전장치 구축
> **범위**: Option B (완전 자율 구현)
> **예상 소요**: 6-7시간

---

## 🎯 Executive Summary

### 목표

**Phase 4를 완전 자율 실행(100% 자율성)하기 위한 인프라 완성**

현재 Phase 3.5까지 구현된 자율성: **85%**

- ✅ 자동 Task 할당 (autoAssign)
- ✅ 자동 PR 생성 (TaskExecutionService)
- ✅ 자동 Code Review (CodeReviewService)
- ✅ 자동 PR 병합 (AutoMergeService)
- ❌ **Task 자동 시작 메커니즘 없음** ← Phase 3.7에서 해결
- ❌ **Sub-Hollon 생성 없음** ← 복잡한 Task 품질 향상

Phase 3.7 완료 후: **100% 자율성**

- ✅ HollonExecutionService (Cron 기반 자동 Task 시작)
- ✅ Sub-Hollon 생성 및 분배 (Planner/Analyzer/Coder 패턴)
- ✅ 6개 안전장치 (무한 루프 방지, Emergency Stop 등)

### 성과

| 항목                 | Phase 3.5          | Phase 3.7 목표         |
| -------------------- | ------------------ | ---------------------- |
| **자율성**           | 85%                | 100% ✅                |
| **인간 개입**        | Task마다 수동 시작 | Goal 생성 1회만 ✅     |
| **복잡한 Task 품질** | 중간               | 높음 (Sub-Hollon) ✅   |
| **안정성**           | 보통               | 높음 (6개 안전장치) ✅ |
| **Phase 4 준비도**   | 85%                | 100% ✅                |

---

## 📋 구현 범위 (Option B)

### ✅ P0: 필수 구현 (Phase 4 시작 전 반드시 완료)

#### 1. HollonExecutionService (1시간)

**목적:** IDLE + assignedTask 있는 Hollon을 자동으로 감지하여 runCycle() 실행

**구현:**

```typescript
// apps/server/src/modules/orchestration/services/hollon-execution.service.ts

@Injectable()
export class HollonExecutionService {
  private readonly logger = new Logger(HollonExecutionService.name);
  private executingHollons = new Set<string>();

  constructor(
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    private readonly orchestrator: HollonOrchestratorService,
  ) {}

  /**
   * 매 10초마다 할당된 Task가 있는 IDLE Hollon 실행
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async executeAssignedHollons(): Promise<void> {
    try {
      this.logger.debug('Checking for hollons with assigned tasks...');

      // 1. Organization별로 체크 (동시 실행 제한 적용)
      const orgs = await this.orgRepo.find();

      for (const org of orgs) {
        // Emergency Stop 체크
        const settings = org.settings as OrganizationSettings;
        if (!settings?.autonomousExecutionEnabled) {
          this.logger.warn(
            `Autonomous execution disabled for org ${org.id}: ${settings?.emergencyStopReason || 'Unknown'}`,
          );
          continue;
        }

        // 동시 실행 제한 체크
        const canExecute = await this.checkConcurrencyLimit(org.id);
        if (!canExecute) {
          continue;
        }

        // 2. IDLE + assignedTask 있는 Hollon 조회
        const hollons = await this.hollonRepo
          .createQueryBuilder('hollon')
          .leftJoinAndSelect('hollon.assignedTasks', 'task')
          .where('hollon.organizationId = :orgId', { orgId: org.id })
          .andWhere('hollon.status = :status', { status: HollonStatus.IDLE })
          .andWhere('task.status IN (:...statuses)', {
            statuses: [TaskStatus.READY, TaskStatus.PENDING],
          })
          .getMany();

        if (hollons.length === 0) {
          continue;
        }

        this.logger.log(
          `Found ${hollons.length} hollons ready to execute tasks in org ${org.name}`,
        );

        // 3. 각 Hollon에 대해 runCycle() 실행
        for (const hollon of hollons) {
          // 중복 실행 방지
          if (this.executingHollons.has(hollon.id)) {
            this.logger.debug(`Hollon ${hollon.name} is already executing`);
            continue;
          }

          this.executingHollons.add(hollon.id);

          // 비동기로 실행 (블로킹 방지)
          this.executeHollonCycle(hollon.id)
            .catch((error) => {
              const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
              this.logger.error(
                `Failed to execute cycle for hollon ${hollon.name}: ${errorMessage}`,
              );
            })
            .finally(() => {
              this.executingHollons.delete(hollon.id);
            });
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error in executeAssignedHollons: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * 동시 실행 제한 체크
   */
  private async checkConcurrencyLimit(orgId: string): Promise<boolean> {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) return false;

    const activeCount = await this.hollonRepo.count({
      where: {
        organizationId: orgId,
        status: In([HollonStatus.WORKING, HollonStatus.WAITING]),
      },
    });

    const maxConcurrent = org.settings?.maxConcurrentHolons || 10;

    if (activeCount >= maxConcurrent) {
      this.logger.warn(
        `Organization ${org.name} at max concurrency: ${activeCount}/${maxConcurrent}`,
      );
      return false;
    }

    return true;
  }

  /**
   * Hollon 실행 사이클
   */
  private async executeHollonCycle(hollonId: string): Promise<void> {
    this.logger.log(`Starting execution cycle for hollon: ${hollonId}`);

    try {
      const result = await this.orchestrator.runCycle(hollonId);

      if (result.success) {
        this.logger.log(
          `Execution cycle completed for ${hollonId}: ` +
            `task=${result.taskId}, duration=${result.duration}ms`,
        );
      } else {
        this.logger.warn(
          `Execution cycle failed for ${hollonId}: ${result.error || 'Unknown error'}`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Exception in executeHollonCycle for ${hollonId}: ${errorMessage}`,
      );
      throw error;
    }
  }
}
```

**테스트:**

```typescript
// apps/server/src/modules/orchestration/services/hollon-execution.service.spec.ts

describe('HollonExecutionService', () => {
  it('should execute IDLE hollons with assigned tasks', async () => {
    // Given: IDLE hollon with READY task
    const hollon = await createHollon({ status: HollonStatus.IDLE });
    const task = await createTask({
      status: TaskStatus.READY,
      assignedHollonId: hollon.id,
    });

    // When: executeAssignedHollons runs
    await service.executeAssignedHollons();

    // Then: orchestrator.runCycle called
    expect(mockOrchestrator.runCycle).toHaveBeenCalledWith(hollon.id);
  });

  it('should respect concurrency limit', async () => {
    // Given: org with maxConcurrentHollons = 2, 2 already WORKING
    const org = await createOrg({ settings: { maxConcurrentHolons: 2 } });
    await createHollon({
      status: HollonStatus.WORKING,
      organizationId: org.id,
    });
    await createHollon({
      status: HollonStatus.WORKING,
      organizationId: org.id,
    });
    const idleHollon = await createHollon({
      status: HollonStatus.IDLE,
      organizationId: org.id,
    });

    // When: executeAssignedHollons runs
    await service.executeAssignedHollons();

    // Then: runCycle NOT called (limit reached)
    expect(mockOrchestrator.runCycle).not.toHaveBeenCalled();
  });

  it('should respect emergency stop', async () => {
    // Given: org with autonomousExecutionEnabled = false
    const org = await createOrg({
      settings: {
        autonomousExecutionEnabled: false,
        emergencyStopReason: 'Testing',
      },
    });
    const hollon = await createHollon({ organizationId: org.id });

    // When: executeAssignedHollons runs
    await service.executeAssignedHollons();

    // Then: runCycle NOT called
    expect(mockOrchestrator.runCycle).not.toHaveBeenCalled();
  });
});
```

#### 2. 무한 루프 방지 (1시간)

**목적:** Task가 반복적으로 실패할 때 Exponential Backoff 적용

**Migration:**

```typescript
// apps/server/src/migrations/XXXXXX-add-task-failure-tracking.ts

export class AddTaskFailureTracking1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'tasks',
      new TableColumn({
        name: 'consecutive_failures',
        type: 'integer',
        default: 0,
      }),
    );

    await queryRunner.addColumn(
      'tasks',
      new TableColumn({
        name: 'last_failed_at',
        type: 'timestamp with time zone',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'tasks',
      new TableColumn({
        name: 'blocked_until',
        type: 'timestamp with time zone',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tasks', 'blocked_until');
    await queryRunner.dropColumn('tasks', 'last_failed_at');
    await queryRunner.dropColumn('tasks', 'consecutive_failures');
  }
}
```

**Entity 수정:**

```typescript
// apps/server/src/modules/task/entities/task.entity.ts

@Entity('tasks')
export class Task {
  // ... 기존 필드

  @Column({ name: 'consecutive_failures', default: 0 })
  consecutiveFailures: number;

  @Column({
    name: 'last_failed_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  lastFailedAt: Date | null;

  @Column({
    name: 'blocked_until',
    type: 'timestamp with time zone',
    nullable: true,
  })
  blockedUntil: Date | null;
}
```

**TaskPoolService 수정:**

```typescript
// apps/server/src/modules/orchestration/services/task-pool.service.ts

async pullNextTask(hollonId: string): Promise<TaskPullResult> {
  // ... 기존 로직

  // Task 후보에서 blocked_until 체크
  const candidates = await this.findCandidates(hollonId, lockedFiles);

  for (const task of candidates) {
    if (await this.isTaskBlocked(task)) {
      this.logger.debug(`Task ${task.id} is blocked until ${task.blockedUntil}`);
      continue;
    }

    return this.claimTask(task, hollon, reason);
  }
}

private async isTaskBlocked(task: Task): Promise<boolean> {
  if (!task.blockedUntil) return false;
  return new Date() < task.blockedUntil;
}
```

**TaskPoolService.failTask 수정:**

```typescript
async failTask(taskId: string, reason: string): Promise<void> {
  const task = await this.taskRepo.findOne({ where: { id: taskId } });
  if (!task) return;

  const now = new Date();
  const consecutiveFailures = (task.consecutiveFailures || 0) + 1;

  // Exponential backoff: 5분, 15분, 1시간
  const backoffMinutes = [5, 15, 60][Math.min(consecutiveFailures - 1, 2)];
  const blockedUntil = new Date(now);
  blockedUntil.setMinutes(blockedUntil.getMinutes() + backoffMinutes);

  await this.taskRepo.update(taskId, {
    status: TaskStatus.FAILED,
    consecutiveFailures,
    lastFailedAt: now,
    blockedUntil: consecutiveFailures >= 3 ? blockedUntil : null,
  });

  this.logger.warn(
    `Task ${taskId} failed (${consecutiveFailures} consecutive). ` +
    (consecutiveFailures >= 3 ? `Blocked until ${blockedUntil}` : 'Will retry immediately')
  );
}
```

**TaskPoolService.completeTask 수정:**

```typescript
async completeTask(taskId: string): Promise<void> {
  await this.taskRepo.update(taskId, {
    status: TaskStatus.COMPLETED,
    completedAt: new Date(),
    consecutiveFailures: 0,  // Reset on success
    blockedUntil: null,
  });
}
```

#### 3. Emergency Stop (30분)

**목적:** 문제 발생 시 자율 실행을 즉시 중단할 수 있는 Kill Switch

**OrganizationSettings 인터페이스:**

```typescript
// apps/server/src/modules/organization/interfaces/organization-settings.interface.ts

export interface OrganizationSettings {
  // 기존 설정
  maxConcurrentHolons?: number;
  costLimitDailyCents?: number;
  costLimitMonthlyCents?: number;

  // Phase 3.7 추가
  autonomousExecutionEnabled?: boolean;
  emergencyStopReason?: string;
}
```

**API 엔드포인트:**

```typescript
// apps/server/src/modules/organization/organization.controller.ts

@Post(':id/emergency-stop')
async emergencyStop(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: EmergencyStopDto,
): Promise<{ message: string }> {
  return this.organizationService.emergencyStop(id, dto.reason);
}

@Post(':id/resume-execution')
async resumeExecution(
  @Param('id', ParseUUIDPipe) id: string,
): Promise<{ message: string }> {
  return this.organizationService.resumeExecution(id);
}
```

**DTO:**

```typescript
// apps/server/src/modules/organization/dto/emergency-stop.dto.ts

export class EmergencyStopDto {
  @IsString()
  reason: string;
}
```

**Service 구현:**

```typescript
// apps/server/src/modules/organization/organization.service.ts

async emergencyStop(orgId: string, reason: string): Promise<{ message: string }> {
  const org = await this.orgRepo.findOne({ where: { id: orgId } });
  if (!org) {
    throw new NotFoundException(`Organization ${orgId} not found`);
  }

  const settings = (org.settings as OrganizationSettings) || {};
  settings.autonomousExecutionEnabled = false;
  settings.emergencyStopReason = reason;

  await this.orgRepo.update(orgId, { settings });

  this.logger.warn(
    `Emergency stop activated for organization ${org.name}: ${reason}`
  );

  return {
    message: `Autonomous execution stopped for ${org.name}. Reason: ${reason}`
  };
}

async resumeExecution(orgId: string): Promise<{ message: string }> {
  const org = await this.orgRepo.findOne({ where: { id: orgId } });
  if (!org) {
    throw new NotFoundException(`Organization ${orgId} not found`);
  }

  const settings = (org.settings as OrganizationSettings) || {};
  settings.autonomousExecutionEnabled = true;
  settings.emergencyStopReason = undefined;

  await this.orgRepo.update(orgId, { settings });

  this.logger.log(`Autonomous execution resumed for organization ${org.name}`);

  return { message: `Autonomous execution resumed for ${org.name}` };
}
```

---

### ✅ P1: Sub-Hollon 구현 (복잡한 Task 품질 향상)

#### 4. Sub-Hollon 생성 및 분배 (2시간)

**목적:** 복잡한 Task를 Planner/Analyzer/Coder Sub-Hollon으로 분배하여 품질 향상

**HollonService 확장:**

```typescript
// apps/server/src/modules/hollon/hollon.service.ts

async createTemporaryHollon(
  parentHollonId: string,
  dto: CreateTemporaryHollonDto,
): Promise<Hollon> {
  const parentHollon = await this.hollonRepo.findOne({
    where: { id: parentHollonId },
  });

  if (!parentHollon) {
    throw new NotFoundException(`Parent hollon ${parentHollonId} not found`);
  }

  const hollon = this.hollonRepo.create({
    ...dto,
    lifecycle: HollonLifecycle.TEMPORARY,
    parentId: parentHollonId,
    status: HollonStatus.IDLE,
    createdBy: parentHollonId,
  });

  const saved = await this.hollonRepo.save(hollon);

  this.logger.log(
    `Created temporary hollon ${saved.name} (parent: ${parentHollon.name})`,
  );

  return saved;
}

async deleteTemporaryHollons(parentHollonId: string): Promise<void> {
  const tempHollons = await this.hollonRepo.find({
    where: {
      parentId: parentHollonId,
      lifecycle: HollonLifecycle.TEMPORARY,
    },
  });

  for (const hollon of tempHollons) {
    await this.hollonRepo.remove(hollon);
    this.logger.log(`Deleted temporary hollon: ${hollon.name}`);
  }
}
```

**HollonOrchestratorService에 복잡한 Task 처리:**

```typescript
// apps/server/src/modules/orchestration/services/hollon-orchestrator.service.ts

async runCycle(hollonId: string): Promise<ExecutionCycleResult> {
  // ... 기존 로직

  const task = pullResult.task;

  // 복잡도 체크
  if (this.isComplexTask(task)) {
    this.logger.log(`Task ${task.id} is complex, creating sub-hollons`);
    return this.handleComplexTask(task, hollon);
  }

  // ... 단일 Hollon 실행 (기존 로직)
}

private isComplexTask(task: Task): boolean {
  // 복잡도 판단 기준
  const indicators = {
    hasHighComplexity: task.complexity === TaskComplexity.HIGH,
    hasMultipleDependencies: task.dependencies?.length > 3,
    hasManyRequiredSkills: task.requiredSkills?.length > 2,
    hasLargeScope: task.estimatePoints > 8,
  };

  const complexityScore = Object.values(indicators).filter(Boolean).length;
  return complexityScore >= 2;  // 2개 이상 지표 충족 시 복잡한 Task
}

private async handleComplexTask(
  task: Task,
  parentHollon: Hollon,
): Promise<ExecutionCycleResult> {
  const startTime = Date.now();

  try {
    // 1. Sub-Hollon 생성 (Planner, Analyzer, Coder)
    const plannerRole = await this.findOrCreateRole('Planner', parentHollon.organizationId);
    const analyzerRole = await this.findOrCreateRole('Analyzer', parentHollon.organizationId);
    const coderRole = await this.findOrCreateRole('Coder', parentHollon.organizationId);

    const plannerHollon = await this.hollonService.createTemporaryHollon(
      parentHollon.id,
      {
        name: `Planner-${task.id.substring(0, 8)}`,
        organizationId: parentHollon.organizationId,
        teamId: parentHollon.teamId,
        roleId: plannerRole.id,
        brainProviderId: parentHollon.brainProviderId,
      },
    );

    const analyzerHollon = await this.hollonService.createTemporaryHollon(
      parentHollon.id,
      {
        name: `Analyzer-${task.id.substring(0, 8)}`,
        organizationId: parentHollon.organizationId,
        teamId: parentHollon.teamId,
        roleId: analyzerRole.id,
        brainProviderId: parentHollon.brainProviderId,
      },
    );

    const coderHollon = await this.hollonService.createTemporaryHollon(
      parentHollon.id,
      {
        name: `Coder-${task.id.substring(0, 8)}`,
        organizationId: parentHollon.organizationId,
        teamId: parentHollon.teamId,
        roleId: coderRole.id,
        brainProviderId: parentHollon.brainProviderId,
      },
    );

    // 2. Subtask 생성
    const subtasks = await this.subtaskService.createSubtasks(task.id, [
      {
        title: `[Planning] ${task.title}`,
        description: 'Analyze requirements and create implementation plan',
        assignedHollonId: plannerHollon.id,
        priority: task.priority,
        type: TaskType.PLANNING,
      },
      {
        title: `[Analysis] ${task.title}`,
        description: 'Design architecture and identify dependencies',
        assignedHollonId: analyzerHollon.id,
        priority: task.priority,
        type: TaskType.ANALYSIS,
      },
      {
        title: `[Implementation] ${task.title}`,
        description: 'Implement the planned solution',
        assignedHollonId: coderHollon.id,
        priority: task.priority,
        type: TaskType.IMPLEMENTATION,
      },
    ]);

    // 3. Subtask 순차 실행
    for (const subtask of subtasks.createdSubtasks) {
      const subtaskResult = await this.runCycle(subtask.assignedHollonId);

      if (!subtaskResult.success) {
        throw new Error(
          `Subtask ${subtask.id} failed: ${subtaskResult.error}`
        );
      }
    }

    // 4. Parent Task 완료
    await this.taskPool.completeTask(task.id);

    // 5. Temporary Hollon 정리
    await this.hollonService.deleteTemporaryHollons(parentHollon.id);

    const duration = Date.now() - startTime;
    this.logger.log(
      `Complex task ${task.id} completed via sub-hollons: duration=${duration}ms`,
    );

    return {
      success: true,
      taskId: task.id,
      taskTitle: task.title,
      duration,
      output: `Completed via ${subtasks.createdSubtasks.length} sub-hollons`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Cleanup on failure
    await this.hollonService.deleteTemporaryHollons(parentHollon.id);

    return {
      success: false,
      taskId: task.id,
      taskTitle: task.title,
      duration: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

private async findOrCreateRole(
  roleName: string,
  organizationId: string,
): Promise<Role> {
  let role = await this.roleRepo.findOne({
    where: { name: roleName, organizationId },
  });

  if (!role) {
    const roleConfigs = {
      Planner: {
        systemPrompt: 'You are a planning specialist. Analyze requirements and create detailed implementation plans.',
        capabilities: ['planning', 'requirements-analysis', 'architecture-design'],
      },
      Analyzer: {
        systemPrompt: 'You are an architecture analyst. Design system architecture and identify dependencies.',
        capabilities: ['architecture', 'design-patterns', 'dependency-analysis'],
      },
      Coder: {
        systemPrompt: 'You are an implementation specialist. Write clean, tested code following the plan.',
        capabilities: ['typescript', 'nestjs', 'testing', 'implementation'],
      },
    };

    const config = roleConfigs[roleName];
    role = this.roleRepo.create({
      name: roleName,
      organizationId,
      systemPrompt: config.systemPrompt,
      capabilities: config.capabilities,
      canCreateTasks: false,
      canCreateSubHolons: false,
    });

    role = await this.roleRepo.save(role);
    this.logger.log(`Created role: ${roleName}`);
  }

  return role;
}
```

#### 5. Temporary Hollon Cleanup (1시간)

**목적:** Subtask 완료 후 Temporary Hollon 자동 정리

**SubtaskCreationService 수정:**

```typescript
// apps/server/src/modules/orchestration/services/subtask-creation.service.ts

async updateParentTaskStatus(parentTaskId: string): Promise<void> {
  const parentTask = await this.taskRepo.findOne({
    where: { id: parentTaskId },
    relations: ['subtasks', 'assignedHollon'],
  });

  if (!parentTask || !parentTask.subtasks || parentTask.subtasks.length === 0) {
    return;
  }

  const subtasks = parentTask.subtasks;
  const allCompleted = subtasks.every((t) => t.status === TaskStatus.COMPLETED);

  if (allCompleted && newStatus === TaskStatus.COMPLETED) {
    // Cleanup temporary hollons
    if (parentTask.assignedHollon) {
      await this.cleanupTemporaryHollons(parentTask.assignedHollon.id);
    }
  }

  // ... 기존 로직
}

private async cleanupTemporaryHollons(parentHollonId: string): Promise<void> {
  const tempHollons = await this.hollonRepo.find({
    where: {
      parentId: parentHollonId,
      lifecycle: HollonLifecycle.TEMPORARY,
    },
  });

  for (const hollon of tempHollons) {
    await this.hollonRepo.remove(hollon);
    this.logger.log(`Cleaned up temporary hollon: ${hollon.name}`);
  }
}
```

---

### ✅ P2: 권장 안전장치 (Phase 4 진행 중 추가 가능)

#### 6. Stuck Task 감지 (30분)

**목적:** IN_PROGRESS 상태로 오래 머무는 Task 자동 복구

**MessageListener에 Cron 추가:**

```typescript
// apps/server/src/modules/message/listeners/message.listener.ts

@Cron(CronExpression.EVERY_HOUR)
async detectStuckTasks(): Promise<void> {
  const STUCK_THRESHOLD_HOURS = 2;
  const threshold = new Date(Date.now() - STUCK_THRESHOLD_HOURS * 60 * 60 * 1000);

  const stuckTasks = await this.taskRepo.find({
    where: {
      status: TaskStatus.IN_PROGRESS,
      startedAt: LessThan(threshold),
    },
    relations: ['assignedHollon'],
  });

  for (const task of stuckTasks) {
    this.logger.warn(
      `Stuck task detected: ${task.id} (started ${task.startedAt}, hollon: ${task.assignedHollon?.name})`,
    );

    // Hollon 상태 확인
    if (task.assignedHollon?.status === HollonStatus.IDLE) {
      // Hollon은 IDLE인데 Task는 IN_PROGRESS → 불일치 해결
      await this.taskRepo.update(task.id, {
        status: TaskStatus.READY,
        assignedHollonId: null,  // Re-assign
      });

      this.logger.log(`Reset stuck task ${task.id} to READY for re-assignment`);
    }
  }
}
```

#### 7. 진행률 모니터링 & 알림 (1시간)

**목적:** Project 진행률 추적 및 이상 징후 감지

**MessageListener에 Cron 추가:**

```typescript
@Cron(CronExpression.EVERY_30_MINUTES)
async sendProgressReport(): Promise<void> {
  const projects = await this.projectRepo.find({
    where: { status: ProjectStatus.ACTIVE },
    relations: ['tasks', 'team'],
  });

  for (const project of projects) {
    const stats = {
      total: project.tasks.length,
      completed: project.tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      inProgress: project.tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      failed: project.tasks.filter(t => t.status === TaskStatus.FAILED).length,
      blocked: project.tasks.filter(t => t.status === TaskStatus.BLOCKED).length,
    };

    const progress = (stats.completed / stats.total) * 100;

    // 이상 징후 감지
    if (stats.blocked > 5) {
      this.logger.error(
        `Project ${project.name}: Too many blocked tasks (${stats.blocked})`,
      );
      // TODO: Slack/Email 알림 전송
    }

    if (stats.failed > 3) {
      this.logger.error(
        `Project ${project.name}: Multiple failures detected (${stats.failed})`,
      );
    }

    this.logger.log(
      `Project ${project.name}: ${progress.toFixed(1)}% complete ` +
      `(${stats.completed}/${stats.total}) - ` +
      `In Progress: ${stats.inProgress}, Failed: ${stats.failed}, Blocked: ${stats.blocked}`,
    );
  }
}
```

---

## 🗓️ 구현 일정

### Day 1 (4시간)

**오전 (2시간):**

- ✅ HollonExecutionService 구현 (1시간)
  - Cron 기반 자동 실행
  - 동시 실행 제한
  - Emergency Stop 체크
- ✅ 단위 테스트 작성 (30분)
- ✅ OrchestrationModule 통합 (30분)

**오후 (2시간):**

- ✅ 무한 루프 방지 구현 (1시간)
  - Migration 작성
  - Entity 수정
  - TaskPoolService 수정
- ✅ Emergency Stop API 구현 (30분)
- ✅ 통합 테스트 (30분)

### Day 2 (3시간)

**오전 (2시간):**

- ✅ Sub-Hollon 생성 구현 (1시간)
  - createTemporaryHollon()
  - deleteTemporaryHollons()
- ✅ Planner/Analyzer/Coder Role 정의 (30분)
- ✅ handleComplexTask() 구현 (30분)

**오후 (1시간):**

- ✅ Temporary Hollon Cleanup (30분)
- ✅ Stuck Task 감지 (15분)
- ✅ 진행률 모니터링 (15분)

### Day 3 (선택적, P2 완성)

**필요 시:**

- ✅ E2E 테스트 작성
- ✅ 문서 업데이트
- ✅ 최종 검증

---

## 🧪 테스트 전략

### 단위 테스트

```typescript
// HollonExecutionService
- executeAssignedHollons: IDLE + assigned task → runCycle 호출
- checkConcurrencyLimit: max 도달 시 실행 안함
- emergencyStop 체크: disabled 시 실행 안함

// TaskPoolService
- isTaskBlocked: blockedUntil 체크
- failTask: consecutiveFailures 증가, Exponential backoff
- completeTask: consecutiveFailures 리셋

// HollonOrchestratorService
- isComplexTask: 복잡도 판단
- handleComplexTask: Sub-Hollon 생성 및 Subtask 실행
- findOrCreateRole: Planner/Analyzer/Coder Role 생성
```

### 통합 테스트

```bash
pnpm --filter @hollon-ai/server test:integration hollon-execution
pnpm --filter @hollon-ai/server test:integration sub-hollon
```

### E2E 테스트

```typescript
describe('Phase 3.7: Autonomous Execution', () => {
  it('should auto-start assigned tasks', async () => {
    // Given: IDLE hollon with READY task
    const hollon = await createHollon({ status: HollonStatus.IDLE });
    const task = await createTask({
      status: TaskStatus.READY,
      assignedHollonId: hollon.id,
    });

    // When: Wait for HollonExecutionService (10 sec)
    await sleep(11000);

    // Then: Task should be IN_PROGRESS or COMPLETED
    const updatedTask = await getTask(task.id);
    expect([TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED]).toContain(
      updatedTask.status,
    );
  });

  it('should handle complex task with sub-hollons', async () => {
    // Given: HIGH complexity task
    const task = await createTask({
      complexity: TaskComplexity.HIGH,
      estimatePoints: 10,
    });

    // When: Hollon executes task
    const result = await orchestrator.runCycle(hollon.id);

    // Then: Sub-hollons created and cleaned up
    expect(result.success).toBe(true);
    const tempHollons = await findTemporaryHollons(hollon.id);
    expect(tempHollons).toHaveLength(0); // Cleaned up
  });
});
```

---

## 📚 문서 업데이트

### 1. phase4-execution-guide.md

**변경 사항:**

**Step 7 완전히 재작성:**

```markdown
### Step 7: Sprint 자동 시작 ✨

Goal 분해 + autoAssign 완료 후, **아무것도 하지 않아도** Hollon이 자율 실행 시작!

#### 자동 실행 메커니즘:

**1️⃣ HollonExecutionService (매 10초)**

- IDLE + assignedTask 있는 Hollon 감지
- HollonOrchestrator.runCycle() 자동 호출

**2️⃣ Task 실행 플로우 (자동)**
```

Task 할당됨 (autoAssign)
↓ 10초 후
HollonExecutionService 감지
↓
HollonOrchestrator.runCycle()
↓
복잡도 체크
├─ 단순 Task → 단일 Hollon 실행
└─ 복잡한 Task → Sub-Hollon 생성 (Planner/Analyzer/Coder)
↓
Subtask 순차 실행
↓
Temporary Hollon 정리
↓
Git commit + push
↓
gh pr create → PR 생성
↓
MessageListener (1분 후)
↓
CodeReviewService → 자동 리뷰
↓
AutoMergeService → 자동 병합
↓
Task 완료 → Hollon IDLE
↓ 10초 후
다음 Task 자동 시작 (반복)

````

#### 🎉 완전 자율 실행!

- ✅ **인간 개입 불필요**: Goal 생성 후 모니터링만 하면 됨
- ✅ **자동 Task Pull**: Hollon이 스스로 다음 Task 선택
- ✅ **자동 PR 생성**: gh CLI를 통한 PR 자동 생성
- ✅ **자동 Code Review**: MessageListener가 자동 리뷰 실행
- ✅ **자동 Merge**: 승인 시 자동 병합
- ✅ **무한 반복**: Task 완료 후 다음 Task 자동 시작
- ✅ **복잡한 Task**: Sub-Hollon으로 분배하여 품질 향상

#### 안전장치:

- ✅ **동시 실행 제한**: Organization.maxConcurrentHolons
- ✅ **무한 루프 방지**: Exponential backoff (5분, 15분, 1시간)
- ✅ **Emergency Stop**: POST /organizations/:id/emergency-stop
- ✅ **Stuck Task 감지**: 2시간 이상 IN_PROGRESS → 자동 복구
- ✅ **진행률 모니터링**: 30분마다 진행 상황 로그

#### Emergency Stop (긴급 중단):

```bash
# 자율 실행 중단
curl -X POST "http://localhost:3001/organizations/$ORG_ID/emergency-stop" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Testing Phase 4 setup"}'

# 실행 재개
curl -X POST "http://localhost:3001/organizations/$ORG_ID/resume-execution"
````

````

### 2. phase4-dogfood-plan.md

**변경 사항:**

**Section 추가 (Line 15 이후):**
```markdown
### 전제 조건 (업데이트)

- ✅ Phase 3.5 완료 (자율 코드 리뷰, PR 자동 병합, 목표 분해 통합)
- ✅ **Phase 3.7 완료 (100% 자율 실행 인프라)** ← 신규
  - ✅ HollonExecutionService (자동 Task 시작)
  - ✅ Sub-Hollon 생성 (Planner/Analyzer/Coder)
  - ✅ 6개 안전장치 (무한 루프 방지, Emergency Stop 등)
- ✅ Document/Memory 인프라 구축 완료 (pgvector 포함)
- ✅ PromptComposerService Layer 5 (Memory) 구현 완료
````

**Section 업데이트 (Line 42-58, Executive Summary):**

```markdown
### 예상 성과 (업데이트)

| 지표                  | Phase 3.5 | Phase 3.7 목표 | Phase 4 예상  |
| --------------------- | --------- | -------------- | ------------- |
| **자율성**            | 85%       | 100% ✅        | 100% ✅       |
| **Phase 4 소요 기간** | N/A       | N/A            | 4-5주         |
| **인간 개입**         | Task마다  | Goal 1회만 ✅  | 주 6-8시간 ✅ |
| **성공 확률**         | N/A       | N/A            | 85% (현실적)  |
| **코드 품질**         | A급       | A급            | A급           |
```

**Section 추가 (Week 0 이전):**

```markdown
### Phase 3.7: 완전 자율 실행 인프라 (1일) ✅

**완료된 기능**:

- ✅ HollonExecutionService
  - Cron 기반 자동 Task 시작 (10초마다)
  - 동시 실행 제한 (Organization.maxConcurrentHolons)
  - Emergency Stop 지원

- ✅ 무한 루프 방지
  - consecutiveFailures 추적
  - Exponential backoff (5분, 15분, 1시간)

- ✅ Sub-Hollon 생성
  - Planner/Analyzer/Coder Role 자동 생성
  - 복잡한 Task 자동 분해 및 분배
  - Temporary Hollon 자동 정리

- ✅ 추가 안전장치
  - Stuck Task 감지 (2시간 threshold)
  - 진행률 모니터링 (30분마다)

**결과**: Phase 4를 100% 자율 실행 가능 🚀
```

---

## ✅ 완료 기준

### Phase 3.7 완료 체크리스트

**P0 (필수):**

- [ ] HollonExecutionService 구현 및 테스트 통과
- [ ] 동시 실행 제한 작동 확인
- [ ] 무한 루프 방지 (Exponential backoff) 작동 확인
- [ ] Emergency Stop API 작동 확인

**P1 (Sub-Hollon):**

- [ ] createTemporaryHollon() 구현 및 테스트 통과
- [ ] handleComplexTask() 구현 (Planner/Analyzer/Coder)
- [ ] Temporary Hollon Cleanup 작동 확인

**P2 (권장):**

- [ ] Stuck Task 감지 작동 확인
- [ ] 진행률 모니터링 로그 확인

**문서:**

- [ ] phase4-execution-guide.md 업데이트
- [ ] phase4-dogfood-plan.md 업데이트

**통합:**

- [ ] E2E 테스트: 자동 Task 시작 → 실행 → 완료
- [ ] E2E 테스트: 복잡한 Task → Sub-Hollon → 완료
- [ ] Emergency Stop 시나리오 검증

---

## 🎯 성공 지표

| 지표                  | 목표 | 측정 방법                             |
| --------------------- | ---- | ------------------------------------- |
| **자율 실행**         | 100% | Goal 생성 후 인간 개입 없이 Task 완료 |
| **동시 실행 제한**    | 작동 | maxConcurrentHolons 초과 시 대기      |
| **무한 루프 방지**    | 작동 | 3회 실패 시 Exponential backoff       |
| **Emergency Stop**    | <5초 | API 호출 후 5초 내 실행 중단          |
| **Sub-Hollon 품질**   | +20% | 복잡한 Task 품질 점수 향상            |
| **Temporary Cleanup** | 100% | Subtask 완료 후 Temp Hollon 0개       |

---

## 📈 Phase 4 영향

### Phase 3.7 완료 시 Phase 4 변화:

**Before (Phase 3.5):**

```
인간: Goal 생성
     ↓
시스템: Task 30개 자동 분해 + 할당
     ↓
인간: 각 Task마다 수동으로 curl POST /hollons/:id/execute (30회)
     ↓
시스템: Task 실행 → PR → Review → Merge
     ↓
인간: 다음 Task 수동 시작 (반복)

→ 자율성 85%, 인간 개입 Task당 1회
```

**After (Phase 3.7):**

```
인간: Goal 생성 (1회만!)
     ↓
시스템: Task 30개 자동 분해 + 할당
     ↓
시스템: HollonExecutionService 자동 시작 (10초마다)
     ↓
시스템: Task Pull → 복잡도 체크
     ├─ 단순 → 단일 Hollon 실행
     └─ 복잡 → Sub-Hollon 3개 생성 → 순차 실행
     ↓
시스템: PR → Review → Merge → 다음 Task (자동 반복)
     ↓
인간: 모니터링만 (선택적)

→ 자율성 100%, 인간 개입 Goal당 1회
```

### 예상 효과:

- ✅ **인간 시간 절약**: 30 Tasks × 2분 = 60분 → 5분 (92% 절감)
- ✅ **복잡한 Task 품질**: Sub-Hollon으로 20% 향상
- ✅ **안정성**: 6개 안전장치로 무인 실행 가능
- ✅ **Phase 4 성공률**: 85% → 95% (안전장치 효과)

---

**문서 버전**: 1.0
**최종 업데이트**: 2025-12-10
**작성자**: Claude
**상태**: 구현 대기 중
