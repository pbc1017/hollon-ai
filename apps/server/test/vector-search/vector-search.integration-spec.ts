import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Injectable } from '@nestjs/common';
import { VectorSearchModule } from '@/modules/vector-search/vector-search.module';
import { VectorSearchService } from '@/modules/vector-search/services/vector-search.service';

/**
 * Test consumer service to verify VectorSearchService can be injected
 */
@Injectable()
class TestConsumerService {
  constructor(private readonly vectorSearchService: VectorSearchService) {}

  async performSearch(query: string, orgId: string) {
    return this.vectorSearchService.searchSimilar(query, orgId);
  }

  async generateEmbedding(text: string) {
    return this.vectorSearchService.generateEmbedding(text);
  }
}

describe('VectorSearchModule Integration', () => {
  let app: INestApplication;
  let vectorSearchService: VectorSearchService;
  let testConsumerService: TestConsumerService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [VectorSearchModule],
      providers: [TestConsumerService],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    vectorSearchService =
      moduleRef.get<VectorSearchService>(VectorSearchService);
    testConsumerService =
      moduleRef.get<TestConsumerService>(TestConsumerService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Module Setup', () => {
    it('should be defined', () => {
      expect(vectorSearchService).toBeDefined();
    });

    it('should export VectorSearchService', () => {
      expect(vectorSearchService).toBeInstanceOf(VectorSearchService);
    });
  });

  describe('Dependency Injection', () => {
    it('should inject VectorSearchService into consumer service', () => {
      expect(testConsumerService).toBeDefined();
      expect(testConsumerService).toBeInstanceOf(TestConsumerService);
    });

    it('should use injected service methods', async () => {
      const result = await testConsumerService.performSearch(
        'test query',
        'org-123',
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should generate embeddings through injected service', async () => {
      const result = await testConsumerService.generateEmbedding('test text');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Service Methods', () => {
    it('should have searchSimilar method', () => {
      expect(vectorSearchService.searchSimilar).toBeDefined();
      expect(typeof vectorSearchService.searchSimilar).toBe('function');
    });

    it('should have generateEmbedding method', () => {
      expect(vectorSearchService.generateEmbedding).toBeDefined();
      expect(typeof vectorSearchService.generateEmbedding).toBe('function');
    });

    it('should have indexItem method', () => {
      expect(vectorSearchService.indexItem).toBeDefined();
      expect(typeof vectorSearchService.indexItem).toBe('function');
    });

    it('should have removeFromIndex method', () => {
      expect(vectorSearchService.removeFromIndex).toBeDefined();
      expect(typeof vectorSearchService.removeFromIndex).toBe('function');
    });

    it('should have updateIndex method', () => {
      expect(vectorSearchService.updateIndex).toBeDefined();
      expect(typeof vectorSearchService.updateIndex).toBe('function');
    });
  });

  describe('Service Behavior', () => {
    it('should return empty array from searchSimilar (stub implementation)', async () => {
      const result = await vectorSearchService.searchSimilar('test', 'org-123');
      expect(result).toEqual([]);
    });

    it('should return empty array from generateEmbedding (stub implementation)', async () => {
      const result = await vectorSearchService.generateEmbedding('test text');
      expect(result).toEqual([]);
    });

    it('should accept search options', async () => {
      const result = await vectorSearchService.searchSimilar(
        'test',
        'org-123',
        {
          limit: 10,
          threshold: 0.8,
          projectId: 'project-123',
          teamId: 'team-456',
        },
      );
      expect(result).toBeDefined();
    });

    it('should handle indexing operations', async () => {
      await expect(
        vectorSearchService.indexItem('item-123', 'test content'),
      ).resolves.not.toThrow();
    });

    it('should handle removal operations', async () => {
      await expect(
        vectorSearchService.removeFromIndex('item-123'),
      ).resolves.not.toThrow();
    });

    it('should handle update operations', async () => {
      await expect(
        vectorSearchService.updateIndex('item-123', 'updated content'),
      ).resolves.not.toThrow();
    });
  });
});
