import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Team } from '../../team/entities/team.entity';
import { Role } from '../../role/entities/role.entity';
import { Task } from '../../task/entities/task.entity';

export enum HollonStatus {
  IDLE = 'idle',
  WORKING = 'working',
  BLOCKED = 'blocked',
  REVIEWING = 'reviewing',
  OFFLINE = 'offline',
}

@Entity('hollons')
@Index(['organizationId', 'status'])
export class Hollon extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: HollonStatus,
    default: HollonStatus.IDLE,
  })
  status: HollonStatus;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'team_id', nullable: true })
  teamId: string;

  @Column({ name: 'role_id' })
  roleId: string;

  @Column({ name: 'brain_provider_id', length: 50, default: 'claude_code' })
  brainProviderId: string;

  @Column({ name: 'system_prompt', type: 'text', nullable: true })
  systemPrompt: string;

  @Column({ name: 'max_concurrent_tasks', default: 1 })
  maxConcurrentTasks: number;

  // 통계
  @Column({ name: 'tasks_completed', default: 0 })
  tasksCompleted: number;

  @Column({
    name: 'average_task_duration',
    type: 'float',
    nullable: true,
  })
  averageTaskDuration: number;

  @Column({
    name: 'success_rate',
    type: 'float',
    nullable: true,
  })
  successRate: number;

  @Column({ name: 'last_active_at', type: 'timestamp', nullable: true })
  lastActiveAt: Date;

  @Column({ name: 'current_task_id', nullable: true })
  currentTaskId: string;

  // Relations
  @ManyToOne(() => Organization, (org) => org.hollons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Team, (team) => team.hollons, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @ManyToOne(() => Role, (role) => role.hollons)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @OneToMany(() => Task, (task) => task.assignedHollon)
  assignedTasks: Task[];

  @OneToMany(() => Task, (task) => task.creatorHollon)
  createdTasks: Task[];
}
