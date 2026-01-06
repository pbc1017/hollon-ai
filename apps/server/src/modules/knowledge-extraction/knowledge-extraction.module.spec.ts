import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KnowledgeExtractionModule } from './knowledge-extraction.module';
import { KnowledgeExtractionService } from './services/knowledge-extraction.service';
import { VectorSearchService } from './services/vector-search.service';
import { KnowledgeItem } from './entities/knowledge-item.entity';

describe('KnowledgeExtractionModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [KnowledgeExtractionModule],
    })
      .overrideProvider(getRepositoryToken(KnowledgeItem))
      .useValue({
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn(),
        remove: jest.fn(),
        insert: jest.fn(),
        createQueryBuilder: jest.fn(),
      })
      .compile();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Module Configuration', () => {
    it('should be defined', () => {
      expect(module).toBeDefined();
    });

    it('should provide KnowledgeExtractionService', () => {
      const service = module.get<KnowledgeExtractionService>(
        KnowledgeExtractionService,
      );
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(KnowledgeExtractionService);
    });

    it('should provide VectorSearchService', () => {
      const service = module.get<VectorSearchService>(VectorSearchService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(VectorSearchService);
    });
  });

  describe('Dependency Injection', () => {
    it('should inject KnowledgeItem repository into KnowledgeExtractionService', () => {
      const service = module.get<KnowledgeExtractionService>(
        KnowledgeExtractionService,
      );
      expect(service).toBeDefined();
      // The service should be properly initialized with its repository
      expect(service['knowledgeItemRepository']).toBeDefined();
    });

    it('should successfully instantiate VectorSearchService', () => {
      const service = module.get<VectorSearchService>(VectorSearchService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(VectorSearchService);
      // VectorSearchService doesn't currently use repository injection
      // but is a valid service in the module
    });
  });

  describe('Module Exports', () => {
    it('should export KnowledgeExtractionService for use in other modules', async () => {
      // Create a consumer module that imports KnowledgeExtractionModule
      const consumerModule = await Test.createTestingModule({
        imports: [KnowledgeExtractionModule],
      })
        .overrideProvider(getRepositoryToken(KnowledgeItem))
        .useValue({
          create: jest.fn(),
          save: jest.fn(),
          findOne: jest.fn(),
          find: jest.fn(),
          count: jest.fn(),
          remove: jest.fn(),
          insert: jest.fn(),
          createQueryBuilder: jest.fn(),
        })
        .compile();

      // Should be able to get the exported service
      const service = consumerModule.get<KnowledgeExtractionService>(
        KnowledgeExtractionService,
      );
      expect(service).toBeDefined();

      await consumerModule.close();
    });

    it('should export VectorSearchService for use in other modules', async () => {
      // Create a consumer module that imports KnowledgeExtractionModule
      const consumerModule = await Test.createTestingModule({
        imports: [KnowledgeExtractionModule],
      })
        .overrideProvider(getRepositoryToken(KnowledgeItem))
        .useValue({
          create: jest.fn(),
          save: jest.fn(),
          findOne: jest.fn(),
          find: jest.fn(),
          count: jest.fn(),
          remove: jest.fn(),
          insert: jest.fn(),
          createQueryBuilder: jest.fn(),
        })
        .compile();

      // Should be able to get the exported service
      const service =
        consumerModule.get<VectorSearchService>(VectorSearchService);
      expect(service).toBeDefined();

      await consumerModule.close();
    });
  });

  describe('Service Integration', () => {
    it('should allow KnowledgeExtractionService to interact with the repository', async () => {
      const service = module.get<KnowledgeExtractionService>(
        KnowledgeExtractionService,
      );
      const mockRepository = module.get(getRepositoryToken(KnowledgeItem));

      const mockKnowledgeItem = {
        id: 'test-id',
        organizationId: 'org-123',
        type: 'conversation',
        content: 'Test content',
        metadata: { source: 'test' },
        extractedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockKnowledgeItem);
      mockRepository.save.mockResolvedValue(mockKnowledgeItem);

      const result = await service.create({
        organizationId: 'org-123',
        type: 'conversation',
        content: 'Test content',
        metadata: { source: 'test' },
        extractedAt: new Date(),
      });

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockKnowledgeItem);
    });

    it('should allow both services to coexist in the module', () => {
      const extractionService = module.get<KnowledgeExtractionService>(
        KnowledgeExtractionService,
      );
      const vectorService =
        module.get<VectorSearchService>(VectorSearchService);

      // Both services should be properly instantiated
      expect(extractionService).toBeDefined();
      expect(vectorService).toBeDefined();
      expect(extractionService['knowledgeItemRepository']).toBeDefined();
    });
  });

  describe('Circular Dependencies', () => {
    it('should not have circular dependencies during module initialization', async () => {
      // If there were circular dependencies, the module compilation would hang or fail
      // This test passing means the module was successfully compiled
      expect(module).toBeDefined();

      const extractionService = module.get<KnowledgeExtractionService>(
        KnowledgeExtractionService,
      );
      const vectorService =
        module.get<VectorSearchService>(VectorSearchService);

      expect(extractionService).toBeDefined();
      expect(vectorService).toBeDefined();
    });

    it('should initialize all providers without dependency issues', () => {
      // Verify all providers can be retrieved without errors
      expect(() => {
        module.get<KnowledgeExtractionService>(KnowledgeExtractionService);
        module.get<VectorSearchService>(VectorSearchService);
      }).not.toThrow();
    });
  });

  describe('Module Imports', () => {
    it('should properly configure TypeORM for KnowledgeItem entity', () => {
      // The repository should be available
      const repository = module.get(getRepositoryToken(KnowledgeItem));
      expect(repository).toBeDefined();
    });
  });
});
