/**
 * Knowledge Repository Interface
 *
 * Defines the contract for Knowledge repository operations including:
 * - CRUD operations (create, read, update, delete)
 * - Custom query methods (findByTopic, search, etc.)
 * - Filtering and pagination support
 */

import { Knowledge, KnowledgeType } from '../entities/knowledge.entity';
import { CreateKnowledgeDto } from '../dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from '../dto/update-knowledge.dto';

/**
 * Query options for knowledge searches
 */
export interface KnowledgeQueryOptions {
  /** Filter by knowledge type(s) */
  types?: KnowledgeType[];

  /** Filter by source */
  source?: string;

  /** Text search in content */
  searchText?: string;

  /** Date range filter */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /** Pagination options */
  pagination?: {
    page: number;
    limit: number;
  };

  /** Sort options */
  sort?: {
    field: 'createdAt' | 'updatedAt' | 'type' | 'source';
    order: 'ASC' | 'DESC';
  };
}

/**
 * Paginated result for knowledge queries
 */
export interface PaginatedKnowledgeResult {
  /** Knowledge items */
  items: Knowledge[];

  /** Total count of items matching query */
  total: number;

  /** Current page number */
  page: number;

  /** Items per page */
  limit: number;

  /** Total number of pages */
  totalPages: number;

  /** Has next page */
  hasNext: boolean;

  /** Has previous page */
  hasPrevious: boolean;
}

/**
 * Knowledge Repository Interface
 *
 * Provides data access operations for Knowledge entities
 */
export interface IKnowledgeRepository {
  /**
   * Create a new knowledge item
   *
   * @param createDto - Data for creating knowledge
   * @returns Created knowledge entity
   */
  create(createDto: CreateKnowledgeDto): Promise<Knowledge>;

  /**
   * Find a knowledge item by ID
   *
   * @param id - Knowledge item ID
   * @returns Knowledge entity or null if not found
   */
  findById(id: string): Promise<Knowledge | null>;

  /**
   * Find all knowledge items
   *
   * @param options - Optional query options for filtering and pagination
   * @returns Array of knowledge entities or paginated result
   */
  findAll(options?: KnowledgeQueryOptions): Promise<Knowledge[]>;

  /**
   * Find knowledge items with pagination
   *
   * @param options - Query options including pagination
   * @returns Paginated knowledge result
   */
  findAllPaginated(
    options: KnowledgeQueryOptions,
  ): Promise<PaginatedKnowledgeResult>;

  /**
   * Update a knowledge item
   *
   * @param id - Knowledge item ID
   * @param updateDto - Data for updating knowledge
   * @returns Updated knowledge entity
   */
  update(id: string, updateDto: UpdateKnowledgeDto): Promise<Knowledge>;

  /**
   * Delete a knowledge item
   *
   * @param id - Knowledge item ID
   * @returns True if deleted successfully
   */
  delete(id: string): Promise<boolean>;

  /**
   * Find knowledge items by type
   *
   * @param type - Knowledge type to filter by
   * @param options - Optional query options
   * @returns Array of knowledge entities matching the type
   */
  findByType(
    type: KnowledgeType,
    options?: KnowledgeQueryOptions,
  ): Promise<Knowledge[]>;

  /**
   * Find knowledge items by source
   *
   * @param source - Source identifier
   * @param options - Optional query options
   * @returns Array of knowledge entities from the specified source
   */
  findBySource(
    source: string,
    options?: KnowledgeQueryOptions,
  ): Promise<Knowledge[]>;

  /**
   * Search knowledge items by content
   *
   * Performs a text search on the knowledge content field
   *
   * @param searchText - Text to search for
   * @param options - Optional query options
   * @returns Array of knowledge entities matching the search
   */
  search(
    searchText: string,
    options?: KnowledgeQueryOptions,
  ): Promise<Knowledge[]>;

  /**
   * Search knowledge items with pagination
   *
   * @param searchText - Text to search for
   * @param options - Query options including pagination
   * @returns Paginated search results
   */
  searchPaginated(
    searchText: string,
    options: KnowledgeQueryOptions,
  ): Promise<PaginatedKnowledgeResult>;

  /**
   * Find knowledge items by multiple types
   *
   * @param types - Array of knowledge types
   * @param options - Optional query options
   * @returns Array of knowledge entities matching any of the types
   */
  findByTypes(
    types: KnowledgeType[],
    options?: KnowledgeQueryOptions,
  ): Promise<Knowledge[]>;

  /**
   * Find knowledge items created within a date range
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @param options - Optional query options
   * @returns Array of knowledge entities created within the range
   */
  findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: KnowledgeQueryOptions,
  ): Promise<Knowledge[]>;

  /**
   * Count knowledge items
   *
   * @param options - Optional query options for filtering
   * @returns Total count of knowledge items
   */
  count(options?: KnowledgeQueryOptions): Promise<number>;

  /**
   * Count knowledge items by type
   *
   * @returns Object with counts for each knowledge type
   */
  countByType(): Promise<Record<KnowledgeType, number>>;

  /**
   * Check if knowledge item exists by ID
   *
   * @param id - Knowledge item ID
   * @returns True if exists, false otherwise
   */
  exists(id: string): Promise<boolean>;

  /**
   * Bulk create knowledge items
   *
   * @param createDtos - Array of knowledge creation DTOs
   * @returns Array of created knowledge entities
   */
  bulkCreate(createDtos: CreateKnowledgeDto[]): Promise<Knowledge[]>;

  /**
   * Bulk delete knowledge items
   *
   * @param ids - Array of knowledge item IDs
   * @returns Number of items deleted
   */
  bulkDelete(ids: string[]): Promise<number>;
}
