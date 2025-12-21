import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity('users')
@Index('IDX_users_email', ['email'], { unique: true })
@Index('IDX_users_organization_id', ['organizationId'])
export class User extends BaseEntity {
  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 20, nullable: true })
  phoneNumber: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;
}
