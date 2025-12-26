import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { KnowledgeItem } from './knowledge-item.entity';

@Entity('vector_embeddings')
@Index(['knowledgeItemId'])
@Index(['modelVersion'])
@Index(['createdAt'])
export class VectorEmbedding extends BaseEntity {
  @Column({ name: 'knowledge_item_id' })
  knowledgeItemId: string;

  @Column({
    type: 'vector',
    nullable: false,
  })
  embedding: number[];

  @Column({ type: 'int', nullable: false })
  dimension: number;

  @Column({ name: 'model_version', type: 'varchar', length: 100 })
  modelVersion: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  // Relations
  @ManyToOne(() => KnowledgeItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledge_item_id' })
  knowledgeItem: KnowledgeItem;
}
