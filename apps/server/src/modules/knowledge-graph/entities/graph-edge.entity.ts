import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { GraphNode } from './graph-node.entity';

@Entity('graph_edges')
@Index(['sourceNodeId', 'targetNodeId'])
@Index(['relationshipType'])
export class GraphEdge extends BaseEntity {
  @Column('uuid')
  sourceNodeId: string;

  @Column('uuid')
  targetNodeId: string;

  @Column()
  relationshipType: string;

  @Column('float', { default: 1.0 })
  weight: number;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any> | null;

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
