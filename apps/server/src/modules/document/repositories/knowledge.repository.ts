import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Brackets } from 'typeorm';
import { Document } from '../entities/document.entity';
import { DocumentType } from '../entities/document.entity';

/**
 * KnowledgeRepository
 * 
 * Specialized repository for CRUD operations on knowledge documents.
 * Provides methods for bulk insert, metadata search, and relationship queries.
 * 
 * All operations are scoped to DocumentType.KNOWLEDGE.
 */
@Injectable()
export class KnowledgeRepository {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a single knowledge document
   */
  async create(data: {
    title: string;
    content: string;
    organizationId: string;
    teamId?: string | null;
    projectId?: string | null;
    hollonId?: string | null;
    taskId?: string | null;
    tags?: string[];
    metadata?: Record<string, unknown>;
    embedding?: string;
  }): Promise<Document> {
    const document = this.documentRepo.create({
      ...data,
      type: DocumentType.KNOWLEDGE,
      tags: data.tags || [],
      metadata: data.metadata || {},
    });

    return this.documentRepo.save(document);
  }

  /**
   * Bulk insert knowledge documents with transaction support
   * Returns array of created documents
   */
  async bulkInsert(
    documents: Array<{
      title: string;
      content: string;
      organizationId: string;
      teamId?: string | null;
      projectId?: string | null;
      hollonId?: string | null;
      taskId?: string | null;
      tags?: string[];
      metadata?: Record<string, unknown>;
      embedding?: string;
    }>,
  ): Promise<Document[]> {
    return this.dataSource.transaction(async (manager) => {
      const entities = documents.map((data) =>
        manager.create(Document, {
          ...data,
          type: DocumentType.KNOWLEDGE,
          tags: data.tags || [],
          metadata: data.metadata || {},
        }),
      );

      return manager.save(Document, entities);
    });
  }

  /**
   * Find knowledge document by ID
   * Throws NotFoundException if not found
   */
  async findById(id: string): Promise<Document> {
    const document = await this.documentRepo.findOne({
      where: { id, type: DocumentType.KNOWLEDGE },
      relations: ['organization', 'project', 'hollon'],
    });

    if (!document) {
      throw new NotFoundException(`Knowledge document #${id} not found`);
    }

    return document;
  }

