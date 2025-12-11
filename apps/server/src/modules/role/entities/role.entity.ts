import {
  Entity,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity('roles')
@Index('IDX_roles_organization_name', ['organizationId', 'name'], {
  unique: true,
})
export class Role extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', default: [] })
  capabilities: string[];

  @Column({ name: 'system_prompt', type: 'text', nullable: true })
  systemPrompt: string;

  @Column({
    name: 'available_for_temporary_hollon',
    type: 'boolean',
    default: false,
  })
  availableForTemporaryHollon: boolean;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @OneToMany(() => Hollon, (hollon) => hollon.role)
  hollons: Hollon[];
}
