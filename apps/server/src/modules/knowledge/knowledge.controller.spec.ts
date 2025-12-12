import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { HybridSearchQueryDto } from './dto/hybrid-search-query.dto';
import {
  AdvancedSearchDto,
  SortField,
  SortOrder,
} from './dto/advanced-search.dto';
import { DocumentType } from '../document/entities/document.entity';

describe('KnowledgeController', () => {
  let controller: KnowledgeController;
  let service: KnowledgeService;

  const mockSearchResult = {
    documents: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Document',
        content: 'Test content',
        type: DocumentType.KNOWLEDGE,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
        projectId: null,
        teamId: null,
        tags: ['test', 'knowledge'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeController],
      providers: [
        {
          provide: KnowledgeService,
          useValue: {
            semanticSearch: jest.fn().mockResolvedValue(mockSearchResult),
            hybridSearch: jest.fn().mockResolvedValue(mockSearchResult),
            advancedSearch: jest.fn().mockResolvedValue(mockSearchResult),
          },
        },
      ],
    }).compile();

    controller = module.get<KnowledgeController>(KnowledgeController);
    service = module.get<KnowledgeService>(KnowledgeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('semanticSearch', () => {
    it('should return search results', async () => {
      const query: SearchQueryDto = {
        query: 'test query',
        limit: 10,
        offset: 0,
      };

      const result = await controller.semanticSearch(query);

      expect(result).toEqual(mockSearchResult);
      expect(service.semanticSearch).toHaveBeenCalledWith(query);
      expect(service.semanticSearch).toHaveBeenCalledTimes(1);
    });

    it('should handle search with filters', async () => {
      const query: SearchQueryDto = {
        query: 'test query',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
        projectId: '123e4567-e89b-12d3-a456-426614174002',
        tags: ['typescript', 'nestjs'],
        limit: 20,
        offset: 10,
      };

      const result = await controller.semanticSearch(query);

      expect(result).toEqual(mockSearchResult);
      expect(service.semanticSearch).toHaveBeenCalledWith(query);
    });
  });

  describe('hybridSearch', () => {
    it('should return hybrid search results with default weights', async () => {
      const query: HybridSearchQueryDto = {
        query: 'test query',
        limit: 10,
        offset: 0,
      };

      const result = await controller.hybridSearch(query);

      expect(result).toEqual(mockSearchResult);
      expect(service.hybridSearch).toHaveBeenCalledWith(query);
      expect(service.hybridSearch).toHaveBeenCalledTimes(1);
    });

    it('should handle hybrid search with custom weights', async () => {
      const query: HybridSearchQueryDto = {
        query: 'test query',
        semanticWeight: 0.6,
        keywordWeight: 0.4,
        limit: 10,
        offset: 0,
      };

      const result = await controller.hybridSearch(query);

      expect(result).toEqual(mockSearchResult);
      expect(service.hybridSearch).toHaveBeenCalledWith(query);
    });

    it('should handle hybrid search with filters', async () => {
      const query: HybridSearchQueryDto = {
        query: 'test query',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
        tags: ['typescript'],
        semanticWeight: 0.8,
        keywordWeight: 0.2,
        limit: 15,
        offset: 5,
      };

      const result = await controller.hybridSearch(query);

      expect(result).toEqual(mockSearchResult);
      expect(service.hybridSearch).toHaveBeenCalledWith(query);
    });
  });

  describe('advancedSearch', () => {
    it('should return advanced search results', async () => {
      const body: AdvancedSearchDto = {
        query: 'test query',
        limit: 10,
        offset: 0,
      };

      const result = await controller.advancedSearch(body);

      expect(result).toEqual(mockSearchResult);
      expect(service.advancedSearch).toHaveBeenCalledWith(body);
      expect(service.advancedSearch).toHaveBeenCalledTimes(1);
    });

    it('should handle advanced search with all filters', async () => {
      const body: AdvancedSearchDto = {
        query: 'test query',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
        projectId: '123e4567-e89b-12d3-a456-426614174002',
        teamId: '123e4567-e89b-12d3-a456-426614174003',
        tags: ['typescript', 'nestjs'],
        type: DocumentType.KNOWLEDGE,
        createdAfter: '2024-01-01T00:00:00Z',
        createdBefore: '2024-12-31T23:59:59Z',
        updatedAfter: '2024-06-01T00:00:00Z',
        updatedBefore: '2024-12-31T23:59:59Z',
        includeEmbeddings: true,
        sortBy: SortField.UPDATED_AT,
        sortOrder: SortOrder.DESC,
        limit: 50,
        offset: 0,
      };

      const result = await controller.advancedSearch(body);

      expect(result).toEqual(mockSearchResult);
      expect(service.advancedSearch).toHaveBeenCalledWith(body);
    });

    it('should handle advanced search with date range filters', async () => {
      const body: AdvancedSearchDto = {
        query: 'test query',
        createdAfter: '2024-01-01T00:00:00Z',
        createdBefore: '2024-12-31T23:59:59Z',
        sortBy: SortField.CREATED_AT,
        sortOrder: SortOrder.ASC,
      };

      const result = await controller.advancedSearch(body);

      expect(result).toEqual(mockSearchResult);
      expect(service.advancedSearch).toHaveBeenCalledWith(body);
    });

    it('should handle advanced search with type filter', async () => {
      const body: AdvancedSearchDto = {
        query: 'test query',
        type: DocumentType.KNOWLEDGE,
        sortBy: SortField.TITLE,
        sortOrder: SortOrder.ASC,
      };

      const result = await controller.advancedSearch(body);

      expect(result).toEqual(mockSearchResult);
      expect(service.advancedSearch).toHaveBeenCalledWith(body);
    });
  });
});
