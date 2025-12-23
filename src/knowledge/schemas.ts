/**
 * Knowledge Management API Schemas and DTOs
 *
 * This file contains all request/response schemas and data transfer objects
 * for the Knowledge Management API, following NestJS and class-validator patterns.
 */

import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  IsBoolean,
  IsObject,
  IsNumber,
  IsEnum,
  IsDateString,
  MaxLength,
  MinLength,
  Min,
  Max,
  IsUrl,
  IsHexColor,
  ValidateNested,
  IsISO8601,
} from 'class-validator';
import { Type, Exclude, Expose } from 'class-transformer';

// ============================================================================
// ENUMS
// ============================================================================

export enum KnowledgeItemStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum KnowledgeSortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  TITLE = 'title',
  RELEVANCE = 'relevance',
}

export enum CategorySortBy {
  NAME = 'name',
  CREATED_AT = 'createdAt',
  ITEM_COUNT = 'itemCount',
}

export enum SearchSortBy {
  RELEVANCE = 'relevance',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  TITLE = 'title',
}

export enum BulkOperationType {
  UPDATE_CATEGORY = 'updateCategory',
  UPDATE_TAGS = 'updateTags',
  DELETE = 'delete',
  PUBLISH = 'publish',
  UNPUBLISH = 'unpublish',
}

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  XML = 'xml',
}

export enum MergeStrategy {
  OVERWRITE = 'overwrite',
  SKIP = 'skip',
  MERGE = 'merge',
}

export enum AuditOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  VIEW = 'view',
  PUBLISH = 'publish',
  UNPUBLISH = 'unpublish',
}

export enum TimeRange {
  SEVEN_DAYS = '7d',
  THIRTY_DAYS = '30d',
  NINETY_DAYS = '90d',
  ONE_YEAR = '1y',
}

// ============================================================================
// BASE DTOs
// ============================================================================

/**
 * Pagination metadata for list responses
 */
export class PaginationMetadataDto {
  @IsNumber()
  @Min(1)
  page: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number;

  @IsNumber()
  @Min(0)
  total: number;

  @IsNumber()
  @Min(0)
  totalPages: number;
}

/**
 * Base audit fields for all resources
 */
export class AuditFieldsDto {
  @IsDateString()
  createdAt: string;

  @IsDateString()
  updatedAt: string;

  @IsUUID()
  createdBy: string;

  @IsOptional()
  @IsUUID()
  updatedBy?: string;

  @IsNumber()
  @Min(1)
  version: number;
}

/**
 * Error response detail
 */
export class ErrorDetailDto {
  @IsString()
  field?: string;

  @IsString()
  constraint?: string;

  @IsString()
  value?: string;

  @IsString()
  message?: string;
}

/**
 * Standard error response
 */
export class ErrorResponseDto {
  @IsNumber()
  statusCode: number;

  @IsDateString()
  timestamp: string;

  @IsString()
  path: string;

  @IsString()
  method: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ErrorDetailDto)
  details?: ErrorDetailDto[];
}

// ============================================================================
// KNOWLEDGE ITEM SCHEMAS
// ============================================================================

/**
 * Create Knowledge Item DTO
 */
export class CreateKnowledgeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  relatedKnowledgeIds?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * Update Knowledge Item DTO
 */
export class UpdateKnowledgeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  relatedKnowledgeIds?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge Item Response DTO
 */
export class KnowledgeItemDto extends AuditFieldsDto {
  @IsUUID()
  id: string;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsBoolean()
  isPublic: boolean;

  @IsArray()
  @IsUUID('4', { each: true })
  relatedKnowledgeIds: string[];

  @IsEnum(KnowledgeItemStatus)
  status: KnowledgeItemStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge List Query DTO
 */
export class ListKnowledgeQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPublic?: boolean;

  @IsOptional()
  @IsEnum(KnowledgeSortBy)
  sortBy?: KnowledgeSortBy = KnowledgeSortBy.CREATED_AT;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}

