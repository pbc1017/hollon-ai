import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity('knowledge_items')
@Index(['organizationId'])
@Index(['source'])
@Index(['extractedAt'])
export class KnowledgeItem extends BaseEntity {
  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 255 })
  source: string;

  @Column({ name: 'extracted_at', type: 'timestamp' })
  extractedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'organization_id' })
  organizationId: string;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
