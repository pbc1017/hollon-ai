import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Team } from '../../team/entities/team.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Task } from '../../task/entities/task.entity';
import { Project } from '../../project/entities/project.entity';

export enum KnowledgeEntryType {
  LESSON_LEARNED = 'lesson_learned',
  BEST_PRACTICE = 'best_practice',
  TECHNICAL_DECISION = 'technical_decision',
  ERROR_PATTERN = 'error_pattern',
  OPTIMIZATION_INSIGHT = 'optimization_insight',
  PROCESS_IMPROVEMENT = 'process_improvement',
}

export enum KnowledgeCategory {
  TECHNICAL = 'technical',
  PROCESS = 'process',
  COLLABORATION = 'collaboration',
  QUALITY = 'quality',
  PERFORMANCE = 'performance',
  ARCHITECTURE = 'architecture',
}

@Entity('knowledge_entries')
@Index(['organizationId', 'createdAt'])
@Index(['teamId', 'type'])
@Index(['type', 'category'])
@Index(['tags'], { unique: false }) // GIN index for array operations
export class KnowledgeEntry extends BaseEntity {
  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: KnowledgeEntryType,
    default: KnowledgeEntryType.LESSON_LEARNED,
  })
  type: KnowledgeEntryType;

  @Column({
    type: 'enum',
    enum: KnowledgeCategory,
    default: KnowledgeCategory.TECHNICAL,
  })
  category: KnowledgeCategory;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId: string | null;

  @Column({ name: 'extracted_by_hollon_id', type: 'uuid', nullable: true })
  extractedByHollonId: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  // Related entities that contributed to this knowledge
  @Column({ type: 'jsonb', nullable: true })
  sources: {
    taskIds?: string[];
    documentIds?: string[];
    hollonIds?: string[];
  };

  // Confidence score (0-100) indicating reliability of this knowledge
  @Column({ name: 'confidence_score', type: 'int', default: 50 })
  confidenceScore: number;

  // Number of times this knowledge has been applied successfully
  @Column({ name: 'application_count', type: 'int', default: 0 })
  applicationCount: number;

  // Metadata for additional context
  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    codeSnippets?: string[];
    relatedFiles?: string[];
    dependencies?: string[];
    context?: Record<string, unknown>;
  };

  // Vector embedding for similarity search (pgvector)
  @Column({ type: 'text', nullable: true })
  embedding: string;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'extracted_by_hollon_id' })
  extractedByHollon: Hollon;
}
