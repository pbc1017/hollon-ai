import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskService } from './task.service';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
} from './entities/task.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TaskService', () => {
  let service: TaskService;
  let _repository: Repository<Task>;

  const mockTaskRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTask: Partial<Task> = {
    id: 'task-123',
    title: 'Test Task',
    description: 'Test Description',
    type: TaskType.IMPLEMENTATION,
    status: TaskStatus.READY,
    priority: TaskPriority.P3_MEDIUM,
    projectId: 'project-123',
    depth: 0,
    affectedFiles: ['test.ts'],
    retryCount: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepository,
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    _repository = module.get<Repository<Task>>(getRepositoryToken(Task));

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a task without parent', async () => {
      const createDto = {
        title: 'New Task',
        description: 'Description',
        projectId: 'project-123',
        priority: TaskPriority.P3_MEDIUM,
      };

      mockTaskRepository.create.mockReturnValue({
        ...createDto,
        depth: 0,
      });
      mockTaskRepository.save.mockResolvedValue({
        id: 'new-task-id',
        ...createDto,
        depth: 0,
      });

      const result = await service.create(createDto);

      expect(mockTaskRepository.create).toHaveBeenCalledWith({
        ...createDto,
        depth: 0,
        creatorHollonId: undefined,
        dueDate: undefined,
      });
      expect(result).toHaveProperty('id', 'new-task-id');
      expect(result.depth).toBe(0);
    });

    it('should create a subtask with correct depth', async () => {
      const parentTask = { ...mockTask, depth: 0 };
      const createDto = {
        title: 'Subtask',
        description: 'Subtask Description',
        projectId: 'project-123',
        parentTaskId: 'task-123',
        priority: TaskPriority.P3_MEDIUM,
      };

      mockTaskRepository.findOne.mockResolvedValue(parentTask);
      mockTaskRepository.count.mockResolvedValue(0);
      mockTaskRepository.create.mockReturnValue({
        ...createDto,
        depth: 1,
      });
      mockTaskRepository.save.mockResolvedValue({
        id: 'subtask-id',
        ...createDto,
        depth: 1,
      });

      const result = await service.create(createDto);

      expect(mockTaskRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'task-123' },
      });
      expect(result.depth).toBe(1);
    });

    it('should throw error if parent task not found', async () => {
      const createDto = {
        title: 'Subtask',
        description: 'Description',
        projectId: 'project-123',
        parentTaskId: 'non-existent',
        priority: TaskPriority.P3_MEDIUM,
      };

      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if max depth exceeded', async () => {
      const parentTask = { ...mockTask, depth: 3 };
      const createDto = {
        title: 'Subtask',
        description: 'Description',
        projectId: 'project-123',
        parentTaskId: 'task-123',
        priority: TaskPriority.P3_MEDIUM,
      };

      mockTaskRepository.findOne.mockResolvedValue(parentTask);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'Maximum subtask depth (3) exceeded',
      );
    });

    it('should throw error if max subtasks per task exceeded', async () => {
      const parentTask = { ...mockTask, depth: 0 };
      const createDto = {
        title: 'Subtask',
        description: 'Description',
        projectId: 'project-123',
        parentTaskId: 'task-123',
        priority: TaskPriority.P3_MEDIUM,
      };

      mockTaskRepository.findOne.mockResolvedValue(parentTask);
      mockTaskRepository.count.mockResolvedValue(10);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'Maximum subtasks per task (10) exceeded',
      );
    });
  });

  describe('findOne', () => {
    it('should return a task if found', async () => {
      mockTaskRepository.findOne.mockResolvedValue(mockTask);

      const result = await service.findOne('task-123');

      expect(mockTaskRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        relations: ['project', 'assignedHollon', 'parentTask', 'subtasks'],
      });
      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent')).rejects.toThrow(
        'Task #non-existent not found',
      );
    });
  });

  describe('assignToHollon', () => {
    it('should assign task to hollon and update status', async () => {
      const task = { ...mockTask, status: TaskStatus.READY };
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockTaskRepository.save.mockResolvedValue({
        ...task,
        assignedHollonId: 'hollon-123',
        status: TaskStatus.IN_PROGRESS,
        startedAt: expect.any(Date),
      });

      const result = await service.assignToHollon('task-123', 'hollon-123');

      expect(result.assignedHollonId).toBe('hollon-123');
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      expect(result.startedAt).toBeDefined();
    });
  });

  describe('complete', () => {
    it('should mark task as completed', async () => {
      const task = { ...mockTask, status: TaskStatus.IN_PROGRESS };
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockTaskRepository.save.mockResolvedValue({
        ...task,
        status: TaskStatus.COMPLETED,
        completedAt: expect.any(Date),
      });

      const result = await service.complete('task-123');

      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.completedAt).toBeDefined();
    });
  });

  describe('fail', () => {
    it('should mark task as failed and increment retry count', async () => {
      const task = {
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
        retryCount: 0,
      };
      mockTaskRepository.findOne.mockResolvedValue(task);
      mockTaskRepository.save.mockResolvedValue({
        ...task,
        status: TaskStatus.FAILED,
        errorMessage: 'Test error',
        retryCount: 1,
      });

      const result = await service.fail('task-123', 'Test error');

      expect(result.status).toBe(TaskStatus.FAILED);
      expect(result.errorMessage).toBe('Test error');
      expect(result.retryCount).toBe(1);
    });
  });

  describe('findReadyTasks', () => {
    it('should return unassigned ready tasks', async () => {
      const readyTasks = [
        { ...mockTask, status: TaskStatus.READY },
        { ...mockTask, id: 'task-456', status: TaskStatus.PENDING },
      ];
      mockTaskRepository.find.mockResolvedValue(readyTasks);

      const result = await service.findReadyTasks('project-123');

      expect(mockTaskRepository.find).toHaveBeenCalledWith({
        where: {
          projectId: 'project-123',
          status: expect.anything(),
          assignedHollonId: undefined,
        },
        order: {
          priority: 'ASC',
          createdAt: 'ASC',
        },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('remove', () => {
    it('should remove a task', async () => {
      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockTaskRepository.remove.mockResolvedValue(mockTask);

      await service.remove('task-123');

      expect(mockTaskRepository.findOne).toHaveBeenCalled();
      expect(mockTaskRepository.remove).toHaveBeenCalledWith(mockTask);
    });

    it('should throw NotFoundException if task to remove not found', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
