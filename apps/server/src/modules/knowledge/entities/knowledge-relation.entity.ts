import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Knowledge } from './knowledge.entity';

export enum RelationType {
  REFINES = 'refines', // B refines/improves A
  CONFLICTS = 'conflicts', // B conflicts with A
  DEPENDS_ON = 'depends_on', // B depends on A
  RELATED_TO = 'related_to', // General relationship
  SUPERSEDES = 'supersedes', // B supersedes/replaces A
  COMPLEMENTS = 'complements', // B complements A
}

@Entity('knowledge_relations')
@Index(['sourceId'])
@Index(['targetId'])
@Index(['type'])
@Unique(['sourceId', 'targetId', 'type'])
export class KnowledgeRelation extends BaseEntity {
  @Column({ name: 'source_id' })
  sourceId: string;

  @Column({ name: 'target_id' })
  targetId: string;

  @Column({
    type: 'enum',
    enum: RelationType,
  })
  type: RelationType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'float', nullable: true })
  strength: number | null; // 0-1 confidence score

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  // Relations
  @ManyToOne(() => Knowledge, (knowledge) => knowledge.relationsAsSource, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'source_id' })
  source: Knowledge;

  @ManyToOne(() => Knowledge, (knowledge) => knowledge.relationsAsTarget, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'target_id' })
  target: Knowledge;
}
