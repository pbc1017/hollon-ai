import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KnowledgeExtractionService } from './knowledge-extraction.service';
import { KnowledgeItem } from '../entities/knowledge-item.entity';

describe('KnowledgeExtractionService', () => {
  let service: KnowledgeExtractionService;

  const mockKnowledgeItemRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getOne: jest.fn(),
      getCount: jest.fn(),
      getRawMany: jest.fn(),
    })),
  };

  const mockKnowledgeItem: Partial<KnowledgeItem> = {
    id: 'knowledge-123',
    content: 'Test knowledge content',
    type: 'test-type',
    extractedAt: new Date('2024-01-01T00:00:00.000Z'),
    metadata: { key: 'value' },
    organizationId: 'org-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeExtractionService,
        {
          provide: getRepositoryToken(KnowledgeItem),
          useValue: mockKnowledgeItemRepository,
        },
      ],
    }).compile();

    service = module.get<KnowledgeExtractionService>(
      KnowledgeExtractionService,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a knowledge item with all required fields', async () => {
      const createDto: Partial<KnowledgeItem> = {
        content: 'New knowledge',
        type: 'test-type',
        extractedAt: new Date('2024-01-01T00:00:00.000Z'),
        organizationId: 'org-123',
      };

      const createdItem = { ...mockKnowledgeItem, ...createDto };
      mockKnowledgeItemRepository.create.mockReturnValue(createdItem);
      mockKnowledgeItemRepository.save.mockResolvedValue(createdItem);

      const result = await service.create(createDto);

      expect(mockKnowledgeItemRepository.create).toHaveBeenCalledWith(
        createDto,
      );
      expect(mockKnowledgeItemRepository.save).toHaveBeenCalledWith(
        createdItem,
      );
      expect(result).toEqual(createdItem);
    });

    it('should create a knowledge item with metadata', async () => {
      const createDto: Partial<KnowledgeItem> = {
        content: 'New knowledge',
        type: 'test-type',
        extractedAt: new Date('2024-01-01T00:00:00.000Z'),
        metadata: { category: 'test', priority: 'high' },
        organizationId: 'org-123',
      };

      const createdItem = { ...mockKnowledgeItem, ...createDto };
      mockKnowledgeItemRepository.create.mockReturnValue(createdItem);
      mockKnowledgeItemRepository.save.mockResolvedValue(createdItem);

      const result = await service.create(createDto);

      expect(result.metadata).toEqual(createDto.metadata);
    });

    it('should handle errors during creation', async () => {
      const createDto: Partial<KnowledgeItem> = {
        content: 'New knowledge',
        type: 'test-type',
        extractedAt: new Date('2024-01-01T00:00:00.000Z'),
        organizationId: 'org-123',
      };

      mockKnowledgeItemRepository.create.mockReturnValue(mockKnowledgeItem);
      mockKnowledgeItemRepository.save.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.create(createDto)).rejects.toThrow('Database error');
    });
  });

  describe('findById', () => {
    it('should return a knowledge item if found', async () => {
      mockKnowledgeItemRepository.findOne.mockResolvedValue(mockKnowledgeItem);

      const result = await service.findById('knowledge-123');

      expect(mockKnowledgeItemRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'knowledge-123' },
      });
      expect(result).toEqual(mockKnowledgeItem);
    });

    it('should return null if knowledge item not found', async () => {
      mockKnowledgeItemRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByOrganization', () => {
    it('should return knowledge items for a specific organization', async () => {
      const items = [
        mockKnowledgeItem,
        { ...mockKnowledgeItem, id: 'knowledge-456' },
      ];
      mockKnowledgeItemRepository.find.mockResolvedValue(items);

      const result = await service.findByOrganization('org-123');

      expect(mockKnowledgeItemRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        order: { extractedAt: 'DESC' },
      });
      expect(result).toEqual(items);
    });

    it('should return empty array if organization has no knowledge items', async () => {
      mockKnowledgeItemRepository.find.mockResolvedValue([]);

      const result = await service.findByOrganization('org-empty');

      expect(result).toEqual([]);
    });
  });

  describe('findByType', () => {
    it('should return knowledge items of a specific type', async () => {
      const items = [mockKnowledgeItem];
      mockKnowledgeItemRepository.find.mockResolvedValue(items);

      const result = await service.findByType('org-123', 'test-type');

      expect(mockKnowledgeItemRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-123', type: 'test-type' },
        order: { extractedAt: 'DESC' },
      });
      expect(result).toEqual(items);
    });

    it('should return empty array if no items of type', async () => {
      mockKnowledgeItemRepository.find.mockResolvedValue([]);

      const result = await service.findByType('org-123', 'unknown-type');

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update knowledge item content', async () => {
      const updateDto: Partial<KnowledgeItem> = {
        content: 'Updated content',
      };

      mockKnowledgeItemRepository.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });
      mockKnowledgeItemRepository.findOne.mockResolvedValue({
        ...mockKnowledgeItem,
        content: 'Updated content',
      });

      const result = await service.update('knowledge-123', updateDto);

      expect(mockKnowledgeItemRepository.update).toHaveBeenCalled();
      expect(result?.content).toBe('Updated content');
    });

    it('should update knowledge item type', async () => {
      const updateDto: Partial<KnowledgeItem> = {
        type: 'new-type',
      };

      mockKnowledgeItemRepository.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });
      mockKnowledgeItemRepository.findOne.mockResolvedValue({
        ...mockKnowledgeItem,
        type: 'new-type',
      });

      const result = await service.update('knowledge-123', updateDto);

      expect(result?.type).toBe('new-type');
    });

    it('should update knowledge item metadata', async () => {
      const updateDto: Partial<KnowledgeItem> = {
        metadata: { updated: true, newKey: 'value' },
      };

      mockKnowledgeItemRepository.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });
      mockKnowledgeItemRepository.findOne.mockResolvedValue({
        ...mockKnowledgeItem,
        metadata: updateDto.metadata,
      });

      const result = await service.update('knowledge-123', updateDto);

      expect(result?.metadata).toEqual(updateDto.metadata);
    });

    it('should return null if knowledge item not found', async () => {
      mockKnowledgeItemRepository.update.mockResolvedValue({
        affected: 0,
        raw: [],
        generatedMaps: [],
      });
      mockKnowledgeItemRepository.findOne.mockResolvedValue(null);

      const result = await service.update('non-existent', {
        content: 'New content',
      });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a knowledge item', async () => {
      mockKnowledgeItemRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete('knowledge-123');

      expect(mockKnowledgeItemRepository.delete).toHaveBeenCalledWith(
        'knowledge-123',
      );
      expect(result).toBe(true);
    });

    it('should return false if knowledge item not found', async () => {
      mockKnowledgeItemRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('batchInsert', () => {
    it('should batch insert knowledge items', async () => {
      const items: Partial<KnowledgeItem>[] = [
        {
          organizationId: 'org-123',
          type: 'document',
          content: 'Document 1',
          extractedAt: new Date(),
        },
        {
          organizationId: 'org-123',
          type: 'document',
          content: 'Document 2',
          extractedAt: new Date(),
        },
      ];

      mockKnowledgeItemRepository.insert.mockResolvedValue({
        identifiers: [{ id: 'id-1' }, { id: 'id-2' }],
        generatedMaps: [],
        raw: [],
      });
      mockKnowledgeItemRepository.find.mockResolvedValue([
        { ...mockKnowledgeItem, id: 'id-1' },
        { ...mockKnowledgeItem, id: 'id-2' },
      ]);

      const result = await service.batchInsert(items);

      expect(mockKnowledgeItemRepository.insert).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty input', async () => {
      const result = await service.batchInsert([]);

      expect(result).toEqual([]);
      expect(mockKnowledgeItemRepository.insert).not.toHaveBeenCalled();
    });
  });

  describe('countByOrganization', () => {
    it('should count knowledge items for an organization', async () => {
      mockKnowledgeItemRepository.count.mockResolvedValue(42);

      const result = await service.countByOrganization('org-123');

      expect(mockKnowledgeItemRepository.count).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
      });
      expect(result).toBe(42);
    });
  });

  describe('findRecent', () => {
    it('should return recent knowledge items', async () => {
      const items = [mockKnowledgeItem];
      mockKnowledgeItemRepository.find.mockResolvedValue(items);

      const result = await service.findRecent('org-123', 5);

      expect(mockKnowledgeItemRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        order: { extractedAt: 'DESC' },
        take: 5,
      });
      expect(result).toEqual(items);
    });
  });

  describe('findWithPagination', () => {
    it('should return paginated knowledge items', async () => {
      const items = [mockKnowledgeItem];
      mockKnowledgeItemRepository.findAndCount.mockResolvedValue([items, 100]);

      const result = await service.findWithPagination('org-123', 2, 20);

      expect(mockKnowledgeItemRepository.findAndCount).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        order: { extractedAt: 'DESC' },
        skip: 20,
        take: 20,
      });
      expect(result).toEqual({
        items,
        total: 100,
        page: 2,
        limit: 20,
      });
    });
  });
});
