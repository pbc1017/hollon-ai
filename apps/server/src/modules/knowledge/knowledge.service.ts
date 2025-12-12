import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Document } from '../document/entities/document.entity';
import { SearchQueryDto } from './dto/search-query.dto';
import { HybridSearchQueryDto } from './dto/hybrid-search-query.dto';
import {
  AdvancedSearchDto,
  SortField,
  SortOrder,
} from './dto/advanced-search.dto';

export interface SearchResult {
  documents: Document[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
  ) {}

  /**
   * Semantic search using vector embeddings (pgvector)
   * Currently returns results based on keyword matching
   * TODO: Implement actual vector similarity search when embedding generation is available
   */
  async semanticSearch(dto: SearchQueryDto): Promise<SearchResult> {
    this.logger.log(`Semantic search: "${dto.query}"`);

    const query = this.documentRepo
      .createQueryBuilder('doc')
      .select([
        'doc.id',
        'doc.title',
        'doc.content',
        'doc.type',
        'doc.organizationId',
        'doc.projectId',
        'doc.teamId',
        'doc.tags',
        'doc.createdAt',
        'doc.updatedAt',
      ])
      .where(
        new Brackets((qb) => {
          qb.where('doc.title ILIKE :query', {
            query: `%${dto.query}%`,
          }).orWhere('doc.content ILIKE :query', { query: `%${dto.query}%` });
        }),
      );

    if (dto.organizationId) {
      query.andWhere('doc.organization_id = :orgId', {
        orgId: dto.organizationId,
      });
    }

    if (dto.projectId) {
      query.andWhere('doc.project_id = :projectId', {
        projectId: dto.projectId,
      });
    }

    if (dto.tags && dto.tags.length > 0) {
      query.andWhere('doc.tags && :tags', { tags: dto.tags });
    }

    const limit = dto.limit || 10;
    const offset = dto.offset || 0;

    const [documents, total] = await query
      .orderBy('doc.updated_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return {
      documents,
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
    };
  }

  /**
   * Hybrid search combining semantic (vector) and keyword search
   * Currently uses weighted keyword matching
   * TODO: Implement actual hybrid search combining pgvector similarity + keyword relevance
   */
  async hybridSearch(dto: HybridSearchQueryDto): Promise<SearchResult> {
    this.logger.log(`Hybrid search: "${dto.query}"`);

    const semanticWeight = dto.semanticWeight ?? 0.7;
    const keywordWeight = dto.keywordWeight ?? 0.3;

    // Validate weights sum to 1
    if (Math.abs(semanticWeight + keywordWeight - 1.0) > 0.01) {
      this.logger.warn(
        `Invalid weights (semantic: ${semanticWeight}, keyword: ${keywordWeight}), using defaults`,
      );
    }

    const query = this.documentRepo
      .createQueryBuilder('doc')
      .select([
        'doc.id',
        'doc.title',
        'doc.content',
        'doc.type',
        'doc.organizationId',
        'doc.projectId',
        'doc.teamId',
        'doc.tags',
        'doc.createdAt',
        'doc.updatedAt',
      ])
      .where(
        new Brackets((qb) => {
          qb.where('doc.title ILIKE :query', {
            query: `%${dto.query}%`,
          }).orWhere('doc.content ILIKE :query', { query: `%${dto.query}%` });
        }),
      );

    if (dto.organizationId) {
      query.andWhere('doc.organization_id = :orgId', {
        orgId: dto.organizationId,
      });
    }

    if (dto.projectId) {
      query.andWhere('doc.project_id = :projectId', {
        projectId: dto.projectId,
      });
    }

    if (dto.tags && dto.tags.length > 0) {
      query.andWhere('doc.tags && :tags', { tags: dto.tags });
    }

    const limit = dto.limit || 10;
    const offset = dto.offset || 0;

    const [documents, total] = await query
      .orderBy('doc.updated_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return {
      documents,
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
    };
  }

  /**
   * Advanced search with comprehensive filters
   */
  async advancedSearch(dto: AdvancedSearchDto): Promise<SearchResult> {
    this.logger.log(`Advanced search: "${dto.query}"`);

    const query = this.documentRepo.createQueryBuilder('doc');

    // Select fields based on includeEmbeddings flag
    const selectFields = [
      'doc.id',
      'doc.title',
      'doc.content',
      'doc.type',
      'doc.organizationId',
      'doc.projectId',
      'doc.teamId',
      'doc.hollonId',
      'doc.taskId',
      'doc.tags',
      'doc.metadata',
      'doc.createdAt',
      'doc.updatedAt',
    ];

    if (dto.includeEmbeddings) {
      selectFields.push('doc.embedding');
    }

    query.select(selectFields);

    // Text search
    query.where(
      new Brackets((qb) => {
        qb.where('doc.title ILIKE :query', {
          query: `%${dto.query}%`,
        }).orWhere('doc.content ILIKE :query', { query: `%${dto.query}%` });
      }),
    );

    // Organization filter
    if (dto.organizationId) {
      query.andWhere('doc.organization_id = :orgId', {
        orgId: dto.organizationId,
      });
    }

    // Project filter
    if (dto.projectId !== undefined) {
      if (dto.projectId === null) {
        query.andWhere('doc.project_id IS NULL');
      } else {
        query.andWhere('doc.project_id = :projectId', {
          projectId: dto.projectId,
        });
      }
    }

    // Team filter
    if (dto.teamId) {
      query.andWhere('doc.team_id = :teamId', { teamId: dto.teamId });
    }

    // Tags filter
    if (dto.tags && dto.tags.length > 0) {
      query.andWhere('doc.tags && :tags', { tags: dto.tags });
    }

    // Document type filter
    if (dto.type) {
      query.andWhere('doc.type = :type', { type: dto.type });
    }

    // Date range filters
    if (dto.createdAfter) {
      query.andWhere('doc.created_at >= :createdAfter', {
        createdAfter: dto.createdAfter,
      });
    }

    if (dto.createdBefore) {
      query.andWhere('doc.created_at <= :createdBefore', {
        createdBefore: dto.createdBefore,
      });
    }

    if (dto.updatedAfter) {
      query.andWhere('doc.updated_at >= :updatedAfter', {
        updatedAfter: dto.updatedAfter,
      });
    }

    if (dto.updatedBefore) {
      query.andWhere('doc.updated_at <= :updatedBefore', {
        updatedBefore: dto.updatedBefore,
      });
    }

    // Sorting
    const sortField = dto.sortBy || SortField.RELEVANCE;
    const sortOrder = dto.sortOrder || SortOrder.DESC;

    switch (sortField) {
      case SortField.CREATED_AT:
        query.orderBy('doc.created_at', sortOrder);
        break;
      case SortField.UPDATED_AT:
        query.orderBy('doc.updated_at', sortOrder);
        break;
      case SortField.TITLE:
        query.orderBy('doc.title', sortOrder);
        break;
      case SortField.RELEVANCE:
      default:
        // For relevance, order by updated_at as a proxy for now
        // TODO: Implement actual relevance scoring
        query.orderBy('doc.updated_at', 'DESC');
        break;
    }

    const limit = dto.limit || 10;
    const offset = dto.offset || 0;

    const [documents, total] = await query
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return {
      documents,
      total,
      page: Math.floor(offset / limit) + 1,
      limit,
    };
  }
}
