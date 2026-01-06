import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryDeepPartialEntity } from 'typeorm';
import { KnowledgeItem } from '../entities/knowledge-item.entity';

@Injectable()
export class KnowledgeExtractionService {
  private readonly logger = new Logger(KnowledgeExtractionService.name);

  constructor(
    @InjectRepository(KnowledgeItem)
    private readonly knowledgeItemRepository: Repository<KnowledgeItem>,
  ) {}

  /**
   * Create a new knowledge item
   */
  /**
   * Extract text content from a message and prepare it for knowledge storage
   * Handles various message formats and edge cases
   */
  extractTextFromMessage(
    message: {
      content: string;
      id?: string;
      conversationId?: string;
      messageType?: string;
      metadata?: Record<string, any>;
      createdAt?: Date;
    },
    organizationId: string,
  ): Partial<KnowledgeItem> | null {
    // Handle empty or invalid content
    if (!message.content || typeof message.content !== 'string') {
      return null;
    }

    // Trim and normalize whitespace
    const normalizedContent = message.content.trim().replace(/\s+/g, ' ');

    // Skip if content is empty after normalization
    if (normalizedContent.length === 0) {
      return null;
    }

    // Build metadata combining message metadata with extraction info
    const extractionMetadata: Record<string, any> = {
      messageId: message.id,
      conversationId: message.conversationId,
      messageType: message.messageType,
      originalCreatedAt: message.createdAt,
      extractedLength: normalizedContent.length,
      ...(message.metadata || {}),
    };

    // Construct knowledge item
    const knowledgeItem: Partial<KnowledgeItem> = {
      content: normalizedContent,
      source: message.conversationId
        ? `conversation:${message.conversationId}`
        : 'message',
      extractedAt: new Date(),
      metadata: extractionMetadata,
      organizationId,
    };

    return knowledgeItem;
  }

  /**
   * Extract text content from multiple messages in batch
   * Filters out invalid messages and returns only valid knowledge items
   */
  extractTextFromMessages(
    messages: Array<{
      content: string;
      id?: string;
      conversationId?: string;
      messageType?: string;
      metadata?: Record<string, any>;
      createdAt?: Date;
    }>,
    organizationId: string,
  ): Partial<KnowledgeItem>[] {
    if (!Array.isArray(messages) || messages.length === 0) {
      return [];
    }

    return messages
      .map((message) => this.extractTextFromMessage(message, organizationId))
      .filter((item): item is Partial<KnowledgeItem> => item !== null);
  }

  async create(createDto: Partial<KnowledgeItem>): Promise<KnowledgeItem> {
    const knowledgeItem = this.knowledgeItemRepository.create(createDto);
    return this.knowledgeItemRepository.save(knowledgeItem);
  }

  /**
   * Batch insert knowledge items
   * Uses TypeORM's insert for optimized bulk operations
   */
  async batchInsert(items: Partial<KnowledgeItem>[]): Promise<KnowledgeItem[]> {
    if (items.length === 0) {
      return [];
    }

    const result = await this.knowledgeItemRepository.insert(
      items as QueryDeepPartialEntity<KnowledgeItem>[],
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
    return this.knowledgeItemRepository.findOne({ where: { id } });
  }

  /**
   * Find all knowledge items for an organization
   * Uses index on organizationId for optimized query
   */
  async findByOrganization(organizationId: string): Promise<KnowledgeItem[]> {
    return this.knowledgeItemRepository.find({
      where: { organizationId },
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
    return this.knowledgeItemRepository.find({
      where: { organizationId, source },
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
    return this.knowledgeItemRepository
      .createQueryBuilder('ki')
      .where('ki.organization_id = :organizationId', { organizationId })
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
    return this.knowledgeItemRepository
      .createQueryBuilder('ki')
      .where('ki.organization_id = :organizationId', { organizationId })
      .andWhere('ki.content ILIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`,
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
    await this.knowledgeItemRepository.update(
      id,
      updateDto as QueryDeepPartialEntity<KnowledgeItem>,
    );
    return this.findById(id);
  }

  /**
   * Delete a knowledge item
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.knowledgeItemRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Delete all knowledge items for an organization
   */
  async deleteByOrganization(organizationId: string): Promise<number> {
    const result = await this.knowledgeItemRepository.delete({
      organizationId,
    });
    return result.affected ?? 0;
  }

  /**
   * Count knowledge items for an organization
   */
  async countByOrganization(organizationId: string): Promise<number> {
    return this.knowledgeItemRepository.count({
      where: { organizationId },
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
    const skip = (page - 1) * limit;

    const [items, total] = await this.knowledgeItemRepository.findAndCount({
      where: { organizationId },
      order: { extractedAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * Find the most recent knowledge items
   */
  async findRecent(
    organizationId: string,
    limit: number = 10,
  ): Promise<KnowledgeItem[]> {
    return this.knowledgeItemRepository.find({
      where: { organizationId },
      order: { extractedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get unique sources for an organization
   */
  async getUniqueSources(organizationId: string): Promise<string[]> {
    const result = await this.knowledgeItemRepository
      .createQueryBuilder('ki')
      .select('DISTINCT ki.source', 'source')
      .where('ki.organization_id = :organizationId', { organizationId })
      .getRawMany();

    return result.map((r) => r.source);
  }
}
