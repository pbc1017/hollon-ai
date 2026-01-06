import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Project } from './project.entity';
import { Task } from '../../task/entities/task.entity';

export enum CycleStatus {
  UPCOMING = 'upcoming',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

@Entity('cycles')
@Index(['projectId', 'status'])
@Check(`"status" IN ('upcoming', 'active', 'completed')`)
export class Cycle extends BaseEntity {
  @Column({ name: 'project_id' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ length: 255, nullable: true })
  name!: string;

  @Column({ type: 'integer' })
  number!: number;

  @Column({ type: 'date', name: 'start_date' })
  startDate!: Date;

  @Column({ type: 'date', name: 'end_date' })
  endDate!: Date;

  @Column({ type: 'text', nullable: true })
  goal!: string;

  @Column({ type: 'integer', name: 'budget_cents', nullable: true })
  budgetCents!: number;

  @Column({
    type: 'integer',
    name: 'actual_cost_cents',
    default: 0,
  })
  actualCostCents!: number;

  @Column({
    type: 'enum',
    enum: CycleStatus,
    default: CycleStatus.UPCOMING,
  })
  status!: CycleStatus;

  @Column({ type: 'timestamp', name: 'completed_at', nullable: true })
  completedAt!: Date;

  // Relations
  @OneToMany(() => Task, (task) => task.cycle)
  tasks!: Task[];
}
