import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum ApprovalRequestType {
  CREATE_PERMANENT_HOLLON = 'create_permanent_hollon',
  DELETE_PERMANENT_HOLLON = 'delete_permanent_hollon',
  ESCALATION = 'escalation',
  INCIDENT_RESOLUTION = 'incident_resolution',
}

@Entity('approval_requests')
export class ApprovalRequest extends BaseEntity {
  @Column({
    type: 'enum',
    enum: ApprovalRequestType,
    name: 'request_type',
  })
  requestType: ApprovalRequestType;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ name: 'requested_by', nullable: true })
  requestedBy: string | null;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  status: ApprovalStatus;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'rejected_by', nullable: true })
  rejectedBy: string | null;

  @Column({ name: 'rejected_at', type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;
}
