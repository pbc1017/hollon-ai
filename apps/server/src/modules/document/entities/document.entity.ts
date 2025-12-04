import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
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

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'hollon_id', nullable: true })
  hollonId: string;

  @Column({ name: 'task_id', nullable: true })
  taskId: string;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  // Vector embedding for RAG (pgvector)
  // Note: 실제 vector 타입은 migration에서 설정
  @Column({ type: 'text', nullable: true })
  embedding: string;

  // Relations
  @ManyToOne(() => Project, (project) => project.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hollon_id' })
  hollon: Hollon;
}
