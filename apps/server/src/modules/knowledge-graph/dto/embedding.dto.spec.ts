import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  EmbeddingDto,
  EmbeddingMetadataDto,
  GenerateEmbeddingDto,
} from './embedding.dto';
import {
  EmbeddingSourceType,
  EmbeddingModelType,
} from '../../../entities/vector-embedding.entity';

describe('EmbeddingDto', () => {
  describe('EmbeddingDto validation', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(1536).fill(0.1),
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 1536,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when embedding is not an array', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: 'not an array',
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 1536,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when embedding array is too small', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(100).fill(0.1),
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 100,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when embedding array is too large', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(4000).fill(0.1),
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 4000,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when embedding contains non-numbers', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: [0.1, 'not a number', 0.3],
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 1536,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when sourceType is invalid', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(1536).fill(0.1),
        sourceType: 'invalid_type',
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 1536,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when sourceId is not a valid UUID', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(1536).fill(0.1),
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: 'not-a-uuid',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 1536,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when modelType is invalid', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(1536).fill(0.1),
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: 'invalid_model',
        dimensions: 1536,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when dimensions is not an integer', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(1536).fill(0.1),
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 1536.5,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when dimensions is out of range', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(1536).fill(0.1),
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 0,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when organizationId is not a valid UUID', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(1536).fill(0.1),
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 1536,
        organizationId: 'not-a-uuid',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass validation with optional fields provided', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(1536).fill(0.1),
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 1536,
        content: 'Sample content for the embedding',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
        projectId: '123e4567-e89b-12d3-a456-426614174002',
        teamId: '123e4567-e89b-12d3-a456-426614174003',
        hollonId: '123e4567-e89b-12d3-a456-426614174004',
        tags: ['ai', 'ml', 'nlp'],
        metadata: {
          embeddingModelVersion: 'text-embedding-3-small',
          tokenCount: 50,
        },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when content is empty string', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(1536).fill(0.1),
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 1536,
        content: '',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass validation when projectId is null', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(1536).fill(0.1),
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 1536,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
        projectId: null,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when tags contain non-strings', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(1536).fill(0.1),
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 1536,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
        tags: ['valid', 123, 'tag'],
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when tag exceeds max length', async () => {
      const dto = plainToInstance(EmbeddingDto, {
        embedding: Array(1536).fill(0.1),
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        dimensions: 1536,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
        tags: ['a'.repeat(256)],
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('EmbeddingMetadataDto validation', () => {
    it('should pass validation with valid metadata', async () => {
      const dto = plainToInstance(EmbeddingMetadataDto, {
        embeddingModelVersion: 'text-embedding-3-small',
        processingTimestamp: '2024-01-07T12:00:00Z',
        chunkIndex: 0,
        totalChunks: 5,
        tokenCount: 150,
        sourceUrl: 'https://example.com/page.html',
        language: 'en',
        quality: 0.95,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with empty metadata', async () => {
      const dto = plainToInstance(EmbeddingMetadataDto, {});

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when chunkIndex is negative', async () => {
      const dto = plainToInstance(EmbeddingMetadataDto, {
        chunkIndex: -1,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when totalChunks is less than 1', async () => {
      const dto = plainToInstance(EmbeddingMetadataDto, {
        totalChunks: 0,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when tokenCount is not positive', async () => {
      const dto = plainToInstance(EmbeddingMetadataDto, {
        tokenCount: 0,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when quality is out of range', async () => {
      const dto = plainToInstance(EmbeddingMetadataDto, {
        quality: 1.5,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass validation when quality is at boundary values', async () => {
      const dto1 = plainToInstance(EmbeddingMetadataDto, {
        quality: 0,
      });

      const dto2 = plainToInstance(EmbeddingMetadataDto, {
        quality: 1,
      });

      const errors1 = await validate(dto1);
      const errors2 = await validate(dto2);

      expect(errors1).toHaveLength(0);
      expect(errors2).toHaveLength(0);
    });

    it('should fail validation when language exceeds max length', async () => {
      const dto = plainToInstance(EmbeddingMetadataDto, {
        language: 'a'.repeat(11),
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('GenerateEmbeddingDto validation', () => {
    it('should pass validation with valid data', async () => {
      const dto = plainToInstance(GenerateEmbeddingDto, {
        content: 'Sample text to generate embedding for',
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with modelType specified', async () => {
      const dto = plainToInstance(GenerateEmbeddingDto, {
        content: 'Sample text to generate embedding for',
        modelType: EmbeddingModelType.OPENAI_SMALL_3,
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when content is empty', async () => {
      const dto = plainToInstance(GenerateEmbeddingDto, {
        content: '',
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when content is not a string', async () => {
      const dto = plainToInstance(GenerateEmbeddingDto, {
        content: 123,
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when sourceType is invalid', async () => {
      const dto = plainToInstance(GenerateEmbeddingDto, {
        content: 'Sample text',
        sourceType: 'invalid',
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when sourceId is not a valid UUID', async () => {
      const dto = plainToInstance(GenerateEmbeddingDto, {
        content: 'Sample text',
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: 'not-a-uuid',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when organizationId is not a valid UUID', async () => {
      const dto = plainToInstance(GenerateEmbeddingDto, {
        content: 'Sample text',
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        organizationId: 'not-a-uuid',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass validation with optional fields', async () => {
      const dto = plainToInstance(GenerateEmbeddingDto, {
        content: 'Sample text',
        modelType: EmbeddingModelType.OPENAI_LARGE_3,
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
        projectId: '123e4567-e89b-12d3-a456-426614174002',
        teamId: '123e4567-e89b-12d3-a456-426614174003',
        hollonId: '123e4567-e89b-12d3-a456-426614174004',
        tags: ['ai', 'ml'],
        metadata: { custom: 'data' },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when tags contain non-strings', async () => {
      const dto = plainToInstance(GenerateEmbeddingDto, {
        content: 'Sample text',
        sourceType: EmbeddingSourceType.GRAPH_NODE,
        sourceId: '123e4567-e89b-12d3-a456-426614174000',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
        tags: ['valid', 123],
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