/**
 * Paginated Knowledge List Response
 */
export class PaginatedKnowledgeListDto {
  @ValidateNested({ each: true })
  @Type(() => KnowledgeItemDto)
  items: KnowledgeItemDto[];

  @ValidateNested()
  @Type(() => PaginationMetadataDto)
  pagination: PaginationMetadataDto;
}

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Advanced Search Query DTO
 */
export class AdvancedSearchQueryDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  categoryIds?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsISO8601()
  createdAfter?: string;

  @IsOptional()
  @IsISO8601()
  createdBefore?: string;

  @IsOptional()
  @IsISO8601()
  updatedAfter?: string;

  @IsOptional()
  @IsISO8601()
  updatedBefore?: string;

  @IsOptional()
  @IsString()
  authors?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  hasRelationships?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(SearchSortBy)
  sortBy?: SearchSortBy = SearchSortBy.RELEVANCE;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}

/**
 * Search Result Item
 */
export class SearchResultItemDto {
  @IsUUID()
  id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsNumber()
  @Min(0)
  @Max(1)
  relevanceScore: number;

  @IsDateString()
  createdAt: string;

  @IsDateString()
  updatedAt: string;
}

/**
 * Search Facet for filtering
 */
export class SearchFacetDto {
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  count: number;
}

/**
 * Search Results Response
 */
export class SearchResultsDto {
  @ValidateNested({ each: true })
  @Type(() => SearchResultItemDto)
  items: SearchResultItemDto[];

  @ValidateNested()
  @Type(() => PaginationMetadataDto)
  pagination: PaginationMetadataDto;

  @IsObject()
  facets: {
    categories?: SearchFacetDto[];
    tags?: SearchFacetDto[];
  };
}

/**
 * Related Knowledge Response
 */
export class RelatedKnowledgeDto {
  @IsUUID()
  knowledgeId: string;

  @ValidateNested({ each: true })
  @Type(() => SearchResultItemDto)
  related: SearchResultItemDto[];

  @IsNumber()
  @Min(1)
  @Max(3)
  depth: number;
}

// ============================================================================
// CATEGORY SCHEMAS
// ============================================================================

/**
 * Create Category DTO
 */
export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

/**
 * Update Category DTO
 */
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

/**
 * Category Response DTO
 */
export class CategoryDto extends AuditFieldsDto {
  @IsUUID()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsNumber()
  @Min(0)
  itemCount: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryDto)
  children: CategoryDto[];
}

/**
 * Category List Response
 */
export class CategoryListDto {
  @ValidateNested({ each: true })
  @Type(() => CategoryDto)
  items: CategoryDto[];

  @ValidateNested()
  @Type(() => PaginationMetadataDto)
  pagination: PaginationMetadataDto;
}

// ============================================================================
// TAG SCHEMAS
// ============================================================================

/**
 * Create Tag DTO
 */
export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}

/**
 * Tag Response DTO
 */
export class TagDto {
  @IsUUID()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsNumber()
  @Min(0)
  usageCount: number;

  @IsDateString()
  createdAt: string;
}

/**
 * Tag List Response
 */
export class TagListDto {
  @ValidateNested({ each: true })
  @Type(() => TagDto)
  items: TagDto[];
}

/**
 * List Tags Query DTO
 */
export class ListTagsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minUsage?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit?: number = 100;
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Bulk Operation Request DTO
 */
export class BulkOperationDto {
  @IsEnum(BulkOperationType)
  operation: BulkOperationType;

  @IsArray()
  @IsUUID('4', { each: true })
  knowledgeIds: string[];

  @IsOptional()
  @IsObject()
  parameters?: {
    categoryId?: string;
    tags?: string[];
  };
}

/**
 * Bulk Operation Result Item
 */
export class BulkOperationResultItemDto {
  @IsUUID()
  knowledgeId: string;

  @IsBoolean()
  success: boolean;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsObject()
  result?: Record<string, unknown>;
}

