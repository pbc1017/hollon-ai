import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeExtractionService } from './knowledge-extraction.service';
import { KnowledgeRepository } from './knowledge.repository';
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from '../../task/entities/task.entity';
import {
  Document,
  DocumentType,
} from '../../document/entities/document.entity';
import {
  KnowledgeEntry,
  KnowledgeEntryType,
} from '../entities/knowledge-entry.entity';

describe('KnowledgeExtractionService', () => {
  let service: KnowledgeExtractionService;
  let knowledgeRepo: jest.Mocked<KnowledgeRepository>;
  let taskRepo: jest.Mocked<Repository<Task>>;
  let documentRepo: jest.Mocked<Repository<Document>>;

  const mockTask: Partial<Task> = {
    id: 'task-123',
    title: 'Fix authentication bug',
    description:
      'Fix the authentication error that occurs when users try to log in with special characters in their password',
    type: TaskType.BUG_FIX,
    status: TaskStatus.COMPLETED,
    priority: TaskPriority.P2_HIGH,
    organizationId: 'org-123',
    projectId: 'project-123',
    assignedHollonId: 'hollon-123',
    assignedTeamId: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
  };

  const mockDocument: Partial<Document> = {
    id: 'doc-123',
    title: 'Authentication Fix Decision Log',
    content:
      'Decided to use bcrypt for password hashing and add input sanitization for special characters',
    type: DocumentType.DECISION_LOG,
    organizationId: 'org-123',
    taskId: 'task-123',
    tags: ['authentication', 'security'],
  };

  beforeEach(async () => {
    const mockKnowledgeRepo = {
      create: jest.fn(),
      findOne: jest.fn(),
      search: jest.fn(),
      findByTags: jest.fn(),
    };

    const mockTaskRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockDocumentRepo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeExtractionService,
        {
          provide: KnowledgeRepository,
          useValue: mockKnowledgeRepo,
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

    service = module.get<KnowledgeExtractionService>(
      KnowledgeExtractionService,
    );
    knowledgeRepo = module.get(
      KnowledgeRepository,
    ) as jest.Mocked<KnowledgeRepository>;
    taskRepo = module.get(getRepositoryToken(Task)) as jest.Mocked<
      Repository<Task>
    >;
    documentRepo = module.get(getRepositoryToken(Document)) as jest.Mocked<
      Repository<Document>
    >;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractFromTaskCompletion', () => {
    it('should extract knowledge from a completed task', async () => {
      taskRepo.findOne.mockResolvedValue(mockTask as Task);
      documentRepo.find.mockResolvedValue([mockDocument as Document]);

      const mockKnowledgeEntry = {
        id: 'knowledge-123',
        title: 'Error Pattern: Fix authentication bug',
        type: KnowledgeEntryType.ERROR_PATTERN,
      } as KnowledgeEntry;

      knowledgeRepo.create.mockResolvedValue(mockKnowledgeEntry);

      const result = await service.extractFromTaskCompletion(
        'task-123',
        'hollon-123',
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe('knowledge-123');
      expect(knowledgeRepo.create).toHaveBeenCalled();
    });

    it('should return null if task is not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      const result = await service.extractFromTaskCompletion('task-999');

      expect(result).toBeNull();
      expect(knowledgeRepo.create).not.toHaveBeenCalled();
    });

    it('should return null if task is not completed', async () => {
      const incompleteTask = { ...mockTask, status: TaskStatus.IN_PROGRESS };
      taskRepo.findOne.mockResolvedValue(incompleteTask as Task);

      const result = await service.extractFromTaskCompletion('task-123');

      expect(result).toBeNull();
      expect(knowledgeRepo.create).not.toHaveBeenCalled();
    });

    it('should detect error patterns from bug fix tasks', async () => {
      taskRepo.findOne.mockResolvedValue(mockTask as Task);
      documentRepo.find.mockResolvedValue([]);

      const mockKnowledgeEntry = {
        id: 'knowledge-123',
        type: KnowledgeEntryType.ERROR_PATTERN,
      } as KnowledgeEntry;

      knowledgeRepo.create.mockResolvedValue(mockKnowledgeEntry);

      await service.extractFromTaskCompletion('task-123');

      expect(knowledgeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: KnowledgeEntryType.ERROR_PATTERN,
        }),
      );
    });

    it('should detect best practices from documents', async () => {
      // Create a task without error keywords so best practice detection takes precedence
      const bestPracticeTask = {
        ...mockTask,
        title: 'Implement user authentication',
        description:
          'Implement secure user authentication following company standards',
      };

      const bestPracticeDoc = {
        ...mockDocument,
        content:
          'This is the recommended approach and best practice for handling authentication',
      };

      taskRepo.findOne.mockResolvedValue(bestPracticeTask as Task);
      documentRepo.find.mockResolvedValue([bestPracticeDoc as Document]);

      const mockKnowledgeEntry = {
        id: 'knowledge-123',
        type: KnowledgeEntryType.BEST_PRACTICE,
      } as KnowledgeEntry;

      knowledgeRepo.create.mockResolvedValue(mockKnowledgeEntry);

      await service.extractFromTaskCompletion('task-123');

      expect(knowledgeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: KnowledgeEntryType.BEST_PRACTICE,
        }),
      );
    });

    it('should include related documents as sources', async () => {
      taskRepo.findOne.mockResolvedValue(mockTask as Task);
      documentRepo.find.mockResolvedValue([mockDocument as Document]);

      const mockKnowledgeEntry = {
        id: 'knowledge-123',
      } as KnowledgeEntry;

      knowledgeRepo.create.mockResolvedValue(mockKnowledgeEntry);

      await service.extractFromTaskCompletion('task-123');

      expect(knowledgeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sources: {
            taskIds: ['task-123'],
            documentIds: ['doc-123'],
          },
        }),
      );
    });

    it('should calculate higher confidence score with decision logs', async () => {
      taskRepo.findOne.mockResolvedValue(mockTask as Task);
      documentRepo.find.mockResolvedValue([mockDocument as Document]);

      const mockKnowledgeEntry = {
        id: 'knowledge-123',
      } as KnowledgeEntry;

      knowledgeRepo.create.mockResolvedValue(mockKnowledgeEntry);

      await service.extractFromTaskCompletion('task-123');

      expect(knowledgeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          confidenceScore: expect.any(Number),
        }),
      );

      const createCall = knowledgeRepo.create.mock.calls[0][0];
      expect(createCall.confidenceScore).toBeGreaterThan(50);
    });

    it('should generate relevant tags from task and documents', async () => {
      taskRepo.findOne.mockResolvedValue(mockTask as Task);
      documentRepo.find.mockResolvedValue([mockDocument as Document]);

      const mockKnowledgeEntry = {
        id: 'knowledge-123',
      } as KnowledgeEntry;

      knowledgeRepo.create.mockResolvedValue(mockKnowledgeEntry);

      await service.extractFromTaskCompletion('task-123');

      const createCall = knowledgeRepo.create.mock.calls[0][0];
      expect(createCall.tags).toContain('authentication');
      expect(createCall.tags).toContain('security');
    });
  });

  describe('batchExtractFromTasks', () => {
    it('should extract knowledge from multiple tasks', async () => {
      taskRepo.findOne.mockResolvedValue(mockTask as Task);
      documentRepo.find.mockResolvedValue([]);

      const mockKnowledgeEntry = {
        id: 'knowledge-123',
      } as KnowledgeEntry;

      knowledgeRepo.create.mockResolvedValue(mockKnowledgeEntry);

      const taskIds = ['task-1', 'task-2', 'task-3'];
      const results = await service.batchExtractFromTasks(taskIds);

      expect(results).toHaveLength(3);
      expect(knowledgeRepo.create).toHaveBeenCalledTimes(3);
    });

    it('should handle errors gracefully in batch extraction', async () => {
      taskRepo.findOne.mockResolvedValueOnce(mockTask as Task);
      taskRepo.findOne.mockResolvedValueOnce(null); // Will fail
      taskRepo.findOne.mockResolvedValueOnce(mockTask as Task);

      documentRepo.find.mockResolvedValue([]);

      const mockKnowledgeEntry = {
        id: 'knowledge-123',
      } as KnowledgeEntry;

      knowledgeRepo.create.mockResolvedValue(mockKnowledgeEntry);

      const taskIds = ['task-1', 'task-2', 'task-3'];
      const results = await service.batchExtractFromTasks(taskIds);

      // Should have 2 successful extractions
      expect(results).toHaveLength(2);
    });
  });

  describe('extractFromOrganization', () => {
    it('should extract knowledge from organization completed tasks', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockTask, mockTask]),
      };

      taskRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
      // Mock findOne for each task in the batch extraction
      taskRepo.findOne.mockResolvedValue(mockTask as Task);
      documentRepo.find.mockResolvedValue([]);

      const mockKnowledgeEntry = {
        id: 'knowledge-123',
      } as KnowledgeEntry;

      knowledgeRepo.create.mockResolvedValue(mockKnowledgeEntry);

      const results = await service.extractFromOrganization('org-123', {
        limit: 10,
      });

      expect(results).toHaveLength(2);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'task.organization_id = :orgId',
        { orgId: 'org-123' },
      );
    });

    it('should filter by date range when provided', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      taskRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-01-31');

      await service.extractFromOrganization('org-123', {
        fromDate,
        toDate,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'task.updated_at >= :fromDate',
        { fromDate },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'task.updated_at <= :toDate',
        { toDate },
      );
    });
  });
});
