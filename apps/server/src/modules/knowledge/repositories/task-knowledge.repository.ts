import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Knowledge,
  KnowledgeRelation,
  Embedding,
  KnowledgeMetadata,
  KnowledgeCategory,
  RelationType,
} from '../entities';
import {
  CreateKnowledgeDto,
  UpdateKnowledgeDto,
  CreateKnowledgeRelationDto,
  CreateEmbeddingDto,
  CreateKnowledgeMetadataDto,
} from '../dto';

@Injectable()
export class TaskKnowledgeRepository {
  constructor(
    @InjectRepository(Knowledge)
    private readonly knowledgeRepo: Repository<Knowledge>,
    @InjectRepository(KnowledgeRelation)
    private readonly relationRepo: Repository<KnowledgeRelation>,
    @InjectRepository(Embedding)
    private readonly embeddingRepo: Repository<Embedding>,
    @InjectRepository(KnowledgeMetadata)
    private readonly metadataRepo: Repository<KnowledgeMetadata>,
  ) {}

  // ============ Knowledge CRUD Operations ============

  /**
   * Create a new knowledge entry
   */
  async createKnowledge(dto: CreateKnowledgeDto): Promise<Knowledge> {
    const knowledge = this.knowledgeRepo.create(dto);
    return await this.knowledgeRepo.save(knowledge);
  }

  /**
   * Get knowledge by ID with relations
   */
  async getKnowledgeById(
    id: string,
    includeRelations = true,
  ): Promise<Knowledge | null> {
    const queryBuilder = this.knowledgeRepo.createQueryBuilder('k');

    if (includeRelations) {
      queryBuilder
        .leftJoinAndSelect('k.organization', 'org')
        .leftJoinAndSelect('k.relevantTask', 'task')
        .leftJoinAndSelect('k.createdByHollon', 'hollon')
        .leftJoinAndSelect('k.relationsAsSource', 'sources')
        .leftJoinAndSelect('k.relationsAsTarget', 'targets');
    }

    return (await queryBuilder.where('k.id = :id', { id }).getOne()) || null;
  }