  /**
   * Find all knowledge documents for an organization
   */
  async findByOrganization(
    organizationId: string,
    options?: {
      limit?: number;
      offset?: number;
      projectId?: string | null;
      teamId?: string | null;
    },
  ): Promise<Document[]> {
    const query = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.organization_id = :orgId', { orgId: organizationId })
      .andWhere('doc.type = :type', { type: DocumentType.KNOWLEDGE });

    if (options?.projectId !== undefined) {
      if (options.projectId === null) {
        query.andWhere('doc.project_id IS NULL');
      } else {
        query.andWhere('doc.project_id = :projectId', {
          projectId: options.projectId,
        });
      }
    }

    if (options?.teamId !== undefined) {
      if (options.teamId === null) {
        query.andWhere('doc.team_id IS NULL');
      } else {
        query.andWhere('doc.team_id = :teamId', { teamId: options.teamId });
      }
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    return query.orderBy('doc.created_at', 'DESC').getMany();
  }

  /**
   * Search knowledge documents by metadata
   * Supports JSONB queries for flexible metadata filtering
   */
  async searchByMetadata(
    organizationId: string,
    metadataFilters: Record<string, unknown>,
    options?: {
      limit?: number;
      offset?: number;
      projectId?: string;
      teamId?: string;
    },
  ): Promise<Document[]> {
    const query = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.organization_id = :orgId', { orgId: organizationId })
      .andWhere('doc.type = :type', { type: DocumentType.KNOWLEDGE });

    // Apply metadata filters using JSONB containment operator
    for (const [key, value] of Object.entries(metadataFilters)) {
      query.andWhere(`doc.metadata @> :metadata_${key}`, {
        [`metadata_${key}`]: JSON.stringify({ [key]: value }),
      });
    }

    if (options?.projectId) {
      query.andWhere('doc.project_id = :projectId', {
        projectId: options.projectId,
      });
    }

    if (options?.teamId) {
      query.andWhere('doc.team_id = :teamId', { teamId: options.teamId });
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    return query.orderBy('doc.created_at', 'DESC').getMany();
  }

  /**
   * Search by tags (supports multiple tags with AND/OR logic)
   */
  async searchByTags(
    organizationId: string,
    tags: string[],
    options?: {
      matchAll?: boolean; // true = AND, false = OR (default)
      limit?: number;
      offset?: number;
      projectId?: string;
      teamId?: string;
    },
  ): Promise<Document[]> {
    const query = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.organization_id = :orgId', { orgId: organizationId })
      .andWhere('doc.type = :type', { type: DocumentType.KNOWLEDGE });

    if (options?.matchAll) {
      // AND logic: document must contain all tags
      query.andWhere('doc.tags @> :tags', { tags });
    } else {
      // OR logic: document must contain at least one tag
      query.andWhere('doc.tags && :tags', { tags });
    }

    if (options?.projectId) {
      query.andWhere('doc.project_id = :projectId', {
        projectId: options.projectId,
      });
    }

    if (options?.teamId) {
      query.andWhere('doc.team_id = :teamId', { teamId: options.teamId });
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    return query.orderBy('doc.created_at', 'DESC').getMany();
  }

  /**
   * Get all knowledge documents related to a specific hollon
   * Includes documents created by or associated with the hollon
   */
  async findByHollon(
    hollonId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Document[]> {
    const query = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.hollon_id = :hollonId', { hollonId })
      .andWhere('doc.type = :type', { type: DocumentType.KNOWLEDGE });

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    return query.orderBy('doc.created_at', 'DESC').getMany();
  }

  /**
   * Get all knowledge documents related to a specific task
   */
  async findByTask(
    taskId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Document[]> {
    const query = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.task_id = :taskId', { taskId })
      .andWhere('doc.type = :type', { type: DocumentType.KNOWLEDGE });

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    return query.orderBy('doc.created_at', 'DESC').getMany();
  }

  /**
   * Get all knowledge documents for a project
   * with optional relationship loading
   */
  async findByProject(
    projectId: string,
    options?: {
      limit?: number;
      offset?: number;
      includeRelations?: boolean;
    },
  ): Promise<Document[]> {
    const query = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.project_id = :projectId', { projectId })
      .andWhere('doc.type = :type', { type: DocumentType.KNOWLEDGE });

    if (options?.includeRelations) {
      query
        .leftJoinAndSelect('doc.organization', 'organization')
        .leftJoinAndSelect('doc.project', 'project')
        .leftJoinAndSelect('doc.hollon', 'hollon');
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    return query.orderBy('doc.created_at', 'DESC').getMany();
  }

  /**
   * Complex relationship query: Get knowledge documents related to multiple entities
   * Useful for cross-referencing knowledge across projects, teams, and tasks
   */
  async findByMultipleRelations(filters: {
    organizationId: string;
    projectIds?: string[];
    teamIds?: string[];
    hollonIds?: string[];
    taskIds?: string[];
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Document[]> {
    const query = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.organization_id = :orgId', { orgId: filters.organizationId })
      .andWhere('doc.type = :type', { type: DocumentType.KNOWLEDGE });

    // Use Brackets for OR conditions within AND logic
    if (filters.projectIds && filters.projectIds.length > 0) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('doc.project_id IN (:...projectIds)', {
            projectIds: filters.projectIds,
          }).orWhere('doc.project_id IS NULL'); // Include org-level knowledge
        }),
      );
    }

    if (filters.teamIds && filters.teamIds.length > 0) {
      query.andWhere('doc.team_id IN (:...teamIds)', {
        teamIds: filters.teamIds,
      });
    }

    if (filters.hollonIds && filters.hollonIds.length > 0) {
      query.andWhere('doc.hollon_id IN (:...hollonIds)', {
        hollonIds: filters.hollonIds,
      });
    }

    if (filters.taskIds && filters.taskIds.length > 0) {
      query.andWhere('doc.task_id IN (:...taskIds)', {
        taskIds: filters.taskIds,
      });
    }

    if (filters.tags && filters.tags.length > 0) {
      query.andWhere('doc.tags && :tags', { tags: filters.tags });
    }

    if (filters.limit) {
      query.limit(filters.limit);
    }

    if (filters.offset) {
      query.offset(filters.offset);
    }

    return query.orderBy('doc.created_at', 'DESC').getMany();
  }

  /**
   * Update a knowledge document
   * Uses transaction for data consistency
   */
  async update(
    id: string,
    updates: Partial<{
      title: string;
      content: string;
      tags: string[];
      metadata: Record<string, unknown>;
      embedding: string;
      teamId: string | null;
      projectId: string | null;
      hollonId: string | null;
      taskId: string | null;
    }>,
  ): Promise<Document> {
    return this.dataSource.transaction(async (manager) => {
      const document = await manager.findOne(Document, {
        where: { id, type: DocumentType.KNOWLEDGE },
      });

      if (!document) {
        throw new NotFoundException(`Knowledge document #${id} not found`);
      }

      Object.assign(document, updates);
      return manager.save(Document, document);
    });
  }

  /**
   * Delete a knowledge document
   */
  async delete(id: string): Promise<void> {
    const document = await this.findById(id);
    await this.documentRepo.remove(document);
  }

  /**
   * Bulk delete knowledge documents with transaction support
   */
  async bulkDelete(ids: string[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const documents = await manager.find(Document, {
        where: {
          id: In(ids),
          type: DocumentType.KNOWLEDGE,
        },
      });

      if (documents.length !== ids.length) {
        throw new NotFoundException(
          `Some documents not found. Expected ${ids.length}, found ${documents.length}`,
        );
      }

      await manager.remove(Document, documents);
    });
  }

  /**
   * Count knowledge documents by organization
   */
  async countByOrganization(
    organizationId: string,
    filters?: {
      projectId?: string | null;
      teamId?: string | null;
    },
  ): Promise<number> {
    const query = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.organization_id = :orgId', { orgId: organizationId })
      .andWhere('doc.type = :type', { type: DocumentType.KNOWLEDGE });

    if (filters?.projectId !== undefined) {
      if (filters.projectId === null) {
        query.andWhere('doc.project_id IS NULL');
      } else {
        query.andWhere('doc.project_id = :projectId', {
          projectId: filters.projectId,
        });
      }
    }

    if (filters?.teamId !== undefined) {
      if (filters.teamId === null) {
        query.andWhere('doc.team_id IS NULL');
      } else {
        query.andWhere('doc.team_id = :teamId', { teamId: filters.teamId });
      }
    }

    return query.getCount();
  }

  /**
   * Get knowledge documents with pagination support
   */
  async findWithPagination(
    organizationId: string,
    page: number,
    pageSize: number,
    filters?: {
      projectId?: string;
      teamId?: string;
      tags?: string[];
    },
  ): Promise<{ data: Document[]; total: number; page: number; pageSize: number }> {
    const query = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.organization_id = :orgId', { orgId: organizationId })
      .andWhere('doc.type = :type', { type: DocumentType.KNOWLEDGE });

    if (filters?.projectId) {
      query.andWhere('doc.project_id = :projectId', {
        projectId: filters.projectId,
      });
    }

    if (filters?.teamId) {
      query.andWhere('doc.team_id = :teamId', { teamId: filters.teamId });
    }

    if (filters?.tags && filters.tags.length > 0) {
      query.andWhere('doc.tags && :tags', { tags: filters.tags });
    }

    const [data, total] = await query
      .orderBy('doc.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      pageSize,
    };
  }
}
