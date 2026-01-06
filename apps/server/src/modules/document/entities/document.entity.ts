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
@Index(['type', 'organizationId']) // Phase 3.5: 타입별 조직 문서 검색 최적화
@Index(['tags'], { unique: false }) // Phase 3.5: 태그 기반 검색 최적화 (GIN 인덱스는 migration에서)
export class Document extends BaseEntity {
  @Column({ length: 255 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'enum',
    enum: DocumentType,
    default: DocumentType.KNOWLEDGE,
  })
  type!: DocumentType;

  @Column({ name: 'organization_id' })
  organizationId!: string;

  @Column({ name: 'team_id', type: 'uuid', nullable: true }) // Phase 3.5: 팀별 지식 분리
  teamId!: string | null;

  @Column({ name: 'project_id', nullable: true })
  projectId!: string | null;

  @Column({ name: 'hollon_id', type: 'uuid', nullable: true })
  hollonId!: string | null;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId!: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  tags!: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown>;

  // Vector embedding for RAG (pgvector)
  // Note: 실제 vector 타입은 migration에서 설정
  @Column({ type: 'text', nullable: true })
  embedding!: string;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => Project, (project) => project.documents, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hollon_id' })
  hollon!: Hollon;
}
