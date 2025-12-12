import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { VectorSearchService } from './vector-search.service';
import { EmbeddingService } from './embedding.service';
import {
  Document,
  DocumentType,
} from '../../document/entities/document.entity';
import { VectorSearchDto } from '../dto/vector-search.dto';

describe('VectorSearchService', () => {
  let service: VectorSearchService;
  let documentRepo: jest.Mocked<Repository<Document>>;
  let embeddingService: jest.Mocked<EmbeddingService>;
  let queryBuilder: jest.Mocked<SelectQueryBuilder<Document>>;

  const mockEmbeddingService = {
    generateEmbedding: jest.fn(),
    embeddingToVector: jest.fn(),
  };

  const mockQueryBuilder = {
    createQueryBuilder: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    getRawMany: jest.fn(),
    getMany: jest.fn(),
  };

  const mockDocumentRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    query: jest.fn(),
  };

  beforeEach(async () => {
    // Reset all query builder methods to return this for chaining
    Object.keys(mockQueryBuilder).forEach((key) => {
      if (key !== 'getRawMany' && key !== 'getMany') {
        mockQueryBuilder[key as keyof typeof mockQueryBuilder] = jest
          .fn()
          .mockReturnThis();
      }
    });

    mockDocumentRepo.createQueryBuilder = jest
      .fn()
      .mockReturnValue(mockQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorSearchService,
        {
          provide: getRepositoryToken(Document),
          useValue: mockDocumentRepo,
        },
        {
          provide: EmbeddingService,
          useValue: mockEmbeddingService,
        },
      ],
    }).compile();

    service = module.get<VectorSearchService>(VectorSearchService);
    documentRepo = module.get(getRepositoryToken(Document));
    embeddingService = module.get(EmbeddingService);
    queryBuilder = mockQueryBuilder as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    const mockEmbedding = Array(1536).fill(0.5);
    const mockVectorString = '[0.5,0.5,0.5]';

    const mockSearchDto: VectorSearchDto = {
      query: 'test query',
      topK: 10,
      organizationId: 'org-123',
      minSimilarity: 0.7,
    };

    const mockRawResults = [
      {
        doc_id: 'doc-1',
        doc_title: 'Test Document',
        doc_content: 'Test content',
        doc_type: DocumentType.KNOWLEDGE,
        doc_tags: ['test', 'example'],
        similarity: '0.95',
        doc_created_at: new Date('2025-01-01'),
        doc_updated_at: new Date('2025-01-02'),
        doc_metadata: { key: 'value' },
        doc_organization_id: 'org-123',
        doc_project_id: null,
        doc_team_id: null,
      },
    ];

    beforeEach(() => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding,
        tokenCount: 10,
      });
      mockEmbeddingService.embeddingToVector.mockReturnValue(mockVectorString);
      mockQueryBuilder.getRawMany.mockResolvedValue(mockRawResults);
    });

    it('should perform vector similarity search successfully', async () => {
      const result = await service.search(mockSearchDto);

      expect(result).toMatchObject({
        query: 'test query',
        topK: 10,
        totalFound: 1,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        id: 'doc-1',
        title: 'Test Document',
        similarity: 0.95,
      });

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);

      // Verify embedding generation was called
      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(
        'test query',
      );

      // Verify query builder was used correctly
      expect(documentRepo.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'doc.embedding IS NOT NULL',
      );
    });

    it('should apply organization filter', async () => {
      await service.search(mockSearchDto);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.organization_id = :orgId',
        { orgId: 'org-123' },
      );
    });

    it('should apply type filter', async () => {
      const searchWithType: VectorSearchDto = {
        ...mockSearchDto,
        type: DocumentType.TASK_CONTEXT,
      };

      await service.search(searchWithType);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('doc.type = :type', {
        type: DocumentType.TASK_CONTEXT,
      });
    });

    it('should apply tags filter', async () => {
      const searchWithTags: VectorSearchDto = {
        ...mockSearchDto,
        tags: ['tag1', 'tag2'],
      };

      await service.search(searchWithTags);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('doc.tags && :tags', {
        tags: ['tag1', 'tag2'],
      });
    });

    it('should apply date range filters', async () => {
      const searchWithDates: VectorSearchDto = {
        ...mockSearchDto,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      };

      await service.search(searchWithDates);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.created_at >= :startDate',
        { startDate: '2025-01-01' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.created_at <= :endDate',
        { endDate: '2025-12-31' },
      );
    });

    it('should respect topK limit', async () => {
      const searchWithLimit: VectorSearchDto = {
        ...mockSearchDto,
        topK: 5,
      };

      await service.search(searchWithLimit);

      expect(queryBuilder.limit).toHaveBeenCalledWith(5);
    });

    it('should use default values if not specified', async () => {
      const minimalSearch: VectorSearchDto = {
        query: 'test',
      };

      await service.search(minimalSearch);

      expect(queryBuilder.limit).toHaveBeenCalledWith(10); // default topK
    });

    it('should log warning if execution time exceeds 500ms', async () => {
      // Mock slow embedding generation
      mockEmbeddingService.generateEmbedding.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ embedding: mockEmbedding, tokenCount: 10 }),
              600,
            ),
          ),
      );

      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

      await service.search(mockSearchDto);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeded 500ms target'),
      );
    });
  });

  describe('generateDocumentEmbedding', () => {
    const mockDocument = {
      id: 'doc-1',
      title: 'Test Document',
      content: 'Test content',
      embedding: null,
    } as unknown as Document;

    const mockEmbedding = Array(1536).fill(0.5);
    const mockVectorString = '[0.5,0.5,0.5]';

    beforeEach(() => {
      mockDocumentRepo.findOne.mockResolvedValue(mockDocument);
      mockEmbeddingService.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding,
        tokenCount: 10,
      });
      mockEmbeddingService.embeddingToVector.mockReturnValue(mockVectorString);
      mockDocumentRepo.query.mockResolvedValue(undefined);
    });

    it('should generate and store embedding for document', async () => {
      await service.generateDocumentEmbedding('doc-1');

      expect(mockDocumentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
      });

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(
        'Test Document\n\nTest content',
      );

      expect(mockDocumentRepo.query).toHaveBeenCalledWith(
        'UPDATE documents SET embedding = $1 WHERE id = $2',
        [mockVectorString, 'doc-1'],
      );
    });

    it('should throw error if document not found', async () => {
      mockDocumentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateDocumentEmbedding('non-existent'),
      ).rejects.toThrow('Document non-existent not found');
    });
  });

  describe('generateMissingEmbeddings', () => {
    const mockDocuments = [
      { id: 'doc-1', title: 'Doc 1', content: 'Content 1' },
      { id: 'doc-2', title: 'Doc 2', content: 'Content 2' },
    ] as Document[];

    beforeEach(() => {
      mockQueryBuilder.getMany.mockResolvedValue(mockDocuments);
      mockDocumentRepo.findOne.mockImplementation(
        (options: { where: { id: string } }) => {
          const doc = mockDocuments.find((d) => d.id === options.where.id);
          return Promise.resolve(doc || null);
        },
      );
      mockEmbeddingService.generateEmbedding.mockResolvedValue({
        embedding: Array(1536).fill(0.5),
        tokenCount: 10,
      });
      mockEmbeddingService.embeddingToVector.mockReturnValue('[0.5,0.5,0.5]');
      mockDocumentRepo.query.mockResolvedValue(undefined);
    });

    it('should process all documents without embeddings', async () => {
      const result = await service.generateMissingEmbeddings('org-123', 10);

      expect(result).toEqual({
        processed: 2,
        failed: 0,
      });

      expect(queryBuilder.where).toHaveBeenCalledWith('doc.embedding IS NULL');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.organization_id = :orgId',
        { orgId: 'org-123' },
      );
    });

    it('should handle failures gracefully', async () => {
      mockEmbeddingService.generateEmbedding
        .mockResolvedValueOnce({
          embedding: Array(1536).fill(0.5),
          tokenCount: 10,
        })
        .mockRejectedValueOnce(new Error('API error'));

      const result = await service.generateMissingEmbeddings();

      expect(result).toEqual({
        processed: 1,
        failed: 1,
      });
    });
  });

  describe('findSimilarDocuments', () => {
    const mockDocument = {
      id: 'doc-1',
      title: 'Test Document',
      content: 'Test content',
      embedding: '[0.5,0.5,0.5]',
    } as Document;

    const mockRawResults = [
      {
        doc_id: 'doc-2',
        doc_title: 'Similar Document',
        doc_content: 'Similar content',
        doc_type: DocumentType.KNOWLEDGE,
        doc_tags: ['test'],
        similarity: '0.92',
        doc_created_at: new Date(),
        doc_updated_at: new Date(),
        doc_metadata: {},
        doc_organization_id: 'org-123',
        doc_project_id: null,
        doc_team_id: null,
      },
    ];

    beforeEach(() => {
      mockDocumentRepo.findOne.mockResolvedValue(mockDocument);
      mockQueryBuilder.getRawMany.mockResolvedValue(mockRawResults);
    });

    it('should find similar documents', async () => {
      const result = await service.findSimilarDocuments('doc-1', {
        topK: 5,
        minSimilarity: 0.8,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'doc-2',
        title: 'Similar Document',
        similarity: 0.92,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('doc.id != :docId', {
        docId: 'doc-1',
      });
    });

    it('should throw error if document not found', async () => {
      mockDocumentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findSimilarDocuments('non-existent'),
      ).rejects.toThrow('Document non-existent not found');
    });

    it('should throw error if document has no embedding', async () => {
      mockDocumentRepo.findOne.mockResolvedValue({
        ...mockDocument,
        embedding: null,
      } as unknown as Document);

      await expect(service.findSimilarDocuments('doc-1')).rejects.toThrow(
        'Document doc-1 does not have an embedding',
      );
    });
  });
});
