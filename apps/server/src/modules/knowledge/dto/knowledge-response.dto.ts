import { KnowledgeCategory } from '../entities/knowledge.entity';

export class KnowledgeResponseDto {
  id: string;
  category: KnowledgeCategory;
  content: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  relevanceScore: number;
  createdAt: Date;
  updatedAt: Date;
}
