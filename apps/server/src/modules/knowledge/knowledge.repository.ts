import { Injectable } from '@nestjs/common';
import { DataSource, Repository, Between, ILike } from 'typeorm';
import { Knowledge, KnowledgeType } from './entities/knowledge.entity';

/**
 * Custom repository for Knowledge entity operations
 * Extends TypeORM Repository to provide domain-specific query methods
 */
@Injectable()
export class KnowledgeRepository extends Repository<Knowledge> {
  constructor(private dataSource: DataSource) {
    super(Knowledge, dataSource.createEntityManager());
  }

  /**
   * Creates a new knowledge entry
   * @param data - The knowledge data to create
   * @returns The created knowledge entity
   */
  async createKnowledge(data: {
    content: string;
    type: KnowledgeType;
    source: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<Knowledge> {
    const knowledge = this.create(data);
    return this.save(knowledge);
  }

  /**
   * Finds a knowledge entry by ID
   * @param id - The UUID of the knowledge entry
   * @returns The knowledge entity or null if not found
   */
  async findById(id: string): Promise<Knowledge | null> {
    return this.findOne({ where: { id } });
  }

  /**
   * Retrieves all knowledge entries with optional pagination
   * @param options - Optional pagination parameters
   * @returns Array of knowledge entities
   */
  async findAll(options?: {
    skip?: number;
    take?: number;
  }): Promise<Knowledge[]> {
    return this.find({
      skip: options?.skip,
      take: options?.take,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Updates a knowledge entry
   * @param id - The UUID of the knowledge entry to update
   * @param data - The updated knowledge data
   * @returns The updated knowledge entity or null if not found
   */
  async updateKnowledge(
    id: string,
    data: {
      content?: string;
      type?: KnowledgeType;
      source?: string;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<Knowledge | null> {
    const knowledge = await this.findById(id);
    if (!knowledge) {
      return null;
    }

    Object.assign(knowledge, data);
    return this.save(knowledge);
  }

  /**
   * Deletes a knowledge entry
   * @param id - The UUID of the knowledge entry to delete
   * @returns True if deleted, false if not found
   */
  async deleteKnowledge(id: string): Promise<boolean> {
    const result = await this.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Finds knowledge entries by tags stored in metadata
   * @param tags - Array of tag strings to search for
   * @returns Array of matching knowledge entities
   */
  async findByTags(tags: string[]): Promise<Knowledge[]> {
    const queryBuilder = this.createQueryBuilder('knowledge');

    // Search for tags in the metadata JSONB field
    // Assumes metadata has a 'tags' array field
    tags.forEach((tag, index) => {
      if (index === 0) {
        queryBuilder.where(`knowledge.metadata @> :metadata${index}`, {
          [`metadata${index}`]: JSON.stringify({ tags: [tag] }),
        });
      } else {
        queryBuilder.orWhere(`knowledge.metadata @> :metadata${index}`, {
          [`metadata${index}`]: JSON.stringify({ tags: [tag] }),
        });
      }
    });

    return queryBuilder.orderBy('knowledge.createdAt', 'DESC').getMany();
  }

  /**
   * Finds knowledge entries within a date range
   * @param startDate - Start date of the range
   * @param endDate - End date of the range
   * @returns Array of knowledge entities created within the date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<Knowledge[]> {
    return this.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Searches knowledge entries by content (case-insensitive)
   * @param searchTerm - The search term to look for in content
   * @returns Array of matching knowledge entities
   */
  async searchByContent(searchTerm: string): Promise<Knowledge[]> {
    return this.find({
      where: {
        content: ILike(`%${searchTerm}%`),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Finds knowledge entries by type
   * @param type - The knowledge type to filter by
   * @returns Array of knowledge entities of the specified type
   */
  async findByType(type: KnowledgeType): Promise<Knowledge[]> {
    return this.find({
      where: { type },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Finds knowledge entries by source
   * @param source - The source to filter by
   * @returns Array of knowledge entities from the specified source
   */
  async findBySource(source: string): Promise<Knowledge[]> {
    return this.find({
      where: { source },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Counts total knowledge entries
   * @returns Total count of knowledge entries
   */
  async countAll(): Promise<number> {
    return this.count();
  }

  /**
   * Finds recent knowledge entries
   * @param limit - Maximum number of entries to return
   * @returns Array of most recent knowledge entities
   */
  async findRecent(limit: number = 10): Promise<Knowledge[]> {
    return this.find({
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }
}
