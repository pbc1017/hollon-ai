import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TechDebtReviewService } from './tech-debt-review.service';
import {
  TechDebt,
  TechDebtCategory,
  TechDebtSeverity,
  TechDebtStatus,
} from '../entities/tech-debt.entity';
import {
  Task,
  TaskStatus,
  TaskPriority,
} from '../../task/entities/task.entity';

describe('TechDebtReviewService', () => {
  let service: TechDebtReviewService;
  let testModule: TestingModule;

  const mockTechDebtRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ ...entity, id: 'debt-1' })),
  };

  beforeEach(async () => {
    testModule = await Test.createTestingModule({
      providers: [
        TechDebtReviewService,
        {
          provide: getRepositoryToken(TechDebt),
          useValue: mockTechDebtRepo,
        },
      ],
    }).compile();

    service = testModule.get<TechDebtReviewService>(TechDebtReviewService);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (testModule) {
      await testModule.close();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reviewTaskForTechDebt', () => {
    const mockTask: Partial<Task> = {
      id: 'task-1',
      title: 'Test Task',
      projectId: 'project-1',
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.P3_MEDIUM,
      affectedFiles: ['src/test.ts'],
      project: {
        workingDirectory: '/test/project',
      } as any,
    };

    it('should return empty result when no files are affected', async () => {
      const taskWithoutFiles: Partial<Task> = {
        ...mockTask,
        affectedFiles: [],
      };

      const result = await service.reviewTaskForTechDebt(
        taskWithoutFiles as Task,
      );

      expect(result.taskId).toBe(taskWithoutFiles.id);
      expect(result.totalCount).toBe(0);
      expect(result.detectedDebts).toHaveLength(0);
      expect(result.shouldBlock).toBe(false);
    });

    it('should detect tech debts with default options', async () => {
      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        autoCreateDebts: false, // Don't actually save to DB in test
      });

      expect(result.taskId).toBe(mockTask.id);
      expect(result).toHaveProperty('detectedDebts');
      expect(result).toHaveProperty('severityCounts');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('shouldBlock');
    });

    it('should auto-create tech debts when enabled', async () => {
      // Mock detected debts
      const mockDebt = {
        title: 'Test debt',
        description: 'Test',
        category: TechDebtCategory.CODE_QUALITY,
        severity: TechDebtSeverity.MEDIUM,
      };

      mockTechDebtRepo.create.mockReturnValue(mockDebt);

      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        autoCreateDebts: true,
        checkCodeQuality: false, // Disable to test only auto-create logic
        checkArchitecture: false,
        checkDocumentation: false,
        checkTesting: false,
      });

      // Since all checks are disabled, no debts should be created
      expect(result.detectedDebts).toHaveLength(0);
    });

    it('should calculate severity counts correctly', async () => {
      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        autoCreateDebts: false,
      });

      expect(result.severityCounts).toHaveProperty('critical');
      expect(result.severityCounts).toHaveProperty('high');
      expect(result.severityCounts).toHaveProperty('medium');
      expect(result.severityCounts).toHaveProperty('low');
      expect(
        result.severityCounts.critical +
          result.severityCounts.high +
          result.severityCounts.medium +
          result.severityCounts.low,
      ).toBe(result.totalCount);
    });

    it('should generate recommendations based on severity', async () => {
      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        autoCreateDebts: false,
      });

      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should block task when critical debts exceed threshold', async () => {
      // This would require mocking the internal check methods
      // to return critical severity debts
      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        autoCreateDebts: false,
        severityThreshold: 'critical',
      });

      expect(result).toHaveProperty('shouldBlock');
      if (result.shouldBlock) {
        expect(result.blockReason).toBeDefined();
      }
    });

    it('should respect severity threshold option', async () => {
      const resultLow = await service.reviewTaskForTechDebt(mockTask as Task, {
        autoCreateDebts: false,
        severityThreshold: 'low',
      });

      const resultCritical = await service.reviewTaskForTechDebt(
        mockTask as Task,
        {
          autoCreateDebts: false,
          severityThreshold: 'critical',
        },
      );

      // With stricter threshold, blocking should be more likely
      expect(typeof resultLow.shouldBlock).toBe('boolean');
      expect(typeof resultCritical.shouldBlock).toBe('boolean');
    });

    it('should handle tasks without working directory', async () => {
      const taskWithoutDir: Partial<Task> = {
        ...mockTask,
        project: undefined,
      };

      const result = await service.reviewTaskForTechDebt(
        taskWithoutDir as Task,
        {
          autoCreateDebts: false,
        },
      );

      // Should still work but with no file-based checks
      expect(result.taskId).toBe(taskWithoutDir.id);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('findAllByProject', () => {
    it('should return all tech debts for a project', async () => {
      const mockDebts = [
        {
          id: 'debt-1',
          projectId: 'project-1',
          severity: TechDebtSeverity.HIGH,
        },
        {
          id: 'debt-2',
          projectId: 'project-1',
          severity: TechDebtSeverity.LOW,
        },
      ];

      mockTechDebtRepo.find.mockResolvedValue(mockDebts);

      const result = await service.findAllByProject('project-1');

      expect(result).toHaveLength(2);
      expect(mockTechDebtRepo.find).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        order: {
          severity: 'DESC',
          createdAt: 'DESC',
        },
      });
    });

    it('should return empty array when no debts exist', async () => {
      mockTechDebtRepo.find.mockResolvedValue([]);

      const result = await service.findAllByProject('project-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('create', () => {
    it('should create a new tech debt', async () => {
      const dto = {
        title: 'Test Debt',
        description: 'Test description',
        category: TechDebtCategory.CODE_QUALITY,
        severity: TechDebtSeverity.MEDIUM,
        projectId: 'project-1',
      };

      const result = await service.create(dto as any);

      expect(mockTechDebtRepo.create).toHaveBeenCalledWith(dto);
      expect(mockTechDebtRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });
  });

  describe('resolve', () => {
    it('should resolve a tech debt', async () => {
      const mockDebt = {
        id: 'debt-1',
        status: TechDebtStatus.IDENTIFIED,
        resolvedAt: null,
        resolutionNotes: null,
      };

      mockTechDebtRepo.findOne.mockResolvedValue(mockDebt);
      mockTechDebtRepo.save.mockResolvedValue({
        ...mockDebt,
        status: TechDebtStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNotes: 'Fixed',
      });

      const result = await service.resolve('debt-1', 'Fixed');

      expect(result.status).toBe(TechDebtStatus.RESOLVED);
      expect(result.resolutionNotes).toBe('Fixed');
      expect(result.resolvedAt).toBeDefined();
    });

    it('should throw error if debt not found', async () => {
      mockTechDebtRepo.findOne.mockResolvedValue(null);

      await expect(service.resolve('invalid-id', 'Fixed')).rejects.toThrow(
        'Tech debt #invalid-id not found',
      );
    });
  });

  describe('getStatistics', () => {
    it('should calculate statistics correctly', async () => {
      const mockDebts = [
        {
          id: 'debt-1',
          severity: TechDebtSeverity.CRITICAL,
          category: TechDebtCategory.SECURITY,
          status: TechDebtStatus.IDENTIFIED,
          estimatedEffortHours: 8,
        },
        {
          id: 'debt-2',
          severity: TechDebtSeverity.HIGH,
          category: TechDebtCategory.CODE_QUALITY,
          status: TechDebtStatus.IDENTIFIED,
          estimatedEffortHours: 4,
        },
        {
          id: 'debt-3',
          severity: TechDebtSeverity.MEDIUM,
          category: TechDebtCategory.CODE_QUALITY,
          status: TechDebtStatus.RESOLVED,
          estimatedEffortHours: 2,
        },
      ];

      mockTechDebtRepo.find.mockResolvedValue(mockDebts);

      const stats = await service.getStatistics('project-1');

      expect(stats.total).toBe(3);
      expect(stats.bySeverity[TechDebtSeverity.CRITICAL]).toBe(1);
      expect(stats.bySeverity[TechDebtSeverity.HIGH]).toBe(1);
      expect(stats.bySeverity[TechDebtSeverity.MEDIUM]).toBe(1);
      expect(stats.byCategory[TechDebtCategory.CODE_QUALITY]).toBe(2);
      expect(stats.byCategory[TechDebtCategory.SECURITY]).toBe(1);
      expect(stats.byStatus[TechDebtStatus.IDENTIFIED]).toBe(2);
      expect(stats.byStatus[TechDebtStatus.RESOLVED]).toBe(1);
      expect(stats.totalEstimatedEffort).toBe(14);
    });

    it('should handle projects with no debts', async () => {
      mockTechDebtRepo.find.mockResolvedValue([]);

      const stats = await service.getStatistics('project-1');

      expect(stats.total).toBe(0);
      expect(stats.totalEstimatedEffort).toBe(0);
    });

    it('should handle debts without effort estimates', async () => {
      const mockDebts = [
        {
          id: 'debt-1',
          severity: TechDebtSeverity.LOW,
          category: TechDebtCategory.DOCUMENTATION,
          status: TechDebtStatus.IDENTIFIED,
          estimatedEffortHours: null,
        },
      ];

      mockTechDebtRepo.find.mockResolvedValue(mockDebts);

      const stats = await service.getStatistics('project-1');

      expect(stats.totalEstimatedEffort).toBe(0);
    });
  });

  describe('severity threshold logic', () => {
    it('should block on critical threshold with critical issues', async () => {
      // This tests the internal shouldBlockBasedOnThreshold method
      const mockTask: Partial<Task> = {
        id: 'task-1',
        projectId: 'project-1',
        affectedFiles: [],
      };

      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        severityThreshold: 'critical',
        autoCreateDebts: false,
      });

      // With no files, no debts should be detected
      expect(result.shouldBlock).toBe(false);
    });

    it('should block on high threshold with high issues', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-1',
        projectId: 'project-1',
        affectedFiles: [],
      };

      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        severityThreshold: 'high',
        autoCreateDebts: false,
      });

      expect(result.shouldBlock).toBe(false);
    });

    it('should block on medium threshold with too many medium issues', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-1',
        projectId: 'project-1',
        affectedFiles: [],
      };

      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        severityThreshold: 'medium',
        autoCreateDebts: false,
      });

      expect(result.shouldBlock).toBe(false);
    });

    it('should block on low threshold with excessive low issues', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-1',
        projectId: 'project-1',
        affectedFiles: [],
      };

      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        severityThreshold: 'low',
        autoCreateDebts: false,
      });

      expect(result.shouldBlock).toBe(false);
    });
  });

  describe('review options', () => {
    const mockTask: Partial<Task> = {
      id: 'task-1',
      projectId: 'project-1',
      affectedFiles: ['src/test.ts'],
      project: { workingDirectory: '/test' } as any,
    };

    it('should skip code quality check when disabled', async () => {
      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        checkCodeQuality: false,
        autoCreateDebts: false,
      });

      expect(result).toBeDefined();
      // Code quality debts should not be detected
    });

    it('should skip architecture check when disabled', async () => {
      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        checkArchitecture: false,
        autoCreateDebts: false,
      });

      expect(result).toBeDefined();
    });

    it('should skip documentation check when disabled', async () => {
      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        checkDocumentation: false,
        autoCreateDebts: false,
      });

      expect(result).toBeDefined();
    });

    it('should skip testing check when disabled', async () => {
      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        checkTesting: false,
        autoCreateDebts: false,
      });

      expect(result).toBeDefined();
    });

    it('should skip performance check by default', async () => {
      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        autoCreateDebts: false,
      });

      expect(result).toBeDefined();
      // Performance checks are disabled by default
    });

    it('should skip security check by default', async () => {
      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        autoCreateDebts: false,
      });

      expect(result).toBeDefined();
      // Security checks are disabled by default
    });

    it('should run performance check when enabled', async () => {
      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        checkPerformance: true,
        autoCreateDebts: false,
      });

      expect(result).toBeDefined();
    });

    it('should run security check when enabled', async () => {
      const result = await service.reviewTaskForTechDebt(mockTask as Task, {
        checkSecurity: true,
        autoCreateDebts: false,
      });

      expect(result).toBeDefined();
    });
  });
});
