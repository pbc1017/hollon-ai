import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Task, TaskStatus, TaskPriority } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const MAX_SUBTASK_DEPTH = 3;
const MAX_SUBTASKS_PER_TASK = 10;

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  async create(dto: CreateTaskDto, creatorHollonId?: string): Promise<Task> {
    let depth = 0;

    // 부모 태스크가 있으면 깊이 계산
    if (dto.parentTaskId) {
      const parentTask = await this.taskRepo.findOne({
        where: { id: dto.parentTaskId },
      });
      if (!parentTask) {
        throw new NotFoundException(
          `Parent task #${dto.parentTaskId} not found`,
        );
      }

      // 안전장치: 최대 깊이 체크
      if (parentTask.depth >= MAX_SUBTASK_DEPTH) {
        throw new BadRequestException(
          `Maximum subtask depth (${MAX_SUBTASK_DEPTH}) exceeded`,
        );
      }

      // 안전장치: 서브태스크 개수 체크
      const subtaskCount = await this.taskRepo.count({
        where: { parentTaskId: dto.parentTaskId },
      });
      if (subtaskCount >= MAX_SUBTASKS_PER_TASK) {
        throw new BadRequestException(
          `Maximum subtasks per task (${MAX_SUBTASKS_PER_TASK}) exceeded`,
        );
      }

      depth = parentTask.depth + 1;
    }

    const task = this.taskRepo.create({
      ...dto,
      depth,
      creatorHollonId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });

    return this.taskRepo.save(task);
  }

  async findAll(filters?: {
    projectId?: string;
    status?: TaskStatus | TaskStatus[];
    priority?: TaskPriority;
    assignedHollonId?: string;
  }): Promise<Task[]> {
    const query = this.taskRepo.createQueryBuilder('task');

    if (filters?.projectId) {
      query.andWhere('task.project_id = :projectId', {
        projectId: filters.projectId,
      });
    }

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query.andWhere('task.status IN (:...statuses)', {
          statuses: filters.status,
        });
      } else {
        query.andWhere('task.status = :status', { status: filters.status });
      }
    }

    if (filters?.priority) {
      query.andWhere('task.priority = :priority', {
        priority: filters.priority,
      });
    }

    if (filters?.assignedHollonId) {
      query.andWhere('task.assigned_hollon_id = :hollonId', {
        hollonId: filters.assignedHollonId,
      });
    }

    return query
      .orderBy('task.priority', 'ASC')
      .addOrderBy('task.createdAt', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['project', 'assignedHollon', 'parentTask', 'subtasks'],
    });
    if (!task) {
      throw new NotFoundException(`Task #${id} not found`);
    }
    return task;
  }

  async findReadyTasks(projectId: string): Promise<Task[]> {
    return this.taskRepo.find({
      where: {
        projectId,
        status: In([TaskStatus.PENDING, TaskStatus.READY]),
        assignedHollonId: undefined,
      },
      order: {
        priority: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);
    Object.assign(task, dto);
    return this.taskRepo.save(task);
  }

  async assignToHollon(taskId: string, hollonId: string): Promise<Task> {
    const task = await this.findOne(taskId);
    task.assignedHollonId = hollonId;
    task.status = TaskStatus.IN_PROGRESS;
    task.startedAt = new Date();
    return this.taskRepo.save(task);
  }

  async complete(id: string): Promise<Task> {
    const task = await this.findOne(id);
    task.status = TaskStatus.COMPLETED;
    task.completedAt = new Date();
    return this.taskRepo.save(task);
  }

  async fail(id: string, errorMessage: string): Promise<Task> {
    const task = await this.findOne(id);
    task.status = TaskStatus.FAILED;
    task.errorMessage = errorMessage;
    task.retryCount += 1;
    return this.taskRepo.save(task);
  }

  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);
    await this.taskRepo.remove(task);
  }
}
