import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { KnowledgeExtractionService } from './services/knowledge-extraction.service';
import { CreateKnowledgeExtractionDto } from './dto/create-knowledge-extraction.dto';
import { UpdateKnowledgeExtractionDto } from './dto/update-knowledge-extraction.dto';
import { KnowledgeItem } from './entities/knowledge-item.entity';

/**
 * KnowledgeExtractionController
 *
 * REST API controller for knowledge extraction and management.
 * Provides complete CRUD endpoints for managing knowledge items,
 * including retrieval with pagination, full-text search, and filtering.
 *
 * Endpoints:
 * - POST /knowledge/extract - Trigger extraction (create knowledge item)
 * - GET /knowledge - Retrieve with pagination and filtering
 * - PUT /knowledge/:id - Update knowledge item
 * - DELETE /knowledge/:id - Delete knowledge item
 *
 * Features:
 * - Request validation using class-validator DTOs
 * - Comprehensive error handling (404, 400, 500)
 * - Pagination support for large result sets
 * - Search and filtering capabilities
 * - Proper HTTP status codes and response formatting
 */
@Controller('knowledge')
export class KnowledgeExtractionController {
  constructor(
    private readonly knowledgeExtractionService: KnowledgeExtractionService,
  ) {}

  /**
   * POST /knowledge/extract
   *
   * Trigger extraction and create a new knowledge item.
   */
  @Post('extract')
  @HttpCode(HttpStatus.CREATED)
  async createKnowledge(
    @Body(new ValidationPipe({ transform: true }))
    createDto: CreateKnowledgeExtractionDto,
  ): Promise<KnowledgeItem> {
    try {
      // Set extractedAt to current time if not provided
      const extractedAt = createDto.extractedAt
        ? new Date(createDto.extractedAt)
        : new Date();

      return await this.knowledgeExtractionService.create({
        ...createDto,
        extractedAt,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * GET /knowledge
   *
   * Retrieve knowledge items with pagination, filtering, and search.
   * Query parameters:
   * - organizationId (required): Filter by organization
   * - page (optional): Page number for pagination (default: 1)
   * - limit (optional): Items per page (default: 10, max: 100)
   * - types (optional): Comma-separated knowledge types to filter by
   * - search (optional): Text search in knowledge content
   * - startDate (optional): ISO date string for date range start
   * - endDate (optional): ISO date string for date range end
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getKnowledge(
    @Query('organizationId') organizationId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('types') types?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    try {
      // Validate required parameter
      if (!organizationId) {
        throw new BadRequestException('organizationId is required');
      }

      // Parse pagination parameters
      const parsedPage = page ? Math.max(1, parseInt(page, 10)) : 1;
      const parsedLimit = limit
        ? Math.min(100, Math.max(1, parseInt(limit, 10)))
        : 10;

      // Validate pagination values are numbers
      if (isNaN(parsedPage) || isNaN(parsedLimit)) {
        throw new BadRequestException('page and limit must be valid numbers');
      }

      // Parse optional filters
      const typeArray = types
        ? types.split(',').map((t) => t.trim())
        : undefined;

      const parsedStartDate = startDate ? new Date(startDate) : undefined;
      const parsedEndDate = endDate ? new Date(endDate) : undefined;

      // Validate dates if provided
      if (parsedStartDate && isNaN(parsedStartDate.getTime())) {
        throw new BadRequestException('startDate must be a valid ISO date');
      }
      if (parsedEndDate && isNaN(parsedEndDate.getTime())) {
        throw new BadRequestException('endDate must be a valid ISO date');
      }

      // Build filter object
      const filters = {
        organizationId,
        ...(typeArray && typeArray.length > 0 && { types: typeArray }),
        ...(search && { searchTerm: search }),
        ...(parsedStartDate && { startDate: parsedStartDate }),
        ...(parsedEndDate && { endDate: parsedEndDate }),
        limit: parsedLimit,
        offset: (parsedPage - 1) * parsedLimit,
      };

      // Execute filtered search
      const [items, total] = await Promise.all([
        this.knowledgeExtractionService.searchWithFilters(filters),
        this.knowledgeExtractionService.countWithFilters({
          organizationId,
          ...(typeArray && typeArray.length > 0 && { types: typeArray }),
          ...(search && { searchTerm: search }),
          ...(parsedStartDate && { startDate: parsedStartDate }),
          ...(parsedEndDate && { endDate: parsedEndDate }),
        }),
      ]);

      const totalPages = Math.ceil(total / parsedLimit);

      return {
        items,
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * PUT /knowledge/:id
   *
   * Update a knowledge item by ID.
   * Allows partial updates of knowledge items.
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateKnowledge(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, skipMissingProperties: true }))
    updateDto: UpdateKnowledgeExtractionDto,
  ): Promise<KnowledgeItem> {
    try {
      // Validate UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new BadRequestException('Invalid knowledge item ID format');
      }

      // Parse extractedAt if provided
      const updateData = { ...updateDto };
      if (updateDto.extractedAt) {
        updateData.extractedAt = new Date(updateDto.extractedAt);
      }

      const result = await this.knowledgeExtractionService.update(
        id,
        updateData,
      );

      if (!result) {
        throw new NotFoundException(`Knowledge item with ID ${id} not found`);
      }

      return result;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * DELETE /knowledge/:id
   *
   * Delete a knowledge item by ID.
   * Permanently removes the knowledge item from the database.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteKnowledge(@Param('id') id: string): Promise<void> {
    try {
      // Validate UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new BadRequestException('Invalid knowledge item ID format');
      }

      const deleted = await this.knowledgeExtractionService.delete(id);

      if (!deleted) {
        throw new NotFoundException(`Knowledge item with ID ${id} not found`);
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
