import { Repository, DeepPartial } from 'typeorm';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
} from '../../src/modules/task/entities/task.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test Data Factory for Task entity
 * Provides methods to create test tasks with unique titles
 */
export class TaskFactory {
  /**
   * Create task data (not persisted)
   * @param overrides - Partial task data to override defaults
   */
  static create(overrides?: Partial<Task>): DeepPartial<Task> {
    const uniqueId = uuidv4().slice(0, 8);
    return {
      title: `Test_Task_${uniqueId}`,
      description: 'Auto-generated test task',
      type: TaskType.IMPLEMENTATION,
      status: TaskStatus.PENDING,
      priority: TaskPriority.P3_MEDIUM,
      depth: 0,
      affectedFiles: [],
      requiredSkills: ['typescript'],
      needsHumanApproval: false,
      retryCount: 0,
      ...overrides,
    };
  }

  /**
   * Create and persist task to database
   * @param repo - TypeORM repository for Task
   * @param overrides - Partial task data to override defaults
   */
  static async createPersisted(
    repo: Repository<Task>,
    overrides?: Partial<Task>,
  ): Promise<Task> {
    const task = this.create(overrides);
    return repo.save(task);
  }

  /**
   * Create multiple tasks
   * @param count - Number of tasks to create
   * @param overrides - Partial task data to override defaults
   */
  static createMany(
    count: number,
    overrides?: Partial<Task>,
  ): DeepPartial<Task>[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create and persist multiple tasks
   * @param repo - TypeORM repository for Task
   * @param count - Number of tasks to create
   * @param overrides - Partial task data to override defaults
   */
  static async createManyPersisted(
    repo: Repository<Task>,
    count: number,
    overrides?: Partial<Task>,
  ): Promise<Task[]> {
    const tasks = this.createMany(count, overrides);
    return repo.save(tasks);
  }
}
