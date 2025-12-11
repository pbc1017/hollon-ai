import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  JoinTable,
  Index,
  Check,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Project } from '../../project/entities/project.entity';
import { Cycle } from '../../project/entities/cycle.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Team } from '../../team/entities/team.entity';

export enum TaskStatus {
  PENDING = 'pending',
  READY = 'ready',
  IN_PROGRESS = 'in_progress',
  READY_FOR_REVIEW = 'ready_for_review', // Phase 3.10: Subtasks completed, awaiting parent review
  IN_REVIEW = 'in_review',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  P1_CRITICAL = 'P1',
  P2_HIGH = 'P2',
  P3_MEDIUM = 'P3',
  P4_LOW = 'P4',
}

export enum TaskType {
  TEAM_EPIC = 'team_epic', // Phase 3.8: Team-level task (Level 0)
  PLANNING = 'planning',
  ANALYSIS = 'analysis',
  IMPLEMENTATION = 'implementation',
  REVIEW = 'review',
  RESEARCH = 'research',
  BUG_FIX = 'bug_fix',
  DOCUMENTATION = 'documentation',
  DISCUSSION = 'discussion',
}

@Entity('tasks')
@Index(['projectId', 'status'])
@Index(['assignedHollonId', 'status'])
@Index(['status', 'priority'])
@Check('"depth" <= 3') // 서브태스크 최대 깊이 제한
export class Task extends BaseEntity {
  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: TaskType,
    default: TaskType.IMPLEMENTATION,
  })
  type: TaskType;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @Column({
    type: 'enum',
    enum: TaskPriority,
    default: TaskPriority.P3_MEDIUM,
  })
  priority: TaskPriority;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'project_id', nullable: true })
  projectId: string;

  @Column({ name: 'cycle_id', type: 'uuid', nullable: true })
  cycleId: string | null;

  // Phase 3.8: Team-level assignment (Level 0)
  // Mutually exclusive with assigned_hollon_id
  @Column({ name: 'assigned_team_id', type: 'uuid', nullable: true })
  assignedTeamId: string | null;

  @Column({ name: 'assigned_hollon_id', type: 'uuid', nullable: true })
  assignedHollonId: string | null;

  @Column({ name: 'parent_task_id', type: 'uuid', nullable: true })
  parentTaskId: string | null;

  @Column({ name: 'creator_hollon_id', type: 'uuid', nullable: true })
  creatorHollonId: string | null;

  // 안전장치: 서브태스크 재귀 제한
  @Column({ default: 0 })
  depth: number;

  // 안전장치: 파일 충돌 방지
  @Column({
    name: 'affected_files',
    type: 'jsonb',
    default: [],
  })
  affectedFiles: string[];

  // 메타데이터
  @Column({
    name: 'acceptance_criteria',
    type: 'jsonb',
    nullable: true,
  })
  acceptanceCriteria?: string[];

  @Column({
    name: 'estimated_complexity',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  estimatedComplexity?: 'low' | 'medium' | 'high' | null;

  @Column({ type: 'jsonb', nullable: true })
  tags?: string[];

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  // 애자일 메트릭스
  @Column({ name: 'story_points', type: 'integer', nullable: true, default: 0 })
  storyPoints?: number;

  @Column({ name: 'blocked_reason', type: 'text', nullable: true })
  blockedReason?: string | null;

  // 타임스탬프
  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'due_date', type: 'timestamp', nullable: true })
  dueDate?: Date | null;

  // ✅ Phase 3.5: 필요 스킬 (Role.capabilities와 매칭)
  @Column({ name: 'required_skills', type: 'text', array: true, default: '{}' })
  requiredSkills: string[];

  // ✅ Phase 3.5: 인간 승인 플래그 (Level 5 에스컬레이션)
  @Column({ name: 'needs_human_approval', default: false })
  needsHumanApproval: boolean;

  // ✅ Phase 3.7: 무한 루프 방지 (Exponential backoff)
  @Column({ name: 'consecutive_failures', default: 0 })
  consecutiveFailures: number;

  @Column({ name: 'last_failed_at', type: 'timestamp', nullable: true })
  lastFailedAt?: Date | null;

  @Column({ name: 'blocked_until', type: 'timestamp', nullable: true })
  blockedUntil?: Date | null;

  // ✅ Phase 3.10: LLM Review Cycle
  @Column({ name: 'review_count', default: 0 })
  reviewCount: number;

  @Column({ name: 'last_reviewed_at', type: 'timestamp', nullable: true })
  lastReviewedAt?: Date | null;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Project, (project) => project.tasks, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Cycle, (cycle) => cycle.tasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'cycle_id' })
  cycle: Cycle;

  // Phase 3.8: Team assignment (Level 0 tasks)
  @ManyToOne(() => Team, (team) => team.assignedTasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'assigned_team_id' })
  assignedTeam: Team;

  @ManyToOne(() => Hollon, (hollon) => hollon.assignedTasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'assigned_hollon_id' })
  assignedHollon: Hollon;

  @ManyToOne(() => Task, (task) => task.subtasks, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_task_id' })
  parentTask: Task;

  @OneToMany(() => Task, (task) => task.parentTask)
  subtasks: Task[];

  @ManyToOne(() => Hollon, (hollon) => hollon.createdTasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'creator_hollon_id' })
  creatorHollon: Hollon;

  // Task Dependencies (DAG 구조)
  // 이 태스크가 의존하는 태스크들 (선행 조건)
  @ManyToMany(() => Task, (task) => task.dependentTasks)
  @JoinTable({
    name: 'task_dependencies',
    joinColumn: { name: 'task_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'depends_on_id', referencedColumnName: 'id' },
  })
  dependencies: Task[];

  // 이 태스크에 의존하는 태스크들 (후행 태스크)
  @ManyToMany(() => Task, (task) => task.dependencies)
  dependentTasks: Task[];
}
