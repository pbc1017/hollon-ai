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

  // Relations
  @ManyToOne(() => Organization, (org) => org.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @OneToMany(() => Task, (task) => task.project)
  tasks: Task[];

  @OneToMany(() => Document, (doc) => doc.project)
  documents: Document[];
}
