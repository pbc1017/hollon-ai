import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Task } from '../../task/entities/task.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { KnowledgeRelation } from './knowledge-relation.entity';

export enum KnowledgeCategory {
  BEST_PRACTICE = 'best_practice',
  PATTERN = 'pattern',
  PITFALL = 'pitfall',
  SOLUTION = 'solution',
  LEARNING = 'learning',
  ARCHITECTURE = 'architecture',
  PROCESS = 'process',
}

export enum KnowledgeSource {
  TASK_COMPLETION = 'task_completion',
  CODE_REVIEW = 'code_review',
  RETROSPECTIVE = 'retrospective',
  DOCUMENTATION = 'documentation',
  TEAM_DISCUSSION = 'team_discussion',
  HOLLON_LEARNING = 'hollon_learning',
}

@Entity('knowledge')
@Index(['organizationId'])
@Index(['category', 'organizationId'])
@Index(['source'])
@Index(['relevantTaskId'])
@Index(['createdByHollonId'])
@Index(['tags'], { unique: false })
export class Knowledge extends BaseEntity {
  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: KnowledgeCategory,
  })
  category: KnowledgeCategory;

  @Column({
    type: 'enum',
    enum: KnowledgeSource,
  })
  source: KnowledgeSource;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'relevant_task_id', type: 'uuid', nullable: true })
  relevantTaskId: string | null;

  @Column({ name: 'created_by_hollon_id', type: 'uuid', nullable: true })
  createdByHollonId: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'verification_count', default: 0 })
  verificationCount: number;

  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @Column({
    name: 'last_used_at',
    type: 'timestamp',
    nullable: true,
  })
  lastUsedAt: Date | null;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'relevant_task_id' })
  relevantTask: Task | null;

  @ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_hollon_id' })
  createdByHollon: Hollon | null;

  @OneToMany(() => KnowledgeRelation, (rel) => rel.source)
  relationsAsSource: KnowledgeRelation[];

  @OneToMany(() => KnowledgeRelation, (rel) => rel.target)
  relationsAsTarget: KnowledgeRelation[];
}
