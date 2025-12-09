import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';

@Entity('teams')
export class Team extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  // ✅ Phase 3.5: 계층 구조 지원
  @Column({ name: 'parent_team_id', type: 'uuid', nullable: true })
  parentTeamId: string | null;

  // ✅ Phase 3.5: 팀 리더 (선택적)
  @Column({ name: 'leader_hollon_id', type: 'uuid', nullable: true })
  leaderHollonId: string | null;

  // Relations
  @ManyToOne(() => Organization, (org) => org.teams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // ✅ Phase 3.5: Self-referencing (parent team)
  @ManyToOne(() => Team, (team) => team.childTeams, { nullable: true })
  @JoinColumn({ name: 'parent_team_id' })
  parentTeam: Team | null;

  @OneToMany(() => Team, (team) => team.parentTeam)
  childTeams: Team[];

  // ✅ Phase 3.5: Team leader
  @ManyToOne(() => Hollon, { nullable: true })
  @JoinColumn({ name: 'leader_hollon_id' })
  leader: Hollon | null;

  @OneToMany(() => Hollon, (hollon) => hollon.team)
  hollons: Hollon[];
}
