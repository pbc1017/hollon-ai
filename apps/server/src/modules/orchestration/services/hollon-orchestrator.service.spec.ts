import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HollonOrchestratorService } from './hollon-orchestrator.service';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import { Document } from '../../document/entities/document.entity';
import { BrainProviderService } from '../../brain-provider/brain-provider.service';
import { PromptComposerService } from './prompt-composer.service';
import { TaskPoolService } from './task-pool.service';
import { TaskStatus } from '../../task/entities/task.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { QualityGateService } from './quality-gate.service';

describe('HollonOrchestratorService', () => {
  let service: HollonOrchestratorService;
  let hollonRepo: Repository<Hollon>;
  let documentRepo: Repository<Document>;
  let brainProvider: BrainProviderService;
  let promptComposer: PromptComposerService;
  let taskPool: TaskPoolService;

  const mockHollonRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockDocumentRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockBrainProvider = {
    executeWithTracking: jest.fn(),
  };

  const mockPromptComposer = {
    composePrompt: jest.fn(),
  };

  const mockTaskPool = {
    pullNextTask: jest.fn(),
    completeTask: jest.fn(),
    failTask: jest.fn(),
  };

  const mockOrganizationRepo = {
    findOne: jest.fn(),
  };

  const mockQualityGate = {
    validateResult: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HollonOrchestratorService,
        {
          provide: getRepositoryToken(Hollon),
          useValue: mockHollonRepo,
        },
        {
          provide: getRepositoryToken(Document),
          useValue: mockDocumentRepo,
        },
        {
          provide: BrainProviderService,
          useValue: mockBrainProvider,
        },
        {
          provide: PromptComposerService,
          useValue: mockPromptComposer,
        },
        {
          provide: TaskPoolService,
          useValue: mockTaskPool,
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: mockOrganizationRepo,
        },
        {
          provide: QualityGateService,
          useValue: mockQualityGate,
        },
      ],
    }).compile();

    service = module.get<HollonOrchestratorService>(
      HollonOrchestratorService,
    );
    hollonRepo = module.get<Repository<Hollon>>(getRepositoryToken(Hollon));
    documentRepo = module.get<Repository<Document>>(
      getRepositoryToken(Document),
    );
    brainProvider = module.get<BrainProviderService>(BrainProviderService);
    promptComposer = module.get<PromptComposerService>(PromptComposerService);
    taskPool = module.get<TaskPoolService>(TaskPoolService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runCycle', () => {
    it('should skip execution when hollon is paused', async () => {
      const mockHollon = {
        id: 'hollon-1',
        status: HollonStatus.PAUSED,
      };

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);

      const result = await service.runCycle('hollon-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('paused');
      expect(mockTaskPool.pullNextTask).not.toHaveBeenCalled();
    });

    it('should return when no task available', async () => {
      const mockHollon = {
        id: 'hollon-1',
        name: 'Alpha',
        status: HollonStatus.IDLE,
        organizationId: 'org-1',
      };

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);
      mockHollonRepo.update.mockResolvedValue({ affected: 1 });
      mockTaskPool.pullNextTask.mockResolvedValue({
        task: null,
        reason: 'No available tasks',
      });

      const result = await service.runCycle('hollon-1');

      expect(result.success).toBe(true);
      expect(result.noTaskAvailable).toBe(true);
      expect(mockHollonRepo.update).toHaveBeenCalledWith(
        { id: 'hollon-1' },
        { status: HollonStatus.WORKING },
      );
      expect(mockHollonRepo.update).toHaveBeenCalledWith(
        { id: 'hollon-1' },
        { status: HollonStatus.IDLE },
      );
    });

    it('should execute complete cycle successfully', async () => {
      const mockHollon = {
        id: 'hollon-1',
        name: 'Alpha',
        status: HollonStatus.IDLE,
        organizationId: 'org-1',
      };

      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test description',
        projectId: 'project-1',
        project: {
          workingDirectory: '/tmp/test',
        },
      };

      const mockComposedPrompt = {
        systemPrompt: 'System prompt',
        userPrompt: 'User prompt',
        totalTokens: 100,
        layers: {
          organization: 'org',
          team: 'team',
          role: 'role',
          hollon: 'hollon',
          memories: 'memories',
          task: 'task',
        },
      };

      const mockBrainResult = {
        success: true,
        output: 'Brain output',
        duration: 5000,
        cost: {
          inputTokens: 100,
          outputTokens: 50,
          totalCostCents: 0.1,
        },
      };

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);
      mockHollonRepo.update.mockResolvedValue({ affected: 1 });
      mockTaskPool.pullNextTask.mockResolvedValue({
        task: mockTask,
        reason: 'Directly assigned',
      });
      mockPromptComposer.composePrompt.mockResolvedValue(mockComposedPrompt);
      mockBrainProvider.executeWithTracking.mockResolvedValue(
        mockBrainResult,
      );
      mockOrganizationRepo.findOne.mockResolvedValue({
        id: 'org-1',
        settings: { costLimitDailyCents: 100 },
      });
      mockQualityGate.validateResult.mockResolvedValue({
        passed: true,
        shouldRetry: false,
      });
      mockDocumentRepo.create.mockReturnValue({
        id: 'doc-1',
        title: 'Result',
      });
      mockDocumentRepo.save.mockResolvedValue({ id: 'doc-1' });
      mockTaskPool.completeTask.mockResolvedValue(undefined);

      const result = await service.runCycle('hollon-1');

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-1');
      expect(result.taskTitle).toBe('Test Task');
      expect(result.output).toBe('Brain output');
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // Verify workflow
      expect(mockHollonRepo.update).toHaveBeenCalledWith(
        { id: 'hollon-1' },
        { status: HollonStatus.WORKING },
      );
      expect(mockTaskPool.pullNextTask).toHaveBeenCalledWith('hollon-1');
      expect(mockPromptComposer.composePrompt).toHaveBeenCalledWith(
        'hollon-1',
        'task-1',
      );
      expect(mockBrainProvider.executeWithTracking).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'User prompt',
          systemPrompt: 'System prompt',
        }),
        expect.objectContaining({
          organizationId: 'org-1',
          hollonId: 'hollon-1',
          taskId: 'task-1',
        }),
      );
      expect(mockDocumentRepo.save).toHaveBeenCalled();
      expect(mockTaskPool.completeTask).toHaveBeenCalledWith('task-1');
      expect(mockHollonRepo.update).toHaveBeenCalledWith(
        { id: 'hollon-1' },
        { status: HollonStatus.IDLE },
      );
    });

    it('should handle brain execution failure', async () => {
      const mockHollon = {
        id: 'hollon-1',
        name: 'Alpha',
        status: HollonStatus.IDLE,
        organizationId: 'org-1',
      };

      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        projectId: 'project-1',
        project: { workingDirectory: '/tmp' },
      };

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);
      mockHollonRepo.update.mockResolvedValue({ affected: 1 });
      mockTaskPool.pullNextTask.mockResolvedValue({
        task: mockTask,
        reason: 'Directly assigned',
      });
      mockPromptComposer.composePrompt.mockResolvedValue({
        systemPrompt: 'sys',
        userPrompt: 'user',
        totalTokens: 10,
        layers: {},
      });
      mockBrainProvider.executeWithTracking.mockRejectedValue(
        new Error('Brain failed'),
      );

      const result = await service.runCycle('hollon-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Brain failed');
      expect(mockHollonRepo.update).toHaveBeenCalledWith(
        { id: 'hollon-1' },
        { status: HollonStatus.ERROR },
      );
    });

    it('should throw error when hollon not found', async () => {
      mockHollonRepo.findOne.mockResolvedValue(null);

      const result = await service.runCycle('invalid-hollon');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getHollonActivity', () => {
    it('should return current activity status', async () => {
      const mockHollon = {
        id: 'hollon-1',
        status: HollonStatus.WORKING,
        assignedTasks: [
          {
            id: 'task-1',
            title: 'Current Task',
            status: 'in_progress' as TaskStatus,
            startedAt: new Date(),
          },
          {
            id: 'task-2',
            title: 'Completed Task',
            status: 'completed' as TaskStatus,
            completedAt: new Date(),
          },
        ],
      };

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);

      const result = await service.getHollonActivity('hollon-1');

      expect(result.status).toBe(HollonStatus.WORKING);
      expect(result.currentTask).toBeDefined();
      expect(result.currentTask?.id).toBe('task-1');
      expect(result.recentTasks).toHaveLength(1);
      expect(result.recentTasks[0].id).toBe('task-2');
    });

    it('should handle hollon not found', async () => {
      mockHollonRepo.findOne.mockResolvedValue(null);

      await expect(service.getHollonActivity('invalid')).rejects.toThrow(
        'not found',
      );
    });
  });
});
