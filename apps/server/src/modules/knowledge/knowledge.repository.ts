import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Knowledge, KnowledgeType } from './entities/knowledge.entity';

@Injectable()
export class KnowledgeRepository extends Repository<Knowledge> {
  constructor(dataSource: DataSource) {
    super(Knowledge, dataSource.createEntityManager());
  }

  /**
   * Find knowledge items by type with pagination
   */
  async findByType(
    type: KnowledgeType,
    limit = 10,
    offset = 0,
  ): Promise<Knowledge[]> {
    return this.find({
      where: { type },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Find knowledge items by source with pagination
   */
  async findBySource(
    source: string,
    limit = 10,
    offset = 0,
  ): Promise<Knowledge[]> {
    return this.find({
      where: { source },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Find knowledge items by type and source
   */
  async findByTypeAndSource(
    type: KnowledgeType,
    source: string,
  ): Promise<Knowledge[]> {
    return this.find({
      where: { type, source },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Search knowledge content using full-text search
   */
  async searchByContent(searchTerm: string): Promise<Knowledge[]> {
    return this.createQueryBuilder('knowledge')
      .where('knowledge.content ILIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`,
      })
      .orderBy('knowledge.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Find recent knowledge items
   */
  async findRecent(limit = 10): Promise<Knowledge[]> {
    return this.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Count knowledge items by type
   */
  async countByType(type: KnowledgeType): Promise<number> {
    return this.count({
      where: { type },
    });
  }

  /**
   * Find knowledge items by metadata field
   */
  async findByMetadata(
    metadataKey: string,
    metadataValue: unknown,
  ): Promise<Knowledge[]> {
    return this.createQueryBuilder('knowledge')
      .where('knowledge.metadata->:key = :value', {
        key: metadataKey,
        value: JSON.stringify(metadataValue),
      })
      .orderBy('knowledge.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Bulk create knowledge items
   */
  async bulkCreate(knowledgeItems: Partial<Knowledge>[]): Promise<Knowledge[]> {
    const entities = this.create(knowledgeItems);
    return this.save(entities);
  }
}
