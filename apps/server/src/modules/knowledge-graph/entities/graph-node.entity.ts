import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { GraphEdge } from './graph-edge.entity';

export enum NodeType {
  CONCEPT = 'concept',
  ENTITY = 'entity',
  EVENT = 'event',
  ATTRIBUTE = 'attribute',
  TASK = 'task',
  HOLLON = 'hollon',
  DOCUMENT = 'document',
}

@Entity('graph_nodes')
@Index(['organizationId', 'nodeType'])
@Index(['organizationId', 'label'])
export class GraphNode extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({
    type: 'enum',
    enum: NodeType,
    name: 'node_type',
  })
  nodeType: NodeType;

  @Column({ length: 255 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  properties: Record<string, any> | null;

  @Column({ name: 'external_id', type: 'uuid', nullable: true })
  externalId: string | null;

  @Column({ name: 'external_type', length: 100, nullable: true })
  externalType: string | null;

  @OneToMany(() => GraphEdge, (edge) => edge.sourceNode)
  outgoingEdges: GraphEdge[];

  @OneToMany(() => GraphEdge, (edge) => edge.targetNode)
  incomingEdges: GraphEdge[];
}
