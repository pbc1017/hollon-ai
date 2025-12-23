import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Document } from './document.entity';

/**
 * KnowledgeMetrics tracks effectiveness metrics for knowledge documents
 * to help identify valuable knowledge and areas needing improvement
 */
@Entity('knowledge_metrics')
@Index(['knowledgeId'])
@Index(['effectivenessScore'])
@Index(['isFlagged'])
@Index(['lastAppliedAt'])
export class KnowledgeMetrics extends BaseEntity {
  @Column({ name: 'knowledge_id', type: 'uuid' })
  knowledgeId: string;

  @Column({ name: 'application_count', type: 'integer', default: 0 })
  applicationCount: number;

  @Column({ name: 'success_count', type: 'integer', default: 0 })
  successCount: number;

  @Column({ name: 'failure_count', type: 'integer', default: 0 })
  failureCount: number;

  @Column({
    name: 'effectiveness_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  effectivenessScore: number;

  @Column({ name: 'last_applied_at', type: 'timestamp', nullable: true })
  lastAppliedAt: Date | null;

  @Column({ name: 'is_flagged', type: 'boolean', default: false })
  isFlagged: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  // Relations
  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledge_id' })
  knowledge: Document;
}
