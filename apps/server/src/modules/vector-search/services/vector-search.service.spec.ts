import { Test, TestingModule } from '@nestjs/testing';
import { VectorSearchService } from './vector-search.service';

describe('VectorSearchService', () => {
  let service: VectorSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VectorSearchService],
    }).compile();

    service = module.get<VectorSearchService>(VectorSearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchSimilar', () => {
    it('should return empty array when no results found', async () => {
      const result = await service.searchSimilar('test query', 'org-123');
      expect(result).toEqual([]);
    });

    it('should accept optional search options', async () => {
      const result = await service.searchSimilar('test query', 'org-123', {
        limit: 10,
        threshold: 0.8,
        projectId: 'project-123',
        teamId: 'team-123',
      });
      expect(result).toEqual([]);
    });

    it('should accept null values in optional search options', async () => {
      const result = await service.searchSimilar('test query', 'org-123', {
        projectId: null,
        teamId: null,
      });
      expect(result).toEqual([]);
    });
  });

  describe('generateEmbedding', () => {
    it('should return empty array for now', async () => {
      const result = await service.generateEmbedding('test text');
      expect(result).toEqual([]);
    });
  });

  describe('indexItem', () => {
    it('should complete without errors', async () => {
      await expect(
        service.indexItem('item-123', 'test content'),
      ).resolves.not.toThrow();
    });
  });

  describe('removeFromIndex', () => {
    it('should complete without errors', async () => {
      await expect(service.removeFromIndex('item-123')).resolves.not.toThrow();
    });
  });

  describe('updateIndex', () => {
    it('should call removeFromIndex and indexItem', async () => {
      const removeFromIndexSpy = jest.spyOn(service, 'removeFromIndex');
      const indexItemSpy = jest.spyOn(service, 'indexItem');

      await service.updateIndex('item-123', 'updated content');

      expect(removeFromIndexSpy).toHaveBeenCalledWith('item-123');
      expect(indexItemSpy).toHaveBeenCalledWith('item-123', 'updated content');
    });
  });
});
