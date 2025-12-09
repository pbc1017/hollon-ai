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
import { Task } from '../../task/entities/task.entity';
import { Document } from '../../document/entities/document.entity';
import { Goal } from '../../goal/entities/goal.entity';
import { Team } from '../../team/entities/team.entity';

export enum ProjectStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

@Entity('projects')
@Index(['organizationId', 'status'])
export class Project extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.ACTIVE,
  })
  status: ProjectStatus;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'repository_url', length: 500, nullable: true })
  repositoryUrl: string;

  @Column({ name: 'working_directory', length: 500, nullable: true })
  workingDirectory: string;

  @Column({ type: 'jsonb', nullable: true, default: {}, name: 'metadata' })
  metadata: Record<string, unknown>;

  @Column({ name: 'goal_id', nullable: true })
  goalId: string;

  // ✅ Phase 3.5: 팀 할당
  @Column({ name: 'assigned_team_id', type: 'uuid', nullable: true })
  assignedTeamId: string | null;

  // Relations
  @ManyToOne(() => Organization, (org) => org.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @OneToMany(() => Task, (task) => task.project)
  tasks: Task[];

  @OneToMany(() => Document, (doc) => doc.project)
  documents: Document[];

  @ManyToOne(() => Goal, (goal) => goal.projects, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'goal_id' })
  goal: Goal;

  // ✅ Phase 3.5: 할당된 팀
  @ManyToOne(() => Team, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_team_id' })
  assignedTeam: Team | null;
}
