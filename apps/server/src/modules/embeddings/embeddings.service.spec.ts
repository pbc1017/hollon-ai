import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EmbeddingsService, EmbeddingBatchRequest } from './embeddings.service';
import { Document, DocumentType } from '../document/entities/document.entity';
import {
  CostRecord,
  CostRecordType,
} from '../cost-tracking/entities/cost-record.entity';
import { ConfigService } from '@nestjs/config';

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;
  let documentRepo: Repository<Document>;
  let costRecordRepo: Repository<CostRecord>;
  let configService: ConfigService;

  const mockOrgId = '550e8400-e29b-41d4-a716-446655440000';
  const mockDocId1 = '660e8400-e29b-41d4-a716-446655440001';
  const mockDocId2 = '660e8400-e29b-41d4-a716-446655440002';

  const mockDocument1: Partial<Document> = {
    id: mockDocId1,
    title: 'Test Doc 1',
    content: 'This is a test document for embedding.',
    type: DocumentType.KNOWLEDGE,
    organizationId: mockOrgId,
    embedding: undefined,
  };

  const mockDocument2: Partial<Document> = {
    id: mockDocId2,
    title: 'Test Doc 2',
    content: 'Another test document with different content.',
    type: DocumentType.KNOWLEDGE,
    organizationId: mockOrgId,
    embedding: undefined,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingsService,
        {
          provide: getRepositoryToken(Document),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CostRecord),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'brain.openaiApiKey') {
                return 'test-api-key-12345';
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmbeddingsService>(EmbeddingsService);
    documentRepo = module.get<Repository<Document>>(
      getRepositoryToken(Document),
    );
    costRecordRepo = module.get<Repository<CostRecord>>(
      getRepositoryToken(CostRecord),
    );
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('embeddingBatchJob', () => {
    it('should throw error if OpenAI API key is not configured', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);

      const request: EmbeddingBatchRequest = {
        documentIds: [mockDocId1],
        organizationId: mockOrgId,
      };

      await expect(service.embeddingBatchJob(request)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if no documents found', async () => {
      jest.spyOn(documentRepo, 'find').mockResolvedValue([]);

      const request: EmbeddingBatchRequest = {
        documentIds: [mockDocId1],
        organizationId: mockOrgId,
      };

      await expect(service.embeddingBatchJob(request)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle documents that already have embeddings', async () => {
      const docWithEmbedding: Partial<Document> = {
        ...mockDocument1,
        embedding: JSON.stringify([0.1, 0.2, 0.3]),
      };

      jest
        .spyOn(documentRepo, 'find')
        .mockResolvedValue([docWithEmbedding as Document]);

      const request: EmbeddingBatchRequest = {
        documentIds: [mockDocId1],
        organizationId: mockOrgId,
      };

      const result = await service.embeddingBatchJob(request);

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.totalCostCents).toBe(0);
    });

    it('should successfully embed documents', async () => {
      jest
        .spyOn(documentRepo, 'find')
        .mockResolvedValue([
          mockDocument1 as Document,
          mockDocument2 as Document,
        ]);

      jest
        .spyOn(documentRepo, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      // Mock OpenAI API response
      const mockOpenAIResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: Array(1536).fill(0.1),
            index: 0,
          },
          {
            object: 'embedding',
            embedding: Array(1536).fill(0.2),
            index: 1,
          },
        ],
        model: 'text-embedding-3-small',
        usage: {
          prompt_tokens: 20,
          total_tokens: 20,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockOpenAIResponse),
      } as any);

      jest.spyOn(costRecordRepo, 'create').mockReturnValue({} as CostRecord);
      jest.spyOn(costRecordRepo, 'save').mockResolvedValue({} as CostRecord);

      const request: EmbeddingBatchRequest = {
        documentIds: [mockDocId1, mockDocId2],
        organizationId: mockOrgId,
      };

      const result = await service.embeddingBatchJob(request);

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.totalTokens).toBe(20);
      expect(result.failedDocumentIds).toHaveLength(0);
      expect(documentRepo.update).toHaveBeenCalledTimes(2);
    });

    it('should record costs correctly', async () => {
      jest
        .spyOn(documentRepo, 'find')
        .mockResolvedValue([mockDocument1 as Document]);

      jest
        .spyOn(documentRepo, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      const mockOpenAIResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: Array(1536).fill(0.1),
            index: 0,
          },
        ],
        model: 'text-embedding-3-small',
        usage: {
          prompt_tokens: 10,
          total_tokens: 10,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockOpenAIResponse),
      } as any);

      const createSpy = jest.spyOn(costRecordRepo, 'create');
      const saveSpy = jest
        .spyOn(costRecordRepo, 'save')
        .mockResolvedValue({} as CostRecord);

      const request: EmbeddingBatchRequest = {
        documentIds: [mockDocId1],
        organizationId: mockOrgId,
      };

      await service.embeddingBatchJob(request);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: mockOrgId,
          type: CostRecordType.OTHER,
          providerId: 'openai_api',
          modelUsed: 'text-embedding-3-small',
          inputTokens: 10,
          outputTokens: 0,
        }),
      );

      expect(saveSpy).toHaveBeenCalled();
    });

    it('should handle OpenAI API errors and mark documents as failed', async () => {
      jest
        .spyOn(documentRepo, 'find')
        .mockResolvedValue([mockDocument1 as Document]);

      jest
        .spyOn(documentRepo, 'update')
        .mockResolvedValue({ affected: 0 } as any);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: jest
          .fn()
          .mockResolvedValue({ error: { message: 'Rate limited' } }),
      } as any);

      jest.spyOn(costRecordRepo, 'create').mockReturnValue({} as CostRecord);
      jest.spyOn(costRecordRepo, 'save').mockResolvedValue({} as CostRecord);

      const request: EmbeddingBatchRequest = {
        documentIds: [mockDocId1],
        organizationId: mockOrgId,
      };

      const result = await service.embeddingBatchJob(request);

      expect(result.failed).toBe(1);
      expect(result.failedDocumentIds).toContain(mockDocId1);
    });

    it('should handle batch splitting for large document sets', async () => {
      // Create 150 mock documents (exceeds MAX_BATCH_SIZE of 100)
      const largeDocSet = Array.from({ length: 150 }, (_, i) => ({
        id: `doc-${i}`,
        title: `Doc ${i}`,
        content: `Content ${i}`,
        type: DocumentType.KNOWLEDGE,
        organizationId: mockOrgId,
        embedding: undefined,
      })) as unknown as Document[];

      jest.spyOn(documentRepo, 'find').mockResolvedValue(largeDocSet);
      jest
        .spyOn(documentRepo, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      const mockOpenAIResponse = {
        object: 'list',
        data: Array.from({ length: 100 }, (_, i) => ({
          object: 'embedding',
          embedding: Array(1536).fill(0.1),
          index: i,
        })),
        model: 'text-embedding-3-small',
        usage: {
          prompt_tokens: 1000,
          total_tokens: 1000,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockOpenAIResponse),
      } as any);

      jest.spyOn(costRecordRepo, 'create').mockReturnValue({} as CostRecord);
      jest.spyOn(costRecordRepo, 'save').mockResolvedValue({} as CostRecord);

      const request: EmbeddingBatchRequest = {
        documentIds: largeDocSet.map((d) => d.id),
        organizationId: mockOrgId,
      };

      const result = await service.embeddingBatchJob(request);

      // Should process all 150 documents (2 batches)
      expect(result.processed).toBe(150);
      expect(documentRepo.update).toHaveBeenCalled();
    });
  });

  describe('embedDocument', () => {
    it('should embed a single document', async () => {
      jest
        .spyOn(documentRepo, 'find')
        .mockResolvedValue([mockDocument1 as Document]);
      jest
        .spyOn(documentRepo, 'findOne')
        .mockResolvedValueOnce(null as any) // First call in embedDocument returns no document
        .mockResolvedValueOnce(mockDocument1 as Document) // Then embeddingBatchJob finds it
        .mockResolvedValueOnce(mockDocument1 as Document); // After batch job finds updated doc
      jest
        .spyOn(documentRepo, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      const mockEmbeddingVector = Array(1536).fill(0.1);
      const mockOpenAIResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: mockEmbeddingVector,
            index: 0,
          },
        ],
        model: 'text-embedding-3-small',
        usage: {
          prompt_tokens: 10,
          total_tokens: 10,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockOpenAIResponse),
      } as any);

      jest.spyOn(costRecordRepo, 'create').mockReturnValue({} as CostRecord);
      jest.spyOn(costRecordRepo, 'save').mockResolvedValue({} as CostRecord);

      // Mock the final findOne call to return document with embedding
      const docWithEmbedding = {
        ...mockDocument1,
        embedding: JSON.stringify(mockEmbeddingVector),
      };

      jest
        .spyOn(documentRepo, 'findOne')
        .mockResolvedValueOnce(mockDocument1 as Document) // First check
        .mockResolvedValueOnce(docWithEmbedding as Document); // After batch job

      const embedding = await service.embedDocument(mockDocId1, mockOrgId);

      expect(embedding).toBeDefined();
      expect(Array.isArray(JSON.parse(embedding))).toBe(true);
    });

    it('should skip embedding if document already has one', async () => {
      const docWithEmbedding = {
        ...mockDocument1,
        embedding: JSON.stringify(Array(1536).fill(0.1)),
      };

      jest
        .spyOn(documentRepo, 'findOne')
        .mockResolvedValue(docWithEmbedding as Document);

      const embedding = await service.embedDocument(mockDocId1, mockOrgId);

      expect(embedding).toEqual(docWithEmbedding.embedding);
    });
  });

  describe('Cost calculation', () => {
    it('should calculate cost correctly for tokens', async () => {
      jest
        .spyOn(documentRepo, 'find')
        .mockResolvedValue([mockDocument1 as Document]);
      jest
        .spyOn(documentRepo, 'update')
        .mockResolvedValue({ affected: 1 } as any);

      // 1M tokens should cost $0.02 = 2 cents
      const mockOpenAIResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: Array(1536).fill(0.1),
            index: 0,
          },
        ],
        model: 'text-embedding-3-small',
        usage: {
          prompt_tokens: 1000000, // 1M tokens
          total_tokens: 1000000,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockOpenAIResponse),
      } as any);

      jest.spyOn(costRecordRepo, 'create').mockReturnValue({} as CostRecord);
      const saveSpy = jest
        .spyOn(costRecordRepo, 'save')
        .mockResolvedValue({} as CostRecord);

      const request: EmbeddingBatchRequest = {
        documentIds: [mockDocId1],
        organizationId: mockOrgId,
      };

      const result = await service.embeddingBatchJob(request);

      expect(result.totalCostCents).toBe(200); // $2.00 = 200 cents

      const savedRecord = saveSpy.mock.calls[0][0] as any;
      expect(savedRecord.costCents).toBeGreaterThan(0);
    });
  });

  describe('Retry logic', () => {
    it('should retry failed documents', async () => {
      jest
        .spyOn(documentRepo, 'find')
        .mockResolvedValue([mockDocument1 as Document]);

      // First call fails, second succeeds
      const fetchSpy = jest
        .spyOn(global, 'fetch' as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: jest
            .fn()
            .mockResolvedValue({ error: { message: 'Rate limited' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            object: 'list',
            data: [
              {
                object: 'embedding',
                embedding: Array(1536).fill(0.1),
                index: 0,
              },
            ],
            model: 'text-embedding-3-small',
            usage: {
              prompt_tokens: 10,
              total_tokens: 10,
            },
          }),
        });

      jest
        .spyOn(documentRepo, 'update')
        .mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(costRecordRepo, 'create').mockReturnValue({} as CostRecord);
      jest.spyOn(costRecordRepo, 'save').mockResolvedValue({} as CostRecord);

      const request: EmbeddingBatchRequest = {
        documentIds: [mockDocId1],
        organizationId: mockOrgId,
        maxRetries: 1,
      };

      const result = await service.embeddingBatchJob(request);

      expect(result.retryAttempts).toBeGreaterThan(0);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
