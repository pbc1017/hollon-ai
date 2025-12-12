import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentQualityService } from './document-quality.service';
import { Document, DocumentType } from '../entities/document.entity';

describe('DocumentQualityService', () => {
  let service: DocumentQualityService;
  let repository: Repository<Document>;

  const mockRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    increment: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentQualityService,
        {
          provide: getRepositoryToken(Document),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DocumentQualityService>(DocumentQualityService);
    repository = module.get<Repository<Document>>(getRepositoryToken(Document));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateQualityScore', () => {
    it('should calculate quality score for a complete document', () => {
      const document = {
        id: '1',
        title: 'Test Document',
        content: 'A'.repeat(1000), // Optimal content length
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'], // Optimal tags
        metadata: { key: 'value' },
        viewCount: 100, // High usage
        ratingCount: 10,
        ratingSum: 50, // Average rating: 5.0
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
        type: DocumentType.KNOWLEDGE,
      } as Document;

      const result = service.calculateQualityScore(document);

      expect(result.totalScore).toBeGreaterThan(80);
      expect(result.completenessScore).toBeGreaterThan(80);
      expect(result.usageScore).toBeGreaterThan(80);
      expect(result.ratingScore).toBe(100);
      expect(result.freshnessScore).toBe(100);
    });

    it('should calculate lower score for incomplete document', () => {
      const document = {
        id: '2',
        title: 'Short',
        content: 'Short content',
        tags: [],
        metadata: {},
        viewCount: 0,
        ratingCount: 0,
        ratingSum: 0,
        createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days old
        updatedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        lastAccessedAt: null,
        type: DocumentType.KNOWLEDGE,
      } as Document;

      const result = service.calculateQualityScore(document);

      expect(result.totalScore).toBeLessThan(50);
      expect(result.completenessScore).toBeLessThan(50);
      expect(result.usageScore).toBe(0);
      expect(result.ratingScore).toBe(50); // No ratings = neutral
      expect(result.freshnessScore).toBe(0); // Too old
    });

    it('should handle document with medium completeness', () => {
      const document = {
        id: '3',
        title: 'Medium Document',
        content: 'A'.repeat(500), // Half optimal
        tags: ['tag1', 'tag2'], // Some tags
        metadata: {},
        viewCount: 50,
        ratingCount: 5,
        ratingSum: 15, // Average rating: 3.0
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
        updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lastAccessedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        type: DocumentType.KNOWLEDGE,
      } as Document;

      const result = service.calculateQualityScore(document);

      expect(result.totalScore).toBeGreaterThan(40);
      expect(result.totalScore).toBeLessThan(70);
      expect(result.ratingScore).toBe(50); // (3-1)/4 * 100 = 50
      expect(result.freshnessScore).toBe(100); // Within freshness period
    });
  });

  describe('updateDocumentScore', () => {
    it('should update quality score for a document', async () => {
      const document = {
        id: '1',
        title: 'Test',
        content: 'Content',
        tags: ['tag1'],
        metadata: {},
        viewCount: 10,
        ratingCount: 2,
        ratingSum: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
        type: DocumentType.KNOWLEDGE,
      } as Document;

      mockRepository.findOne.mockResolvedValue(document);
      mockRepository.save.mockResolvedValue({ ...document, qualityScore: 50 });

      const result = await service.updateDocumentScore('1');

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.qualityScore).toBeDefined();
    });

    it('should throw error if document not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.updateDocumentScore('999')).rejects.toThrow(
        'Document 999 not found',
      );
    });
  });

  describe('recordDocumentView', () => {
    it('should increment view count and update last accessed time', async () => {
      const document = {
        id: '1',
        title: 'Test',
        content: 'Content',
        tags: [],
        metadata: {},
        viewCount: 5,
        ratingCount: 0,
        ratingSum: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: null,
        type: DocumentType.KNOWLEDGE,
      } as Document;

      mockRepository.increment.mockResolvedValue(undefined);
      mockRepository.update.mockResolvedValue(undefined);
      mockRepository.findOne.mockResolvedValue(document);
      mockRepository.save.mockResolvedValue(document);

      await service.recordDocumentView('1');

      expect(mockRepository.increment).toHaveBeenCalledWith(
        { id: '1' },
        'viewCount',
        1,
      );
      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: '1' },
        expect.objectContaining({
          lastAccessedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('rateDocument', () => {
    it('should add rating and update quality score', async () => {
      const document = {
        id: '1',
        title: 'Test',
        content: 'Content',
        tags: [],
        metadata: {},
        viewCount: 0,
        ratingCount: 0,
        ratingSum: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: null,
        type: DocumentType.KNOWLEDGE,
      } as Document;

      mockRepository.findOne.mockResolvedValue(document);
      mockRepository.save.mockResolvedValue({
        ...document,
        ratingCount: 1,
        ratingSum: 5,
      });

      const result = await service.rateDocument('1', 5);

      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should reject rating outside 1-5 range', async () => {
      await expect(service.rateDocument('1', 0)).rejects.toThrow(
        'Rating must be between 1 and 5',
      );
      await expect(service.rateDocument('1', 6)).rejects.toThrow(
        'Rating must be between 1 and 5',
      );
    });

    it('should throw error if document not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.rateDocument('999', 5)).rejects.toThrow(
        'Document 999 not found',
      );
    });
  });

  describe('batchUpdateScores', () => {
    it('should update scores for multiple documents', async () => {
      const document = {
        id: '1',
        title: 'Test',
        content: 'Content',
        tags: [],
        metadata: {},
        viewCount: 0,
        ratingCount: 0,
        ratingSum: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: null,
        type: DocumentType.KNOWLEDGE,
      } as Document;

      mockRepository.findOne.mockResolvedValue(document);
      mockRepository.save.mockResolvedValue(document);

      await service.batchUpdateScores(['1', '2', '3']);

      expect(mockRepository.findOne).toHaveBeenCalledTimes(3);
    });

    it('should continue on errors', async () => {
      mockRepository.findOne
        .mockResolvedValueOnce(null) // First fails
        .mockResolvedValueOnce({
          id: '2',
          title: 'Test',
          content: 'Content',
          tags: [],
          metadata: {},
          viewCount: 0,
          ratingCount: 0,
          ratingSum: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: null,
          type: DocumentType.KNOWLEDGE,
        }); // Second succeeds

      mockRepository.save.mockResolvedValue({});

      // Should not throw, but log errors
      await expect(service.batchUpdateScores(['1', '2'])).resolves.not.toThrow();
    });
  });

  describe('getScoreBreakdown', () => {
    it('should return score breakdown', async () => {
      const document = {
        id: '1',
        title: 'Test Document',
        content: 'A'.repeat(500),
        tags: ['tag1'],
        metadata: { key: 'value' },
        viewCount: 50,
        ratingCount: 5,
        ratingSum: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
        type: DocumentType.KNOWLEDGE,
      } as Document;

      mockRepository.findOne.mockResolvedValue(document);

      const result = await service.getScoreBreakdown('1');

      expect(result.totalScore).toBeDefined();
      expect(result.completenessScore).toBeDefined();
      expect(result.usageScore).toBeDefined();
      expect(result.ratingScore).toBeDefined();
      expect(result.freshnessScore).toBeDefined();
    });

    it('should throw error if document not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getScoreBreakdown('999')).rejects.toThrow(
        'Document 999 not found',
      );
    });
  });
});
