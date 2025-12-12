import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../document/entities/document.entity';
import { EmbeddingService } from './embedding.service';
import {
  VectorSearchDto,
  VectorSearchResponseDto,
  VectorSearchResultDto,
} from '../dto/vector-search.dto';

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Perform semantic similarity search using vector embeddings
   * Performance target: < 500ms response time
   */
  async search(searchDto: VectorSearchDto): Promise<VectorSearchResponseDto> {
    const startTime = Date.now();

    try {
      // 1. Generate query embedding
      const { embedding } = await this.embeddingService.generateEmbedding(
        searchDto.query,
      );
      const embeddingTime = Date.now() - startTime;
      this.logger.debug(`Query embedding generated in ${embeddingTime}ms`);

      // 2. Build SQL query with filters
      const queryBuilder = this.documentRepo
        .createQueryBuilder('doc')
        .select([
          'doc.id',
          'doc.title',
          'doc.content',
          'doc.type',
          'doc.tags',
          'doc.created_at',
          'doc.updated_at',
          'doc.metadata',
          'doc.organization_id',
          'doc.project_id',
          'doc.team_id',
        ])
        .where('doc.embedding IS NOT NULL');

      // 3. Apply filters
      this.applyFilters(queryBuilder, searchDto);

      // 4. Add vector similarity search with cosine distance
      // pgvector: <=> is cosine distance operator (lower = more similar)
      // We use 1 - cosine_distance to get similarity score (0-1, higher = more similar)
      const vectorString = this.embeddingService.embeddingToVector(embedding);

      queryBuilder
        .addSelect(`1 - (doc.embedding <=> '${vectorString}')`, 'similarity')
        .andWhere(
          `1 - (doc.embedding <=> '${vectorString}') >= :minSimilarity`,
          { minSimilarity: searchDto.minSimilarity || 0.7 },
        )
        .orderBy('similarity', 'DESC')
        .limit(searchDto.topK || 10);

      // 5. Execute query
      const queryStartTime = Date.now();
      const rawResults = await queryBuilder.getRawMany();
      const queryTime = Date.now() - queryStartTime;
      this.logger.debug(`Vector search query executed in ${queryTime}ms`);

      // 6. Transform results
      const results: VectorSearchResultDto[] = rawResults.map((raw) => ({
        id: raw.doc_id,
        title: raw.doc_title,
        content: raw.doc_content,
        type: raw.doc_type,
        tags: raw.doc_tags || [],
        similarity: parseFloat(raw.similarity),
        createdAt: raw.doc_created_at,
        updatedAt: raw.doc_updated_at,
        metadata: raw.doc_metadata,
        organizationId: raw.doc_organization_id,
        projectId: raw.doc_project_id,
        teamId: raw.doc_team_id,
      }));

      const executionTimeMs = Date.now() - startTime;
      this.logger.log(
        `Vector search completed in ${executionTimeMs}ms (embedding: ${embeddingTime}ms, query: ${queryTime}ms), found ${results.length} results`,
      );

      // Performance warning if response time exceeds target
      if (executionTimeMs > 500) {
        this.logger.warn(
          `Vector search exceeded 500ms target: ${executionTimeMs}ms`,
        );
      }

      return {
        results,
        query: searchDto.query,
        topK: searchDto.topK || 10,
        totalFound: results.length,
        executionTimeMs,
      };
    } catch (error) {
      this.logger.error(
        `Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Apply filters to the query builder
   */
  private applyFilters(queryBuilder: any, filters: VectorSearchDto): void {
    // Organization filter
    if (filters.organizationId) {
      queryBuilder.andWhere('doc.organization_id = :orgId', {
        orgId: filters.organizationId,
      });
    }

    // Project filter
    if (filters.projectId !== undefined) {
      if (filters.projectId === null) {
        queryBuilder.andWhere('doc.project_id IS NULL');
      } else {
        queryBuilder.andWhere('doc.project_id = :projectId', {
          projectId: filters.projectId,
        });
      }
    }

    // Team filter
    if (filters.teamId) {
      queryBuilder.andWhere('doc.team_id = :teamId', {
        teamId: filters.teamId,
      });
    }

    // Document type filter
    if (filters.type) {
      queryBuilder.andWhere('doc.type = :type', { type: filters.type });
    }

    // Tags filter (documents must have at least one of the specified tags)
    if (filters.tags && filters.tags.length > 0) {
      queryBuilder.andWhere('doc.tags && :tags', { tags: filters.tags });
    }

    // Date range filters
    if (filters.startDate) {
      queryBuilder.andWhere('doc.created_at >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('doc.created_at <= :endDate', {
        endDate: filters.endDate,
      });
    }
  }

  /**
   * Generate and store embedding for a document
   */
  async generateDocumentEmbedding(documentId: string): Promise<void> {
    const document = await this.documentRepo.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Combine title and content for embedding
    const textToEmbed = `${document.title}\n\n${document.content}`;
    const { embedding } =
      await this.embeddingService.generateEmbedding(textToEmbed);

    // Store embedding in database
    const vectorString = this.embeddingService.embeddingToVector(embedding);
    await this.documentRepo.query(
      `UPDATE documents SET embedding = $1 WHERE id = $2`,
      [vectorString, documentId],
    );

    this.logger.log(
      `Generated and stored embedding for document ${documentId}`,
    );
  }

  /**
   * Batch generate embeddings for documents without embeddings
   */
  async generateMissingEmbeddings(
    organizationId?: string,
    limit?: number,
  ): Promise<{ processed: number; failed: number }> {
    const query = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.embedding IS NULL');

    if (organizationId) {
      query.andWhere('doc.organization_id = :orgId', { orgId: organizationId });
    }

    if (limit) {
      query.limit(limit);
    }

    const documents = await query.getMany();
    this.logger.log(
      `Processing ${documents.length} documents without embeddings`,
    );

    let processed = 0;
    let failed = 0;

    for (const doc of documents) {
      try {
        await this.generateDocumentEmbedding(doc.id);
        processed++;
      } catch (error) {
        this.logger.error(
          `Failed to generate embedding for document ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        failed++;
      }
    }

    this.logger.log(
      `Embedding generation complete: ${processed} processed, ${failed} failed`,
    );

    return { processed, failed };
  }

  /**
   * Find similar documents to a given document
   */
  async findSimilarDocuments(
    documentId: string,
    options?: {
      topK?: number;
      minSimilarity?: number;
      organizationId?: string;
    },
  ): Promise<VectorSearchResultDto[]> {
    const document = await this.documentRepo.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    if (!document.embedding) {
      throw new Error(`Document ${documentId} does not have an embedding`);
    }

    // Use the document's embedding directly for similarity search
    const queryBuilder = this.documentRepo
      .createQueryBuilder('doc')
      .select([
        'doc.id',
        'doc.title',
        'doc.content',
        'doc.type',
        'doc.tags',
        'doc.created_at',
        'doc.updated_at',
        'doc.metadata',
        'doc.organization_id',
        'doc.project_id',
        'doc.team_id',
      ])
      .where('doc.embedding IS NOT NULL')
      .andWhere('doc.id != :docId', { docId: documentId });

    if (options?.organizationId) {
      queryBuilder.andWhere('doc.organization_id = :orgId', {
        orgId: options.organizationId,
      });
    }

    queryBuilder
      .addSelect(
        `1 - (doc.embedding <=> (SELECT embedding FROM documents WHERE id = '${documentId}'))`,
        'similarity',
      )
      .andWhere(
        `1 - (doc.embedding <=> (SELECT embedding FROM documents WHERE id = '${documentId}')) >= :minSimilarity`,
        { minSimilarity: options?.minSimilarity || 0.7 },
      )
      .orderBy('similarity', 'DESC')
      .limit(options?.topK || 10);

    const rawResults = await queryBuilder.getRawMany();

    return rawResults.map((raw) => ({
      id: raw.doc_id,
      title: raw.doc_title,
      content: raw.doc_content,
      type: raw.doc_type,
      tags: raw.doc_tags || [],
      similarity: parseFloat(raw.similarity),
      createdAt: raw.doc_created_at,
      updatedAt: raw.doc_updated_at,
      metadata: raw.doc_metadata,
      organizationId: raw.doc_organization_id,
      projectId: raw.doc_project_id,
      teamId: raw.doc_team_id,
    }));
  }
}
