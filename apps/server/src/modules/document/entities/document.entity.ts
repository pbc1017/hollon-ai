import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Project } from '../../project/entities/project.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';

export enum DocumentType {
  TASK_CONTEXT = 'task_context',
  DECISION_LOG = 'decision_log',
  KNOWLEDGE = 'knowledge',
  DISCUSSION = 'discussion',
  CODE_REVIEW = 'code_review',
}

@Entity('documents')
@Index(['organizationId'])
@Index(['projectId', 'type'])
@Index(['hollonId'])
export class Document extends BaseEntity {
  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: DocumentType,
    default: DocumentType.KNOWLEDGE,
  })
  type: DocumentType;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'project_id', nullable: true })
  projectId: string | null;

  @Column({ name: 'hollon_id', type: 'uuid', nullable: true })
  hollonId: string | null;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  // Vector embedding for RAG (pgvector)
  // Note: 실제 vector 타입은 migration에서 설정
  @Column({ type: 'text', nullable: true })
  embedding: string;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Project, (project) => project.documents, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hollon_id' })
  hollon: Hollon;
}
