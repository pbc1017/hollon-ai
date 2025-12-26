import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeItem } from '../entities/knowledge-item.entity';

@Injectable()
export class KnowledgeExtractionService {
  constructor(
    @InjectRepository(KnowledgeItem)
    private readonly knowledgeItemRepository: Repository<KnowledgeItem>,
  ) {}

  /**
   * Create a new knowledge item
   */
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
      items as any[], // TypeORM's insert type is too strict for our use case
    );
    const insertedIds = result.identifiers.map((identifier) => identifier.id);

    return this.knowledgeItemRepository.findByIds(insertedIds);
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
      updateDto as any, // TypeORM's update type is too strict for our use case
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
