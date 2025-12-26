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
   * Find all knowledge items for an organization
   */
  async findByOrganization(organizationId: string): Promise<KnowledgeItem[]> {
    return this.knowledgeItemRepository.find({
      where: { organizationId },
      order: { extractedAt: 'DESC' },
    });
  }
}
