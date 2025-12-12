import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  const createService = async (apiKey: string) => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(apiKey),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    return module.get<EmbeddingService>(EmbeddingService);
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', async () => {
    const service = await createService('');
    expect(service).toBeDefined();
  });

  describe('generateEmbedding', () => {
    it('should throw error if API key is not configured', async () => {
      const service = await createService('');

      await expect(service.generateEmbedding('test text')).rejects.toThrow(
        'OpenAI API key is not configured',
      );
    });

    it('should generate embedding successfully', async () => {
      const service = await createService('test-api-key');

      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              embedding: [0.1, 0.2, 0.3],
            },
          ],
          usage: {
            total_tokens: 10,
          },
        }),
      });

      const result = await service.generateEmbedding('test text');

      expect(result).toEqual({
        embedding: [0.1, 0.2, 0.3],
        tokenCount: 10,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    it('should handle API errors', async () => {
      const service = await createService('test-api-key');

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(service.generateEmbedding('test text')).rejects.toThrow(
        'OpenAI API error: 401 - Unauthorized',
      );
    });
  });

  describe('generateEmbeddingsBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const service = await createService('test-api-key');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { embedding: [0.1, 0.2, 0.3] },
            { embedding: [0.4, 0.5, 0.6] },
          ],
          usage: {
            total_tokens: 20,
          },
        }),
      });

      const result = await service.generateEmbeddingsBatch([
        'text 1',
        'text 2',
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].embedding).toEqual([0.1, 0.2, 0.3]);
      expect(result[1].embedding).toEqual([0.4, 0.5, 0.6]);
    });
  });

  describe('embeddingToVector', () => {
    it('should convert embedding array to pgvector format', async () => {
      const service = await createService('test-key');
      const embedding = [0.1, 0.2, 0.3];
      const result = service.embeddingToVector(embedding);
      expect(result).toBe('[0.1,0.2,0.3]');
    });

    it('should handle large embeddings', async () => {
      const service = await createService('test-key');
      const embedding = Array(1536).fill(0.5);
      const result = service.embeddingToVector(embedding);
      expect(result).toMatch(/^\[0\.5,/);
      expect(result).toMatch(/,0\.5\]$/);
    });
  });

  describe('vectorToEmbedding', () => {
    it('should parse pgvector string to array', async () => {
      const service = await createService('test-key');
      const vectorString = '[0.1,0.2,0.3]';
      const result = service.vectorToEmbedding(vectorString);
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it('should handle negative numbers', async () => {
      const service = await createService('test-key');
      const vectorString = '[-0.1,0.2,-0.3]';
      const result = service.vectorToEmbedding(vectorString);
      expect(result).toEqual([-0.1, 0.2, -0.3]);
    });
  });
});
