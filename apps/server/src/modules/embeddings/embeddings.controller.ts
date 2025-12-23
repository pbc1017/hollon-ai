import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { EmbeddingsService, EmbeddingBatchRequest, EmbeddingBatchResult } from './embeddings.service';

@Controller('embeddings')
export class EmbeddingsController {
  constructor(private readonly embeddingsService: EmbeddingsService) {}

  /**
   * 배치 임베딩 작업 트리거
   *
   * POST /embeddings/batch
   * Body: {
   *   "documentIds": ["uuid1", "uuid2", ...],
   *   "organizationId": "uuid",
   *   "retryFailedItems": true,
   *   "maxRetries": 3
   * }
   */
  @Post('batch')
  async batchEmbed(
    @Body() request: EmbeddingBatchRequest,
  ): Promise<EmbeddingBatchResult> {
    if (!request.documentIds || request.documentIds.length === 0) {
      throw new BadRequestException('documentIds must not be empty');
    }

    if (!request.organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    return this.embeddingsService.embeddingBatchJob(request);
  }
}
