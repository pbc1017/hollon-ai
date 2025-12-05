import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from '../../task/entities/task.entity';

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
          status: TaskStatus.READY,
          assignedHollonId: null, // Subtasks start unassigned
          retryCount: 0,
          priority: definition.priority as any,
          type: definition.type as any, // Cast to any to avoid TypeScript error
        });

        const savedSubtask = await this.taskRepo.save(subtask);
        createdSubtasks.push(savedSubtask);
        this.logger.log(`Created subtask ${savedSubtask.id}: ${savedSubtask.title}`);
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

    if (!parentTask || !parentTask.subtasks || parentTask.subtasks.length === 0) {
      return;
    }

    const subtasks = parentTask.subtasks;

    // Check various conditions
    const allCompleted = subtasks.every((t) => t.status === TaskStatus.COMPLETED);
    const anyFailed = subtasks.some((t) => t.status === TaskStatus.FAILED);
    const anyInProgress = subtasks.some((t) => t.status === TaskStatus.IN_PROGRESS);
    const anyBlocked = subtasks.some((t) => t.status === TaskStatus.BLOCKED);

    let newStatus: TaskStatus | null = null;

    if (allCompleted) {
      newStatus = TaskStatus.COMPLETED;
      this.logger.log(
        `Parent task ${parentTaskId}: All subtasks completed → COMPLETED`,
      );
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
}
