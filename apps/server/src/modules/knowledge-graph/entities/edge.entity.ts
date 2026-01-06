import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Node } from './node.entity';

export enum EdgeType {
  CREATED_BY = 'created_by',
  BELONGS_TO = 'belongs_to',
  MANAGES = 'manages',
  COLLABORATES_WITH = 'collaborates_with',
  DEPENDS_ON = 'depends_on',
  REFERENCES = 'references',
  IMPLEMENTS = 'implements',
  DERIVES_FROM = 'derives_from',
  RELATED_TO = 'related_to',
  CHILD_OF = 'child_of',
  PART_OF = 'part_of',
  CUSTOM = 'custom',
}

@Entity('knowledge_graph_edges')
@Index(['type'])
@Index(['sourceNodeId', 'targetNodeId'])
@Index(['sourceNodeId', 'type'])
@Index(['targetNodeId', 'type'])
@Index(['organizationId'])
@Index(['createdAt'])
export class Edge extends BaseEntity {
  @Column({ name: 'source_node_id', type: 'uuid' })
  sourceNodeId: string;

  @Column({ name: 'target_node_id', type: 'uuid' })
  targetNodeId: string;

  @Column({
    type: 'enum',
    enum: EdgeType,
    default: EdgeType.RELATED_TO,
  })
  type: EdgeType;

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

  // Relations
  @ManyToOne(() => Node, (node) => node.outgoingEdges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_node_id' })
  sourceNode: Node;

  @ManyToOne(() => Node, (node) => node.incomingEdges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_node_id' })
  targetNode: Node;
}
