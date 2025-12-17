import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service';
import { KnowledgeRepository } from './knowledge.repository';
import {
  KnowledgeEntry,
  KnowledgeEntryType,
  KnowledgeCategory,
} from '../entities/knowledge-entry.entity';

describe('KnowledgeRetrievalService', () => {
  let service: KnowledgeRetrievalService;
  let knowledgeRepo: jest.Mocked<KnowledgeRepository>;
  let entryRepo: jest.Mocked<Repository<KnowledgeEntry>>;

  const mockEntry: Partial<KnowledgeEntry> = {
    id: 'knowledge-123',
    title: 'Best Practice: TypeScript Testing',
    content: 'Always use Jest for TypeScript testing',
    type: KnowledgeEntryType.BEST_PRACTICE,
    category: KnowledgeCategory.TECHNICAL,
    organizationId: 'org-123',
    teamId: null,
    projectId: null,
    taskId: null,
    tags: ['typescript', 'testing', 'jest'],
    confidenceScore: 85,
    applicationCount: 10,
  };

  beforeEach(async () => {
    const mockKnowledgeRepo = {
      findOne: jest.fn(),
      findByTags: jest.fn(),
      search: jest.fn(),
      findByTask: jest.fn(),
      getStatistics: jest.fn(),
    };

    const mockEntryRepo = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeRetrievalService,
        {
          provide: KnowledgeRepository,
          useValue: mockKnowledgeRepo,
        },
        {
          provide: getRepositoryToken(KnowledgeEntry),
          useValue: mockEntryRepo,
        },
      ],
    }).compile();

    service = module.get<KnowledgeRetrievalService>(KnowledgeRetrievalService);
    knowledgeRepo = module.get(
      KnowledgeRepository,
    ) as jest.Mocked<KnowledgeRepository>;
    entryRepo = module.get(getRepositoryToken(KnowledgeEntry)) as jest.Mocked<
      Repository<KnowledgeEntry>
    >;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('semanticSearch', () => {
    it('should perform keyword-based search', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEntry]),
      } as unknown as SelectQueryBuilder<KnowledgeEntry>;

      entryRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQueryBuilder);

      const results = await service.semanticSearch({
        query: 'typescript testing',
        organizationId: 'org-123',
        limit: 5,
      });

      expect(results).toEqual([mockEntry]);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({
          query: expect.stringContaining('typescript testing'),
        }),
      );
    });

    it('should apply filters', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEntry]),
      } as unknown as SelectQueryBuilder<KnowledgeEntry>;

      entryRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQueryBuilder);

      await service.semanticSearch({
        query: 'testing',
        organizationId: 'org-123',
        type: KnowledgeEntryType.BEST_PRACTICE,
        category: KnowledgeCategory.TECHNICAL,
        minConfidence: 80,
        limit: 5,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'ke.type = :type',
        { type: KnowledgeEntryType.BEST_PRACTICE },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'ke.category = :category',
        { category: KnowledgeCategory.TECHNICAL },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'ke.confidence_score >= :minConfidence',
        { minConfidence: 80 },
      );
    });
  });

  describe('retrieveForContext', () => {
    it('should retrieve knowledge using tags', async () => {
      knowledgeRepo.findByTags.mockResolvedValue([mockEntry as KnowledgeEntry]);
      knowledgeRepo.search.mockResolvedValue([]);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as unknown as SelectQueryBuilder<KnowledgeEntry>;

      entryRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQueryBuilder);

      const results = await service.retrieveForContext(
        {
          tags: ['typescript', 'testing'],
        },
        'org-123',
        { limit: 5 },
      );

      expect(knowledgeRepo.findByTags).toHaveBeenCalledWith(
        'org-123',
        ['typescript', 'testing'],
        expect.anything(),
      );
      expect(results.length).toBeGreaterThan(0);
    });

    it('should combine results from multiple sources', async () => {
      const entry1 = { ...mockEntry, id: 'entry-1' } as KnowledgeEntry;
      const entry2 = { ...mockEntry, id: 'entry-2' } as KnowledgeEntry;
      const entry3 = { ...mockEntry, id: 'entry-3' } as KnowledgeEntry;

      knowledgeRepo.findByTags.mockResolvedValue([entry1]);
      knowledgeRepo.search.mockResolvedValue([entry2]);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([entry3]),
      } as unknown as SelectQueryBuilder<KnowledgeEntry>;

      entryRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQueryBuilder);

      const results = await service.retrieveForContext(
        {
          tags: ['typescript'],
          taskDescription: 'Write tests for the authentication module',
          type: 'feature',
        },
        'org-123',
        { limit: 10 },
      );

      // Should have combined and deduplicated results
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should return empty array when no context provided', async () => {
      knowledgeRepo.findByTags.mockResolvedValue([]);
      knowledgeRepo.search.mockResolvedValue([]);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as unknown as SelectQueryBuilder<KnowledgeEntry>;

      entryRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQueryBuilder);

      const results = await service.retrieveForContext({}, 'org-123');

      expect(results).toEqual([]);
    });
  });

  describe('findSimilar', () => {
    it('should find similar entries based on tags and category', async () => {
      const originalEntry = { ...mockEntry } as KnowledgeEntry;
      const similarEntry = {
        ...mockEntry,
        id: 'similar-123',
      } as KnowledgeEntry;

      knowledgeRepo.findOne.mockResolvedValue(originalEntry);
      knowledgeRepo.search.mockResolvedValue([originalEntry, similarEntry]);

      const results = await service.findSimilar('knowledge-123', { limit: 5 });

      expect(knowledgeRepo.findOne).toHaveBeenCalledWith('knowledge-123');
      expect(knowledgeRepo.search).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-123',
          category: KnowledgeCategory.TECHNICAL,
          tags: expect.arrayContaining(['typescript', 'testing', 'jest']),
        }),
      );
      // Should exclude the original entry
      expect(results).not.toContainEqual(
        expect.objectContaining({ id: 'knowledge-123' }),
      );
    });
  });

  describe('getRecommendationsForTask', () => {
    it('should return existing knowledge for a task', async () => {
      knowledgeRepo.findByTask.mockResolvedValue([mockEntry as KnowledgeEntry]);

      const results = await service.getRecommendationsForTask(
        'task-123',
        'org-123',
      );

      expect(knowledgeRepo.findByTask).toHaveBeenCalledWith('task-123');
      expect(results).toEqual([mockEntry]);
    });

    it('should retrieve based on context if no existing knowledge', async () => {
      knowledgeRepo.findByTask.mockResolvedValue([]);
      knowledgeRepo.findByTags.mockResolvedValue([mockEntry as KnowledgeEntry]);
      knowledgeRepo.search.mockResolvedValue([]);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as unknown as SelectQueryBuilder<KnowledgeEntry>;

      entryRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQueryBuilder);

      const results = await service.getRecommendationsForTask(
        'task-123',
        'org-123',
        {
          tags: ['typescript'],
          type: 'feature',
        },
      );

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getInsights', () => {
    it('should return insights for an organization', async () => {
      const stats = {
        totalEntries: 10,
        byType: {
          [KnowledgeEntryType.LESSON_LEARNED]: 0,
          [KnowledgeEntryType.BEST_PRACTICE]: 5,
          [KnowledgeEntryType.TECHNICAL_DECISION]: 0,
          [KnowledgeEntryType.ERROR_PATTERN]: 0,
          [KnowledgeEntryType.OPTIMIZATION_INSIGHT]: 0,
          [KnowledgeEntryType.PROCESS_IMPROVEMENT]: 0,
        },
        byCategory: {
          [KnowledgeCategory.TECHNICAL]: 7,
          [KnowledgeCategory.PROCESS]: 0,
          [KnowledgeCategory.COLLABORATION]: 0,
          [KnowledgeCategory.QUALITY]: 0,
          [KnowledgeCategory.PERFORMANCE]: 0,
          [KnowledgeCategory.ARCHITECTURE]: 0,
        },
        averageConfidence: 80,
      };

      knowledgeRepo.getStatistics.mockResolvedValue(stats);
      entryRepo.find.mockResolvedValue([
        { tags: ['typescript', 'testing'] } as KnowledgeEntry,
        { tags: ['typescript', 'jest'] } as KnowledgeEntry,
        { tags: ['testing', 'jest'] } as KnowledgeEntry,
      ]);

      const insights = await service.getInsights('org-123');

      expect(insights.totalEntries).toBe(10);
      expect(insights.averageConfidence).toBe(80);
      expect(insights.topTags.length).toBeGreaterThan(0);
      expect(insights.mostApplied.length).toBeGreaterThan(0);
    });

    it('should calculate top tags correctly', async () => {
      const stats = {
        totalEntries: 3,
        byType: {
          [KnowledgeEntryType.LESSON_LEARNED]: 0,
          [KnowledgeEntryType.BEST_PRACTICE]: 0,
          [KnowledgeEntryType.TECHNICAL_DECISION]: 0,
          [KnowledgeEntryType.ERROR_PATTERN]: 0,
          [KnowledgeEntryType.OPTIMIZATION_INSIGHT]: 0,
          [KnowledgeEntryType.PROCESS_IMPROVEMENT]: 0,
        },
        byCategory: {
          [KnowledgeCategory.TECHNICAL]: 0,
          [KnowledgeCategory.PROCESS]: 0,
          [KnowledgeCategory.COLLABORATION]: 0,
          [KnowledgeCategory.QUALITY]: 0,
          [KnowledgeCategory.PERFORMANCE]: 0,
          [KnowledgeCategory.ARCHITECTURE]: 0,
        },
        averageConfidence: 75,
      };

      knowledgeRepo.getStatistics.mockResolvedValue(stats);
      entryRepo.find
        .mockResolvedValueOnce([
          { tags: ['typescript', 'testing', 'jest'] } as KnowledgeEntry,
          { tags: ['typescript', 'testing'] } as KnowledgeEntry,
          { tags: ['typescript'] } as KnowledgeEntry,
        ])
        .mockResolvedValueOnce([]);

      const insights = await service.getInsights('org-123');

      expect(insights.topTags[0].tag).toBe('typescript');
      expect(insights.topTags[0].count).toBe(3);
      expect(insights.topTags[1].tag).toBe('testing');
      expect(insights.topTags[1].count).toBe(2);
    });
  });
});
