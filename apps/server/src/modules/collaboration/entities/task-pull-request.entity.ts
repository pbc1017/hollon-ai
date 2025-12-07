import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Task } from '../../task/entities/task.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';

export enum PullRequestStatus {
  DRAFT = 'draft',
  READY_FOR_REVIEW = 'ready_for_review',
  CHANGES_REQUESTED = 'changes_requested',
  APPROVED = 'approved',
  MERGED = 'merged',
  CLOSED = 'closed',
}

export enum ReviewerType {
  TEAM_MEMBER = 'team_member',
  SECURITY_REVIEWER = 'security_reviewer',
  ARCHITECTURE_REVIEWER = 'architecture_reviewer',
  PERFORMANCE_REVIEWER = 'performance_reviewer',
  CODE_REVIEWER = 'code_reviewer',
}

@Entity('task_pull_requests')
@Index(['taskId'])
@Index(['status'])
@Index(['authorHollonId'])
@Index(['reviewerHollonId'])
export class TaskPullRequest extends BaseEntity {
  @Column({ name: 'task_id' })
  taskId: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({ type: 'integer', name: 'pr_number' })
  prNumber: number;

  @Column({ length: 500, name: 'pr_url' })
  prUrl: string;

  @Column({ length: 255 })
  repository: string;

  @Column({ name: 'branch_name', type: 'varchar', length: 255, nullable: true })
  branchName: string | null;

  @Column({
    type: 'enum',
    enum: PullRequestStatus,
    default: PullRequestStatus.DRAFT,
  })
  status: PullRequestStatus;

  @Column({ name: 'author_hollon_id', type: 'uuid', nullable: true })
  authorHollonId: string | null;

  @ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_hollon_id' })
  authorHollon: Hollon | null;

  @Column({ name: 'reviewer_hollon_id', type: 'uuid', nullable: true })
  reviewerHollonId: string | null;

  @ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewer_hollon_id' })
  reviewerHollon: Hollon | null;

  @Column({
    type: 'enum',
    enum: ReviewerType,
    name: 'reviewer_type',
    nullable: true,
  })
  reviewerType: ReviewerType | null;

  @Column({ type: 'text', name: 'review_comments', nullable: true })
  reviewComments: string | null;

  @Column({ type: 'timestamp', name: 'approved_at', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'timestamp', name: 'merged_at', nullable: true })
  mergedAt: Date | null;
}
