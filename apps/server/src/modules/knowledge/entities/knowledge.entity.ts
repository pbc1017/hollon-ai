import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum KnowledgeType {
  GENERAL = 'general',
  TECHNICAL = 'technical',
  BUSINESS = 'business',
  PROCESS = 'process',
  DOCUMENTATION = 'documentation',
  INSIGHT = 'insight',
  BEST_PRACTICE = 'best_practice',
  LESSON_LEARNED = 'lesson_learned',
}

@Entity('knowledge')
@Index(['type'])
@Index(['source'])
@Index(['createdAt'])
@Index(['type', 'source'])
export class Knowledge extends BaseEntity {
  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'enum',
    enum: KnowledgeType,
    default: KnowledgeType.GENERAL,
  })
  type!: KnowledgeType;

  @Column({ type: 'varchar', length: 255 })
  source!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
