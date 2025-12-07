import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Team } from '../../team/entities/team.entity';

export enum ContractStatus {
  PENDING = 'pending',
  NEGOTIATING = 'negotiating',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  DELIVERED = 'delivered',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('cross_team_contracts')
@Index(['requesterTeamId', 'status'])
@Index(['targetTeamId', 'status'])
export class CrossTeamContract extends BaseEntity {
  @Column({ name: 'requester_team_id' })
  requesterTeamId: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_team_id' })
  requesterTeam: Team;

  @Column({ name: 'target_team_id' })
  targetTeamId: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_team_id' })
  targetTeam: Team;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', default: [] })
  deliverables: string[];

  @Column({ name: 'requested_deadline', type: 'timestamp', nullable: true })
  requestedDeadline: Date | null;

  @Column({ name: 'agreed_deadline', type: 'timestamp', nullable: true })
  agreedDeadline: Date | null;

  @Column({
    type: 'enum',
    enum: ContractStatus,
    default: ContractStatus.PENDING,
  })
  status: ContractStatus;

  @Column({ name: 'negotiation_notes', type: 'text', nullable: true })
  negotiationNotes: string | null;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;
}
