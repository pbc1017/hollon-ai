import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';

export enum IncidentSeverity {
  P1 = 'P1', // 전체 시스템 영향
  P2 = 'P2', // 주요 기능 영향
  P3 = 'P3', // 부분 영향
  P4 = 'P4', // 경미한 이슈
}

export enum IncidentStatus {
  REPORTED = 'reported',
  INVESTIGATING = 'investigating',
  IDENTIFIED = 'identified',
  RESOLVING = 'resolving',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

@Entity('incidents')
@Index(['organizationId', 'status'])
@Index(['severity', 'status'])
export class Incident extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: IncidentSeverity,
  })
  severity: IncidentSeverity;

  @Column({
    type: 'enum',
    enum: IncidentStatus,
    default: IncidentStatus.REPORTED,
  })
  status: IncidentStatus;

  @Column({ name: 'reporter_hollon_id', type: 'uuid', nullable: true })
  reporterHollonId: string | null;

  @ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reporter_hollon_id' })
  reporterHollon?: Hollon;

  @Column({ name: 'owner_hollon_id', type: 'uuid', nullable: true })
  ownerHollonId: string | null;

  @ManyToOne(() => Hollon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_hollon_id' })
  ownerHollon?: Hollon;

  @Column({ name: 'channel_id', type: 'uuid', nullable: true })
  channelId: string | null;

  @Column({ type: 'jsonb', default: {} })
  impact: Record<string, any>;

  @Column({ type: 'jsonb', default: [] })
  timeline: Array<{
    timestamp: string;
    event: string;
    description: string;
  }>;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolution_summary', type: 'text', nullable: true })
  resolutionSummary: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;
}
