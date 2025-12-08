import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';

export interface TaskPullResult {
  task: Task | null;
  reason: string;
}

/**
 * TaskPoolService
 *
 * Smart task allocation with priority logic:
 * 1. Directly assigned tasks (assignedHollonId matches)
 * 2. Same-file tasks (affectedFiles overlap with current working files)
 * 3. Team unassigned tasks (same team, no assignment)
 * 4. Role matching tasks (same role across organization)
 *
 * Safety features:
 * - File conflict prevention (no two hollons work on same files simultaneously)
 * - Dependency checking (dependencies must be completed first)
 * - Atomic task claiming (prevents race conditions)
 */
@Injectable()
export class TaskPoolService {
  private readonly logger = new Logger(TaskPoolService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
  ) {}

  /**
   * Pull next available task for the hollon
   */
  async pullNextTask(hollonId: string): Promise<TaskPullResult> {
    this.logger.log(`Pulling next task for hollon: ${hollonId}`);

    const hollon = await this.hollonRepo.findOne({
      where: { id: hollonId },
      relations: ['team', 'role', 'assignedTasks'],
    });

    if (!hollon) {
      return {
        task: null,
        reason: `Hollon not found: ${hollonId}`,
      };
    }

    // Get currently locked files (files being worked on by other hollons)
    const lockedFiles = await this.getLockedFiles(hollonId);

    // Priority 1: Directly assigned tasks
    let task = await this.findDirectlyAssignedTask(hollonId, lockedFiles);
    if (task) {
      return this.claimTask(task, hollon, 'Directly assigned');
    }

    // Priority 2: Same-file tasks (continuation of work)
    task = await this.findSameFileTask(hollon, lockedFiles);
    if (task) {
      return this.claimTask(task, hollon, 'Same-file continuation');
    }

    // Priority 3: Team unassigned tasks
    task = await this.findTeamUnassignedTask(hollon, lockedFiles);
    if (task) {
      return this.claimTask(task, hollon, 'Team unassigned');
    }

    // Priority 4: Role matching tasks across organization
    task = await this.findRoleMatchingTask(hollon, lockedFiles);
    if (task) {
      return this.claimTask(task, hollon, 'Role matching');
    }

    this.logger.log(`No available tasks for hollon: ${hollonId}`);
    return {
      task: null,
      reason: 'No available tasks',
    };
  }

  /**
   * Get list of files currently being worked on by other hollons
   */
  private async getLockedFiles(excludeHollonId: string): Promise<string[]> {
    const activeTasks = await this.taskRepo.find({
      where: {
        status: TaskStatus.IN_PROGRESS,
        assignedHollonId: Not(excludeHollonId),
      },
      select: ['affectedFiles'],
    });

    const lockedFiles = new Set<string>();
    for (const task of activeTasks) {
      if (task.affectedFiles) {
        task.affectedFiles.forEach((file) => lockedFiles.add(file));
      }
    }

    return Array.from(lockedFiles);
  }

  /**
   * Check if task has file conflicts with locked files
   */
  private hasFileConflict(task: Task, lockedFiles: string[]): boolean {
    if (!task.affectedFiles || task.affectedFiles.length === 0) {
      return false;
    }

    return task.affectedFiles.some((file) => lockedFiles.includes(file));
  }

  /**
   * Check if task's dependencies are all completed
   */
  private async areDependenciesCompleted(_task: Task): Promise<boolean> {
    // TODO: Implement dependency graph checking
    // For now, assume no dependencies or all completed
    return true;
  }

  /**
   * Priority 1: Find directly assigned task
   */
  private async findDirectlyAssignedTask(
    hollonId: string,
    lockedFiles: string[],
  ): Promise<Task | null> {
    const tasks = await this.taskRepo.find({
      where: {
        assignedHollonId: hollonId,
        status: In([TaskStatus.READY, TaskStatus.PENDING]),
      },
      order: {
        priority: 'ASC', // P1 < P2 < P3 < P4
        createdAt: 'ASC',
      },
    });

    for (const task of tasks) {
      if (this.hasFileConflict(task, lockedFiles)) {
        continue;
      }
      if (!(await this.areDependenciesCompleted(task))) {
        continue;
      }
      return task;
    }

    return null;
  }

  /**
   * Priority 2: Find same-file task (continuation)
   */
  private async findSameFileTask(
    hollon: Hollon,
    lockedFiles: string[],
  ): Promise<Task | null> {
    // Get files this hollon has worked on recently
    const recentTasks = await this.taskRepo.find({
      where: {
        assignedHollonId: hollon.id,
        status: TaskStatus.COMPLETED,
      },
      order: {
        completedAt: 'DESC',
      },
      take: 5,
    });

    const workedFiles = new Set<string>();
    for (const task of recentTasks) {
      if (task.affectedFiles) {
        task.affectedFiles.forEach((file) => workedFiles.add(file));
      }
    }

    if (workedFiles.size === 0) {
      return null;
    }

    // Find unassigned tasks with overlapping files
    const candidateTasks = await this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.project', 'project')
      .where('task.status IN (:...statuses)', {
        statuses: [TaskStatus.READY, TaskStatus.PENDING],
      })
      .andWhere('task.assigned_hollon_id IS NULL')
      .andWhere('task.affected_files && ARRAY[:...workedFiles]::text[]', {
        workedFiles: Array.from(workedFiles),
      })
      .orderBy('task.priority', 'ASC')
      .addOrderBy('task.created_at', 'ASC')
      .getMany();

    for (const task of candidateTasks) {
      if (this.hasFileConflict(task, lockedFiles)) {
        continue;
      }
      if (!(await this.areDependenciesCompleted(task))) {
        continue;
      }
      return task;
    }

    return null;
  }

