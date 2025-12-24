import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GraphNode } from './entities/graph-node.entity';
import { GraphEdge } from './entities/graph-edge.entity';

@Injectable()
export class KnowledgeGraphService {
  constructor(
    @InjectRepository(GraphNode)
    private readonly graphNodeRepository: Repository<GraphNode>,
    @InjectRepository(GraphEdge)
    private readonly graphEdgeRepository: Repository<GraphEdge>,
  ) {}

  async createNode(nodeData: Partial<GraphNode>): Promise<GraphNode> {
    const node = this.graphNodeRepository.create(nodeData);
    return this.graphNodeRepository.save(node);
  }

  async createEdge(edgeData: Partial<GraphEdge>): Promise<GraphEdge> {
    const edge = this.graphEdgeRepository.create(edgeData);
    return this.graphEdgeRepository.save(edge);
  }

  async findNodeById(id: string): Promise<GraphNode | null> {
    return this.graphNodeRepository.findOne({ where: { id } });
  }

  async findNodesByOrganization(organizationId: string): Promise<GraphNode[]> {
    return this.graphNodeRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findEdgesByNode(nodeId: string): Promise<GraphEdge[]> {
    return this.graphEdgeRepository.find({
      where: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }],
      relations: ['sourceNode', 'targetNode'],
    });
  }

  async deleteNode(id: string): Promise<void> {
    await this.graphNodeRepository.delete(id);
  }

  async deleteEdge(id: string): Promise<void> {
    await this.graphEdgeRepository.delete(id);
  }
}
