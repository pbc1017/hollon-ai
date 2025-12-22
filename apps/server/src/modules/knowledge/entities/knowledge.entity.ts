import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum KnowledgeSourceType {
  DOCUMENT = 'document',
  CONVERSATION = 'conversation',
  TASK_RESULT = 'task_result',
  CODE_ANALYSIS = 'code_analysis',
  EXTERNAL_API = 'external_api',
  USER_INPUT = 'user_input',
  SYSTEM_GENERATED = 'system_generated',
}

@Entity('knowledge')
@Index(['sourceType', 'sourceId'])
@Index(['createdAt'])
@Index(['title'], { unique: false }) // For search optimization
export class Knowledge extends BaseEntity {
  @Column({ length: 500 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: KnowledgeSourceType,
    name: 'source_type',
  })
  sourceType: KnowledgeSourceType;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[];

  // Vector embedding for RAG (pgvector)
  // Note: Actual vector type will be set in migration
  @Column({ type: 'text', nullable: true })
  embedding: string;
}
