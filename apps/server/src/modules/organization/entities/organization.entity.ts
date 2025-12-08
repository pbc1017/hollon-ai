import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Team } from '../../team/entities/team.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Project } from '../../project/entities/project.entity';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  contextPrompt: string;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  settings: Record<string, unknown>;

  @OneToMany(() => Team, (team) => team.organization)
  teams: Team[];

  @OneToMany(() => Hollon, (hollon) => hollon.organization)
  hollons: Hollon[];

  @OneToMany(() => Project, (project) => project.organization)
  projects: Project[];
}
