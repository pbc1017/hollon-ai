import { Injectable } from '@nestjs/common';
import { DataSource, Repository, In } from 'typeorm';
import { KnowledgeItem } from '../entities/knowledge-item.entity';
import {
  IKnowledgeExtractionRepository,
  KnowledgeExtractionQueryOptions,
  PaginatedKnowledgeExtractionResult,
} from '../interfaces/knowledge-extraction-repository.interface';

@Injectable()
export class KnowledgeExtractionRepository
  extends Repository<KnowledgeItem>
  implements IKnowledgeExtractionRepository
{
  constructor(dataSource: DataSource) {
    super(KnowledgeItem, dataSource.createEntityManager());
  }

  async findById(id: string): Promise<KnowledgeItem | null> {
    return this.findOne({ where: { id } });
  }

  async findAll(organizationId: string): Promise<KnowledgeItem[]> {
    return this.find({
      where: { organizationId },
      order: { extractedAt: 'DESC' },
    });
  }

  async findAllPaginated(
    options: KnowledgeExtractionQueryOptions,
  ): Promise<PaginatedKnowledgeExtractionResult> {
    const {
      organizationId,
      types,
      searchText,
      dateRange,
      pagination = { page: 1, limit: 10 },
      sort = { field: 'extractedAt', order: 'DESC' },
    } = options;

    const query = this.createQueryBuilder('ki').where(
      'ki.organization_id = :organizationId',
      { organizationId },
    );

    if (types && types.length > 0) {
      query.andWhere('ki.type IN (:...types)', { types });
    }

    if (searchText) {
      query.andWhere('ki.content ILIKE :searchText', {
        searchText: `%${searchText}%`,
      });
    }

    if (dateRange) {
      query.andWhere('ki.extracted_at >= :startDate', {
        startDate: dateRange.start,
      });
      query.andWhere('ki.extracted_at <= :endDate', {
        endDate: dateRange.end,
      });
    }

    const sortField = `ki.${sort.field.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
    query.orderBy(sortField, sort.order);

    const skip = (pagination.page - 1) * pagination.limit;
    query.skip(skip).take(pagination.limit);

    const [items, total] = await query.getManyAndCount();
    const totalPages = Math.ceil(total / pagination.limit);

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrevious: pagination.page > 1,
    };
  }

  async update(
    id: string,
    data: Partial<KnowledgeItem>,
  ): Promise<KnowledgeItem | null> {
    await super.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await super.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async findByType(
    organizationId: string,
    type: string,
  ): Promise<KnowledgeItem[]> {
    return this.find({
      where: { organizationId, type },
      order: { extractedAt: 'DESC' },
    });
  }

  async findByTypes(
    organizationId: string,
    types: string[],
  ): Promise<KnowledgeItem[]> {
    if (types.length === 0) {
      return [];
    }

    return this.createQueryBuilder('ki')
      .where('ki.organization_id = :organizationId', { organizationId })
      .andWhere('ki.type IN (:...types)', { types })
      .orderBy('ki.extracted_at', 'DESC')
      .getMany();
  }

  async searchByContent(
    organizationId: string,
    searchText: string,
  ): Promise<KnowledgeItem[]> {
    return this.createQueryBuilder('ki')
      .where('ki.organization_id = :organizationId', { organizationId })
      .andWhere('ki.content ILIKE :searchText', {
        searchText: `%${searchText}%`,
      })
      .orderBy('ki.extracted_at', 'DESC')
      .getMany();
  }

  async searchByContentPaginated(
    organizationId: string,
    searchText: string,
    options: KnowledgeExtractionQueryOptions,
  ): Promise<PaginatedKnowledgeExtractionResult> {
    const {
      pagination = { page: 1, limit: 10 },
      sort = { field: 'extractedAt', order: 'DESC' },
    } = options;

    const query = this.createQueryBuilder('ki')
      .where('ki.organization_id = :organizationId', { organizationId })
      .andWhere('ki.content ILIKE :searchText', {
        searchText: `%${searchText}%`,
      });

    const sortField = `ki.${sort.field.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
    query.orderBy(sortField, sort.order);

    const skip = (pagination.page - 1) * pagination.limit;
    query.skip(skip).take(pagination.limit);

    const [items, total] = await query.getManyAndCount();
    const totalPages = Math.ceil(total / pagination.limit);

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrevious: pagination.page > 1,
    };
  }

  async findByDateRange(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<KnowledgeItem[]> {
    return this.createQueryBuilder('ki')
      .where('ki.organization_id = :organizationId', { organizationId })
      .andWhere('ki.extracted_at >= :startDate', { startDate })
      .andWhere('ki.extracted_at <= :endDate', { endDate })
      .orderBy('ki.extracted_at', 'DESC')
      .getMany();
  }

  async findByTypeAndDateRange(
    organizationId: string,
    type: string,
    startDate: Date,
    endDate: Date,
  ): Promise<KnowledgeItem[]> {
    return this.createQueryBuilder('ki')
      .where('ki.organization_id = :organizationId', { organizationId })
      .andWhere('ki.type = :type', { type })
      .andWhere('ki.extracted_at >= :startDate', { startDate })
      .andWhere('ki.extracted_at <= :endDate', { endDate })
      .orderBy('ki.extracted_at', 'DESC')
      .getMany();
  }

  async findByMetadata(
    organizationId: string,
    metadataQuery: Record<string, unknown>,
  ): Promise<KnowledgeItem[]> {
    return this.createQueryBuilder('ki')
      .where('ki.organization_id = :organizationId', { organizationId })
      .andWhere('ki.metadata @> :metadataQuery', {
        metadataQuery: JSON.stringify(metadataQuery),
      })
      .orderBy('ki.extracted_at', 'DESC')
      .getMany();
  }

  async findRecent(
    organizationId: string,
    limit: number = 10,
  ): Promise<KnowledgeItem[]> {
    return this.find({
      where: { organizationId },
      order: { extractedAt: 'DESC' },
      take: limit,
    });
  }

  async findExtractedAfter(
    organizationId: string,
    afterDate: Date,
    limit?: number,
  ): Promise<KnowledgeItem[]> {
    const query = this.createQueryBuilder('ki')
      .where('ki.organization_id = :organizationId', { organizationId })
      .andWhere('ki.extracted_at > :afterDate', { afterDate })
      .orderBy('ki.extracted_at', 'ASC');

    if (limit) {
      query.take(limit);
    }

    return query.getMany();
  }

  async findExtractedBefore(
    organizationId: string,
    beforeDate: Date,
    limit?: number,
  ): Promise<KnowledgeItem[]> {
    const query = this.createQueryBuilder('ki')
      .where('ki.organization_id = :organizationId', { organizationId })
      .andWhere('ki.extracted_at < :beforeDate', { beforeDate })
      .orderBy('ki.extracted_at', 'DESC');

    if (limit) {
      query.take(limit);
    }

    return query.getMany();
  }

  async count(organizationId: string): Promise<number> {
    return this.countEntity({ organizationId });
  }

  async countByType(organizationId: string): Promise<Record<string, number>> {
    const result = await this.createQueryBuilder('ki')
      .select('ki.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('ki.organization_id = :organizationId', { organizationId })
      .groupBy('ki.type')
      .getRawMany();

    return result.reduce(
      (acc, row) => {
        acc[row.type] = parseInt(row.count, 10);
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  async getUniqueTypes(organizationId: string): Promise<string[]> {
    const result = await this.createQueryBuilder('ki')
      .select('DISTINCT ki.type', 'type')
      .where('ki.organization_id = :organizationId', { organizationId })
      .getRawMany();

    return result.map((r) => r.type);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.countEntity({ id });
    return count > 0;
  }

  async bulkCreate(items: Partial<KnowledgeItem>[]): Promise<KnowledgeItem[]> {
    if (items.length === 0) {
      return [];
    }

    const entities = this.create(items);
    return this.save(entities);
  }

  async bulkDelete(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await super.delete({ id: In(ids) });
    return result.affected ?? 0;
  }

  async deleteByOrganization(organizationId: string): Promise<number> {
    const result = await super.delete({ organizationId });
    return result.affected ?? 0;
  }

  private countEntity(criteria: Record<string, unknown>): Promise<number> {
    return super.count({ where: criteria });
  }
}
