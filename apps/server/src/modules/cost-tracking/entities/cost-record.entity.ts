import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Task } from '../../task/entities/task.entity';

export enum CostRecordType {
  BRAIN_EXECUTION = 'brain_execution',
  TASK_ANALYSIS = 'task_analysis',
  QUALITY_CHECK = 'quality_check',
  OTHER = 'other',
}

@Entity('cost_records')
@Index(['organizationId', 'createdAt'])
@Index(['taskId'])
export class CostRecord extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'hollon_id', nullable: true })
  hollonId: string;

  @Column({ name: 'task_id', nullable: true })
  taskId: string;

  @Column({
    type: 'enum',
    enum: CostRecordType,
    default: CostRecordType.BRAIN_EXECUTION,
  })
  type: CostRecordType;

  @Column({ name: 'provider_id', length: 50 })
  providerId: string; // 'claude_code', 'anthropic_api', etc.

  @Column({ name: 'model_used', length: 100, nullable: true })
  modelUsed: string;

  @Column({ name: 'input_tokens', default: 0 })
  inputTokens: number;

  @Column({ name: 'output_tokens', default: 0 })
  outputTokens: number;

  @Column({ name: 'cost_cents', type: 'decimal', precision: 10, scale: 4 })
  costCents: number;

  @Column({ name: 'execution_time_ms', nullable: true })
  executionTimeMs: number;

  @Column({ type: 'text', nullable: true })
  metadata: string; // JSON stringified metadata

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
}
