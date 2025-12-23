import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Document } from '../document/entities/document.entity';
import {
  CostRecord,
  CostRecordType,
} from '../cost-tracking/entities/cost-record.entity';

/**
 * OpenAI Embedding API 응답 타입
 */
interface OpenAIEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * 배치 임베딩 요청 타입
 */
export interface EmbeddingBatchRequest {
  documentIds: string[];
  organizationId: string;
  retryFailedItems?: boolean;
  maxRetries?: number;
}

/**
 * 배치 임베딩 결과 타입
 */
export interface EmbeddingBatchResult {
  processed: number;
  failed: number;
  totalTokens: number;
  totalCostCents: number;
  executionTimeMs: number;
  failedDocumentIds: string[];
  retryAttempts: number;
}

/**
 * 개별 임베딩 작업 상태
 */
interface EmbeddingJobStatus {
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  retryCount: number;
}

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  // OpenAI API 설정
  private readonly OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';
  private readonly MAX_BATCH_SIZE = 100; // OpenAI 배치 크기 제한
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  // 토큰 가격 (text-embedding-3-small)
  // 현재 가격: $0.02 per 1M tokens (2025년 기준)
  private readonly COST_PER_1M_TOKENS_CENTS = 2;

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(CostRecord)
    private readonly costRecordRepo: Repository<CostRecord>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 배치 임베딩 작업 실행
   *
   * 주요 기능:
   * 1. 문서 조회 및 배치 분할
   * 2. OpenAI API를 통한 임베딩 생성
   * 3. 토큰 사용량 모니터링
   * 4. 비용 추적 (CostRecord)
   * 5. 실패 항목 재시도 (configurable)
   * 6. 임베딩을 Document 엔티티에 저장
   *
   * @param request - 배치 요청 정보
   * @returns 배치 작업 결과
   * @throws BadRequestException - 잘못된 요청
   */
  async embeddingBatchJob(
    request: EmbeddingBatchRequest,
  ): Promise<EmbeddingBatchResult> {
    const startTime = Date.now();
    this.logger.log(
      `Starting embedding batch job for org ${request.organizationId}. Requesting ${request.documentIds.length} documents.`,
    );

    // 1. OpenAI API 키 확인
    const apiKey = this.configService.get<string>('brain.openaiApiKey');
    if (!apiKey || apiKey === 'test-key-not-used') {
      throw new BadRequestException('OpenAI API key not configured');
    }

    // 2. 문서 조회
    const documents = await this.documentRepo.find({
      where: {
        id: request.documentIds as any,
        organizationId: request.organizationId,
      },
    });

    if (documents.length === 0) {
      throw new BadRequestException('No documents found for embedding');
    }

    this.logger.log(
      `Found ${documents.length} documents. Starting embedding process.`,
    );

    // 3. 임베딩이 필요한 문서만 필터링 (이미 임베딩이 있으면 스킵)
    const docsToEmbed = documents.filter((doc) => !doc.embedding);
    const docsAlreadyEmbedded = documents.filter((doc) => doc.embedding);

    if (docsAlreadyEmbedded.length > 0) {
      this.logger.log(
        `${docsAlreadyEmbedded.length} documents already have embeddings, skipping them.`,
      );
    }

    if (docsToEmbed.length === 0) {
      this.logger.log('All documents already have embeddings.');
      return {
        processed: 0,
        failed: 0,
        totalTokens: 0,
        totalCostCents: 0,
        executionTimeMs: Date.now() - startTime,
        failedDocumentIds: [],
        retryAttempts: 0,
      };
    }

    // 4. 배치 분할 및 처리
    const batches = this.createBatches(docsToEmbed);
    let totalTokens = 0;
    let totalCostCents = 0;
    let totalProcessed = 0;
    let totalFailed = 0;
    const failedDocumentIds: Set<string> = new Set();
    let retryAttempts = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      this.logger.log(
        `Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} documents)`,
      );

      const jobStatuses: EmbeddingJobStatus[] = batch.map((doc) => ({
        documentId: doc.id,
        status: 'pending',
        retryCount: 0,
      }));

      // 배치 처리 및 재시도
      const batchResult = await this.processBatchWithRetry(
        batch,
        jobStatuses,
        apiKey,
        request.maxRetries ?? this.MAX_RETRIES,
      );

      totalTokens += batchResult.tokensUsed;
      totalCostCents += batchResult.costCents;
      totalProcessed += batchResult.processed;
      totalFailed += batchResult.failed;
      retryAttempts += batchResult.retryAttempts;

      // 실패한 문서 ID 수집
      jobStatuses.forEach((status) => {
        if (status.status === 'failed') {
          failedDocumentIds.add(status.documentId);
        }
      });

      this.logger.log(
        `Batch ${batchIndex + 1} completed: ${batchResult.processed} processed, ${batchResult.failed} failed`,
      );
    }

    const executionTimeMs = Date.now() - startTime;

    // 5. 비용 기록
    await this.recordCost(
      request.organizationId,
      totalTokens,
      totalCostCents,
      executionTimeMs,
      totalProcessed,
      totalFailed,
    );

    this.logger.log(
      `Embedding batch job completed. Processed: ${totalProcessed}, Failed: ${totalFailed}, ` +
        `Tokens: ${totalTokens}, Cost: $${(totalCostCents / 100).toFixed(4)}, Time: ${executionTimeMs}ms`,
    );

    return {
      processed: totalProcessed,
      failed: totalFailed,
      totalTokens,
      totalCostCents,
      executionTimeMs,
      failedDocumentIds: Array.from(failedDocumentIds),
      retryAttempts,
    };
  }

  /**
   * 배치를 최대 크기로 분할
   */
  private createBatches<T>(items: T[]): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += this.MAX_BATCH_SIZE) {
      batches.push(items.slice(i, i + this.MAX_BATCH_SIZE));
    }
    return batches;
  }

  /**
   * 배치 처리 (재시도 로직 포함)
   */
  private async processBatchWithRetry(
    documents: Document[],
    jobStatuses: EmbeddingJobStatus[],
    apiKey: string,
    maxRetries: number,
  ): Promise<{
    processed: number;
    failed: number;
    tokensUsed: number;
    costCents: number;
    retryAttempts: number;
  }> {
    let tokensUsed = 0;
    let costCents = 0;
    let retryAttempts = 0;

    // 초기 시도
    const { succeeded, failed } = await this.callOpenAIEmbeddingAPI(
      documents,
      jobStatuses,
      apiKey,
    );

    tokensUsed += succeeded.tokens;
    costCents += succeeded.cost;

    // 실패한 문서 재시도
    if (failed.length > 0 && maxRetries > 0) {
      this.logger.warn(
        `${failed.length} documents failed in initial attempt. Starting retry logic.`,
      );

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (failed.length === 0) break;

        retryAttempts++;
        const delayMs = this.RETRY_DELAY_MS * (attempt + 1); // 지수 백오프

        this.logger.log(
          `Retry attempt ${attempt + 1}/${maxRetries} for ${failed.length} documents (delay: ${delayMs}ms)`,
        );

        await this.delay(delayMs);

        const failedDocs = failed.map((id) =>
          documents.find((doc) => doc.id === id),
        );
        const validFailedDocs = failedDocs.filter(
          (doc): doc is Document => doc !== undefined,
        );

        if (validFailedDocs.length === 0) break;

        const { succeeded: retrySucceeded, failed: retryFailed } =
          await this.callOpenAIEmbeddingAPI(
            validFailedDocs,
            jobStatuses,
            apiKey,
          );

        tokensUsed += retrySucceeded.tokens;
        costCents += retrySucceeded.cost;

        // failed 배열 업데이트
        failed.splice(0, failed.length, ...retryFailed);

        this.logger.log(
          `Retry attempt ${attempt + 1}: ${retrySucceeded.count} succeeded, ${retryFailed.length} still failing`,
        );
      }
    }

    const processed =
      documents.length -
      failed.filter((id) =>
        jobStatuses.find((js) => js.documentId === id && js.retryCount > 0),
      ).length;
    const finalFailed = failed.length;

    return {
      processed: documents.length - finalFailed,
      failed: finalFailed,
      tokensUsed,
      costCents,
      retryAttempts,
    };
  }

  /**
   * OpenAI Embedding API 호출
   */
  private async callOpenAIEmbeddingAPI(
    documents: Document[],
    jobStatuses: EmbeddingJobStatus[],
    apiKey: string,
  ): Promise<{
    succeeded: { count: number; tokens: number; cost: number };
    failed: string[];
  }> {
    const texts = documents.map((doc) => doc.content);
    let succeeded = { count: 0, tokens: 0, cost: 0 };
    const failedIds: string[] = [];

    try {
      const response = await this.fetchOpenAI(texts, apiKey);

      // 응답 처리
      for (const item of response.data) {
        const doc = documents[item.index];
        if (!doc) continue;

        try {
          // 임베딩을 벡터 형식으로 저장 (pgvector 호환)
          const embeddingVector = JSON.stringify(item.embedding);

          // Document에 임베딩 저장
          await this.documentRepo.update(doc.id, {
            embedding: embeddingVector,
          });

          // 작업 상태 업데이트
          const jobStatus = jobStatuses.find((js) => js.documentId === doc.id);
          if (jobStatus) {
            jobStatus.status = 'completed';
          }

          succeeded.count++;
          this.logger.debug(
            `Document ${doc.id.slice(0, 8)} embedded successfully`,
          );
        } catch (updateError) {
          this.logger.error(
            `Failed to save embedding for document ${doc.id}: ${
              updateError instanceof Error
                ? updateError.message
                : 'Unknown error'
            }`,
          );
          failedIds.push(doc.id);

          const jobStatus = jobStatuses.find((js) => js.documentId === doc.id);
          if (jobStatus) {
            jobStatus.status = 'failed';
            jobStatus.error =
              updateError instanceof Error
                ? updateError.message
                : 'Unknown error';
            jobStatus.retryCount++;
          }
        }
      }

      // 토큰 및 비용 계산
      succeeded.tokens = response.usage.total_tokens;
      succeeded.cost = this.calculateCost(response.usage.total_tokens);

      this.logger.log(
        `OpenAI API call: ${succeeded.count} embeddings, ${succeeded.tokens} tokens, $${(succeeded.cost / 100).toFixed(4)}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `OpenAI API call failed: ${errorMessage}. Marking all documents as failed.`,
      );

      // 모든 문서를 실패로 표시
      for (const doc of documents) {
        const jobStatus = jobStatuses.find((js) => js.documentId === doc.id);
        if (jobStatus) {
          jobStatus.status = 'failed';
          jobStatus.error = errorMessage;
          jobStatus.retryCount++;
        }
        failedIds.push(doc.id);
      }
    }

    return { succeeded, failed: failedIds };
  }

  /**
   * OpenAI Embedding API에 실제 요청
   */
  private async fetchOpenAI(
    texts: string[],
    apiKey: string,
  ): Promise<OpenAIEmbeddingResponse> {
    const response = await fetch(this.OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.EMBEDDING_MODEL,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`,
      );
    }

    return response.json() as Promise<OpenAIEmbeddingResponse>;
  }

  /**
   * 토큰 기반 비용 계산
   */
  private calculateCost(tokens: number): number {
    // text-embedding-3-small: $0.02 per 1M tokens
    // 1cent = $0.01
    // (tokens / 1_000_000) * 0.02 * 100 cents = tokens * 0.000002 * 100 = tokens * 0.0002
    return (tokens / 1_000_000) * this.COST_PER_1M_TOKENS_CENTS * 100;
  }

  /**
   * 비용 기록 (CostRecord 엔티티에 저장)
   */
  private async recordCost(
    organizationId: string,
    totalTokens: number,
    totalCostCents: number,
    executionTimeMs: number,
    processed: number,
    failed: number,
  ): Promise<void> {
    try {
      const costRecord = this.costRecordRepo.create({
        organizationId,
        type: CostRecordType.OTHER, // 임베딩은 BRAIN_EXECUTION이 아님
        providerId: 'openai_api',
        modelUsed: this.EMBEDDING_MODEL,
        inputTokens: totalTokens,
        outputTokens: 0, // 임베딩은 입력 토큰만 사용
        costCents: totalCostCents,
        executionTimeMs,
        metadata: JSON.stringify({
          batchType: 'embedding',
          processedCount: processed,
          failedCount: failed,
        }),
      });

      await this.costRecordRepo.save(costRecord);
      this.logger.log(`Cost record saved: ${costRecord.id}`);
    } catch (error) {
      // 비용 기록 실패는 임베딩 작업 자체를 막지 않음
      this.logger.error(
        `Failed to record cost: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * 지연 함수 (재시도 시간 대기)
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 개별 문서 임베딩 (편의 메서드)
   */
  async embedDocument(
    documentId: string,
    organizationId: string,
  ): Promise<string> {
    const document = await this.documentRepo.findOne({
      where: { id: documentId, organizationId },
    });

    if (!document) {
      throw new BadRequestException('Document not found');
    }

    if (document.embedding) {
      this.logger.log(`Document ${documentId} already has embedding`);
      return document.embedding;
    }

    // 단일 문서 배치로 처리
    const result = await this.embeddingBatchJob({
      documentIds: [documentId],
      organizationId,
    });

    if (result.failed > 0) {
      throw new BadRequestException(
        `Failed to embed document: ${result.failedDocumentIds[0]}`,
      );
    }

    // 업데이트된 문서 조회
    const updatedDoc = await this.documentRepo.findOne({
      where: { id: documentId },
    });

    if (!updatedDoc?.embedding) {
      throw new BadRequestException(
        'Failed to retrieve embedding after creation',
      );
    }

    return updatedDoc.embedding;
  }
}
