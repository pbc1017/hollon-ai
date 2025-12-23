import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Knowledge } from './knowledge.entity';

export enum EmbeddingModel {
  TEXT_EMBEDDING_3_SMALL = 'text-embedding-3-small',
  TEXT_EMBEDDING_3_LARGE = 'text-embedding-3-large',
  TEXT_EMBEDDING_ADA_002 = 'text-embedding-ada-002',
}

@Entity('embeddings')
@Index(['knowledgeId'])
@Index(['model'])
@Index(['isActive'])
export class Embedding extends BaseEntity {
  @Column({ name: 'knowledge_id' })
  knowledgeId: string;

  @Column({ type: 'text' })
  vector: string; // Stored as JSON string (e.g., "[0.1, 0.2, 0.3, ...]")

  @Column({
    type: 'enum',
    enum: EmbeddingModel,
  })
  model: EmbeddingModel;

  @Column({ name: 'vector_dimension', default: 1536 })
  vectorDimension: number;

  @Column({ name: 'input_tokens', nullable: true })
  inputTokens: number | null;

  @Column({ type: 'text', nullable: true })
  content: string | null; // Original content that was embedded

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({
    name: 'generated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  generatedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  // Relations
  @ManyToOne(() => Knowledge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledge_id' })
  knowledge: Knowledge;
}
