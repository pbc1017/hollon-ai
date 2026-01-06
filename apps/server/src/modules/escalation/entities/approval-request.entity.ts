import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Task } from '../../task/entities/task.entity';

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum ApprovalType {
  COST_OVERRIDE = 'cost_override',
  TASK_COMPLEXITY = 'task_complexity',
  QUALITY_ISSUE = 'quality_issue',
  ESCALATION_L5 = 'escalation_l5',
  OTHER = 'other',
}

@Entity('approval_requests')
@Index(['organizationId', 'status'])
@Index(['taskId'])
export class ApprovalRequest extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'hollon_id', type: 'uuid', nullable: true })
  hollonId: string;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId: string;

  @Column({
    type: 'enum',
    enum: ApprovalType,
    default: ApprovalType.OTHER,
  })
  type: ApprovalType;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  status: ApprovalStatus;

  @Column({ length: 500 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, unknown>;

  @Column({ name: 'requested_by_hollon_id', type: 'uuid', nullable: true })
  requestedByHollonId: string;

  @Column({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  reviewedByUserId: string; // Future: link to User entity

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ name: 'review_comment', type: 'text', nullable: true })
  reviewComment: string;

  @Column({ name: 'escalation_level', default: 5 })
  escalationLevel: number; // 1-5

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hollon_id' })
  hollon: Hollon;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requested_by_hollon_id' })
  requestedByHollon: Hollon;
}
