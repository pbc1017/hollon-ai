import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
} from '../../task/entities/task.entity';
import { Hollon, HollonLifecycle } from '../../hollon/entities/hollon.entity';

export interface SubtaskDefinition {
  title: string;
  description: string;
  type: string;
  acceptanceCriteria?: string[];
  affectedFiles?: string[];
  priority?: string;
}

export interface SubtaskCreationOptions {
  validateDepth?: boolean;
  validateCount?: boolean;
}

export interface SubtaskCreationResult {
  success: boolean;
  createdSubtasks: Task[];
  errors?: string[];
}

@Injectable()
export class SubtaskCreationService {
  private readonly logger = new Logger(SubtaskCreationService.name);

  // Configuration
  private readonly MAX_SUBTASK_DEPTH = 3;
  private readonly MAX_SUBTASKS_PER_PARENT = 10;

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
  ) {}

  /**
   * Create subtasks for a parent task
   * Validates depth and count limits before creating
   */
  async createSubtasks(
    parentTaskId: string,
    subtaskDefinitions: SubtaskDefinition[],
    options: SubtaskCreationOptions = {
      validateDepth: true,
      validateCount: true,
    },
  ): Promise<SubtaskCreationResult> {
    this.logger.log(
      `Creating ${subtaskDefinitions.length} subtasks for parent task ${parentTaskId}`,
    );

    const errors: string[] = [];

    // 1. Validate parent task exists
    const parentTask = await this.taskRepo.findOne({
      where: { id: parentTaskId },
      relations: ['subtasks'],
    });

    if (!parentTask) {
      return {
        success: false,
        createdSubtasks: [],
        errors: [`Parent task ${parentTaskId} not found`],
      };
    }

    // 2. Validate depth limit
    if (options.validateDepth) {
      const currentDepth = await this.calculateTaskDepth(parentTaskId);
      if (currentDepth >= this.MAX_SUBTASK_DEPTH) {
        this.logger.warn(
          `Task ${parentTaskId} is at max depth ${this.MAX_SUBTASK_DEPTH}, cannot create subtasks`,
        );
        return {
          success: false,
          createdSubtasks: [],
          errors: [
            `Maximum subtask depth (${this.MAX_SUBTASK_DEPTH}) reached. Cannot create deeper subtasks.`,
          ],
        };
      }
    }

    // 3. Validate count limit
    if (options.validateCount) {
      const existingSubtaskCount = parentTask.subtasks?.length || 0;
      const totalCount = existingSubtaskCount + subtaskDefinitions.length;

      if (totalCount > this.MAX_SUBTASKS_PER_PARENT) {
        this.logger.warn(
          `Task ${parentTaskId} would exceed max subtask count: ${totalCount} > ${this.MAX_SUBTASKS_PER_PARENT}`,
        );
        return {
          success: false,
          createdSubtasks: [],
          errors: [
            `Maximum subtask count (${this.MAX_SUBTASKS_PER_PARENT}) would be exceeded. Current: ${existingSubtaskCount}, Requested: ${subtaskDefinitions.length}`,
          ],
        };
      }
    }

    // 4. Create subtasks
    const createdSubtasks: Task[] = [];
    for (const definition of subtaskDefinitions) {
      try {
        const subtask = this.taskRepo.create({
          ...definition,
          parentTaskId: parentTaskId,
          projectId: parentTask.projectId,
          organizationId: parentTask.organizationId, // Phase 3.8: Set organizationId
          assignedTeamId: parentTask.assignedTeamId, // Phase 4: Inherit team from parent
          depth: (parentTask.depth || 0) + 1, // Phase 3.8: Set depth
          status: TaskStatus.READY,
          assignedHollonId: null, // Subtasks start unassigned
          reviewerHollonId: parentTask.assignedHollonId, // Phase 3.16: Parent's manager reviews
          retryCount: 0,
          priority:
            (definition.priority as TaskPriority) || parentTask.priority,
          type: (definition.type as TaskType) || TaskType.IMPLEMENTATION,
          // Phase 3.12: Inherit workingDirectory from parent (for temporary hollon's subtasks)
          workingDirectory: parentTask.workingDirectory,
        });

        const savedSubtask = await this.taskRepo.save(subtask);
        createdSubtasks.push(savedSubtask);
        this.logger.log(
          `Created subtask ${savedSubtask.id}: ${savedSubtask.title}`,
        );
      } catch (error) {
        const errorMsg = `Failed to create subtask "${definition.title}": ${error instanceof Error ? error.message : String(error)}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // 5. Update parent task status if subtasks were created
    if (createdSubtasks.length > 0) {
      await this.updateParentTaskStatus(parentTaskId);
    }

    const allSuccessful = createdSubtasks.length === subtaskDefinitions.length;

    this.logger.log(
      `Subtask creation completed: ${createdSubtasks.length}/${subtaskDefinitions.length} successful`,
    );

    return {
      success: allSuccessful,
      createdSubtasks,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Calculate the depth of a task in the task tree
   * Root tasks (no parent) have depth 0
   * Direct children have depth 1, etc.
   */
  async calculateTaskDepth(taskId: string): Promise<number> {
    let depth = 0;
    let currentTaskId: string | null = taskId;

    // Traverse up the parent chain
    while (currentTaskId) {
      const task = await this.taskRepo.findOne({
        where: { id: currentTaskId },
        select: ['id', 'parentTaskId'],
      });

      if (!task) {
        break;
      }

      if (task.parentTaskId) {
        depth++;
        currentTaskId = task.parentTaskId;
      } else {
        break;
      }
    }

    return depth;
  }

  /**
   * Update parent task status based on subtask completion
   * - If all subtasks completed → parent becomes COMPLETED
   * - If any subtask failed → parent becomes BLOCKED
   * - If any subtask in progress → parent stays IN_PROGRESS
   * - Otherwise → parent stays current status
   */
  async updateParentTaskStatus(parentTaskId: string): Promise<void> {
    const parentTask = await this.taskRepo.findOne({
      where: { id: parentTaskId },
      relations: ['subtasks'],
    });

    if (
      !parentTask ||
      !parentTask.subtasks ||
      parentTask.subtasks.length === 0
    ) {
      return;
    }

    const subtasks = parentTask.subtasks;

    // Check various conditions
    const allCompleted = subtasks.every(
      (t) => t.status === TaskStatus.COMPLETED,
    );
    const anyFailed = subtasks.some((t) => t.status === TaskStatus.FAILED);
    const anyInProgress = subtasks.some(
      (t) => t.status === TaskStatus.IN_PROGRESS,
    );
    const anyBlocked = subtasks.some((t) => t.status === TaskStatus.BLOCKED);

    let newStatus: TaskStatus | null = null;

    if (allCompleted) {
      // Phase 3.10: Change COMPLETED → READY_FOR_REVIEW (LLM 검토 필요)
      newStatus = TaskStatus.READY_FOR_REVIEW;
      this.logger.log(
        `Parent task ${parentTaskId}: All subtasks completed → READY_FOR_REVIEW (awaiting LLM review)`,
      );

      // Phase 3.10: Temporary hollon cleanup moved to completeParentTaskByLLM()
      // LLM will explicitly complete the task after review
    } else if (anyFailed) {
      newStatus = TaskStatus.BLOCKED;
      this.logger.log(
        `Parent task ${parentTaskId}: Subtask(s) failed → BLOCKED`,
      );
    } else if (anyBlocked) {
      newStatus = TaskStatus.BLOCKED;
      this.logger.log(
        `Parent task ${parentTaskId}: Subtask(s) blocked → BLOCKED`,
      );
    } else if (anyInProgress) {
      if (parentTask.status !== TaskStatus.IN_PROGRESS) {
        newStatus = TaskStatus.IN_PROGRESS;
        this.logger.log(
          `Parent task ${parentTaskId}: Subtask(s) in progress → IN_PROGRESS`,
        );
      }
    }

    // Update status if changed
    if (newStatus && newStatus !== parentTask.status) {
      await this.taskRepo.update(parentTaskId, { status: newStatus });
      this.logger.log(
        `Updated parent task ${parentTaskId} status: ${parentTask.status} → ${newStatus}`,
      );
    }
  }

  /**
   * Phase 3.7: Clean up temporary Hollon after all subtasks complete
   *
   * If the creator of subtasks was a temporary Hollon and all its created tasks
   * are now complete, delete the temporary Hollon.
   */
  private async cleanupTemporaryHollon(parentTask: Task): Promise<void> {
    // Load the task with creator hollon relation
    const taskWithCreator = await this.taskRepo.findOne({
      where: { id: parentTask.id },
      relations: ['creatorHollon', 'creatorHollon.createdTasks'],
    });

    if (!taskWithCreator || !taskWithCreator.creatorHollon) {
      return; // No creator hollon to clean up
    }

    const creatorHollon = taskWithCreator.creatorHollon;

    // Only clean up temporary hollons
    if (creatorHollon.lifecycle !== HollonLifecycle.TEMPORARY) {
      return;
    }

    // Check if ALL tasks created by this hollon are completed
    if (
      !creatorHollon.createdTasks ||
      creatorHollon.createdTasks.length === 0
    ) {
      return;
    }

    const allCreatedTasksComplete = creatorHollon.createdTasks.every(
      (task) => task.status === TaskStatus.COMPLETED,
    );

    if (allCreatedTasksComplete) {
      this.logger.log(
        `Cleaning up temporary Hollon ${creatorHollon.id} (${creatorHollon.name}) - all created tasks completed`,
      );

      try {
        await this.hollonRepo.remove(creatorHollon);
        this.logger.log(
          `Successfully deleted temporary Hollon ${creatorHollon.name}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to delete temporary Hollon ${creatorHollon.name}: ${error}`,
        );
      }
    }
  }

  /**
   * Phase 3.10: LLM explicitly completes parent task after review
   *
   * This method is called only when the LLM decides to complete the task
   * after reviewing all subtask results. It:
   * 1. Sets task status to COMPLETED
   * 2. Cleans up temporary hollons if applicable
   */
  async completeParentTaskByLLM(parentTaskId: string): Promise<void> {
    const parentTask = await this.taskRepo.findOne({
      where: { id: parentTaskId },
    });

    if (!parentTask) {
      this.logger.error(`Parent task ${parentTaskId} not found`);
      return;
    }

    // Update status to COMPLETED
    await this.taskRepo.update(parentTaskId, {
      status: TaskStatus.COMPLETED,
      completedAt: new Date(),
    });

    this.logger.log(
      `✅ Parent task ${parentTaskId} explicitly completed by LLM review`,
    );

    // Clean up temporary hollon if it created these subtasks
    await this.cleanupTemporaryHollon(parentTask);
  }

  /**
   * Validate subtask count against limit
   */
  validateSubtaskCount(count: number): boolean {
    return count > 0 && count <= this.MAX_SUBTASKS_PER_PARENT;
  }

  /**
   * Get all subtasks for a parent task
   */
  async getSubtasks(parentTaskId: string): Promise<Task[]> {
    return this.taskRepo.find({
      where: { parentTaskId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get subtask tree with all descendants
   */
  async getSubtaskTree(parentTaskId: string): Promise<Task[]> {
    const allSubtasks: Task[] = [];
    const queue: string[] = [parentTaskId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const directSubtasks = await this.getSubtasks(currentId);

      allSubtasks.push(...directSubtasks);

      // Add children to queue for breadth-first traversal
      queue.push(...directSubtasks.map((t) => t.id));
    }

    return allSubtasks;
  }

  /**
   * Check if a task can have more subtasks
   */
  async canCreateMoreSubtasks(parentTaskId: string): Promise<{
    canCreate: boolean;
    reason?: string;
    currentCount?: number;
    currentDepth?: number;
  }> {
    // Check depth
    const depth = await this.calculateTaskDepth(parentTaskId);
    if (depth >= this.MAX_SUBTASK_DEPTH) {
      return {
        canCreate: false,
        reason: `Maximum depth (${this.MAX_SUBTASK_DEPTH}) reached`,
        currentDepth: depth,
      };
    }

    // Check count
    const subtasks = await this.getSubtasks(parentTaskId);
    if (subtasks.length >= this.MAX_SUBTASKS_PER_PARENT) {
      return {
        canCreate: false,
        reason: `Maximum subtask count (${this.MAX_SUBTASKS_PER_PARENT}) reached`,
        currentCount: subtasks.length,
      };
    }

    return {
      canCreate: true,
      currentCount: subtasks.length,
      currentDepth: depth,
    };
  }

  /**
   * Get configuration limits
   */
  getLimits() {
    return {
      maxDepth: this.MAX_SUBTASK_DEPTH,
      maxSubtasksPerParent: this.MAX_SUBTASKS_PER_PARENT,
    };
  }

  /**
   * Phase 3.7: Check and unblock BLOCKED tasks after any task status update
   *
   * Public method that should be called after a task's status changes to COMPLETED.
   * Checks all BLOCKED sibling tasks and unblocks them if their dependencies are satisfied.
   */
  async checkAndUnblockDependencies(parentTaskId: string): Promise<void> {
    try {
      // Find all BLOCKED tasks under this parent
      const blockedTasks = await this.taskRepo.find({
        where: {
          parentTaskId: parentTaskId,
          status: TaskStatus.BLOCKED,
        },
        relations: ['dependencies'],
      });

      if (blockedTasks.length === 0) {
        return;
      }

      this.logger.log(
        `Checking ${blockedTasks.length} blocked tasks for unblocking under parent ${parentTaskId}`,
      );

      for (const blockedTask of blockedTasks) {
        if (
          !blockedTask.dependencies ||
          blockedTask.dependencies.length === 0
        ) {
          // No dependencies but still BLOCKED? Unblock immediately
          await this.taskRepo.update(
            { id: blockedTask.id },
            { status: TaskStatus.READY },
          );
          this.logger.log(
            `Unblocked task ${blockedTask.id} "${blockedTask.title}": no dependencies`,
          );
          continue;
        }

        // Check if ALL dependencies are completed
        const allDepsCompleted = blockedTask.dependencies.every(
          (dep) => dep.status === TaskStatus.COMPLETED,
        );

        if (allDepsCompleted) {
          // Unblock: BLOCKED → READY
          await this.taskRepo.update(
            { id: blockedTask.id },
            { status: TaskStatus.READY },
          );
          this.logger.log(
            `✅ Unblocked task ${blockedTask.id} "${blockedTask.title}": all ${blockedTask.dependencies.length} dependencies completed`,
          );
        } else {
          const remainingDeps = blockedTask.dependencies.filter(
            (dep) => dep.status !== TaskStatus.COMPLETED,
          );
          this.logger.debug(
            `Task ${blockedTask.id} still blocked: ${remainingDeps.length}/${blockedTask.dependencies.length} dependencies pending`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error checking dependencies for parent ${parentTaskId}: ${error}`,
      );
      // Don't throw - unblocking is best-effort
    }
  }

  /**
   * Phase 3.7: Check and unblock BLOCKED tasks when their dependencies complete
   *
   * Called when a task completes. Searches for BLOCKED tasks that depend on this task
   * and unblocks them if ALL their dependencies are now completed.
   *
   * This enables sequential-parallel execution:
   * - Research (READY) → executes immediately
   * - Design (BLOCKED, depends on Research) → unblocks when Research completes
   * - Implementation 1,2,3 (BLOCKED, depend on Design) → all unblock in parallel when Design completes
   *
   * @deprecated Use checkAndUnblockDependencies(parentTaskId) instead
   */
  // @ts-expect-error - Reserved for future use

  private async checkAndUnblockDependentTasks(
    completedTaskId: string,
  ): Promise<void> {
    try {
      // Find the completed task to get its parent context
      const completedTask = await this.taskRepo.findOne({
        where: { id: completedTaskId },
        relations: ['parentTask'],
      });

      if (!completedTask || !completedTask.parentTask) {
        // Not a subtask, nothing to unblock
        return;
      }

      // Find all BLOCKED siblings (subtasks with same parent)
      const blockedSiblings = await this.taskRepo.find({
        where: {
          parentTaskId: completedTask.parentTask.id,
          status: TaskStatus.BLOCKED,
        },
        relations: ['dependencies'],
      });

      if (blockedSiblings.length === 0) {
        this.logger.debug(
          `No blocked siblings to check for task ${completedTaskId}`,
        );
        return;
      }

      this.logger.log(
        `Checking ${blockedSiblings.length} blocked siblings for unblocking after task ${completedTaskId} completed`,
      );

      // Check each blocked task
      for (const blockedTask of blockedSiblings) {
        if (
          !blockedTask.dependencies ||
          blockedTask.dependencies.length === 0
        ) {
          // No dependencies but still BLOCKED? Unblock immediately
          await this.taskRepo.update(
            { id: blockedTask.id },
            { status: TaskStatus.READY },
          );
          this.logger.log(
            `Unblocked task ${blockedTask.id} "${blockedTask.title}": no dependencies`,
          );
          continue;
        }

        // Check if ALL dependencies are completed
        const allDepsCompleted = blockedTask.dependencies.every(
          (dep) => dep.status === TaskStatus.COMPLETED,
        );

        if (allDepsCompleted) {
          // Unblock: BLOCKED → READY
          await this.taskRepo.update(
            { id: blockedTask.id },
            { status: TaskStatus.READY },
          );
          this.logger.log(
            `✅ Unblocked task ${blockedTask.id} "${blockedTask.title}": all ${blockedTask.dependencies.length} dependencies completed`,
          );
        } else {
          const remainingDeps = blockedTask.dependencies.filter(
            (dep) => dep.status !== TaskStatus.COMPLETED,
          );
          this.logger.debug(
            `Task ${blockedTask.id} still blocked: ${remainingDeps.length}/${blockedTask.dependencies.length} dependencies pending`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error checking dependent tasks for ${completedTaskId}: ${error}`,
      );
      // Don't throw - unblocking is best-effort
    }
  }
}
