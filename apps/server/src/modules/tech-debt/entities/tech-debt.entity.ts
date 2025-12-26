import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Task } from '../../task/entities/task.entity';
import { Project } from '../../project/entities/project.entity';

export enum TechDebtSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum TechDebtStatus {
  IDENTIFIED = 'identified',
  ACKNOWLEDGED = 'acknowledged',
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  WONT_FIX = 'wont_fix',
}

export enum TechDebtCategory {
  CODE_QUALITY = 'code_quality',
  ARCHITECTURE = 'architecture',
  DOCUMENTATION = 'documentation',
  TESTING = 'testing',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  DEPENDENCY = 'dependency',
  OTHER = 'other',
}

@Entity('tech_debts')
@Index(['projectId', 'status'])
@Index(['severity', 'status'])
@Index(['taskId'])
export class TechDebt extends BaseEntity {
  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: TechDebtCategory,
    default: TechDebtCategory.CODE_QUALITY,
  })
  category: TechDebtCategory;

  @Column({
    type: 'enum',
    enum: TechDebtSeverity,
    default: TechDebtSeverity.MEDIUM,
  })
  severity: TechDebtSeverity;

  @Column({
    type: 'enum',
    enum: TechDebtStatus,
    default: TechDebtStatus.IDENTIFIED,
  })
  status: TechDebtStatus;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId: string | null;

  @Column({
    name: 'affected_files',
    type: 'text',
    array: true,
    default: '{}',
  })
  affectedFiles: string[];

  @Column({
    name: 'estimated_effort_hours',
    type: 'integer',
    nullable: true,
  })
  estimatedEffortHours: number | null;

  @Column({ name: 'detected_by', type: 'varchar', length: 100, nullable: true })
  detectedBy: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  // Relations
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'task_id' })
  task: Task | null;
}
