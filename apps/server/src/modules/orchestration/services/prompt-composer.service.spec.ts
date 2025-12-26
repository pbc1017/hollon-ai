import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PromptComposerService } from './prompt-composer.service';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Task } from '../../task/entities/task.entity';
import { Document } from '../../document/entities/document.entity';

describe('PromptComposerService', () => {
  let service: PromptComposerService;
  let module: TestingModule;

  const mockHollonRepo = {
    findOne: jest.fn(),
  };

  const mockTaskRepo = {
    findOne: jest.fn(),
  };

  const mockDocumentRepo = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        PromptComposerService,
        {
          provide: getRepositoryToken(Hollon),
          useValue: mockHollonRepo,
        },
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepo,
        },
        {
          provide: getRepositoryToken(Document),
          useValue: mockDocumentRepo,
        },
      ],
    }).compile();

    service = module.get<PromptComposerService>(PromptComposerService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('composePrompt', () => {
    it('should compose 6-layer prompt with all contexts', async () => {
      // Mock data
      const mockOrganization = {
        id: 'org-1',
        name: 'Test Org',
        description: 'Test organization',
        settings: {
          costLimitDailyCents: 10000,
          costLimitMonthlyCents: 100000,
          maxHollonsPerTeam: 10,
          defaultTaskPriority: 'medium',
        },
      };

      const mockTeam = {
        id: 'team-1',
        name: 'Dev Team',
        description: 'Development team',
      };

      const mockRole = {
        id: 'role-1',
        name: 'Backend Engineer',
        description: 'Backend development',
        systemPrompt: 'You are a backend engineer',
        capabilities: ['typescript', 'nestjs'],
      };

      const mockHollon = {
        id: 'hollon-1',
        name: 'Alpha',
        systemPrompt: 'Custom hollon prompt',
        maxConcurrentTasks: 1,
        organization: mockOrganization,
        team: mockTeam,
        role: mockRole,
      };

      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        workingDirectory: '/tmp/test',
      };

      const mockTask = {
        id: 'task-1',
        title: 'Implement feature',
        description: 'Implement new feature',
        acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
        affectedFiles: ['src/file1.ts', 'src/file2.ts'],
        projectId: 'project-1',
        project: mockProject,
      };

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);
      mockTaskRepo.findOne.mockResolvedValue(mockTask);

      // Mock document search
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'doc-1',
            title: 'Previous Work',
            content: 'Some relevant context',
            type: 'knowledge',
          },
        ]),
      };

      mockDocumentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Execute
      const result = await service.composePrompt('hollon-1', 'task-1');

      // Assertions
      expect(result).toBeDefined();
      expect(result.systemPrompt).toContain('Test Org');
      expect(result.systemPrompt).toContain('Dev Team');
      expect(result.systemPrompt).toContain('Backend Engineer');
      expect(result.systemPrompt).toContain('Alpha');
      expect(result.userPrompt).toContain('Implement feature');
      expect(result.userPrompt).toContain('Criterion 1');
      expect(result.userPrompt).toContain('src/file1.ts');
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.layers).toHaveProperty('organization');
      expect(result.layers).toHaveProperty('team');
      expect(result.layers).toHaveProperty('role');
      expect(result.layers).toHaveProperty('hollon');
      expect(result.layers).toHaveProperty('memories');
      expect(result.layers).toHaveProperty('task');
    });

    it('should handle hollon not found', async () => {
      mockHollonRepo.findOne.mockResolvedValue(null);

      await expect(
        service.composePrompt('invalid-hollon', 'task-1'),
      ).rejects.toThrow('Hollon not found');
    });

    it('should handle task not found', async () => {
      const mockHollon = {
        id: 'hollon-1',
        organization: {},
        team: {},
        role: {},
      };

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);
      mockTaskRepo.findOne.mockResolvedValue(null);

      await expect(
        service.composePrompt('hollon-1', 'invalid-task'),
      ).rejects.toThrow('Task not found');
    });

    it('should compose prompt without memories when no documents found', async () => {
      const mockHollon = {
        id: 'hollon-1',
        name: 'Alpha',
        maxConcurrentTasks: 1,
        organization: {
          name: 'Org',
          settings: {
            costLimitDailyCents: 10000,
            costLimitMonthlyCents: 100000,
            maxHollonsPerTeam: 10,
            defaultTaskPriority: 'medium',
          },
        },
        team: { name: 'Team' },
        role: {
          name: 'Role',
          description: 'Desc',
          systemPrompt: 'Prompt',
          capabilities: [],
        },
      };

      const mockTask = {
        id: 'task-1',
        title: 'Task',
        description: 'Description',
        projectId: 'project-1',
        project: { workingDirectory: '/tmp' },
      };

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);
      mockTaskRepo.findOne.mockResolvedValue(mockTask);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockDocumentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.composePrompt('hollon-1', 'task-1');

      expect(result.layers.memories).toBe('');
    });
  });
});
