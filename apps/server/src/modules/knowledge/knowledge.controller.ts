import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { HybridSearchQueryDto } from './dto/hybrid-search-query.dto';
import { AdvancedSearchDto } from './dto/advanced-search.dto';

/**
 * Knowledge Search Controller
 *
 * Provides endpoints for searching knowledge documents using different strategies:
 * - Semantic search: Vector-based similarity search using embeddings
 * - Hybrid search: Combines semantic and keyword search with configurable weights
 * - Advanced search: Full-featured search with comprehensive filters and sorting
 *
 * Rate limiting: Default rate limits apply (configured globally)
 * - TODO: Add @Throttle() decorator when @nestjs/throttler is installed
 *
 * API Documentation:
 * - TODO: Add Swagger decorators (@ApiTags, @ApiOperation, @ApiResponse) when @nestjs/swagger is installed
 */
@Controller('knowledge')
export class KnowledgeController {
  private readonly logger = new Logger(KnowledgeController.name);

  constructor(private readonly knowledgeService: KnowledgeService) {}

  /**
   * GET /api/knowledge/search
   *
   * Semantic search endpoint using vector embeddings (pgvector)
   * Returns documents ranked by semantic similarity to the query
   *
   * Query Parameters:
   * - query (required): Search query string
   * - organizationId (optional): Filter by organization
   * - projectId (optional): Filter by project
   * - tags (optional): Filter by tags (array)
   * - limit (optional): Results per page (1-100, default: 10)
   * - offset (optional): Pagination offset (default: 0)
   *
   * Returns:
   * - 200: Search results with pagination metadata
   * - 400: Invalid query parameters (validation error)
   *
   * Swagger Documentation (when @nestjs/swagger is installed):
   * @ApiTags('knowledge')
   * @ApiOperation({ summary: 'Semantic search for knowledge documents' })
   * @ApiResponse({ status: 200, description: 'Search results returned successfully' })
   * @ApiResponse({ status: 400, description: 'Invalid query parameters' })
   * @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
   */
  @Get('search')
  @HttpCode(HttpStatus.OK)
  async semanticSearch(@Query() query: SearchQueryDto) {
    this.logger.log(`Semantic search request: "${query.query}"`);

    const result = await this.knowledgeService.semanticSearch(query);

    this.logger.log(
      `Semantic search completed: ${result.documents.length}/${result.total} results`,
    );

    return result;
  }

  /**
   * GET /api/knowledge/search/hybrid
   *
   * Hybrid search combining semantic (vector) and keyword search
   * Allows configurable weighting between semantic and keyword relevance
   *
   * Query Parameters:
   * - query (required): Search query string
   * - organizationId (optional): Filter by organization
   * - projectId (optional): Filter by project
   * - tags (optional): Filter by tags (array)
   * - semanticWeight (optional): Weight for semantic similarity (0-1, default: 0.7)
   * - keywordWeight (optional): Weight for keyword matching (0-1, default: 0.3)
   * - limit (optional): Results per page (1-100, default: 10)
   * - offset (optional): Pagination offset (default: 0)
   *
   * Note: semanticWeight + keywordWeight should equal 1.0
   *
   * Returns:
   * - 200: Hybrid search results with pagination metadata
   * - 400: Invalid query parameters (validation error)
   *
   * Swagger Documentation (when @nestjs/swagger is installed):
   * @ApiTags('knowledge')
   * @ApiOperation({ summary: 'Hybrid search combining semantic and keyword search' })
   * @ApiResponse({ status: 200, description: 'Hybrid search results returned successfully' })
   * @ApiResponse({ status: 400, description: 'Invalid query parameters' })
   * @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
   */
  @Get('search/hybrid')
  @HttpCode(HttpStatus.OK)
  async hybridSearch(@Query() query: HybridSearchQueryDto) {
    this.logger.log(
      `Hybrid search request: "${query.query}" ` +
        `(semantic: ${query.semanticWeight ?? 0.7}, keyword: ${query.keywordWeight ?? 0.3})`,
    );

    const result = await this.knowledgeService.hybridSearch(query);

    this.logger.log(
      `Hybrid search completed: ${result.documents.length}/${result.total} results`,
    );

    return result;
  }

  /**
   * POST /api/knowledge/search/advanced
   *
   * Advanced search with comprehensive filters and sorting options
   * Supports complex queries with date ranges, document types, and custom sorting
   *
   * Request Body (AdvancedSearchDto):
   * - query (required): Search query string
   * - organizationId (optional): Filter by organization
   * - projectId (optional): Filter by project (null for org-level docs)
   * - teamId (optional): Filter by team
   * - tags (optional): Filter by tags (array)
   * - type (optional): Filter by document type (enum)
   * - createdAfter (optional): Filter by creation date (ISO string)
   * - createdBefore (optional): Filter by creation date (ISO string)
   * - updatedAfter (optional): Filter by update date (ISO string)
   * - updatedBefore (optional): Filter by update date (ISO string)
   * - includeEmbeddings (optional): Include embedding vectors in response (default: false)
   * - sortBy (optional): Sort field (relevance, created_at, updated_at, title)
   * - sortOrder (optional): Sort order (ASC, DESC)
   * - limit (optional): Results per page (1-100, default: 10)
   * - offset (optional): Pagination offset (default: 0)
   *
   * Returns:
   * - 200: Advanced search results with pagination metadata
   * - 400: Invalid request body (validation error)
   *
   * Swagger Documentation (when @nestjs/swagger is installed):
   * @ApiTags('knowledge')
   * @ApiOperation({ summary: 'Advanced search with comprehensive filters' })
   * @ApiResponse({ status: 200, description: 'Advanced search results returned successfully' })
   * @ApiResponse({ status: 400, description: 'Invalid request body' })
   * @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
   */
  @Post('search/advanced')
  @HttpCode(HttpStatus.OK)
  async advancedSearch(@Body() body: AdvancedSearchDto) {
    this.logger.log(
      `Advanced search request: "${body.query}" ` +
        `(filters: ${JSON.stringify({
          type: body.type,
          tags: body.tags,
          dateRange: body.createdAfter || body.createdBefore ? 'yes' : 'no',
        })})`,
    );

    const result = await this.knowledgeService.advancedSearch(body);

    this.logger.log(
      `Advanced search completed: ${result.documents.length}/${result.total} results`,
    );

    return result;
  }
}