  /**
   * Priority 3: Find team unassigned task
   */
  private async findTeamUnassignedTask(
    hollon: Hollon,
    lockedFiles: string[],
  ): Promise<Task | null> {
    if (!hollon.teamId) {
      return null;
    }

    // Get all projects this team works on
    const teamHollons = await this.hollonRepo.find({
      where: { teamId: hollon.teamId },
      relations: ['assignedTasks'],
    });

    const projectIds = new Set<string>();
    for (const teamHollon of teamHollons) {
      if (teamHollon.assignedTasks) {
        teamHollon.assignedTasks.forEach((task) =>
          projectIds.add(task.projectId),
        );
      }
    }

    if (projectIds.size === 0) {
      return null;
    }

    const tasks = await this.taskRepo.find({
      where: {
        projectId: In(Array.from(projectIds)),
        assignedHollonId: IsNull(),
        status: In([TaskStatus.READY, TaskStatus.PENDING]),
      },
      order: {
        priority: 'ASC',
        createdAt: 'ASC',
      },
    });

    for (const task of tasks) {
      if (this.hasFileConflict(task, lockedFiles)) {
        continue;
      }
      if (!(await this.areDependenciesCompleted(task))) {
        continue;
      }
      return task;
    }

    return null;
  }

  /**
   * Priority 4: Find role matching task across organization
   */
  private async findRoleMatchingTask(
    _hollon: Hollon,
    lockedFiles: string[],
  ): Promise<Task | null> {
    // Find tasks that match this hollon's role
    // For now, just find any unassigned task in the organization
    const tasks = await this.taskRepo.find({
      where: {
        assignedHollonId: IsNull(),
        status: In([TaskStatus.READY, TaskStatus.PENDING]),
      },
      order: {
        priority: 'ASC',
        createdAt: 'ASC',
      },
      take: 20,
    });

    for (const task of tasks) {
      if (this.hasFileConflict(task, lockedFiles)) {
        continue;
      }
      if (!(await this.areDependenciesCompleted(task))) {
        continue;
      }
      return task;
    }

    return null;
  }

  /**
   * Atomically claim a task for the hollon
   */
  private async claimTask(
    task: Task,
    hollon: Hollon,
    reason: string,
  ): Promise<TaskPullResult> {
    // Use transaction for atomic update
    const result = await this.taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({
        assignedHollonId: hollon.id,
        status: TaskStatus.IN_PROGRESS,
        startedAt: new Date(),
      })
      .where('id = :id', { id: task.id })
      .andWhere('status IN (:...statuses)', {
        statuses: [TaskStatus.READY, TaskStatus.PENDING],
      })
      .andWhere(
        '(assigned_hollon_id IS NULL OR assigned_hollon_id = :hollonId)',
        { hollonId: hollon.id },
      )
      .execute();

    if (result.affected === 0) {
      this.logger.warn(
        `Failed to claim task ${task.id} - already claimed by another hollon`,
      );
      return {
        task: null,
        reason: 'Task already claimed',
      };
    }

    // Reload task with updated data
    const claimedTask = await this.taskRepo.findOne({
      where: { id: task.id },
      relations: ['project'],
    });

    this.logger.log(
      `Task claimed: ${task.id} by ${hollon.name} (reason: ${reason})`,
    );

    return {
      task: claimedTask,
      reason,
    };
  }

  /**
   * Release task (on error or cancellation)
   */
  async releaseTask(taskId: string, errorMessage?: string): Promise<void> {
    const updateData: any = {
      status: TaskStatus.READY,
      retryCount: () => 'retry_count + 1',
    };

    // TypeORM update doesn't accept null for non-nullable fields, so we use raw SQL
    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    await this.taskRepo
      .createQueryBuilder()
      .update(Task)
      .set(updateData)
      .where('id = :id', { id: taskId })
      .execute();

    // Separately set assignedHollonId to null using raw update
    await this.taskRepo.query(
      `UPDATE hollon.tasks SET assigned_hollon_id = NULL WHERE id = $1`,
      [taskId],
    );

    this.logger.log(`Task released: ${taskId}`);
  }

  /**
   * Complete task
   */
  async completeTask(taskId: string): Promise<void> {
    await this.taskRepo.update(
      { id: taskId },
      {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
      },
    );

    this.logger.log(`Task completed: ${taskId}`);
  }

  /**
   * Mark task as failed
   */
  async failTask(taskId: string, errorMessage: string): Promise<void> {
    await this.taskRepo.update(
      { id: taskId },
      {
        status: TaskStatus.FAILED,
        errorMessage,
        completedAt: new Date(),
      },
    );

    this.logger.log(`Task failed: ${taskId} - ${errorMessage}`);
  }
}
