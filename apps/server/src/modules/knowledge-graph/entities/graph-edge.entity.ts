import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { GraphNode } from './graph-node.entity';

export enum EdgeType {
  RELATED_TO = 'related_to',
  DEPENDS_ON = 'depends_on',
  PART_OF = 'part_of',
  CAUSES = 'causes',
  ASSIGNED_TO = 'assigned_to',
  CREATED_BY = 'created_by',
  REFERENCES = 'references',
  FOLLOWS = 'follows',
}

@Entity('graph_edges')
@Index(['organizationId', 'edgeType'])
@Index(['sourceNodeId', 'targetNodeId'])
export class GraphEdge extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'source_node_id' })
  sourceNodeId: string;

  @Column({ name: 'target_node_id' })
  targetNodeId: string;

  @Column({
    type: 'enum',
    enum: EdgeType,
    name: 'edge_type',
  })
  edgeType: EdgeType;

  @Column({ type: 'float', nullable: true })
  weight: number | null;

  @Column({ type: 'jsonb', nullable: true })
  properties: Record<string, any> | null;

  @ManyToOne(() => GraphNode, (node) => node.outgoingEdges, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'source_node_id' })
  sourceNode: GraphNode;

  @ManyToOne(() => GraphNode, (node) => node.incomingEdges, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'target_node_id' })
  targetNode: GraphNode;
}
