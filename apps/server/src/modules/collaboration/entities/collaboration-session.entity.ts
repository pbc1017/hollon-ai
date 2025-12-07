import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Task } from '../../task/entities/task.entity';

export enum CollaborationType {
  PAIR_PROGRAMMING = 'pair_programming',
  CODE_REVIEW = 'code_review',
  KNOWLEDGE_SHARING = 'knowledge_sharing',
  DEBUGGING = 'debugging',
  ARCHITECTURE_REVIEW = 'architecture_review',
}

export enum CollaborationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('collaboration_sessions')
@Index(['requesterHollonId', 'status'])
@Index(['collaboratorHollonId', 'status'])
@Index(['taskId'])
export class CollaborationSession extends BaseEntity {
  @Column({
    type: 'enum',
    enum: CollaborationType,
  })
  type: CollaborationType;

  @Column({
    type: 'enum',
    enum: CollaborationStatus,
    default: CollaborationStatus.PENDING,
  })
  status: CollaborationStatus;

  @Column({ name: 'requester_hollon_id' })
  requesterHollonId: string;

  @ManyToOne(() => Hollon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_hollon_id' })
  requesterHollon: Hollon;

  @Column({ name: 'collaborator_hollon_id', nullable: true })
  collaboratorHollonId: string | null;

  @ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'collaborator_hollon_id' })
  collaboratorHollon: Hollon | null;

  @Column({ name: 'task_id', nullable: true })
  taskId: string | null;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'timestamp', name: 'started_at', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  outcome: string | null;
}
