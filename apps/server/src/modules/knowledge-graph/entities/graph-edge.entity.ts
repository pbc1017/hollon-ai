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

  @Column('uuid')
  sourceNodeId: string;

  @Column('uuid')
  targetNodeId: string;

  @Column({
    type: 'enum',
    enum: EdgeType,
    name: 'edge_type',
  })
  edgeType: EdgeType;

  @Column('float', { nullable: true })
  weight: number | null;

  @Column('jsonb', { nullable: true, name: 'properties' })
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
