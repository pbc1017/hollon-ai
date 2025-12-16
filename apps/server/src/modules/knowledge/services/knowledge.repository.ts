import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  KnowledgeEntry,
  KnowledgeEntryType,
  KnowledgeCategory,
} from '../entities/knowledge-entry.entity';

export interface CreateKnowledgeEntryDto {
  title: string;
  content: string;
  type: KnowledgeEntryType;
  category: KnowledgeCategory;
  organizationId: string;
  teamId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  extractedByHollonId?: string | null;
  tags?: string[];
  sources?: {
    taskIds?: string[];
    documentIds?: string[];
    hollonIds?: string[];
  };
  confidenceScore?: number;
  metadata?: {
    codeSnippets?: string[];
    relatedFiles?: string[];
    dependencies?: string[];
    context?: Record<string, unknown>;
  };
}

export interface SearchKnowledgeOptions {
  organizationId: string;
  teamId?: string;
  projectId?: string;
  type?: KnowledgeEntryType;
  category?: KnowledgeCategory;
  tags?: string[];
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

@Injectable()
export class KnowledgeRepository {
  constructor(
    @InjectRepository(KnowledgeEntry)
    private readonly knowledgeRepo: Repository<KnowledgeEntry>,
  ) {}

  /**
   * Create a new knowledge entry
   */
  async create(dto: CreateKnowledgeEntryDto): Promise<KnowledgeEntry> {
    const entry = this.knowledgeRepo.create({
      title: dto.title,
      content: dto.content,
      type: dto.type,
      category: dto.category,
      organizationId: dto.organizationId,
      teamId: dto.teamId ?? null,
      projectId: dto.projectId ?? null,
      taskId: dto.taskId ?? null,
      extractedByHollonId: dto.extractedByHollonId ?? null,
      tags: dto.tags || [],
      sources: dto.sources || {},
      confidenceScore: dto.confidenceScore ?? 50,
      metadata: dto.metadata || {},
    });

    return this.knowledgeRepo.save(entry);
  }

  /**
   * Find knowledge entry by ID
   */
  async findOne(id: string): Promise<KnowledgeEntry> {
    const entry = await this.knowledgeRepo.findOne({
      where: { id },
      relations: [
        'organization',
        'team',
        'project',
        'task',
        'extractedByHollon',
      ],
    });

    if (!entry) {
      throw new NotFoundException(`Knowledge entry #${id} not found`);
    }

    return entry;
  }

  /**
   * Search knowledge entries with filters
   */
  async search(options: SearchKnowledgeOptions): Promise<KnowledgeEntry[]> {
    const query = this.knowledgeRepo
      .createQueryBuilder('ke')
      .where('ke.organization_id = :orgId', { orgId: options.organizationId });

    if (options.teamId) {
      query.andWhere('ke.team_id = :teamId', { teamId: options.teamId });
    }

    if (options.projectId) {
      query.andWhere('ke.project_id = :projectId', {
        projectId: options.projectId,
      });
    }

    if (options.type) {
      query.andWhere('ke.type = :type', { type: options.type });
    }

    if (options.category) {
      query.andWhere('ke.category = :category', { category: options.category });
    }

    if (options.tags && options.tags.length > 0) {
      query.andWhere('ke.tags && :tags', { tags: options.tags });
    }

    if (options.minConfidence !== undefined) {
      query.andWhere('ke.confidence_score >= :minConfidence', {
        minConfidence: options.minConfidence,
      });
    }

    if (options.limit) {
      query.limit(options.limit);
    }

    if (options.offset) {
      query.offset(options.offset);
    }

    return query.orderBy('ke.confidence_score', 'DESC').getMany();
  }

  /**
   * Find knowledge entries by tags
   */
  async findByTags(
    organizationId: string,
    tags: string[],
    options?: {
      teamId?: string;
      limit?: number;
    },
  ): Promise<KnowledgeEntry[]> {
    const query = this.knowledgeRepo
      .createQueryBuilder('ke')
      .where('ke.organization_id = :orgId', { orgId: organizationId })
      .andWhere('ke.tags && :tags', { tags });

    if (options?.teamId) {
      query.andWhere('ke.team_id = :teamId', { teamId: options.teamId });
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    return query
      .orderBy('ke.confidence_score', 'DESC')
      .addOrderBy('ke.application_count', 'DESC')
      .getMany();
  }

  /**
   * Find knowledge entries related to a task
   */
  async findByTask(taskId: string): Promise<KnowledgeEntry[]> {
    return this.knowledgeRepo.find({
      where: { taskId },
      order: { confidenceScore: 'DESC' },
    });
  }

  /**
   * Find knowledge entries extracted by a hollon
   */
  async findByHollon(hollonId: string): Promise<KnowledgeEntry[]> {
    return this.knowledgeRepo.find({
      where: { extractedByHollonId: hollonId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find recent best practices
   */
  async findBestPractices(
    organizationId: string,
    options?: {
      category?: KnowledgeCategory;
      limit?: number;
    },
  ): Promise<KnowledgeEntry[]> {
    const query = this.knowledgeRepo
      .createQueryBuilder('ke')
      .where('ke.organization_id = :orgId', { orgId: organizationId })
      .andWhere('ke.type = :type', {
        type: KnowledgeEntryType.BEST_PRACTICE,
      });

    if (options?.category) {
      query.andWhere('ke.category = :category', { category: options.category });
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    return query
      .orderBy('ke.application_count', 'DESC')
      .addOrderBy('ke.confidence_score', 'DESC')
      .getMany();
  }

  /**
   * Increment application count for a knowledge entry
   */
  async incrementApplicationCount(id: string): Promise<KnowledgeEntry> {
    const entry = await this.findOne(id);
    entry.applicationCount += 1;

    // Increase confidence score when knowledge is applied successfully
    if (entry.confidenceScore < 100) {
      entry.confidenceScore = Math.min(100, entry.confidenceScore + 2);
    }

    return this.knowledgeRepo.save(entry);
  }

  /**
   * Update knowledge entry
   */
  async update(
    id: string,
    updates: Partial<CreateKnowledgeEntryDto>,
  ): Promise<KnowledgeEntry> {
    const entry = await this.findOne(id);
    Object.assign(entry, updates);
    return this.knowledgeRepo.save(entry);
  }

  /**
   * Delete knowledge entry
   */
  async remove(id: string): Promise<void> {
    const entry = await this.findOne(id);
    await this.knowledgeRepo.remove(entry);
  }

  /**
   * Get knowledge statistics for an organization
   */
  async getStatistics(organizationId: string): Promise<{
    totalEntries: number;
    byType: Record<KnowledgeEntryType, number>;
    byCategory: Record<KnowledgeCategory, number>;
    averageConfidence: number;
  }> {
    const entries = await this.knowledgeRepo.find({
      where: { organizationId },
    });

    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let totalConfidence = 0;

    entries.forEach((entry) => {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      totalConfidence += entry.confidenceScore;
    });

    return {
      totalEntries: entries.length,
      byType: byType as Record<KnowledgeEntryType, number>,
      byCategory: byCategory as Record<KnowledgeCategory, number>,
      averageConfidence:
        entries.length > 0 ? totalConfidence / entries.length : 0,
    };
  }
}
