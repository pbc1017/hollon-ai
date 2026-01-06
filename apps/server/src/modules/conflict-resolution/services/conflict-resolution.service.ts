import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  ConflictResolution,
  ConflictType,
  ConflictStatus,
  ResolutionStrategy,
} from '../entities/conflict-resolution.entity';
import {
  Task,
  TaskStatus,
  TaskPriority,
} from '../../task/entities/task.entity';
import { MessageService } from '../../message/message.service';
import {
  MessageType,
  ParticipantType,
} from '../../message/entities/message.entity';
import { ConflictContextDto } from '../dto/conflict-context.dto';

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts?: ConflictResolution[];
}

export interface ConflictResolutionResult {
  resolved: boolean;
  strategy: ResolutionStrategy;
  details: string;
}

@Injectable()
export class ConflictResolutionService {
  private readonly logger = new Logger(ConflictResolutionService.name);

  constructor(
    @InjectRepository(ConflictResolution)
    private readonly conflictRepo: Repository<ConflictResolution>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly messageService: MessageService,
  ) {}

  /**
   * 충돌 감지 및 해결
   */
  async detectAndResolve(
    context: ConflictContextDto,
  ): Promise<ConflictDetectionResult> {
    this.logger.log(`Detecting conflicts for org ${context.organizationId}`);

    const conflicts: ConflictResolution[] = [];

    // 1. 파일 충돌 감지
    if (context.affectedFiles && context.affectedFiles.length > 0) {
      const fileConflicts = await this.detectFileConflicts(
        context.organizationId,
        context.affectedFiles,
      );
      conflicts.push(...fileConflicts);
    }

    // 2. 리소스 충돌 감지
    if (context.affectedResources && context.affectedResources.length > 0) {
      const resourceConflicts = await this.detectResourceConflicts(
        context.organizationId,
        context.affectedResources,
      );
      conflicts.push(...resourceConflicts);
    }

    // 3. 우선순위 충돌 감지
    if (context.taskIds && context.taskIds.length > 0) {
      const priorityConflicts = await this.detectPriorityConflicts(
        context.taskIds,
      );
      conflicts.push(...priorityConflicts);
    }

    // 4. 마감일 충돌 감지
    if (context.taskIds && context.taskIds.length > 0) {
      const deadlineConflicts = await this.detectDeadlineConflicts(
        context.taskIds,
      );
      conflicts.push(...deadlineConflicts);
    }

    if (conflicts.length === 0) {
      return { hasConflicts: false };
    }

    // 충돌 해결 시도
    for (const conflict of conflicts) {
      await this.resolveConflict(conflict);
    }

    this.logger.log(`Detected and resolved ${conflicts.length} conflicts`);
    return { hasConflicts: true, conflicts };
  }

  /**
   * 파일 충돌 감지
   */
  private async detectFileConflicts(
    organizationId: string,
    files: string[],
  ): Promise<ConflictResolution[]> {
    // 같은 파일을 수정하는 진행 중인 태스크 찾기
    const tasks = await this.taskRepo
      .createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .where('project.organization_id = :orgId', { orgId: organizationId })
      .andWhere('task.status IN (:...statuses)', {
        statuses: [TaskStatus.IN_PROGRESS, TaskStatus.READY],
      })
      .andWhere('task.affected_files && ARRAY[:...files]::text[]', {
        files,
      })
      .getMany();

    if (tasks.length <= 1) {
      return [];
    }

    const conflict = await this.conflictRepo.save({
      organizationId,
      conflictType: ConflictType.FILE_CONFLICT,
      description: `${tasks.length} tasks are modifying the same files: ${files.join(', ')}`,
      affectedTaskIds: tasks.map((t) => t.id),
      affectedHollonIds: tasks
        .map((t) => t.assignedHollonId)
        .filter(Boolean) as string[],
      conflictContext: { files, taskCount: tasks.length },
      status: ConflictStatus.DETECTED,
    });

    return [conflict];
  }

  /**
   * 리소스 충돌 감지 (태그 기반)
   */
  private async detectResourceConflicts(
    organizationId: string,
    resources: string[],
  ): Promise<ConflictResolution[]> {
    // 같은 리소스 태그를 가진 진행 중인 태스크 찾기
    const tasks = await this.taskRepo
      .createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .where('project.organization_id = :orgId', { orgId: organizationId })
      .andWhere('task.status = :status', { status: TaskStatus.IN_PROGRESS })
      .andWhere('task.tags && ARRAY[:...resources]::text[]', {
        resources,
      })
      .getMany();

    if (tasks.length <= 1) {
      return [];
    }

    const conflict = await this.conflictRepo.save({
      organizationId,
      conflictType: ConflictType.RESOURCE_CONFLICT,
      description: `${tasks.length} tasks require the same resources: ${resources.join(', ')}`,
      affectedTaskIds: tasks.map((t) => t.id),
      affectedHollonIds: tasks
        .map((t) => t.assignedHollonId)
        .filter(Boolean) as string[],
      conflictContext: { resources, taskCount: tasks.length },
      status: ConflictStatus.DETECTED,
    });

    return [conflict];
  }

