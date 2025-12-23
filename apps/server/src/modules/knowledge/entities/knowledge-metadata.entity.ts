import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Knowledge } from './knowledge.entity';

export enum MetadataKeyType {
  SKILL = 'skill', // Related skill/technology
  DOMAIN = 'domain', // Problem domain
  PATTERN = 'pattern', // Design/code pattern
  COMPLEXITY = 'complexity', // Complexity level
  TIME_TO_LEARN = 'time_to_learn', // Estimated learning time
  APPLICABILITY = 'applicability', // When/where applicable
  PREREQUISITE = 'prerequisite', // Prerequisites
  OUTCOME = 'outcome', // Expected outcomes
}

@Entity('knowledge_metadata')
@Index(['knowledgeId'])
@Index(['keyType'])
@Index(['keyType', 'value'])
export class KnowledgeMetadata extends BaseEntity {
  @Column({ name: 'knowledge_id' })
  knowledgeId: string;

  @Column({
    type: 'enum',
    enum: MetadataKeyType,
  })
  keyType: MetadataKeyType;

  @Column({ type: 'text' })
  value: string;

  @Column({ name: 'confidence_score', type: 'float', nullable: true })
  confidenceScore: number | null; // 0-1 confidence

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  // Relations
  @ManyToOne(() => Knowledge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledge_id' })
  knowledge: Knowledge;
}
