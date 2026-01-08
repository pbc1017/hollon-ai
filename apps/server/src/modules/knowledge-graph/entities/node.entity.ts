import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Edge } from './edge.entity';

export enum NodeType {
  PERSON = 'person',
  ORGANIZATION = 'organization',
  TEAM = 'team',
  TASK = 'task',
  DOCUMENT = 'document',
  CODE = 'code',
  CONCEPT = 'concept',
  GOAL = 'goal',
  SKILL = 'skill',
  TOOL = 'tool',
  CUSTOM = 'custom',
}

@Entity('knowledge_graph_nodes')
@Index(['type'])
@Index(['organizationId'])
@Index(['createdAt'])
// Note: GIN index on properties JSONB column is created manually in migration
export class Node extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: NodeType,
    default: NodeType.CUSTOM,
  })
  type: NodeType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  // Flexible JSON properties for storing additional data
  @Column({ type: 'jsonb', default: {} })
  properties: Record<string, any>;

  // Metadata for search and filtering
  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  // For soft delete pattern
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /**
   * Vector embedding for semantic search and similarity matching
   * Stored as text type in TypeScript, actual vector type set in migration
   * This enables semantic search across graph nodes based on their content
   *
   * Note: The actual database column type is vector(1536) for pgvector
   * Format in database: [0.1, 0.2, 0.3, ...]
   */
  @Column({ type: 'text', nullable: true })
  embedding: string | null;

  // Relations - outgoing edges (this node is the source)
  @OneToMany(() => Edge, (edge) => edge.sourceNode)
  outgoingEdges: Edge[];

  // Relations - incoming edges (this node is the target)
  @OneToMany(() => Edge, (edge) => edge.targetNode)
  incomingEdges: Edge[];
}
