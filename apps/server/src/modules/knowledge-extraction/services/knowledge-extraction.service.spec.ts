import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { KnowledgeExtractionService } from './knowledge-extraction.service';
import { KnowledgeItem } from '../entities/knowledge-item.entity';
import { CreateKnowledgeExtractionDto } from '../dto/create-knowledge-extraction.dto';
import { UpdateKnowledgeExtractionDto } from '../dto/update-knowledge-extraction.dto';

describe('KnowledgeExtractionService', () => {
  let service: KnowledgeExtractionService;

  const mockKnowledgeItemRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };

  const mockKnowledgeItem: Partial<KnowledgeItem> = {
    id: 'knowledge-123',
    content: 'Test knowledge content',
    source: 'test-source',
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
      const createDto: CreateKnowledgeExtractionDto = {
        content: 'New knowledge',
        source: 'test-source',
        extractedAt: '2024-01-01T00:00:00.000Z',
        organizationId: 'org-123',
      };

      const createdItem = { ...mockKnowledgeItem, ...createDto };
      mockKnowledgeItemRepository.create.mockReturnValue(createdItem);
      mockKnowledgeItemRepository.save.mockResolvedValue(createdItem);

      const result = await service.create(createDto);

      expect(mockKnowledgeItemRepository.create).toHaveBeenCalledWith({
        content: createDto.content,
        source: createDto.source,
        extractedAt: new Date(createDto.extractedAt),
        metadata: null,
        organizationId: createDto.organizationId,
      });
      expect(mockKnowledgeItemRepository.save).toHaveBeenCalledWith(
        createdItem,
      );
      expect(result).toEqual(createdItem);
    });

    it('should create a knowledge item with metadata', async () => {
      const createDto: CreateKnowledgeExtractionDto = {
        content: 'New knowledge',
        source: 'test-source',
        extractedAt: '2024-01-01T00:00:00.000Z',
        metadata: { category: 'test', priority: 'high' },
        organizationId: 'org-123',
      };

      const createdItem = { ...mockKnowledgeItem, ...createDto };
      mockKnowledgeItemRepository.create.mockReturnValue(createdItem);
      mockKnowledgeItemRepository.save.mockResolvedValue(createdItem);

      const result = await service.create(createDto);

      expect(mockKnowledgeItemRepository.create).toHaveBeenCalledWith({
        content: createDto.content,
        source: createDto.source,
        extractedAt: new Date(createDto.extractedAt),
        metadata: createDto.metadata,
        organizationId: createDto.organizationId,
      });
      expect(result.metadata).toEqual(createDto.metadata);
    });

    it('should handle errors during creation', async () => {
      const createDto: CreateKnowledgeExtractionDto = {
        content: 'New knowledge',
        source: 'test-source',
        extractedAt: '2024-01-01T00:00:00.000Z',
        organizationId: 'org-123',
      };

      mockKnowledgeItemRepository.create.mockReturnValue(mockKnowledgeItem);
      mockKnowledgeItemRepository.save.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.create(createDto)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('findAll', () => {
    it('should return all knowledge items with default pagination', async () => {
      const items = [mockKnowledgeItem, { ...mockKnowledgeItem, id: 'knowledge-456' }];
      mockKnowledgeItemRepository.find.mockResolvedValue(items);

      const result = await service.findAll();

      expect(mockKnowledgeItemRepository.find).toHaveBeenCalledWith({
        order: { extractedAt: 'DESC' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual(items);
    });

    it('should apply custom pagination', async () => {
      const items = [mockKnowledgeItem];
      mockKnowledgeItemRepository.find.mockResolvedValue(items);

      const result = await service.findAll(10, 20);

      expect(mockKnowledgeItemRepository.find).toHaveBeenCalledWith({
        order: { extractedAt: 'DESC' },
        take: 10,
        skip: 20,
      });
      expect(result).toEqual(items);
    });

    it('should return empty array when no items found', async () => {
      mockKnowledgeItemRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a knowledge item if found', async () => {
      mockKnowledgeItemRepository.findOne.mockResolvedValue(mockKnowledgeItem);

      const result = await service.findOne('knowledge-123');

      expect(mockKnowledgeItemRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'knowledge-123' },
        relations: ['organization'],
      });
      expect(result).toEqual(mockKnowledgeItem);
    });

    it('should throw NotFoundException if knowledge item not found', async () => {
      mockKnowledgeItemRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent')).rejects.toThrow(
        'Knowledge item with ID non-existent not found',
      );
    });
  });

  describe('findByOrganization', () => {
    it('should return knowledge items for a specific organization', async () => {
      const items = [mockKnowledgeItem, { ...mockKnowledgeItem, id: 'knowledge-456' }];
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

  describe('findBySource', () => {
    it('should return knowledge items from a specific source', async () => {
      const items = [mockKnowledgeItem];
      mockKnowledgeItemRepository.find.mockResolvedValue(items);

      const result = await service.findBySource('test-source');

      expect(mockKnowledgeItemRepository.find).toHaveBeenCalledWith({
        where: { source: 'test-source' },
        order: { extractedAt: 'DESC' },
      });
      expect(result).toEqual(items);
    });

    it('should return empty array if no items from source', async () => {
      mockKnowledgeItemRepository.find.mockResolvedValue([]);

      const result = await service.findBySource('unknown-source');

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update knowledge item content', async () => {
      const updateDto: UpdateKnowledgeExtractionDto = {
        content: 'Updated content',
      };

      mockKnowledgeItemRepository.findOne.mockResolvedValue(mockKnowledgeItem);
      const updatedItem = { ...mockKnowledgeItem, content: 'Updated content' };
      mockKnowledgeItemRepository.save.mockResolvedValue(updatedItem);

      const result = await service.update('knowledge-123', updateDto);

      expect(mockKnowledgeItemRepository.save).toHaveBeenCalled();
      expect(result.content).toBe('Updated content');
    });

    it('should update knowledge item source', async () => {
      const updateDto: UpdateKnowledgeExtractionDto = {
        source: 'new-source',
      };

      mockKnowledgeItemRepository.findOne.mockResolvedValue(mockKnowledgeItem);
      const updatedItem = { ...mockKnowledgeItem, source: 'new-source' };
      mockKnowledgeItemRepository.save.mockResolvedValue(updatedItem);

      const result = await service.update('knowledge-123', updateDto);

      expect(result.source).toBe('new-source');
    });

    it('should update knowledge item extractedAt date', async () => {
      const newDate = '2024-12-31T23:59:59.000Z';
      const updateDto: UpdateKnowledgeExtractionDto = {
        extractedAt: newDate,
      };

      mockKnowledgeItemRepository.findOne.mockResolvedValue(mockKnowledgeItem);
      const updatedItem = {
        ...mockKnowledgeItem,
        extractedAt: new Date(newDate),
      };
      mockKnowledgeItemRepository.save.mockResolvedValue(updatedItem);

      const result = await service.update('knowledge-123', updateDto);

      expect(result.extractedAt).toEqual(new Date(newDate));
    });

    it('should update knowledge item metadata', async () => {
      const updateDto: UpdateKnowledgeExtractionDto = {
        metadata: { updated: true, newKey: 'value' },
      };

      mockKnowledgeItemRepository.findOne.mockResolvedValue(mockKnowledgeItem);
      const updatedItem = { ...mockKnowledgeItem, metadata: updateDto.metadata };
      mockKnowledgeItemRepository.save.mockResolvedValue(updatedItem);

      const result = await service.update('knowledge-123', updateDto);

      expect(result.metadata).toEqual(updateDto.metadata);
    });

    it('should update multiple fields at once', async () => {
      const updateDto: UpdateKnowledgeExtractionDto = {
        content: 'New content',
        source: 'new-source',
        metadata: { updated: true },
      };

      mockKnowledgeItemRepository.findOne.mockResolvedValue(mockKnowledgeItem);
      const updatedItem = { ...mockKnowledgeItem, ...updateDto };
      mockKnowledgeItemRepository.save.mockResolvedValue(updatedItem);

      const result = await service.update('knowledge-123', updateDto);

      expect(result.content).toBe('New content');
      expect(result.source).toBe('new-source');
      expect(result.metadata).toEqual({ updated: true });
    });

    it('should throw NotFoundException if knowledge item not found', async () => {
      mockKnowledgeItemRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { content: 'New content' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a knowledge item', async () => {
      mockKnowledgeItemRepository.findOne.mockResolvedValue(mockKnowledgeItem);
      mockKnowledgeItemRepository.remove.mockResolvedValue(mockKnowledgeItem);

      await service.remove('knowledge-123');

      expect(mockKnowledgeItemRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'knowledge-123' },
        relations: ['organization'],
      });
      expect(mockKnowledgeItemRepository.remove).toHaveBeenCalledWith(
        mockKnowledgeItem,
      );
    });

    it('should throw NotFoundException if knowledge item not found', async () => {
      mockKnowledgeItemRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('extractKnowledge', () => {
    it('should create a knowledge item with extraction metadata', async () => {
      const content = 'Content to extract knowledge from';
      const source = 'test-document';
      const organizationId = 'org-123';

      const createdItem = {
        ...mockKnowledgeItem,
        content,
        source,
        organizationId,
      };
      mockKnowledgeItemRepository.create.mockReturnValue(createdItem);
      mockKnowledgeItemRepository.save.mockResolvedValue(createdItem);

      const result = await service.extractKnowledge(
        content,
        source,
        organizationId,
      );

      expect(mockKnowledgeItemRepository.create).toHaveBeenCalled();
      expect(mockKnowledgeItemRepository.save).toHaveBeenCalled();
      expect(result.content).toBe(content);
      expect(result.source).toBe(source);
    });
  });

  describe('categorizeKnowledge', () => {
    it('should add categorization metadata to knowledge item', async () => {
      mockKnowledgeItemRepository.findOne.mockResolvedValue(mockKnowledgeItem);
      const categorizedItem = {
        ...mockKnowledgeItem,
        metadata: {
          ...mockKnowledgeItem.metadata,
          category: 'uncategorized',
          categorizedAt: expect.any(String),
        },
      };
      mockKnowledgeItemRepository.save.mockResolvedValue(categorizedItem);

      const result = await service.categorizeKnowledge('knowledge-123');

      expect(mockKnowledgeItemRepository.save).toHaveBeenCalled();
      expect(result.metadata).toHaveProperty('category');
      expect(result.metadata).toHaveProperty('categorizedAt');
    });

    it('should throw NotFoundException if knowledge item not found', async () => {
      mockKnowledgeItemRepository.findOne.mockResolvedValue(null);

      await expect(service.categorizeKnowledge('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('searchBySimilarity', () => {
    it('should return knowledge items for similarity search', async () => {
      const items = [mockKnowledgeItem];
      mockKnowledgeItemRepository.find.mockResolvedValue(items);

      const result = await service.searchBySimilarity(
        'test query',
        'org-123',
      );

      expect(mockKnowledgeItemRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        order: { extractedAt: 'DESC' },
        take: 10,
      });
      expect(result).toEqual(items);
    });

    it('should apply custom limit to similarity search', async () => {
      const items = [mockKnowledgeItem];
      mockKnowledgeItemRepository.find.mockResolvedValue(items);

      await service.searchBySimilarity('test query', 'org-123', 20);

      expect(mockKnowledgeItemRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        order: { extractedAt: 'DESC' },
        take: 20,
      });
    });

    it('should return empty array if no similar items found', async () => {
      mockKnowledgeItemRepository.find.mockResolvedValue([]);

      const result = await service.searchBySimilarity('test query', 'org-123');

      expect(result).toEqual([]);
    });
  });
});
