import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeService } from './knowledge.service';
import { Document, DocumentType } from '../document/entities/document.entity';
import { SearchQueryDto } from './dto/search-query.dto';
import { HybridSearchQueryDto } from './dto/hybrid-search-query.dto';
import {
  AdvancedSearchDto,
  SortField,
  SortOrder,
} from './dto/advanced-search.dto';

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let repository: Repository<Document>;

  const mockDocument = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Document',
    content: 'Test content about TypeScript and NestJS',
    type: DocumentType.KNOWLEDGE,
    organizationId: '123e4567-e89b-12d3-a456-426614174001',
    projectId: null,
    teamId: null,
    hollonId: null,
    taskId: null,
    tags: ['typescript', 'nestjs'],
    metadata: {},
    embedding: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  };

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[mockDocument], 1]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        {
          provide: getRepositoryToken(Document),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<KnowledgeService>(KnowledgeService);
    repository = module.get<Repository<Document>>(getRepositoryToken(Document));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('semanticSearch', () => {
    it('should perform semantic search with basic query', async () => {
      const dto: SearchQueryDto = {
        query: 'typescript',
      };

      const result = await service.semanticSearch(dto);

      expect(result).toEqual({
        documents: [mockDocument],
        total: 1,
        page: 1,
        limit: 10,
      });
      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.getManyAndCount).toHaveBeenCalled();
    });

    it('should apply organization filter', async () => {
      const dto: SearchQueryDto = {
        query: 'typescript',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      };

      await service.semanticSearch(dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.organization_id = :orgId',
        { orgId: dto.organizationId },
      );
    });

    it('should apply project filter', async () => {
      const dto: SearchQueryDto = {
        query: 'typescript',
        projectId: '123e4567-e89b-12d3-a456-426614174002',
      };

      await service.semanticSearch(dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.project_id = :projectId',
        { projectId: dto.projectId },
      );
    });

    it('should apply tags filter', async () => {
      const dto: SearchQueryDto = {
        query: 'typescript',
        tags: ['typescript', 'nestjs'],
      };

      await service.semanticSearch(dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.tags && :tags',
        { tags: dto.tags },
      );
    });

    it('should apply pagination with custom limit and offset', async () => {
      const dto: SearchQueryDto = {
        query: 'typescript',
        limit: 20,
        offset: 40,
      };

      const result = await service.semanticSearch(dto);

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(40);
      expect(result.page).toBe(3); // offset 40 / limit 20 + 1
      expect(result.limit).toBe(20);
    });
  });

  describe('hybridSearch', () => {
    it('should perform hybrid search with default weights', async () => {
      const dto: HybridSearchQueryDto = {
        query: 'typescript',
      };

      const result = await service.hybridSearch(dto);

      expect(result).toEqual({
        documents: [mockDocument],
        total: 1,
        page: 1,
        limit: 10,
      });
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should perform hybrid search with custom weights', async () => {
      const dto: HybridSearchQueryDto = {
        query: 'typescript',
        semanticWeight: 0.6,
        keywordWeight: 0.4,
      };

      const result = await service.hybridSearch(dto);

      expect(result).toBeDefined();
      expect(result.documents).toEqual([mockDocument]);
    });

    it('should apply all filters in hybrid search', async () => {
      const dto: HybridSearchQueryDto = {
        query: 'typescript',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
        projectId: '123e4567-e89b-12d3-a456-426614174002',
        tags: ['typescript'],
        limit: 15,
        offset: 5,
      };

      await service.hybridSearch(dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.organization_id = :orgId',
        { orgId: dto.organizationId },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.project_id = :projectId',
        { projectId: dto.projectId },
      );
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(15);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
    });
  });

  describe('advancedSearch', () => {
    it('should perform advanced search with basic query', async () => {
      const dto: AdvancedSearchDto = {
        query: 'typescript',
      };

      const result = await service.advancedSearch(dto);

      expect(result).toEqual({
        documents: [mockDocument],
        total: 1,
        page: 1,
        limit: 10,
      });
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should apply document type filter', async () => {
      const dto: AdvancedSearchDto = {
        query: 'typescript',
        type: DocumentType.KNOWLEDGE,
      };

      await service.advancedSearch(dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.type = :type',
        { type: DocumentType.KNOWLEDGE },
      );
    });

    it('should apply team filter', async () => {
      const dto: AdvancedSearchDto = {
        query: 'typescript',
        teamId: '123e4567-e89b-12d3-a456-426614174003',
      };

      await service.advancedSearch(dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.team_id = :teamId',
        { teamId: dto.teamId },
      );
    });

    it('should apply date range filters', async () => {
      const dto: AdvancedSearchDto = {
        query: 'typescript',
        createdAfter: '2024-01-01T00:00:00Z',
        createdBefore: '2024-12-31T23:59:59Z',
        updatedAfter: '2024-06-01T00:00:00Z',
        updatedBefore: '2024-12-31T23:59:59Z',
      };

      await service.advancedSearch(dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.created_at >= :createdAfter',
        { createdAfter: dto.createdAfter },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.created_at <= :createdBefore',
        { createdBefore: dto.createdBefore },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.updated_at >= :updatedAfter',
        { updatedAfter: dto.updatedAfter },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.updated_at <= :updatedBefore',
        { updatedBefore: dto.updatedBefore },
      );
    });

    it('should handle null projectId to filter org-level documents', async () => {
      const dto: AdvancedSearchDto = {
        query: 'typescript',
        projectId: null,
      };

      await service.advancedSearch(dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.project_id IS NULL',
      );
    });

    it('should apply sorting by created_at', async () => {
      const dto: AdvancedSearchDto = {
        query: 'typescript',
        sortBy: SortField.CREATED_AT,
        sortOrder: SortOrder.ASC,
      };

      await service.advancedSearch(dto);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'doc.created_at',
        SortOrder.ASC,
      );
    });

    it('should apply sorting by title', async () => {
      const dto: AdvancedSearchDto = {
        query: 'typescript',
        sortBy: SortField.TITLE,
        sortOrder: SortOrder.DESC,
      };

      await service.advancedSearch(dto);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'doc.title',
        SortOrder.DESC,
      );
    });

    it('should include embeddings when requested', async () => {
      const dto: AdvancedSearchDto = {
        query: 'typescript',
        includeEmbeddings: true,
      };

      await service.advancedSearch(dto);

      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        expect.arrayContaining(['doc.embedding']),
      );
    });
  });
});
