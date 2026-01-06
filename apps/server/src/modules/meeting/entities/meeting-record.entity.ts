import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Team } from '../../team/entities/team.entity';
import { Organization } from '../../organization/entities/organization.entity';

export enum MeetingType {
  STANDUP = 'standup',
  SPRINT_PLANNING = 'sprint_planning',
  RETROSPECTIVE = 'retrospective',
  TECH_DEBT_REVIEW = 'tech_debt_review',
  AD_HOC = 'ad_hoc',
}

@Entity('meeting_records')
export class MeetingRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId!: string | null;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'team_id' })
  team?: Team;

  @Column({
    type: 'enum',
    enum: MeetingType,
    name: 'meeting_type',
  })
  meetingType!: MeetingType;

  @Column({ length: 500 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @Column({ type: 'timestamp', name: 'scheduled_at', nullable: true })
  scheduledAt!: Date | null;

  @Column({ type: 'timestamp', name: 'completed_at', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
