import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HybridSearchService } from './hybrid-search.service';
import { Document, DocumentType } from '../entities/document.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Team } from '../../team/entities/team.entity';
import { Project } from '../../project/entities/project.entity';
import { Task } from '../../task/entities/task.entity';
import { SearchStrategy } from '../dto/hybrid-search.dto';

describe('HybridSearchService', () => {
  let service: HybridSearchService;
  let hollonRepo: jest.Mocked<Repository<Hollon>>;
  let teamRepo: jest.Mocked<Repository<Team>>;
  let projectRepo: jest.Mocked<Repository<Project>>;
  let taskRepo: jest.Mocked<Repository<Task>>;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HybridSearchService,
        {
          provide: getRepositoryToken(Document),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Hollon),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Team),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Project),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Task),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HybridSearchService>(HybridSearchService);
    hollonRepo = module.get(getRepositoryToken(Hollon));
    teamRepo = module.get(getRepositoryToken(Team));
    projectRepo = module.get(getRepositoryToken(Project));
    taskRepo = module.get(getRepositoryToken(Task));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should validate weights for hybrid strategy', async () => {
      const dto = {
        query: 'test query',
        strategy: SearchStrategy.HYBRID,
        vectorWeight: 0.5,
        graphWeight: 0.3, // Sum is not 1.0
        limit: 10,
        minSimilarity: 0.5,
        maxGraphDepth: 3,
      };

      await expect(service.search(dto)).rejects.toThrow(
        'Vector and graph weights must sum to 1.0',
      );
    });

    it('should perform graph-only search successfully', async () => {
      const dto = {
        query: 'test query',
        organizationId: 'org-1',
        projectId: 'project-1',
        strategy: SearchStrategy.GRAPH_ONLY,
        vectorWeight: 0.6,
        graphWeight: 0.4,
        limit: 10,
        minSimilarity: 0.5,
        maxGraphDepth: 3,
      };

      const mockTask = {
        id: 'task-1',
        projectId: 'project-1',
        title: 'Test Task',
      } as Task;

      const mockDocument = {
        id: 'doc-1',
        title: 'Test Document',
        content: 'This is a test query document',
        type: DocumentType.KNOWLEDGE,
        taskId: 'task-1',
        metadata: {},
        tags: ['test'],
      } as Partial<Document> as Document;

      taskRepo.find.mockResolvedValue([mockTask]);
      mockQueryBuilder.getMany.mockResolvedValue([mockDocument]);

      const result = await service.search(dto);

      expect(result.results).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.query).toBe('test query');
      expect(result.strategy).toBe(SearchStrategy.GRAPH_ONLY);
      expect(result.metrics.searchTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty results gracefully', async () => {
      const dto = {
        query: 'nonexistent query',
        organizationId: 'org-1',
        strategy: SearchStrategy.GRAPH_ONLY,
        vectorWeight: 0.6,
        graphWeight: 0.4,
        limit: 10,
        minSimilarity: 0.5,
        maxGraphDepth: 3,
      };

      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.search(dto);

      expect(result.results).toEqual([]);
      expect(result.metrics.totalDocuments).toBe(0);
      expect(result.metrics.graphMatches).toBe(0);
    });
  });

  describe('graph traversal', () => {
    it('should traverse from hollon to team', async () => {
      const dto = {
        query: 'test',
        hollonId: 'hollon-1',
        strategy: SearchStrategy.GRAPH_ONLY,
        vectorWeight: 0.6,
        graphWeight: 0.4,
        limit: 10,
        minSimilarity: 0.5,
        maxGraphDepth: 2,
      };

      const mockHollon = {
        id: 'hollon-1',
        teamId: 'team-1',
        name: 'Test Hollon',
      } as Hollon;

      const mockTeam = {
        id: 'team-1',
        name: 'Test Team',
        organizationId: 'org-1',
        hollons: [],
      } as Partial<Team> as Team;

      const mockDocument = {
        id: 'doc-1',
        title: 'Test Document',
        content: 'test content',
        type: DocumentType.KNOWLEDGE,
        teamId: 'team-1',
        metadata: {},
        tags: [],
      } as Partial<Document> as Document;

      hollonRepo.findOne.mockResolvedValue(mockHollon);
      teamRepo.findOne.mockResolvedValue(mockTeam);
      projectRepo.find.mockResolvedValue([]);
      mockQueryBuilder.getMany.mockResolvedValue([mockDocument]);

      const result = await service.search(dto);

      expect(hollonRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'hollon-1' },
        relations: ['team'],
      });
      expect(teamRepo.findOne).toHaveBeenCalled();
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should traverse from project to tasks', async () => {
      const dto = {
        query: 'test',
        projectId: 'project-1',
        strategy: SearchStrategy.GRAPH_ONLY,
        vectorWeight: 0.6,
        graphWeight: 0.4,
        limit: 10,
        minSimilarity: 0.5,
        maxGraphDepth: 2,
      };

      const mockTask = {
        id: 'task-1',
        projectId: 'project-1',
        title: 'Test Task',
      } as Task;

      const mockDocument = {
        id: 'doc-1',
        title: 'Test Document',
        content: 'test content',
        type: DocumentType.TASK_CONTEXT,
        taskId: 'task-1',
        metadata: {},
        tags: [],
      } as Partial<Document> as Document;

      taskRepo.find.mockResolvedValue([mockTask]);
      mockQueryBuilder.getMany.mockResolvedValue([mockDocument]);

      const result = await service.search(dto);

      expect(taskRepo.find).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        take: 20,
      });
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should limit graph depth correctly', async () => {
      const dto = {
        query: 'test',
        projectId: 'project-1',
        strategy: SearchStrategy.GRAPH_ONLY,
        vectorWeight: 0.6,
        graphWeight: 0.4,
        limit: 10,
        minSimilarity: 0.5,
        maxGraphDepth: 1, // Should not traverse beyond project level
      };

      const mockDocument = {
        id: 'doc-1',
        title: 'Test Document',
        content: 'test content',
        type: DocumentType.KNOWLEDGE,
        projectId: 'project-1',
        metadata: {},
        tags: [],
      } as Partial<Document> as Document;

      mockQueryBuilder.getMany.mockResolvedValue([mockDocument]);

      await service.search(dto);

      // Should not call taskRepo.find because maxDepth is 1
      expect(taskRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('relationship scoring', () => {
    it('should score documents with multiple relationships higher', async () => {
      const dto = {
        query: 'test query',
        teamId: 'team-1',
        strategy: SearchStrategy.GRAPH_ONLY,
        vectorWeight: 0.6,
        graphWeight: 0.4,
        limit: 10,
        minSimilarity: 0.5,
        maxGraphDepth: 3,
      };

      const mockTeam = {
        id: 'team-1',
        name: 'Test Team',
        organizationId: 'org-1',
        hollons: [{ id: 'hollon-1' } as Hollon, { id: 'hollon-2' } as Hollon],
      } as Team;

      const mockProject = {
        id: 'project-1',
        organizationId: 'org-1',
        name: 'Test Project',
      } as Project;

      const mockTask = {
        id: 'task-1',
        projectId: 'project-1',
        title: 'Test Task',
      } as Task;

      const mockDocument = {
        id: 'doc-1',
        title: 'Test Document',
        content: 'test query content',
        type: DocumentType.KNOWLEDGE,
        taskId: 'task-1',
        metadata: {},
        tags: [],
      } as Partial<Document> as Document;

      teamRepo.findOne.mockResolvedValue(mockTeam);
      projectRepo.find.mockResolvedValue([mockProject]);
      taskRepo.find.mockResolvedValue([mockTask]);
      mockQueryBuilder.getMany.mockResolvedValue([mockDocument]);

      const result = await service.search(dto);

      expect(result.results.length).toBeGreaterThan(0);
      if (result.results.length > 0) {
        const firstResult = result.results[0];
        expect(firstResult.relationships.length).toBeGreaterThan(0);
        expect(firstResult.graphScore).toBeGreaterThan(0);
      }
    });
  });

  describe('text relevance calculation', () => {
    it('should calculate text relevance correctly', async () => {
      const dto = {
        query: 'knowledge system implementation',
        projectId: 'project-1',
        strategy: SearchStrategy.GRAPH_ONLY,
        vectorWeight: 0.6,
        graphWeight: 0.4,
        limit: 10,
        minSimilarity: 0.5,
        maxGraphDepth: 2,
      };

      const highRelevanceDoc = {
        id: 'doc-1',
        title: 'Knowledge System Implementation Guide',
        content: 'This document describes the knowledge system implementation',
        type: DocumentType.KNOWLEDGE,
        projectId: 'project-1',
        metadata: {},
        tags: [],
      } as Partial<Document> as Document;

      const lowRelevanceDoc = {
        id: 'doc-2',
        title: 'Unrelated Document',
        content: 'This is about something completely different',
        type: DocumentType.KNOWLEDGE,
        projectId: 'project-1',
        metadata: {},
        tags: [],
      } as Partial<Document> as Document;

      mockQueryBuilder.getMany.mockResolvedValue([
        highRelevanceDoc,
        lowRelevanceDoc,
      ]);

      const result = await service.search(dto);

      // High relevance doc should be included
      const highRelevanceResult = result.results.find(
        (r) => r.documentId === 'doc-1',
      );
      expect(highRelevanceResult).toBeDefined();
      expect(highRelevanceResult?.graphScore).toBeGreaterThan(0);

      // Low relevance doc might be filtered out or have lower score
      const lowRelevanceResult = result.results.find(
        (r) => r.documentId === 'doc-2',
      );
      if (lowRelevanceResult) {
        expect(lowRelevanceResult.graphScore).toBeLessThan(
          highRelevanceResult?.graphScore || 1,
        );
      }
    });
  });

  describe('result limiting and sorting', () => {
    it('should limit results to specified limit', async () => {
      const dto = {
        query: 'test',
        projectId: 'project-1',
        strategy: SearchStrategy.GRAPH_ONLY,
        vectorWeight: 0.6,
        graphWeight: 0.4,
        limit: 5,
        minSimilarity: 0.5,
        maxGraphDepth: 2,
      };

      const mockDocuments = Array.from({ length: 10 }, (_, i) => ({
        id: `doc-${i}`,
        title: `Test Document ${i}`,
        content: 'test content',
        type: DocumentType.KNOWLEDGE,
        projectId: 'project-1',
        metadata: {},
        tags: [],
      })) as Partial<Document>[] as Document[];

      mockQueryBuilder.getMany.mockResolvedValue(mockDocuments);

      const result = await service.search(dto);

      expect(result.results.length).toBeLessThanOrEqual(5);
    });

    it('should sort results by combined score descending', async () => {
      const dto = {
        query: 'test query document',
        projectId: 'project-1',
        strategy: SearchStrategy.GRAPH_ONLY,
        vectorWeight: 0.6,
        graphWeight: 0.4,
        limit: 10,
        minSimilarity: 0.5,
        maxGraphDepth: 2,
      };

      const mockDocuments = [
        {
          id: 'doc-1',
          title: 'Low Relevance',
          content: 'unrelated content',
          type: DocumentType.KNOWLEDGE,
          projectId: 'project-1',
          metadata: {},
          tags: [],
        },
        {
          id: 'doc-2',
          title: 'High Relevance',
          content: 'test query document content',
          type: DocumentType.KNOWLEDGE,
          projectId: 'project-1',
          metadata: {},
          tags: [],
        },
      ] as Partial<Document>[] as Document[];

      mockQueryBuilder.getMany.mockResolvedValue(mockDocuments);

      const result = await service.search(dto);

      if (result.results.length > 1) {
        for (let i = 0; i < result.results.length - 1; i++) {
          expect(result.results[i].combinedScore).toBeGreaterThanOrEqual(
            result.results[i + 1].combinedScore,
          );
        }
      }
    });
  });

  describe('metrics calculation', () => {
    it('should calculate search metrics correctly', async () => {
      const dto = {
        query: 'test',
        projectId: 'project-1',
        strategy: SearchStrategy.GRAPH_ONLY,
        vectorWeight: 0.6,
        graphWeight: 0.4,
        limit: 10,
        minSimilarity: 0.5,
        maxGraphDepth: 2,
      };

      const mockDocument = {
        id: 'doc-1',
        title: 'Test Document',
        content: 'test content',
        type: DocumentType.KNOWLEDGE,
        projectId: 'project-1',
        metadata: {},
        tags: [],
      } as Partial<Document> as Document;

      mockQueryBuilder.getMany.mockResolvedValue([mockDocument]);

      const result = await service.search(dto);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalDocuments).toBe(result.results.length);
      expect(result.metrics.searchTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metrics.avgGraphScore).toBeGreaterThanOrEqual(0);
      expect(result.metrics.avgGraphScore).toBeLessThanOrEqual(1);
      expect(result.metrics.avgCombinedScore).toBeGreaterThanOrEqual(0);
      expect(result.metrics.avgCombinedScore).toBeLessThanOrEqual(1);
    });
  });
});