  /**
   * Get all knowledge entries by organization
   */
  async getKnowledgeByOrganization(
    organizationId: string,
    limit = 100,
    offset = 0,
  ): Promise<[Knowledge[], number]> {
    return await this.knowledgeRepo.findAndCount({
      where: { organizationId },
      relations: ['organization', 'relevantTask', 'createdByHollon'],
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get knowledge by category and organization
   */
  async getKnowledgeByCategory(
    organizationId: string,
    category: KnowledgeCategory,
    limit = 50,
    offset = 0,
  ): Promise<[Knowledge[], number]> {
    return await this.knowledgeRepo.findAndCount({
      where: { organizationId, category },
      relations: ['organization', 'createdByHollon'],
      take: limit,
      skip: offset,
      order: { verificationCount: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Get knowledge by tags
   */
  async getKnowledgeByTags(
    organizationId: string,
    tags: string[],
    limit = 50,
  ): Promise<Knowledge[]> {
    const queryBuilder = this.knowledgeRepo
      .createQueryBuilder('k')
      .where('k.organization_id = :orgId', { orgId: organizationId });

    // Filter by tags (using PostgreSQL array overlap operator)
    if (tags.length > 0) {
      queryBuilder.andWhere('k.tags && :tags', { tags });
    }

    return await queryBuilder
      .orderBy('k.usage_count', 'DESC')
      .addOrderBy('k.created_at', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Search knowledge by title and content
   */
  async searchKnowledge(
    organizationId: string,
    searchTerm: string,
    limit = 50,
  ): Promise<Knowledge[]> {
    const searchPattern = `%${searchTerm}%`;

    return await this.knowledgeRepo
      .createQueryBuilder('k')
      .where('k.organization_id = :orgId', { orgId: organizationId })
      .andWhere('(k.title ILIKE :search OR k.content ILIKE :search)', {
        search: searchPattern,
      })
      .orderBy('k.usage_count', 'DESC')
      .addOrderBy('k.created_at', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Update knowledge entry
   */
  async updateKnowledge(
    id: string,
    dto: UpdateKnowledgeDto,
  ): Promise<Knowledge> {
    // TypeORM's update method has strict typing for metadata field
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.knowledgeRepo.update(id, dto as any);
    const updated = await this.getKnowledgeById(id);
    if (!updated) {
      throw new Error(`Knowledge with id ${id} not found`);
    }
    return updated;
  }

  /**
   * Mark knowledge as verified
   */
  async verifyKnowledge(id: string): Promise<Knowledge> {
    const knowledge = await this.getKnowledgeById(id, false);
    if (!knowledge) {
      throw new Error(`Knowledge with id ${id} not found`);
    }

    return await this.updateKnowledge(id, {
      isVerified: true,
      verificationCount: (knowledge.verificationCount || 0) + 1,
    });
  }

  /**
   * Increment usage count for knowledge
   */
  async recordKnowledgeUsage(id: string): Promise<void> {
    const knowledge = await this.getKnowledgeById(id, false);
    if (!knowledge) {
      throw new Error(`Knowledge with id ${id} not found`);
    }

    await this.knowledgeRepo.update(id, {
      usageCount: (knowledge.usageCount || 0) + 1,
      lastUsedAt: new Date(),
    });
  }

  /**
   * Delete knowledge entry
   */
  async deleteKnowledge(id: string): Promise<boolean> {
    const result = await this.knowledgeRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  // ============ Knowledge Relations Operations ============

  /**
   * Create a relation between two knowledge entries
   */
  async createRelation(
    dto: CreateKnowledgeRelationDto,
  ): Promise<KnowledgeRelation> {
    // Check for duplicate with different type
    const existing = await this.relationRepo.findOne({
      where: {
        sourceId: dto.sourceId,
        targetId: dto.targetId,
        type: dto.type,
      },
    });

    if (existing) {
      return existing;
    }

    const relation = this.relationRepo.create(dto);
    return await this.relationRepo.save(relation);
  }

  /**
   * Get relations for a knowledge entry (as source)
   */
  async getRelationsAsSource(
    knowledgeId: string,
  ): Promise<KnowledgeRelation[]> {
    return await this.relationRepo.find({
      where: { sourceId: knowledgeId },
      relations: ['target'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get relations for a knowledge entry (as target)
   */
  async getRelationsAsTarget(
    knowledgeId: string,
  ): Promise<KnowledgeRelation[]> {
    return await this.relationRepo.find({
      where: { targetId: knowledgeId },
      relations: ['source'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all relations of a specific type
   */
  async getRelationsByType(type: RelationType): Promise<KnowledgeRelation[]> {
    return await this.relationRepo.find({
      where: { type },
      relations: ['source', 'target'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Delete a relation
   */
  async deleteRelation(id: string): Promise<boolean> {
    const result = await this.relationRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  // ============ Embedding Operations ============

  /**
   * Create an embedding for knowledge
   */
  async createEmbedding(dto: CreateEmbeddingDto): Promise<Embedding> {
    const embedding = this.embeddingRepo.create({
      ...dto,
      vector: JSON.stringify(dto.vector),
    });
    return await this.embeddingRepo.save(embedding);
  }

  /**
   * Get embedding for knowledge
   */
  async getEmbeddingByKnowledgeId(
    knowledgeId: string,
  ): Promise<Embedding | null> {
    return await this.embeddingRepo.findOne({
      where: { knowledgeId, isActive: true },
      relations: ['knowledge'],
    });
  }

  /**
   * Update embedding
   */
  async updateEmbedding(id: string, vector: number[]): Promise<Embedding> {
    await this.embeddingRepo.update(id, {
      vector: JSON.stringify(vector),
    });

    const updated = await this.embeddingRepo.findOne({ where: { id } });
    if (!updated) {
      throw new Error(`Embedding with id ${id} not found`);
    }

    return updated;
  }

  /**
   * Deactivate old embeddings and create new one
   */
  async replaceEmbedding(dto: CreateEmbeddingDto): Promise<Embedding> {
    // Deactivate old embeddings
    await this.embeddingRepo.update(
      { knowledgeId: dto.knowledgeId },
      { isActive: false },
    );

    // Create new embedding
    return await this.createEmbedding(dto);
  }

  /**
   * Delete embedding
   */
  async deleteEmbedding(id: string): Promise<boolean> {
    const result = await this.embeddingRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  // ============ Knowledge Metadata Operations ============

  /**
   * Create metadata for knowledge
   */
  async createMetadata(
    dto: CreateKnowledgeMetadataDto,
  ): Promise<KnowledgeMetadata> {
    const metadata = this.metadataRepo.create(dto);
    return await this.metadataRepo.save(metadata);
  }

  /**
   * Get metadata for knowledge
   */
  async getMetadataByKnowledgeId(
    knowledgeId: string,
  ): Promise<KnowledgeMetadata[]> {
    return await this.metadataRepo.find({
      where: { knowledgeId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Delete metadata
   */
  async deleteMetadata(id: string): Promise<boolean> {
    const result = await this.metadataRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  // ============ Bulk Operations ============

  /**
   * Bulk create knowledge entries
   */
  async bulkCreateKnowledge(dtos: CreateKnowledgeDto[]): Promise<Knowledge[]> {
    if (dtos.length === 0) {
      return [];
    }

    const knowledges = this.knowledgeRepo.create(dtos);
    return await this.knowledgeRepo.save(knowledges);
  }

  /**
   * Bulk create relations
   */
  async bulkCreateRelations(
    dtos: CreateKnowledgeRelationDto[],
  ): Promise<KnowledgeRelation[]> {
    if (dtos.length === 0) {
      return [];
    }

    const relations = this.relationRepo.create(dtos);
    return await this.relationRepo.save(relations, { chunk: 100 });
  }

  /**
   * Bulk create embeddings
   */
  async bulkCreateEmbeddings(dtos: CreateEmbeddingDto[]): Promise<Embedding[]> {
    if (dtos.length === 0) {
      return [];
    }

    const embeddings = dtos.map((dto) =>
      this.embeddingRepo.create({
        ...dto,
        vector: JSON.stringify(dto.vector),
      }),
    );

    return await this.embeddingRepo.save(embeddings, { chunk: 100 });
  }

  /**
   * Bulk create metadata
   */
  async bulkCreateMetadata(
    dtos: CreateKnowledgeMetadataDto[],
  ): Promise<KnowledgeMetadata[]> {
    if (dtos.length === 0) {
      return [];
    }

    const metadatas = this.metadataRepo.create(dtos);
    return await this.metadataRepo.save(metadatas, { chunk: 100 });
  }

  /**
   * Delete knowledge entries by IDs
   */
  async bulkDeleteKnowledge(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.knowledgeRepo.delete({ id: In(ids) });
    return result.affected ?? 0;
  }

  /**
   * Bulk update knowledge entries
   */
  async bulkUpdateKnowledge(
    updates: Array<{ id: string; data: UpdateKnowledgeDto }>,
  ): Promise<void> {
    for (const { id, data } of updates) {
      // TypeORM's update method has strict typing for metadata field
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.knowledgeRepo.update(id, data as any);
    }
  }

  // ============ Statistics and Analytics ============

  /**
   * Get verified knowledge count by organization
   */
  async getVerifiedKnowledgeCount(organizationId: string): Promise<number> {
    return await this.knowledgeRepo.count({
      where: { organizationId, isVerified: true },
    });
  }

  /**
   * Get most used knowledge entries
   */
  async getMostUsedKnowledge(
    organizationId: string,
    limit = 10,
  ): Promise<Knowledge[]> {
    return await this.knowledgeRepo.find({
      where: { organizationId },
      order: { usageCount: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get recently updated knowledge
   */
  async getRecentlyUpdatedKnowledge(
    organizationId: string,
    limit = 10,
  ): Promise<Knowledge[]> {
    return await this.knowledgeRepo.find({
      where: { organizationId },
      order: { updatedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get knowledge statistics
   */
  async getKnowledgeStatistics(organizationId: string): Promise<{
    totalCount: number;
    verifiedCount: number;
    categoryBreakdown: Record<string, number>;
    sourceBreakdown: Record<string, number>;
  }> {
    const totalCount = await this.knowledgeRepo.count({
      where: { organizationId },
    });

    const verifiedCount = await this.knowledgeRepo.count({
      where: { organizationId, isVerified: true },
    });

    const categoryBreakdown = await this.knowledgeRepo
      .createQueryBuilder('k')
      .select('k.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('k.organization_id = :orgId', { orgId: organizationId })
      .groupBy('k.category')
      .getRawMany();

    const sourceBreakdown = await this.knowledgeRepo
      .createQueryBuilder('k')
      .select('k.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .where('k.organization_id = :orgId', { orgId: organizationId })
      .groupBy('k.source')
      .getRawMany();

    return {
      totalCount,
      verifiedCount,
      categoryBreakdown: Object.fromEntries(
        categoryBreakdown.map((item) => [item.category, parseInt(item.count)]),
      ),
      sourceBreakdown: Object.fromEntries(
        sourceBreakdown.map((item) => [item.source, parseInt(item.count)]),
      ),
    };
  }
}
