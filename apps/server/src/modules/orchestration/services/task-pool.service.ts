import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';
import { Task, TaskStatus, TaskType } from '../../task/entities/task.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Team } from '../../team/entities/team.entity';

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
    const now = new Date();

    // Check if this hollon is a manager (Phase 4)
    const managedTeams = await this.hollonRepo.manager
      .getRepository(Team)
      .find({
        where: { managerHollonId: hollon.id },
      });
    const isManager = managedTeams.length > 0;

    // Priority 0: Review tasks (highest priority - Phase 3.10)
    let task = await this.findReviewReadyTask(hollonId);
    if (task) {
      return this.claimTask(
        task,
        hollon,
        'Review subtasks - all subtasks completed, needs parent review',
      );
    }

    // Priority 1: Directly assigned tasks
    task = await this.findDirectlyAssignedTask(hollonId, lockedFiles, now);
    if (task) {
      return this.claimTask(task, hollon, 'Directly assigned');
    }

    // Priority 2: Team Epic tasks for managers (Phase 3.8+)
    // Managers pull team_epic tasks assigned to their managed teams
    task = await this.findManagedTeamEpicTask(hollon, now);
    if (task) {
      return this.claimTask(
        task,
        hollon,
        'Managed team epic - needs decomposition',
      );
    }

    // Phase 4: Managers ONLY handle team_epic tasks (Priority 2)
    // Skip implementation/review task assignment for managers
    if (!isManager) {
      // Priority 3: Same-file tasks (continuation of work)
      task = await this.findSameFileTask(hollon, lockedFiles, now);
      if (task) {
        return this.claimTask(task, hollon, 'Same-file continuation');
      }

      // Priority 4: Team unassigned tasks
      task = await this.findTeamUnassignedTask(hollon, lockedFiles, now);
      if (task) {
        return this.claimTask(task, hollon, 'Team unassigned');
      }

      // Priority 5: Role matching tasks across organization
      task = await this.findRoleMatchingTask(hollon, lockedFiles, now);
      if (task) {
        return this.claimTask(task, hollon, 'Role matching');
      }
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
   * Check if task is currently blocked by exponential backoff
   */
  private isTaskBlocked(task: Task, now: Date): boolean {
    if (!task.blockedUntil) {
      return false;
    }
    return task.blockedUntil.getTime() > now.getTime();
  }

  /**
   * Priority 0: Find parent tasks ready for review (Phase 3.10)
   *
   * Conditions:
   * - status = READY_FOR_REVIEW
   * - assignedHollonId = this hollon
   * - All subtasks are COMPLETED
   * - reviewCount < 3 (prevent infinite loop)
   */
  private async findReviewReadyTask(hollonId: string): Promise<Task | null> {
    const tasks = await this.taskRepo.find({
      where: {
        assignedHollonId: hollonId,
        status: TaskStatus.READY_FOR_REVIEW,
      },
      relations: ['subtasks'],
      order: {
        priority: 'ASC',
        lastReviewedAt: 'ASC', // 오래된 것 우선
      },
    });

    for (const task of tasks) {
      // 무한루프 방지
      if (task.reviewCount >= 3) {
        this.logger.warn(
          `Task ${task.id} exceeded max review count (3), skipping`,
        );
        continue;
      }

      // 모든 서브태스크 완료 확인
      const allSubtasksCompleted =
        task.subtasks && task.subtasks.length > 0
          ? task.subtasks.every((st) => st.status === TaskStatus.COMPLETED)
          : false;

      if (!allSubtasksCompleted) {
        this.logger.warn(
          `Task ${task.id} marked READY_FOR_REVIEW but not all subtasks completed`,
        );
        continue;
      }

      return task;
    }

    return null;
  }

  /**
   * Priority 1: Find directly assigned task
   */
  private async findDirectlyAssignedTask(
    hollonId: string,
    lockedFiles: string[],
    now: Date,
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
      if (this.isTaskBlocked(task, now)) {
        continue;
      }
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
    now: Date,
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
      .andWhere('task.type != :teamEpic', { teamEpic: TaskType.TEAM_EPIC }) // Phase 4: Exclude team_epic
      .andWhere('task.affected_files && ARRAY[:...workedFiles]::text[]', {
        workedFiles: Array.from(workedFiles),
      })
      .orderBy('task.priority', 'ASC')
      .addOrderBy('task.created_at', 'ASC')
      .getMany();

    for (const task of candidateTasks) {
      if (this.isTaskBlocked(task, now)) {
        continue;
      }
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
    now: Date,
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
        type: Not(TaskType.TEAM_EPIC), // Phase 4: Exclude team_epic
      },
      order: {
        priority: 'ASC',
        createdAt: 'ASC',
      },
    });

    for (const task of tasks) {
      if (this.isTaskBlocked(task, now)) {
        continue;
      }
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
   * Phase 3.8+: Find team_epic tasks for teams managed by this hollon
   * Team managers should pull team_epic tasks assigned to their managed teams
   * and decompose them into implementation tasks for team members
   */
  private async findManagedTeamEpicTask(
    hollon: Hollon,
    now: Date,
  ): Promise<Task | null> {
    // Find all teams managed by this hollon
    const managedTeams = await this.hollonRepo.manager
      .getRepository(Team)
      .find({
        where: { managerHollonId: hollon.id },
      });

    if (managedTeams.length === 0) {
      return null; // Not a manager
    }

    const teamIds = managedTeams.map((team) => team.id);

    // Find team_epic tasks assigned to these teams
    const tasks = await this.taskRepo.find({
      where: {
        assignedTeamId: In(teamIds),
        type: TaskType.TEAM_EPIC,
        status: In([TaskStatus.READY, TaskStatus.PENDING]),
      },
      order: {
        priority: 'ASC',
        createdAt: 'ASC',
      },
    });

    for (const task of tasks) {
      if (this.isTaskBlocked(task, now)) {
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
    now: Date,
  ): Promise<Task | null> {
    // Find tasks that match this hollon's role
    // For now, just find any unassigned task in the organization
    const tasks = await this.taskRepo.find({
      where: {
        assignedHollonId: IsNull(),
        status: In([TaskStatus.READY, TaskStatus.PENDING]),
        type: Not(TaskType.TEAM_EPIC), // Phase 4: Exclude team_epic
      },
      order: {
        priority: 'ASC',
        createdAt: 'ASC',
      },
      take: 20,
    });

    for (const task of tasks) {
      if (this.isTaskBlocked(task, now)) {
        continue;
      }
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
   * Phase 3.10: Handle READY_FOR_REVIEW → IN_REVIEW transition
   */
  private async claimTask(
    task: Task,
    hollon: Hollon,
    reason: string,
  ): Promise<TaskPullResult> {
    // Determine target status based on current status
    const isReviewTask = task.status === TaskStatus.READY_FOR_REVIEW;
    const newStatus = isReviewTask
      ? TaskStatus.IN_REVIEW
      : TaskStatus.IN_PROGRESS;

    // Prepare update data
    const updateData: any = {
      assignedHollonId: hollon.id,
      status: newStatus,
    };

    // Add review tracking for review tasks
    if (isReviewTask) {
      updateData.lastReviewedAt = new Date();
      updateData.reviewCount = () => 'review_count + 1'; // Increment reviewCount
    } else {
      updateData.startedAt = new Date();
    }

    // Build dynamic WHERE clause based on task type
    const allowedStatuses = isReviewTask
      ? [TaskStatus.READY_FOR_REVIEW]
      : [TaskStatus.READY, TaskStatus.PENDING];

    // Use transaction for atomic update
    const result = await this.taskRepo
      .createQueryBuilder()
      .update(Task)
      .set(updateData)
      .where('id = :id', { id: task.id })
      .andWhere('status IN (:...statuses)', {
        statuses: allowedStatuses,
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
      `Task claimed: ${task.id} by ${hollon.name} (reason: ${reason}, status: ${task.status} → ${newStatus})`,
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
   * Complete task (reset backoff counters on success)
   */
  async completeTask(taskId: string): Promise<void> {
    await this.taskRepo.update(
      { id: taskId },
      {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        consecutiveFailures: 0, // Reset on success
        blockedUntil: null,
        lastFailedAt: null,
      },
    );

    this.logger.log(`Task completed: ${taskId}`);
  }

  /**
   * Mark task as failed with exponential backoff
   *
   * Phase 3.7: Exponential backoff to prevent infinite loops
   * - 1st failure: 5 minutes
   * - 2nd failure: 15 minutes
   * - 3rd+ failure: 1 hour
   */
  async failTask(taskId: string, errorMessage: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      this.logger.error(`Task not found: ${taskId}`);
      return;
    }

    const now = new Date();
    const consecutiveFailures = (task.consecutiveFailures || 0) + 1;

    // Calculate backoff duration
    let backoffMinutes: number;
    if (consecutiveFailures === 1) {
      backoffMinutes = 5; // 5 minutes
    } else if (consecutiveFailures === 2) {
      backoffMinutes = 15; // 15 minutes
    } else {
      backoffMinutes = 60; // 1 hour
    }

    const blockedUntil = new Date(now.getTime() + backoffMinutes * 60 * 1000);

    await this.taskRepo.update(
      { id: taskId },
      {
        status: TaskStatus.READY, // Set to READY instead of FAILED (for retry)
        errorMessage,
        consecutiveFailures,
        lastFailedAt: now,
        blockedUntil,
      },
    );

    this.logger.warn(
      `Task ${taskId} failed (attempt ${consecutiveFailures}). ` +
        `Blocked until ${blockedUntil.toISOString()} (${backoffMinutes} min). ` +
        `Error: ${errorMessage}`,
    );
  }
}
