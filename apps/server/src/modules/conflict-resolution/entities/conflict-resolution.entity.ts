import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum ConflictType {
  FILE_CONFLICT = 'file_conflict',
  RESOURCE_CONFLICT = 'resource_conflict',
  PRIORITY_CONFLICT = 'priority_conflict',
  DEADLINE_CONFLICT = 'deadline_conflict',
}

export enum ConflictStatus {
  DETECTED = 'detected',
  RESOLVING = 'resolving',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
}

export enum ResolutionStrategy {
  SEQUENTIAL_EXECUTION = 'sequential_execution',
  RESOURCE_REALLOCATION = 'resource_reallocation',
  PRIORITY_ADJUSTMENT = 'priority_adjustment',
  DEADLINE_EXTENSION = 'deadline_extension',
  MANUAL_INTERVENTION = 'manual_intervention',
}

@Entity('conflict_resolutions')
@Index(['organizationId', 'status'])
@Index(['conflictType', 'status'])
export class ConflictResolution extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({
    type: 'enum',
    enum: ConflictType,
    name: 'conflict_type',
  })
  conflictType: ConflictType;

  @Column({
    type: 'enum',
    enum: ConflictStatus,
    default: ConflictStatus.DETECTED,
  })
  status: ConflictStatus;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', default: [] })
  affectedTaskIds: string[];

  @Column({ type: 'jsonb', default: [] })
  affectedHollonIds: string[];

  @Column({ type: 'jsonb', default: {} })
  conflictContext: Record<string, any>;

  @Column({
    type: 'enum',
    enum: ResolutionStrategy,
    name: 'resolution_strategy',
    nullable: true,
  })
  resolutionStrategy: ResolutionStrategy | null;

  @Column({ name: 'resolution_details', type: 'text', nullable: true })
  resolutionDetails: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'escalated_at', type: 'timestamp', nullable: true })
  escalatedAt: Date | null;

  @Column({ name: 'escalation_reason', type: 'text', nullable: true })
  escalationReason: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;
}
