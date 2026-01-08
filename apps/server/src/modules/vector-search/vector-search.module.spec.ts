import { Test, TestingModule } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';
import { VectorSearchModule } from './vector-search.module';
import { VectorSearchService } from './services/vector-search.service';

/**
 * Mock consumer service to test VectorSearchService injection
 */
@Injectable()
class TestConsumerService {
  constructor(private readonly vectorSearchService: VectorSearchService) {}

  async performSearch(query: string, organizationId: string) {
    return this.vectorSearchService.searchSimilar(query, organizationId);
  }

  async generateEmbedding(text: string) {
    return this.vectorSearchService.generateEmbedding(text);
  }
}

describe('VectorSearchModule', () => {
  let module: TestingModule;
  let vectorSearchService: VectorSearchService;
  let consumerService: TestConsumerService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [VectorSearchModule],
      providers: [TestConsumerService],
    }).compile();

    vectorSearchService = module.get<VectorSearchService>(VectorSearchService);
    consumerService = module.get<TestConsumerService>(TestConsumerService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  describe('VectorSearchService', () => {
    it('should be provided by the module', () => {
      expect(vectorSearchService).toBeDefined();
      expect(vectorSearchService).toBeInstanceOf(VectorSearchService);
    });

    it('should be injectable into other services', () => {
      expect(consumerService).toBeDefined();
    });

    it('should allow other services to call searchSimilar', async () => {
      const result = await consumerService.performSearch(
        'test query',
        'org-123',
      );
      expect(result).toEqual([]);
    });

    it('should allow other services to call generateEmbedding', async () => {
      const result = await consumerService.generateEmbedding('test text');
      expect(result).toEqual([]);
    });
  });

  describe('Module exports', () => {
    it('should export VectorSearchService for use in other modules', async () => {
      // Create a separate module that imports VectorSearchModule
      const importingModule = await Test.createTestingModule({
        imports: [VectorSearchModule],
        providers: [
          {
            provide: 'TEST_PROVIDER',
            useFactory: (vectorSearch: VectorSearchService) => {
              return { vectorSearch };
            },
            inject: [VectorSearchService],
          },
        ],
      }).compile();

      const testProvider = importingModule.get<{
        vectorSearch: VectorSearchService;
      }>('TEST_PROVIDER');

      expect(testProvider.vectorSearch).toBeDefined();
      expect(testProvider.vectorSearch).toBeInstanceOf(VectorSearchService);

      await importingModule.close();
    });
  });

  describe('Module configuration', () => {
    it('should follow NestJS best practices', () => {
      // Verify module has correct metadata
      const moduleMetadata = Reflect.getMetadata('imports', VectorSearchModule);
      const providers = Reflect.getMetadata('providers', VectorSearchModule);
      const exports = Reflect.getMetadata('exports', VectorSearchModule);

      // Should have providers
      expect(providers).toBeDefined();
      expect(providers).toContain(VectorSearchService);

      // Should export VectorSearchService for use in other modules
      expect(exports).toBeDefined();
      expect(exports).toContain(VectorSearchService);

      // Should not have unnecessary imports (module is self-contained)
      expect(moduleMetadata).toBeUndefined();
    });
  });
});
