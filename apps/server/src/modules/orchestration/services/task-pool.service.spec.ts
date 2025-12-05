import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskPoolService } from './task-pool.service';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';

describe('TaskPoolService', () => {
  let service: TaskPoolService;
  let taskRepo: Repository<Task>;
  let hollonRepo: Repository<Hollon>;

  const mockTaskRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockHollonRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskPoolService,
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepo,
        },
        {
          provide: getRepositoryToken(Hollon),
          useValue: mockHollonRepo,
        },
      ],
    }).compile();

    service = module.get<TaskPoolService>(TaskPoolService);
    taskRepo = module.get<Repository<Task>>(getRepositoryToken(Task));
    hollonRepo = module.get<Repository<Hollon>>(getRepositoryToken(Hollon));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('pullNextTask', () => {
    it('should return null when hollon not found', async () => {
      mockHollonRepo.findOne.mockResolvedValue(null);

      const result = await service.pullNextTask('invalid-hollon');

      expect(result.task).toBeNull();
      expect(result.reason).toContain('not found');
    });

    it('should pull directly assigned task (Priority 1)', async () => {
      const mockHollon = {
        id: 'hollon-1',
        name: 'Alpha',
        teamId: 'team-1',
        assignedTasks: [],
      };

      const mockTask = {
        id: 'task-1',
        title: 'Direct Task',
        status: TaskStatus.READY,
        assignedHollonId: 'hollon-1',
        affectedFiles: [],
      };

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);
      mockTaskRepo.find.mockResolvedValueOnce([]); // locked files
      mockTaskRepo.find.mockResolvedValueOnce([mockTask]); // direct tasks

      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockTaskRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockTaskRepo.findOne.mockResolvedValue({
        ...mockTask,
        project: { id: 'project-1' },
      });

      const result = await service.pullNextTask('hollon-1');

      expect(result.task).toBeDefined();
      expect(result.reason).toBe('Directly assigned');
    });

    it('should skip task with file conflict', async () => {
      const mockHollon = {
        id: 'hollon-1',
        name: 'Alpha',
        teamId: 'team-1',
        assignedTasks: [],
      };

      const lockedTask = {
        id: 'locked-task',
        status: TaskStatus.IN_PROGRESS,
        assignedHollonId: 'hollon-2',
        affectedFiles: ['src/file1.ts'],
      };

      const conflictingTask = {
        id: 'task-1',
        title: 'Conflicting Task',
        status: TaskStatus.READY,
        assignedHollonId: 'hollon-1',
        affectedFiles: ['src/file1.ts'], // Conflicts with locked task
        completedAt: new Date(),
      };

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);
      mockHollonRepo.find.mockResolvedValue([]); // team hollons
      mockTaskRepo.find.mockResolvedValueOnce([lockedTask]); // locked files
      mockTaskRepo.find.mockResolvedValueOnce([conflictingTask]); // direct tasks
      mockTaskRepo.find.mockResolvedValue([]); // all other queries

      const result = await service.pullNextTask('hollon-1');

      expect(result.task).toBeNull();
      expect(result.reason).toBe('No available tasks');
    });

    it('should return no task when all queues empty', async () => {
      const mockHollon = {
        id: 'hollon-1',
        name: 'Alpha',
        teamId: 'team-1',
        assignedTasks: [],
      };

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);
      mockHollonRepo.find.mockResolvedValue([]); // team hollons
      mockTaskRepo.find.mockResolvedValue([]); // All finds return empty

      const result = await service.pullNextTask('hollon-1');

      expect(result.task).toBeNull();
      expect(result.reason).toBe('No available tasks');
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed', async () => {
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      await service.completeTask('task-1');

      expect(mockTaskRepo.update).toHaveBeenCalledWith(
        { id: 'task-1' },
        expect.objectContaining({
          status: TaskStatus.COMPLETED,
          completedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('failTask', () => {
    it('should mark task as failed with error message', async () => {
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      await service.failTask('task-1', 'Test error');

      expect(mockTaskRepo.update).toHaveBeenCalledWith(
        { id: 'task-1' },
        expect.objectContaining({
          status: TaskStatus.FAILED,
          errorMessage: 'Test error',
          completedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('releaseTask', () => {
    it('should release task and clear assignment', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockTaskRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockTaskRepo.query.mockResolvedValue(undefined);

      await service.releaseTask('task-1', 'Test error');

      expect(mockTaskRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE hollon.tasks'),
        ['task-1'],
      );
    });
  });
});
