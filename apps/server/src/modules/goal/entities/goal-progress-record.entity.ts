import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Goal } from './goal.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';

@Entity('goal_progress_records')
@Index(['goalId'])
@Index(['recordedAt'])
export class GoalProgressRecord extends BaseEntity {
  @Column({ name: 'goal_id' })
  goalId: string;

  @Column({
    name: 'progress_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  progressPercent: number;

  @Column({
    name: 'current_value',
    type: 'decimal',
    precision: 15,
    scale: 4,
    nullable: true,
  })
  currentValue: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ name: 'recorded_by', nullable: true })
  recordedBy: string;

  @Column({
    name: 'recorded_at',
    type: 'timestamp with time zone',
    default: () => 'NOW()',
  })
  recordedAt: Date;

  // Relations
  @ManyToOne(() => Goal, (goal) => goal.progressRecords, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'goal_id' })
  goal: Goal;

  @ManyToOne(() => Hollon, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'recorded_by' })
  recordedByHollon: Hollon;
}
