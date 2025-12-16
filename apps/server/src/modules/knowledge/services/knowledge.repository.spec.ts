import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { KnowledgeRepository } from './knowledge.repository';
import {
  KnowledgeEntry,
  KnowledgeEntryType,
  KnowledgeCategory,
} from '../entities/knowledge-entry.entity';
import { NotFoundException } from '@nestjs/common';

describe('KnowledgeRepository', () => {
  let repository: KnowledgeRepository;
  let entryRepo: jest.Mocked<Repository<KnowledgeEntry>>;

  const mockEntry: Partial<KnowledgeEntry> = {
    id: 'knowledge-123',
    title: 'Test Knowledge Entry',
    content: 'This is test content',
    type: KnowledgeEntryType.BEST_PRACTICE,
    category: KnowledgeCategory.TECHNICAL,
    organizationId: 'org-123',
    teamId: null,
    projectId: null,
    taskId: null,
    extractedByHollonId: null,
    tags: ['test', 'typescript'],
    sources: {},
    confidenceScore: 75,
    applicationCount: 5,
    metadata: {},
  };

  beforeEach(async () => {
    const mockEntryRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeRepository,
        {
          provide: getRepositoryToken(KnowledgeEntry),
          useValue: mockEntryRepo,
        },
      ],
    }).compile();

    repository = module.get<KnowledgeRepository>(KnowledgeRepository);
    entryRepo = module.get(getRepositoryToken(KnowledgeEntry)) as jest.Mocked<
      Repository<KnowledgeEntry>
    >;
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a knowledge entry', async () => {
      const dto = {
        title: 'Test Entry',
        content: 'Test content',
        type: KnowledgeEntryType.BEST_PRACTICE,
        category: KnowledgeCategory.TECHNICAL,
        organizationId: 'org-123',
      };

      entryRepo.create.mockReturnValue(mockEntry as KnowledgeEntry);
      entryRepo.save.mockResolvedValue(mockEntry as KnowledgeEntry);

      const result = await repository.create(dto);

      expect(entryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: dto.title,
          content: dto.content,
          type: dto.type,
          category: dto.category,
          organizationId: dto.organizationId,
        }),
      );
      expect(entryRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockEntry);
    });

    it('should set default values for optional fields', async () => {
      const dto = {
        title: 'Test Entry',
        content: 'Test content',
        type: KnowledgeEntryType.LESSON_LEARNED,
        category: KnowledgeCategory.PROCESS,
        organizationId: 'org-123',
      };

      entryRepo.create.mockReturnValue(mockEntry as KnowledgeEntry);
      entryRepo.save.mockResolvedValue(mockEntry as KnowledgeEntry);

      await repository.create(dto);

      expect(entryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [],
          sources: {},
          confidenceScore: 50,
          metadata: {},
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should find a knowledge entry by ID', async () => {
      entryRepo.findOne.mockResolvedValue(mockEntry as KnowledgeEntry);

      const result = await repository.findOne('knowledge-123');

      expect(entryRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'knowledge-123' },
        relations: [
          'organization',
          'team',
          'project',
          'task',
          'extractedByHollon',
        ],
      });
      expect(result).toEqual(mockEntry);
    });

    it('should throw NotFoundException if entry not found', async () => {
      entryRepo.findOne.mockResolvedValue(null);

      await expect(repository.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('search', () => {
    it('should search knowledge entries with filters', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEntry]),
      } as unknown as SelectQueryBuilder<KnowledgeEntry>;

      entryRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQueryBuilder);

      const options = {
        organizationId: 'org-123',
        type: KnowledgeEntryType.BEST_PRACTICE,
        category: KnowledgeCategory.TECHNICAL,
        tags: ['test'],
        minConfidence: 50,
        limit: 10,
        offset: 0,
      };

      const results = await repository.search(options);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'ke.organization_id = :orgId',
        { orgId: 'org-123' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'ke.type = :type',
        { type: KnowledgeEntryType.BEST_PRACTICE },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'ke.category = :category',
        { category: KnowledgeCategory.TECHNICAL },
      );
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(results).toEqual([mockEntry]);
    });

    it('should handle optional filters', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockEntry]),
      } as unknown as SelectQueryBuilder<KnowledgeEntry>;

      entryRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQueryBuilder);

      const options = {
        organizationId: 'org-123',
      };

      await repository.search(options);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'ke.organization_id = :orgId',
        { orgId: 'org-123' },
      );
      // Should not call andWhere for optional filters
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        'ke.type = :type',
        expect.anything(),
      );
    });
  });

  describe('findByTags', () => {
    it('should find entries by tags', async () => {
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

      const results = await repository.findByTags(
        'org-123',
        ['test', 'typescript'],
        { limit: 5 },
      );

      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'ke.tags && :tags',
        { tags: ['test', 'typescript'] },
      );
      expect(results).toEqual([mockEntry]);
    });
  });

  describe('incrementApplicationCount', () => {
    it('should increment application count and confidence score', async () => {
      const entry = {
        ...mockEntry,
        applicationCount: 5,
        confidenceScore: 75,
      } as KnowledgeEntry;
      entryRepo.findOne.mockResolvedValue(entry);
      entryRepo.save.mockResolvedValue({
        ...entry,
        applicationCount: 6,
        confidenceScore: 77,
      } as KnowledgeEntry);

      const result =
        await repository.incrementApplicationCount('knowledge-123');

      expect(result.applicationCount).toBe(6);
      expect(result.confidenceScore).toBe(77);
    });

    it('should cap confidence score at 100', async () => {
      const entry = {
        ...mockEntry,
        applicationCount: 10,
        confidenceScore: 99,
      } as KnowledgeEntry;
      entryRepo.findOne.mockResolvedValue(entry);
      entryRepo.save.mockResolvedValue({
        ...entry,
        applicationCount: 11,
        confidenceScore: 100,
      } as KnowledgeEntry);

      const result =
        await repository.incrementApplicationCount('knowledge-123');

      expect(result.confidenceScore).toBe(100);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for an organization', async () => {
      const entries = [
        {
          ...mockEntry,
          type: KnowledgeEntryType.BEST_PRACTICE,
          category: KnowledgeCategory.TECHNICAL,
          confidenceScore: 80,
        },
        {
          ...mockEntry,
          type: KnowledgeEntryType.LESSON_LEARNED,
          category: KnowledgeCategory.PROCESS,
          confidenceScore: 70,
        },
        {
          ...mockEntry,
          type: KnowledgeEntryType.BEST_PRACTICE,
          category: KnowledgeCategory.TECHNICAL,
          confidenceScore: 90,
        },
      ] as KnowledgeEntry[];

      entryRepo.find.mockResolvedValue(entries);

      const stats = await repository.getStatistics('org-123');

      expect(stats.totalEntries).toBe(3);
      expect(stats.byType[KnowledgeEntryType.BEST_PRACTICE]).toBe(2);
      expect(stats.byType[KnowledgeEntryType.LESSON_LEARNED]).toBe(1);
      expect(stats.byCategory[KnowledgeCategory.TECHNICAL]).toBe(2);
      expect(stats.byCategory[KnowledgeCategory.PROCESS]).toBe(1);
      expect(stats.averageConfidence).toBe(80);
    });

    it('should handle empty results', async () => {
      entryRepo.find.mockResolvedValue([]);

      const stats = await repository.getStatistics('org-123');

      expect(stats.totalEntries).toBe(0);
      expect(stats.averageConfidence).toBe(0);
    });
  });

  describe('update', () => {
    it('should update a knowledge entry', async () => {
      const entry = { ...mockEntry } as KnowledgeEntry;
      const updates = { title: 'Updated Title', confidenceScore: 90 };

      entryRepo.findOne.mockResolvedValue(entry);
      entryRepo.save.mockResolvedValue({
        ...entry,
        ...updates,
      } as KnowledgeEntry);

      const result = await repository.update('knowledge-123', updates);

      expect(result.title).toBe('Updated Title');
      expect(result.confidenceScore).toBe(90);
    });
  });

  describe('remove', () => {
    it('should remove a knowledge entry', async () => {
      const entry = { ...mockEntry } as KnowledgeEntry;
      entryRepo.findOne.mockResolvedValue(entry);
      entryRepo.remove.mockResolvedValue(entry);

      await repository.remove('knowledge-123');

      expect(entryRepo.remove).toHaveBeenCalledWith(entry);
    });
  });
});
