import { KnowledgeItem } from '../entities/knowledge-item.entity';

export interface KnowledgeExtractionQueryOptions {
  organizationId: string;
  types?: string[];
  searchText?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  pagination?: {
    page: number;
    limit: number;
  };
  sort?: {
    field: 'extractedAt' | 'createdAt' | 'type' | 'updatedAt';
    order: 'ASC' | 'DESC';
  };
  metadata?: Record<string, unknown>;
}

export interface PaginatedKnowledgeExtractionResult {
  items: KnowledgeItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface IKnowledgeExtractionRepository {
  create(data: Partial<KnowledgeItem>): Promise<KnowledgeItem>;
  findById(id: string): Promise<KnowledgeItem | null>;
  findAll(organizationId: string): Promise<KnowledgeItem[]>;
  findAllPaginated(
    options: KnowledgeExtractionQueryOptions,
  ): Promise<PaginatedKnowledgeExtractionResult>;
  update(
    id: string,
    data: Partial<KnowledgeItem>,
  ): Promise<KnowledgeItem | null>;
  delete(id: string): Promise<boolean>;
  findByType(organizationId: string, type: string): Promise<KnowledgeItem[]>;
  findByTypes(
    organizationId: string,
    types: string[],
  ): Promise<KnowledgeItem[]>;
  searchByContent(
    organizationId: string,
    searchText: string,
  ): Promise<KnowledgeItem[]>;
  searchByContentPaginated(
    organizationId: string,
    searchText: string,
    options: KnowledgeExtractionQueryOptions,
  ): Promise<PaginatedKnowledgeExtractionResult>;
  findByDateRange(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<KnowledgeItem[]>;
  findByTypeAndDateRange(
    organizationId: string,
    type: string,
    startDate: Date,
    endDate: Date,
  ): Promise<KnowledgeItem[]>;
  findByMetadata(
    organizationId: string,
    metadataQuery: Record<string, unknown>,
  ): Promise<KnowledgeItem[]>;
  findRecent(organizationId: string, limit?: number): Promise<KnowledgeItem[]>;
  findExtractedAfter(
    organizationId: string,
    afterDate: Date,
    limit?: number,
  ): Promise<KnowledgeItem[]>;
  findExtractedBefore(
    organizationId: string,
    beforeDate: Date,
    limit?: number,
  ): Promise<KnowledgeItem[]>;
  count(organizationId: string): Promise<number>;
  countByType(organizationId: string): Promise<Record<string, number>>;
  getUniqueTypes(organizationId: string): Promise<string[]>;
  exists(id: string): Promise<boolean>;
  bulkCreate(items: Partial<KnowledgeItem>[]): Promise<KnowledgeItem[]>;
  bulkDelete(ids: string[]): Promise<number>;
  deleteByOrganization(organizationId: string): Promise<number>;
}
