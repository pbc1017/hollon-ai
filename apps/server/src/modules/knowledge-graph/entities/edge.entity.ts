import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Node } from './node.entity';
import { RelationshipType } from '../../../knowledge/enums/relationship-type.enum';

/**
 * @deprecated Use RelationshipType instead. This alias is kept for backward compatibility.
 */
export const EdgeType = RelationshipType;

@Entity('knowledge_graph_edges')
@Index(['type'])
@Index(['sourceNodeId', 'targetNodeId'])
@Index(['sourceNodeId', 'type'])
@Index(['targetNodeId', 'type'])
@Index(['organizationId'])
@Index(['createdAt'])
// Composite indexes for improved query performance
@Index(['organizationId', 'type']) // Multi-tenancy + type filtering
@Index(['organizationId', 'isActive']) // Multi-tenancy + soft delete filtering
export class Edge extends BaseEntity {
  @Column({ name: 'source_node_id', type: 'uuid' })
  sourceNodeId: string;

  @Column({ name: 'target_node_id', type: 'uuid' })
  targetNodeId: string;

  @Column({
    type: 'enum',
    enum: RelationshipType,
    default: RelationshipType.RELATES_TO,
  })
  type: RelationshipType;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  // Optional weight for weighted graphs
  @Column({ type: 'float', default: 1.0 })
  weight: number;

  // Flexible JSON properties for storing additional relationship data
  @Column({ type: 'jsonb', default: {} })
  properties: Record<string, any>;

  // For soft delete pattern
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /**
   * Vector embedding for semantic search on relationships
   * Stored as text type in TypeScript, actual vector type set in migration
   * Enables finding similar relationships based on their properties and context
   *
   * Note: The actual database column type is vector(1536) for pgvector
   * Format in database: [0.1, 0.2, 0.3, ...]
   */
  @Column({ type: 'text', nullable: true })
  embedding: string | null;

  // Relations
  @ManyToOne(() => Node, (node) => node.outgoingEdges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_node_id' })
  sourceNode: Node;

  @ManyToOne(() => Node, (node) => node.incomingEdges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_node_id' })
  targetNode: Node;
}
