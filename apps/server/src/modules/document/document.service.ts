import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentType } from './entities/document.entity';
import { DocumentQualityService } from './services/document-quality.service';

export interface CreateDocumentDto {
  title: string;
  content: string;
  type: DocumentType;
  organizationId: string;
  teamId?: string | null; // Phase 3.5: 팀별 지식 분리
  projectId?: string | null;
  hollonId?: string | null;
  taskId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly qualityService: DocumentQualityService,
  ) {}

  /**
   * 문서 생성
   */
  async create(dto: CreateDocumentDto): Promise<Document> {
    const document = this.documentRepo.create({
      title: dto.title,
      content: dto.content,
      type: dto.type,
      organizationId: dto.organizationId,
      teamId: dto.teamId ?? null, // Phase 3.5: 팀별 지식 분리
      projectId: dto.projectId ?? null,
      hollonId: dto.hollonId ?? null,
      taskId: dto.taskId ?? null,
      tags: dto.tags || [],
      metadata: dto.metadata || {},
    });

    const saved = await this.documentRepo.save(document);

    // Calculate initial quality score
    await this.qualityService.updateDocumentScore(saved.id);

    return this.documentRepo.findOne({ where: { id: saved.id } });
  }

  /**
   * 문서 조회
   */
  async findOne(id: string, recordView = false): Promise<Document> {
    const document = await this.documentRepo.findOne({
      where: { id },
      relations: ['organization', 'project', 'hollon'],
    });

    if (!document) {
      throw new NotFoundException(`Document #${id} not found`);
    }

    // Record view and update quality score
    if (recordView) {
      await this.qualityService.recordDocumentView(id);
      // Refresh document to get updated scores
      return this.documentRepo.findOne({ where: { id } });
    }

    return document;
  }

  /**
   * 조직 레벨 지식 문서 조회
   * SSOT 원칙: projectId가 null인 문서는 조직 전체가 공유
   */
  async findOrganizationKnowledge(
    organizationId: string,
    filters?: {
      tags?: string[];
      type?: DocumentType;
      limit?: number;
    },
  ): Promise<Document[]> {
    const query = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.organization_id = :orgId', { orgId: organizationId })
      .andWhere('doc.project_id IS NULL'); // 조직 레벨 지식

    if (filters?.type) {
      query.andWhere('doc.type = :type', { type: filters.type });
    }

    if (filters?.tags && filters.tags.length > 0) {
      query.andWhere('doc.tags && :tags', { tags: filters.tags });
    }

    if (filters?.limit) {
      query.limit(filters.limit);
    }

    return query
      .orderBy('doc.quality_score', 'DESC')
      .addOrderBy('doc.created_at', 'DESC')
      .getMany();
  }

  /**
   * 프로젝트 레벨 문서 조회
   */
  async findProjectDocuments(
    projectId: string,
    filters?: {
      type?: DocumentType;
      limit?: number;
    },
  ): Promise<Document[]> {
    const query = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.project_id = :projectId', { projectId });

    if (filters?.type) {
      query.andWhere('doc.type = :type', { type: filters.type });
    }

    if (filters?.limit) {
      query.limit(filters.limit);
    }

    return query
      .orderBy('doc.quality_score', 'DESC')
      .addOrderBy('doc.created_at', 'DESC')
      .getMany();
  }

  /**
   * 태그로 문서 검색 (조직 내)
   */
  async searchByTags(
    organizationId: string,
    tags: string[],
    options?: {
      projectId?: string | null;
      type?: DocumentType;
      limit?: number;
    },
  ): Promise<Document[]> {
    const query = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.organization_id = :orgId', { orgId: organizationId })
      .andWhere('doc.tags && :tags', { tags });

    if (options?.projectId !== undefined) {
      if (options.projectId === null) {
        query.andWhere('doc.project_id IS NULL');
      } else {
        query.andWhere('doc.project_id = :projectId', {
          projectId: options.projectId,
        });
      }
    }

    if (options?.type) {
      query.andWhere('doc.type = :type', { type: options.type });
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    return query
      .orderBy('doc.quality_score', 'DESC')
      .addOrderBy('doc.created_at', 'DESC')
      .getMany();
  }

  /**
   * 홀론이 작성한 문서 조회
   */
  async findByHollon(hollonId: string): Promise<Document[]> {
    return this.documentRepo.find({
      where: { hollonId },
      order: { qualityScore: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * 태스크 관련 문서 조회
   */
  async findByTask(taskId: string): Promise<Document[]> {
    return this.documentRepo.find({
      where: { taskId },
      order: { qualityScore: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * 문서 업데이트
   */
  async update(
    id: string,
    updates: Partial<CreateDocumentDto>,
  ): Promise<Document> {
    const document = await this.findOne(id);
    Object.assign(document, updates);
    const saved = await this.documentRepo.save(document);

    // Recalculate quality score after update
    await this.qualityService.updateDocumentScore(saved.id);

    return this.documentRepo.findOne({ where: { id: saved.id } });
  }

  /**
   * 문서 삭제
   */
  async remove(id: string): Promise<void> {
    const document = await this.findOne(id);
    await this.documentRepo.remove(document);
  }

  /**
   * 문서에 평점 추가
   * @param id - 문서 ID
   * @param rating - 평점 (1-5)
   */
  async rateDocument(id: string, rating: number): Promise<Document> {
    return this.qualityService.rateDocument(id, rating);
  }

  /**
   * 문서의 품질 점수 세부 정보 조회
   */
  async getQualityScoreBreakdown(id: string) {
    return this.qualityService.getScoreBreakdown(id);
  }
}
