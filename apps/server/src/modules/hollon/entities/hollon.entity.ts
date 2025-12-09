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
  PAUSED = 'paused',
  ERROR = 'error',
  OFFLINE = 'offline',
}

export enum HollonLifecycle {
  PERMANENT = 'permanent',
  TEMPORARY = 'temporary',
}

export enum ExperienceLevel {
  JUNIOR = 'junior',
  MID = 'mid',
  SENIOR = 'senior',
  LEAD = 'lead',
  PRINCIPAL = 'principal',
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

  @Column({
    type: 'enum',
    enum: HollonLifecycle,
    default: HollonLifecycle.PERMANENT,
  })
  lifecycle: HollonLifecycle;

  @Column({ name: 'created_by_hollon_id', type: 'uuid', nullable: true })
  createdByHollonId: string | null;

  // 안전장치: 임시 홀론 재귀 생성 깊이 (영구 홀론은 depth 제한 없음)
  @Column({ default: 0 })
  depth: number;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId: string | null;

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

  @Column({ name: 'current_task_id', type: 'uuid', nullable: true })
  currentTaskId: string;

  // ✅ Phase 3.5: 직속 상사 (stored - 성능 우선)
  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId: string | null;

  // ✅ Phase 3.5: 경험 레벨 (통계적 성과 지표 - 개별 성장 아님!)
  @Column({
    name: 'experience_level',
    type: 'enum',
    enum: ExperienceLevel,
    default: ExperienceLevel.MID,
  })
  experienceLevel: ExperienceLevel;

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

  // ✅ Phase 3.5: Self-referencing (manager)
  @ManyToOne(() => Hollon, (hollon) => hollon.subordinates, { nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager: Hollon | null;

  @OneToMany(() => Hollon, (hollon) => hollon.manager)
  subordinates: Hollon[];
}
