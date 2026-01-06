import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictResolutionService } from './conflict-resolution.service';
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
import { ConflictContextDto } from '../dto/conflict-context.dto';

describe('ConflictResolutionService', () => {
  let service: ConflictResolutionService;

  const mockConflictRepo = {
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockTaskRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockMessageService = {
    send: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConflictResolutionService,
        {
          provide: getRepositoryToken(ConflictResolution),
          useValue: mockConflictRepo,
        },
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepo,
        },
        {
          provide: MessageService,
          useValue: mockMessageService,
        },
      ],
    }).compile();

    service = module.get<ConflictResolutionService>(ConflictResolutionService);

    jest.clearAllMocks();
  });

  describe('detectAndResolve', () => {
    it('should return hasConflicts: false when no conflicts detected', async () => {
      const context: ConflictContextDto = {
        organizationId: 'org-1',
        affectedFiles: ['file1.ts'],
        affectedResources: [],
        taskIds: [],
      };

      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]), // No tasks found
      };

      mockTaskRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.detectAndResolve(context);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toBeUndefined();
    });

    it('should detect file conflicts when multiple tasks modify same files', async () => {
      const context: ConflictContextDto = {
        organizationId: 'org-1',
        affectedFiles: ['file1.ts', 'file2.ts'],
      };

      const mockTasks = [
        {
          id: 'task-1',
          assignedHollonId: 'hollon-1',
          status: TaskStatus.IN_PROGRESS,
          project: { organizationId: 'org-1' },
        },
        {
          id: 'task-2',
          assignedHollonId: 'hollon-2',
          status: TaskStatus.IN_PROGRESS,
          project: { organizationId: 'org-1' },
        },
      ];

      const mockConflict = {
        id: 'conflict-1',
        organizationId: 'org-1',
        conflictType: ConflictType.FILE_CONFLICT,
        status: ConflictStatus.DETECTED,
        affectedTaskIds: ['task-1', 'task-2'],
      };

      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockTasks),
      };

      mockTaskRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockConflictRepo.save.mockResolvedValue(mockConflict);
      mockTaskRepo.find.mockResolvedValue(mockTasks);
      mockTaskRepo.save.mockResolvedValue(mockTasks[1]);

      const result = await service.detectAndResolve(context);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts![0].conflictType).toBe(
        ConflictType.FILE_CONFLICT,
      );
      expect(mockConflictRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictType: ConflictType.FILE_CONFLICT,
          affectedTaskIds: ['task-1', 'task-2'],
        }),
      );
    });

    it('should detect priority conflicts when hollon has multiple high-priority tasks', async () => {
      const context: ConflictContextDto = {
        organizationId: 'org-1',
        taskIds: ['task-1', 'task-2', 'task-3'],
      };

      const mockTasks = [
        {
          id: 'task-1',
          assignedHollonId: 'hollon-1',
          priority: TaskPriority.P1_CRITICAL,
          project: { organizationId: 'org-1' },
        },
        {
          id: 'task-2',
          assignedHollonId: 'hollon-1',
          priority: TaskPriority.P2_HIGH,
          project: { organizationId: 'org-1' },
        },
        {
          id: 'task-3',
          assignedHollonId: 'hollon-2',
          priority: TaskPriority.P3_MEDIUM,
          project: { organizationId: 'org-1' },
        },
      ];

      const mockConflict = {
        id: 'conflict-1',
        organizationId: 'org-1',
        conflictType: ConflictType.PRIORITY_CONFLICT,
        status: ConflictStatus.DETECTED,
      };

      mockTaskRepo.find.mockResolvedValue(mockTasks);
      mockConflictRepo.save.mockResolvedValue(mockConflict);

      // Mock for empty file/resource conflicts
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockTaskRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.detectAndResolve(context);

      expect(result.hasConflicts).toBe(true);
      expect(mockConflictRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictType: ConflictType.PRIORITY_CONFLICT,
          affectedHollonIds: ['hollon-1'],
        }),
      );
    });

    it('should detect deadline conflicts when tasks are due within 24 hours', async () => {
      const now = new Date();
      const soonDeadline = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours

      const context: ConflictContextDto = {
        organizationId: 'org-1',
        taskIds: ['task-1', 'task-2'],
      };

      const mockTasks = [
        {
          id: 'task-1',
          assignedHollonId: 'hollon-1',
          dueDate: soonDeadline,
          project: { organizationId: 'org-1' },
        },
        {
          id: 'task-2',
          assignedHollonId: 'hollon-1',
          dueDate: soonDeadline,
          project: { organizationId: 'org-1' },
        },
      ];

      const mockConflict = {
        id: 'conflict-1',
        organizationId: 'org-1',
        conflictType: ConflictType.DEADLINE_CONFLICT,
        status: ConflictStatus.DETECTED,
      };

      mockTaskRepo.find.mockResolvedValue(mockTasks);
      mockConflictRepo.save.mockResolvedValue(mockConflict);

      // Mock for empty file/resource conflicts
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockTaskRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.detectAndResolve(context);

      expect(result.hasConflicts).toBe(true);
    });
  });

  describe('getActiveConflicts', () => {
    it('should return active conflicts for organization', async () => {
      const organizationId = 'org-1';
      const mockConflicts = [
        {
          id: 'conflict-1',
          organizationId,
          status: ConflictStatus.DETECTED,
          conflictType: ConflictType.FILE_CONFLICT,
        },
        {
          id: 'conflict-2',
          organizationId,
          status: ConflictStatus.RESOLVING,
          conflictType: ConflictType.PRIORITY_CONFLICT,
        },
      ];

      mockConflictRepo.find.mockResolvedValue(mockConflicts);

      const result = await service.getActiveConflicts(organizationId);

      expect(result).toEqual(mockConflicts);
      expect(mockConflictRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId,
          }),
        }),
      );
    });

    it('should return empty array when no active conflicts', async () => {
      mockConflictRepo.find.mockResolvedValue([]);

      const result = await service.getActiveConflicts('org-1');

      expect(result).toEqual([]);
    });
  });

  describe('manuallyResolve', () => {
    it('should manually resolve a conflict', async () => {
      const conflictId = 'conflict-1';
      const resolutionDetails = 'Manually resolved by admin';

      const mockConflict = {
        id: conflictId,
        organizationId: 'org-1',
        status: ConflictStatus.ESCALATED,
        conflictType: ConflictType.PRIORITY_CONFLICT,
      };

      mockConflictRepo.findOne.mockResolvedValue(mockConflict);
      mockConflictRepo.save.mockResolvedValue({
        ...mockConflict,
        status: ConflictStatus.RESOLVED,
        resolutionStrategy: ResolutionStrategy.MANUAL_INTERVENTION,
        resolutionDetails,
      });

      const result = await service.manuallyResolve(
        conflictId,
        resolutionDetails,
      );

      expect(result.status).toBe(ConflictStatus.RESOLVED);
      expect(result.resolutionStrategy).toBe(
        ResolutionStrategy.MANUAL_INTERVENTION,
      );
      expect(result.resolutionDetails).toBe(resolutionDetails);
      expect(mockConflictRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ConflictStatus.RESOLVED,
          resolutionDetails,
        }),
      );
    });

    it('should throw error when conflict not found', async () => {
      mockConflictRepo.findOne.mockResolvedValue(null);

      await expect(
        service.manuallyResolve('non-existent', 'details'),
      ).rejects.toThrow('Conflict non-existent not found');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty task arrays gracefully', async () => {
      const context: ConflictContextDto = {
        organizationId: 'org-1',
        taskIds: [],
        affectedFiles: [],
      };

      const result = await service.detectAndResolve(context);

      expect(result.hasConflicts).toBe(false);
    });

    it('should handle tasks without assigned hollon', async () => {
      const context: ConflictContextDto = {
        organizationId: 'org-1',
        taskIds: ['task-1', 'task-2'],
      };

      const mockTasks = [
        {
          id: 'task-1',
          assignedHollonId: null, // No hollon assigned
          priority: TaskPriority.P1_CRITICAL,
          project: { organizationId: 'org-1' },
        },
        {
          id: 'task-2',
          assignedHollonId: null,
          priority: TaskPriority.P2_HIGH,
          project: { organizationId: 'org-1' },
        },
      ];

      mockTaskRepo.find.mockResolvedValue(mockTasks);

      // Mock for empty file/resource conflicts
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockTaskRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.detectAndResolve(context);

      // Should not create priority conflict if no hollon assigned
      expect(result.hasConflicts).toBe(false);
    });

    it('should handle tasks without due dates for deadline conflicts', async () => {
      const context: ConflictContextDto = {
        organizationId: 'org-1',
        taskIds: ['task-1', 'task-2'],
      };

      const mockTasks = [
        {
          id: 'task-1',
          assignedHollonId: 'hollon-1',
          dueDate: null, // No due date
          project: { organizationId: 'org-1' },
        },
        {
          id: 'task-2',
          assignedHollonId: 'hollon-1',
          dueDate: null,
          project: { organizationId: 'org-1' },
        },
      ];

      mockTaskRepo.find.mockResolvedValue(mockTasks);

      // Mock for empty file/resource conflicts
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockTaskRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.detectAndResolve(context);

      // Should not create deadline conflict if no due dates
      expect(result.hasConflicts).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('should notify hollons when blocking tasks', async () => {
      const context: ConflictContextDto = {
        organizationId: 'org-1',
        affectedFiles: ['file1.ts'],
      };

      const mockTasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          assignedHollonId: 'hollon-1',
          status: TaskStatus.IN_PROGRESS,
          createdAt: new Date('2024-01-01'),
          project: { organizationId: 'org-1' },
        },
        {
          id: 'task-2',
          title: 'Task 2',
          assignedHollonId: 'hollon-2',
          status: TaskStatus.IN_PROGRESS,
          createdAt: new Date('2024-01-02'),
          project: { organizationId: 'org-1' },
        },
      ];

      const mockConflict = {
        id: 'conflict-1',
        organizationId: 'org-1',
        conflictType: ConflictType.FILE_CONFLICT,
        status: ConflictStatus.DETECTED,
        affectedTaskIds: ['task-1', 'task-2'],
      };

      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockTasks),
      };

      mockTaskRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockConflictRepo.save.mockResolvedValue(mockConflict);
      mockTaskRepo.find.mockResolvedValue(mockTasks);
      mockTaskRepo.save.mockResolvedValue(mockTasks[1]);

      await service.detectAndResolve(context);

      // Should send notification to blocked task's hollon
      expect(mockMessageService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          toId: 'hollon-2',
          messageType: expect.any(String),
        }),
      );
    });
  });
});