  /**
   * 우선순위 충돌 감지
   */
  private async detectPriorityConflicts(
    taskIds: string[],
  ): Promise<ConflictResolution[]> {
    const tasks = await this.taskRepo.find({
      where: { id: In(taskIds) },
      relations: ['project'],
    });

    // 같은 홀론에게 할당된 높은 우선순위 태스크가 여러 개인지 확인
    const hollonTaskMap = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.assignedHollonId) continue;
      if (!hollonTaskMap.has(task.assignedHollonId)) {
        hollonTaskMap.set(task.assignedHollonId, []);
      }
      hollonTaskMap.get(task.assignedHollonId)!.push(task);
    }

    const conflicts: ConflictResolution[] = [];

    for (const [hollonId, hollonTasks] of hollonTaskMap.entries()) {
      const highPriorityTasks = hollonTasks.filter(
        (t) =>
          t.priority === TaskPriority.P2_HIGH ||
          t.priority === TaskPriority.P1_CRITICAL,
      );

      if (highPriorityTasks.length > 1) {
        const conflict = await this.conflictRepo.save({
          organizationId: highPriorityTasks[0].project.organizationId,
          conflictType: ConflictType.PRIORITY_CONFLICT,
          description: `Hollon ${hollonId} has ${highPriorityTasks.length} high-priority tasks`,
          affectedTaskIds: highPriorityTasks.map((t) => t.id),
          affectedHollonIds: [hollonId],
          conflictContext: {
            hollonId,
            taskCount: highPriorityTasks.length,
          },
          status: ConflictStatus.DETECTED,
        });

        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * 마감일 충돌 감지
   */
  private async detectDeadlineConflicts(
    taskIds: string[],
  ): Promise<ConflictResolution[]> {
    const tasks = await this.taskRepo.find({
      where: { id: In(taskIds) },
      relations: ['project'],
    });

    // 같은 홀론에게 할당된 태스크 중 마감일이 겹치는지 확인
    const hollonTaskMap = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.assignedHollonId || !task.dueDate) continue;
      if (!hollonTaskMap.has(task.assignedHollonId)) {
        hollonTaskMap.set(task.assignedHollonId, []);
      }
      hollonTaskMap.get(task.assignedHollonId)!.push(task);
    }

    const conflicts: ConflictResolution[] = [];
    const now = new Date();

    for (const [hollonId, hollonTasks] of hollonTaskMap.entries()) {
      const urgentTasks = hollonTasks.filter((t) => {
        const deadline = new Date(t.dueDate!);
        const hoursUntilDeadline =
          (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursUntilDeadline < 24; // 24시간 이내 마감
      });

      if (urgentTasks.length > 1) {
        const conflict = await this.conflictRepo.save({
          organizationId: hollonTasks[0].project.organizationId,
          conflictType: ConflictType.DEADLINE_CONFLICT,
          description: `Hollon ${hollonId} has ${urgentTasks.length} tasks due within 24 hours`,
          affectedTaskIds: urgentTasks.map((t) => t.id),
          affectedHollonIds: [hollonId],
          conflictContext: {
            hollonId,
            taskCount: urgentTasks.length,
          },
          status: ConflictStatus.DETECTED,
        });

        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * 충돌 해결
   */
  private async resolveConflict(
    conflict: ConflictResolution,
  ): Promise<ConflictResolutionResult> {
    this.logger.log(
      `Resolving conflict ${conflict.id} (${conflict.conflictType})`,
    );

    conflict.status = ConflictStatus.RESOLVING;
    await this.conflictRepo.save(conflict);

    let result: ConflictResolutionResult;

    switch (conflict.conflictType) {
      case ConflictType.FILE_CONFLICT:
        result = await this.resolveFileConflict(conflict);
        break;
      case ConflictType.RESOURCE_CONFLICT:
        result = await this.resolveResourceConflict(conflict);
        break;
      case ConflictType.PRIORITY_CONFLICT:
        result = await this.resolvePriorityConflict(conflict);
        break;
      case ConflictType.DEADLINE_CONFLICT:
        result = await this.resolveDeadlineConflict(conflict);
        break;
      default:
        result = await this.escalateConflict(conflict);
    }

    // 해결 결과 저장
    if (result.resolved) {
      conflict.status = ConflictStatus.RESOLVED;
      conflict.resolvedAt = new Date();
    } else {
      conflict.status = ConflictStatus.ESCALATED;
      conflict.escalatedAt = new Date();
    }

    conflict.resolutionStrategy = result.strategy;
    conflict.resolutionDetails = result.details;
    await this.conflictRepo.save(conflict);

    return result;
  }

  /**
   * 파일 충돌 해결: 순차 실행
   */
  private async resolveFileConflict(
    conflict: ConflictResolution,
  ): Promise<ConflictResolutionResult> {
    const tasks = await this.taskRepo.find({
      where: { id: In(conflict.affectedTaskIds) },
      order: { createdAt: 'ASC' },
    });

    if (tasks.length === 0) {
      return {
        resolved: false,
        strategy: ResolutionStrategy.MANUAL_INTERVENTION,
        details: 'No affected tasks found',
      };
    }

    // 첫 번째 태스크는 계속 진행, 나머지는 대기
    for (let i = 1; i < tasks.length; i++) {
      tasks[i].status = TaskStatus.BLOCKED;
      tasks[i].errorMessage =
        `File conflict - waiting for task ${tasks[0].id} to complete`;
      await this.taskRepo.save(tasks[i]);

      // 홀론에게 알림
      if (tasks[i].assignedHollonId) {
        await this.messageService.send({
          fromType: ParticipantType.SYSTEM,
          toId: tasks[i].assignedHollonId!,
          toType: ParticipantType.HOLLON,
          messageType: MessageType.CONFLICT_NOTIFICATION,
          content: `파일 충돌로 인해 Task "${tasks[0].title}" 완료 후 진행합니다.`,
          metadata: { conflictId: conflict.id, waitingFor: tasks[0].id },
        });
      }
    }

    return {
      resolved: true,
      strategy: ResolutionStrategy.SEQUENTIAL_EXECUTION,
      details: `Task ${tasks[0].id} continues, ${tasks.length - 1} tasks waiting`,
    };
  }

  /**
   * 리소스 충돌 해결: 리소스 재할당
   */
  private async resolveResourceConflict(
    conflict: ConflictResolution,
  ): Promise<ConflictResolutionResult> {
    const tasks = await this.taskRepo.find({
      where: { id: In(conflict.affectedTaskIds) },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });

    if (tasks.length === 0) {
      return {
        resolved: false,
        strategy: ResolutionStrategy.MANUAL_INTERVENTION,
        details: 'No affected tasks found',
      };
    }

    // 가장 높은 우선순위 태스크만 리소스 사용, 나머지는 대기
    const highestPriorityTask = tasks[0];
    for (let i = 1; i < tasks.length; i++) {
      tasks[i].status = TaskStatus.BLOCKED;
      tasks[i].errorMessage =
        `Resource conflict - waiting for task ${highestPriorityTask.id} to complete`;
      await this.taskRepo.save(tasks[i]);

      // 홀론에게 알림
      if (tasks[i].assignedHollonId) {
        await this.messageService.send({
          fromType: ParticipantType.SYSTEM,
          toId: tasks[i].assignedHollonId!,
          toType: ParticipantType.HOLLON,
          messageType: MessageType.CONFLICT_NOTIFICATION,
          content: `리소스 충돌로 인해 대기 중입니다. Task "${highestPriorityTask.title}" 완료 후 진행합니다.`,
          metadata: {
            conflictId: conflict.id,
            waitingFor: highestPriorityTask.id,
          },
        });
      }
    }

    return {
      resolved: true,
      strategy: ResolutionStrategy.RESOURCE_REALLOCATION,
      details: `Highest priority task ${highestPriorityTask.id} gets resources, ${tasks.length - 1} tasks waiting`,
    };
  }

  /**
   * 우선순위 충돌 해결: 우선순위 조정
   */
  private async resolvePriorityConflict(
    conflict: ConflictResolution,
  ): Promise<ConflictResolutionResult> {
    // 이 경우는 인간의 판단이 필요
    return this.escalateConflict(conflict);
  }

  /**
   * 마감일 충돌 해결: 에스컬레이션
   */
  private async resolveDeadlineConflict(
    conflict: ConflictResolution,
  ): Promise<ConflictResolutionResult> {
    // 마감일 충돌은 인간에게 에스컬레이션
    return this.escalateConflict(conflict);
  }

  /**
   * 충돌 에스컬레이션
   */
  private async escalateConflict(
    conflict: ConflictResolution,
  ): Promise<ConflictResolutionResult> {
    this.logger.warn(
      `Escalating conflict ${conflict.id}: requires human intervention`,
    );

    conflict.escalationReason = 'Requires human decision';

    // TODO: 인간에게 알림 전송 (이메일, Slack 등)

    return {
      resolved: false,
      strategy: ResolutionStrategy.MANUAL_INTERVENTION,
      details: 'Conflict escalated to human for resolution',
    };
  }

  /**
   * 조직의 활성 충돌 조회
   */
  async getActiveConflicts(
    organizationId: string,
  ): Promise<ConflictResolution[]> {
    return this.conflictRepo.find({
      where: {
        organizationId,
        status: In([
          ConflictStatus.DETECTED,
          ConflictStatus.RESOLVING,
          ConflictStatus.ESCALATED,
        ]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 충돌 수동 해결
   */
  async manuallyResolve(
    conflictId: string,
    resolutionDetails: string,
  ): Promise<ConflictResolution> {
    const conflict = await this.conflictRepo.findOne({
      where: { id: conflictId },
    });

    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    conflict.status = ConflictStatus.RESOLVED;
    conflict.resolvedAt = new Date();
    conflict.resolutionStrategy = ResolutionStrategy.MANUAL_INTERVENTION;
    conflict.resolutionDetails = resolutionDetails;

    await this.conflictRepo.save(conflict);

    this.logger.log(`Conflict ${conflictId} manually resolved`);
    return conflict;
  }
}