/**
 * Bulk Operation Result Response
 */
export class BulkOperationResultDto {
  @IsEnum(BulkOperationType)
  operation: BulkOperationType;

  @IsNumber()
  @Min(0)
  totalCount: number;

  @IsNumber()
  @Min(0)
  successCount: number;

  @IsNumber()
  @Min(0)
  failureCount: number;

  @ValidateNested({ each: true })
  @Type(() => BulkOperationResultItemDto)
  results: BulkOperationResultItemDto[];
}

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

/**
 * Export Query DTO
 */
export class ExportQueryDto {
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeMetadata?: boolean = true;

  @IsOptional()
  @IsString()
  categoryIds?: string;
}

/**
 * Import Result DTO
 */
export class ImportResultDto {
  @IsNumber()
  @Min(0)
  totalCount: number;

  @IsNumber()
  @Min(0)
  successCount: number;

  @IsNumber()
  @Min(0)
  failureCount: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkOperationResultItemDto)
  results: BulkOperationResultItemDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ErrorDetailDto)
  errors?: ErrorDetailDto[];
}

// ============================================================================
// AUDIT LOG
// ============================================================================

/**
 * Audit Log Entry DTO
 */
export class AuditLogEntryDto {
  @IsUUID()
  id: string;

  @IsUUID()
  knowledgeId: string;

  @IsUUID()
  userId: string;

  @IsEnum(AuditOperation)
  operation: AuditOperation;

  @IsObject()
  changes: Record<string, unknown>;

  @IsDateString()
  timestamp: string;

  @IsString()
  ipAddress?: string;

  @IsString()
  userAgent?: string;
}

/**
 * Audit Log Query DTO
 */
export class AuditLogQueryDto {
  @IsOptional()
  @IsUUID()
  knowledgeId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(AuditOperation)
  operation?: AuditOperation;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;
}

/**
 * Audit Log Response
 */
export class AuditLogDto {
  @ValidateNested({ each: true })
  @Type(() => AuditLogEntryDto)
  entries: AuditLogEntryDto[];

  @ValidateNested()
  @Type(() => PaginationMetadataDto)
  pagination: PaginationMetadataDto;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Knowledge Statistics DTO
 */
export class KnowledgeStatisticsDto {
  @IsNumber()
  @Min(0)
  totalItems: number;

  @IsNumber()
  @Min(0)
  publishedItems: number;

  @IsNumber()
  @Min(0)
  draftItems: number;

  @IsNumber()
  @Min(0)
  archivedItems: number;

  @IsNumber()
  @Min(0)
  totalCategories: number;

  @IsNumber()
  @Min(0)
  totalTags: number;

  @IsNumber()
  @Min(0)
  totalRelationships: number;

  @IsNumber()
  @Min(0)
  averageItemsPerCategory: number;

  @IsObject()
  timeSeriesData: {
    date: string;
    itemsCreated: number;
    itemsUpdated: number;
  }[];

  @ValidateNested({ each: true })
  @Type(() => SearchFacetDto)
  topCategories: SearchFacetDto[];

  @ValidateNested({ each: true })
  @Type(() => SearchFacetDto)
  topTags: SearchFacetDto[];

  @IsNumber()
  @Min(0)
  @Max(1)
  avgSearchRelevance: number;

  @IsDateString()
  lastUpdated: string;
}

// ============================================================================
// API VERSION INFO
// ============================================================================

/**
 * API Info Response
 */
export class ApiInfoDto {
  @IsString()
  version: string = 'v1';

  @IsString()
  title: string = 'Knowledge Management API';

  @IsString()
  description: string = 'REST API for managing knowledge artifacts';

  @IsDateString()
  releaseDate: string;

  @ValidateNested({ each: true })
  @Type(() => Object)
  endpoints: {
    knowledge: string[];
    categories: string[];
    tags: string[];
    search: string[];
    admin: string[];
  };
}
