import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryDeepPartialEntity } from 'typeorm';
import { KnowledgeItem } from '../entities/knowledge-item.entity';

@Injectable()
export class KnowledgeExtractionService {
  constructor(
    @InjectRepository(KnowledgeItem)
    private readonly knowledgeItemRepository: Repository<KnowledgeItem>,
  ) {}

  /**
   * Sanitize content by removing or escaping potentially dangerous characters
   * while preserving meaningful whitespace and structure
   */
  private sanitizeContent(content: string): string {
    if (!content) {
      return '';
    }

    // Remove null bytes and other control characters except newlines, tabs, and carriage returns
    // eslint-disable-next-line no-control-regex
    let sanitized = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Normalize multiple whitespace sequences but preserve intentional line breaks
    sanitized = sanitized.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs to single space
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n'); // Multiple newlines to max 2

    // Trim leading/trailing whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Validate and sanitize search term to prevent SQL injection
   */
  private sanitizeSearchTerm(searchTerm: string): string {
    if (!searchTerm) {
      return '';
    }

    // Remove SQL special characters that could be used for injection
    // Keep alphanumeric, spaces, and basic punctuation
    const sanitized = searchTerm.replace(/[^\w\s\-.,!?@#]/g, '');

    return sanitized.trim();
  }

  /**
   * Validate pagination parameters
   */
  private validatePaginationParams(
    page: number,
    limit: number,
  ): { page: number; limit: number } {
    const validPage = Math.max(1, Math.floor(page) || 1);
    const validLimit = Math.min(Math.max(1, Math.floor(limit) || 10), 100);

    return { page: validPage, limit: validLimit };
  }

  /**
   * Create a new knowledge item
   */
  async create(createDto: Partial<KnowledgeItem>): Promise<KnowledgeItem> {
    // Validate required fields
    if (!createDto.content || createDto.content.trim() === '') {
      throw new Error('Content is required and cannot be empty');
    }

    if (!createDto.source || createDto.source.trim() === '') {
      throw new Error('Source is required and cannot be empty');
    }

    if (!createDto.organizationId) {
      throw new Error('Organization ID is required');
    }

    // Sanitize content
    const sanitizedContent = this.sanitizeContent(createDto.content);
    if (sanitizedContent === '') {
      throw new Error('Content contains only invalid or whitespace characters');
    }

    // Validate content length (prevent extremely large content)
    if (sanitizedContent.length > 1000000) {
      // 1MB limit
      throw new Error('Content exceeds maximum allowed length (1MB)');
    }

    // Sanitize source
    const sanitizedSource = createDto.source.trim();
    if (sanitizedSource.length > 255) {
      throw new Error('Source exceeds maximum allowed length (255 characters)');
    }

    // Validate extractedAt date
    const extractedAt = createDto.extractedAt || new Date();
    if (extractedAt instanceof Date && isNaN(extractedAt.getTime())) {
      throw new Error('Invalid extractedAt date');
    }

    // Sanitize metadata if present
    let sanitizedMetadata: Record<string, unknown> | null = null;
    if (createDto.metadata) {
      try {
        // Ensure metadata is a valid object and can be serialized
        sanitizedMetadata =
          typeof createDto.metadata === 'object' && createDto.metadata !== null
            ? createDto.metadata
            : null;

        // Validate JSON serialization
        JSON.stringify(sanitizedMetadata);
      } catch (error) {
        throw new Error(
          `Invalid metadata: ${error instanceof Error ? error.message : 'Cannot serialize to JSON'}`,
        );
      }
    }

    const knowledgeItem = this.knowledgeItemRepository.create({
      ...createDto,
      content: sanitizedContent,
      source: sanitizedSource,
      extractedAt,
      metadata: sanitizedMetadata,
    });

    return this.knowledgeItemRepository.save(knowledgeItem);
  }

  /**
   * Batch insert knowledge items
   * Uses TypeORM's insert for optimized bulk operations
   */
  async batchInsert(items: Partial<KnowledgeItem>[]): Promise<KnowledgeItem[]> {
    // Handle empty array
    if (!items || items.length === 0) {
      return [];
    }

    // Validate and sanitize each item
    const sanitizedItems: Partial<KnowledgeItem>[] = [];
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      try {
        // Validate required fields
        if (!item.content || item.content.trim() === '') {
          errors.push(`Item ${i}: Content is required and cannot be empty`);
          continue;
        }

        if (!item.source || item.source.trim() === '') {
          errors.push(`Item ${i}: Source is required and cannot be empty`);
          continue;
        }

        if (!item.organizationId) {
          errors.push(`Item ${i}: Organization ID is required`);
          continue;
        }

        // Sanitize content
        const sanitizedContent = this.sanitizeContent(item.content);
        if (sanitizedContent === '') {
          errors.push(
            `Item ${i}: Content contains only invalid or whitespace characters`,
          );
          continue;
        }

        // Validate content length
        if (sanitizedContent.length > 1000000) {
          errors.push(
            `Item ${i}: Content exceeds maximum allowed length (1MB)`,
          );
          continue;
        }

        // Sanitize source
        const sanitizedSource = item.source.trim();
        if (sanitizedSource.length > 255) {
          errors.push(
            `Item ${i}: Source exceeds maximum allowed length (255 characters)`,
          );
          continue;
        }

        // Validate extractedAt date
        const extractedAt = item.extractedAt || new Date();
        if (extractedAt instanceof Date && isNaN(extractedAt.getTime())) {
          errors.push(`Item ${i}: Invalid extractedAt date`);
          continue;
        }

        // Sanitize metadata if present
        let sanitizedMetadata: Record<string, unknown> | null = null;
        if (item.metadata) {
          try {
            sanitizedMetadata =
              typeof item.metadata === 'object' && item.metadata !== null
                ? item.metadata
                : null;
            JSON.stringify(sanitizedMetadata);
          } catch (error) {
            errors.push(
              `Item ${i}: Invalid metadata - ${error instanceof Error ? error.message : 'Cannot serialize to JSON'}`,
            );
            continue;
          }
        }

        sanitizedItems.push({
          ...item,
          content: sanitizedContent,
          source: sanitizedSource,
          extractedAt,
          metadata: sanitizedMetadata,
        });
      } catch (error) {
        errors.push(
          `Item ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // If there are errors and no valid items, throw an error with all validation messages
    if (errors.length > 0 && sanitizedItems.length === 0) {
      throw new Error(`All items failed validation:\n${errors.join('\n')}`);
    }

    // If there are no valid items after filtering, return empty array
    if (sanitizedItems.length === 0) {
      return [];
    }

    // Log warnings if some items were skipped
    if (errors.length > 0) {
      console.warn(
        `Batch insert: ${errors.length} item(s) skipped due to validation errors:\n${errors.join('\n')}`,
      );
    }

    const result = await this.knowledgeItemRepository.insert(
      sanitizedItems as QueryDeepPartialEntity<KnowledgeItem>[],
    );
    const insertedIds = result.identifiers.map(
      (identifier) => identifier.id as string,
    );

    return this.knowledgeItemRepository.find({
      where: { id: In(insertedIds) },
    });
  }

  /**
   * Find a knowledge item by ID
   */
  async findById(id: string): Promise<KnowledgeItem | null> {
    // Validate ID format (basic UUID check)
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return null;
    }

    const trimmedId = id.trim();

    // Basic UUID format validation (optional but recommended)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedId)) {
      return null;
    }

    return this.knowledgeItemRepository.findOne({ where: { id: trimmedId } });
  }

  /**
   * Find all knowledge items for an organization
   * Uses index on organizationId for optimized query
   */
  async findByOrganization(organizationId: string): Promise<KnowledgeItem[]> {
    // Validate organizationId
    if (
      !organizationId ||
      typeof organizationId !== 'string' ||
      organizationId.trim() === ''
    ) {
      return [];
    }

    const trimmedOrgId = organizationId.trim();

    // Basic UUID format validation
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedOrgId)) {
      return [];
    }

    return this.knowledgeItemRepository.find({
      where: { organizationId: trimmedOrgId },
      order: { extractedAt: 'DESC' },
    });
  }

  /**
   * Find knowledge items by source
   * Uses index on source for optimized query
   */
  async findBySource(
    organizationId: string,
    source: string,
  ): Promise<KnowledgeItem[]> {
    // Validate inputs
    if (
      !organizationId ||
      typeof organizationId !== 'string' ||
      organizationId.trim() === ''
    ) {
      return [];
    }

    if (!source || typeof source !== 'string' || source.trim() === '') {
      return [];
    }

    const trimmedOrgId = organizationId.trim();
    const trimmedSource = source.trim();

    // Validate organization ID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedOrgId)) {
      return [];
    }

    // Validate source length
    if (trimmedSource.length > 255) {
      return [];
    }

    return this.knowledgeItemRepository.find({
      where: { organizationId: trimmedOrgId, source: trimmedSource },
      order: { extractedAt: 'DESC' },
    });
  }

  /**
   * Find knowledge items extracted within a date range
   * Uses index on extractedAt for optimized query
   */
  async findByDateRange(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<KnowledgeItem[]> {
    // Validate inputs
    if (
      !organizationId ||
      typeof organizationId !== 'string' ||
      organizationId.trim() === ''
    ) {
      return [];
    }

    const trimmedOrgId = organizationId.trim();

    // Validate organization ID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedOrgId)) {
      return [];
    }

    // Validate dates
    if (
      !(startDate instanceof Date) ||
      isNaN(startDate.getTime()) ||
      !(endDate instanceof Date) ||
      isNaN(endDate.getTime())
    ) {
      throw new Error(
        'Invalid date range: startDate and endDate must be valid Date objects',
      );
    }

    // Ensure startDate is before endDate
    if (startDate > endDate) {
      throw new Error(
        'Invalid date range: startDate must be before or equal to endDate',
      );
    }

    return this.knowledgeItemRepository
      .createQueryBuilder('ki')
      .where('ki.organization_id = :organizationId', {
        organizationId: trimmedOrgId,
      })
      .andWhere('ki.extracted_at >= :startDate', { startDate })
      .andWhere('ki.extracted_at <= :endDate', { endDate })
      .orderBy('ki.extracted_at', 'DESC')
      .getMany();
  }

  /**
   * Search knowledge items by content
   * Uses PostgreSQL full-text search for optimized text matching
   */
  async searchByContent(
    organizationId: string,
    searchTerm: string,
  ): Promise<KnowledgeItem[]> {
    // Validate inputs
    if (
      !organizationId ||
      typeof organizationId !== 'string' ||
      organizationId.trim() === ''
    ) {
      return [];
    }

    if (
      !searchTerm ||
      typeof searchTerm !== 'string' ||
      searchTerm.trim() === ''
    ) {
      return [];
    }

    const trimmedOrgId = organizationId.trim();
    const sanitizedSearchTerm = this.sanitizeSearchTerm(searchTerm);

    // Validate organization ID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedOrgId)) {
      return [];
    }

    // Return empty if search term is empty after sanitization
    if (sanitizedSearchTerm === '') {
      return [];
    }

    // Limit search term length to prevent performance issues
    const limitedSearchTerm = sanitizedSearchTerm.substring(0, 200);

    return this.knowledgeItemRepository
      .createQueryBuilder('ki')
      .where('ki.organization_id = :organizationId', {
        organizationId: trimmedOrgId,
      })
      .andWhere('ki.content ILIKE :searchTerm', {
        searchTerm: `%${limitedSearchTerm}%`,
      })
      .orderBy('ki.extracted_at', 'DESC')
      .getMany();
  }

  /**
   * Update a knowledge item
   */
  async update(
    id: string,
    updateDto: Partial<KnowledgeItem>,
  ): Promise<KnowledgeItem | null> {
    // Validate ID
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error('ID is required');
    }

    const trimmedId = id.trim();

    // Validate ID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedId)) {
      throw new Error('Invalid ID format');
    }

    // Check if item exists
    const existingItem = await this.findById(trimmedId);
    if (!existingItem) {
      return null;
    }

    // Validate and sanitize update fields
    const sanitizedUpdate: Partial<KnowledgeItem> = {};

    if (updateDto.content !== undefined) {
      if (updateDto.content === null || updateDto.content.trim() === '') {
        throw new Error('Content cannot be empty');
      }

      const sanitizedContent = this.sanitizeContent(updateDto.content);
      if (sanitizedContent === '') {
        throw new Error(
          'Content contains only invalid or whitespace characters',
        );
      }

      if (sanitizedContent.length > 1000000) {
        throw new Error('Content exceeds maximum allowed length (1MB)');
      }

      sanitizedUpdate.content = sanitizedContent;
    }

    if (updateDto.source !== undefined) {
      if (updateDto.source === null || updateDto.source.trim() === '') {
        throw new Error('Source cannot be empty');
      }

      const sanitizedSource = updateDto.source.trim();
      if (sanitizedSource.length > 255) {
        throw new Error(
          'Source exceeds maximum allowed length (255 characters)',
        );
      }

      sanitizedUpdate.source = sanitizedSource;
    }

    if (updateDto.extractedAt !== undefined) {
      if (
        !(updateDto.extractedAt instanceof Date) ||
        isNaN(updateDto.extractedAt.getTime())
      ) {
        throw new Error('Invalid extractedAt date');
      }

      sanitizedUpdate.extractedAt = updateDto.extractedAt;
    }

    if (updateDto.metadata !== undefined) {
      if (updateDto.metadata === null) {
        sanitizedUpdate.metadata = null;
      } else {
        try {
          const sanitizedMetadata =
            typeof updateDto.metadata === 'object' &&
            updateDto.metadata !== null
              ? updateDto.metadata
              : null;

          // Validate JSON serialization
          JSON.stringify(sanitizedMetadata);
          sanitizedUpdate.metadata = sanitizedMetadata;
        } catch (error) {
          throw new Error(
            `Invalid metadata: ${error instanceof Error ? error.message : 'Cannot serialize to JSON'}`,
          );
        }
      }
    }

    // Only update if there are valid fields to update
    if (Object.keys(sanitizedUpdate).length === 0) {
      return existingItem;
    }

    await this.knowledgeItemRepository.update(
      trimmedId,
      sanitizedUpdate as QueryDeepPartialEntity<KnowledgeItem>,
    );

    return this.findById(trimmedId);
  }

  /**
   * Delete a knowledge item
   */
  async delete(id: string): Promise<boolean> {
    // Validate ID
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return false;
    }

    const trimmedId = id.trim();

    // Validate ID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedId)) {
      return false;
    }

    const result = await this.knowledgeItemRepository.delete(trimmedId);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Delete all knowledge items for an organization
   */
  async deleteByOrganization(organizationId: string): Promise<number> {
    // Validate organizationId
    if (
      !organizationId ||
      typeof organizationId !== 'string' ||
      organizationId.trim() === ''
    ) {
      return 0;
    }

    const trimmedOrgId = organizationId.trim();

    // Validate organization ID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedOrgId)) {
      return 0;
    }

    const result = await this.knowledgeItemRepository.delete({
      organizationId: trimmedOrgId,
    });
    return result.affected ?? 0;
  }

  /**
   * Count knowledge items for an organization
   */
  async countByOrganization(organizationId: string): Promise<number> {
    // Validate organizationId
    if (
      !organizationId ||
      typeof organizationId !== 'string' ||
      organizationId.trim() === ''
    ) {
      return 0;
    }

    const trimmedOrgId = organizationId.trim();

    // Validate organization ID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedOrgId)) {
      return 0;
    }

    return this.knowledgeItemRepository.count({
      where: { organizationId: trimmedOrgId },
    });
  }

  /**
   * Find knowledge items with pagination
   */
  async findWithPagination(
    organizationId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    items: KnowledgeItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Validate organizationId
    if (
      !organizationId ||
      typeof organizationId !== 'string' ||
      organizationId.trim() === ''
    ) {
      return {
        items: [],
        total: 0,
        page: 1,
        limit: 10,
      };
    }

    const trimmedOrgId = organizationId.trim();

    // Validate organization ID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedOrgId)) {
      return {
        items: [],
        total: 0,
        page: 1,
        limit: 10,
      };
    }

    // Validate and sanitize pagination parameters
    const { page: validPage, limit: validLimit } =
      this.validatePaginationParams(page, limit);

    const skip = (validPage - 1) * validLimit;

    const [items, total] = await this.knowledgeItemRepository.findAndCount({
      where: { organizationId: trimmedOrgId },
      order: { extractedAt: 'DESC' },
      skip,
      take: validLimit,
    });

    return {
      items,
      total,
      page: validPage,
      limit: validLimit,
    };
  }

  /**
   * Find the most recent knowledge items
   */
  async findRecent(
    organizationId: string,
    limit: number = 10,
  ): Promise<KnowledgeItem[]> {
    // Validate organizationId
    if (
      !organizationId ||
      typeof organizationId !== 'string' ||
      organizationId.trim() === ''
    ) {
      return [];
    }

    const trimmedOrgId = organizationId.trim();

    // Validate organization ID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedOrgId)) {
      return [];
    }

    // Validate limit
    const validLimit = Math.min(Math.max(1, Math.floor(limit) || 10), 100);

    return this.knowledgeItemRepository.find({
      where: { organizationId: trimmedOrgId },
      order: { extractedAt: 'DESC' },
      take: validLimit,
    });
  }

  /**
   * Get unique sources for an organization
   */
  async getUniqueSources(organizationId: string): Promise<string[]> {
    // Validate organizationId
    if (
      !organizationId ||
      typeof organizationId !== 'string' ||
      organizationId.trim() === ''
    ) {
      return [];
    }

    const trimmedOrgId = organizationId.trim();

    // Validate organization ID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedOrgId)) {
      return [];
    }

    const result = await this.knowledgeItemRepository
      .createQueryBuilder('ki')
      .select('DISTINCT ki.source', 'source')
      .where('ki.organization_id = :organizationId', {
        organizationId: trimmedOrgId,
      })
      .getRawMany();

    return result
      .map((r) => r.source)
      .filter((source) => source && source.trim() !== '');
  }
}
