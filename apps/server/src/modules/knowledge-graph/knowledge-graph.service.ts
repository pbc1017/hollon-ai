import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Node } from './entities/node.entity';
import { Edge } from './entities/edge.entity';

@Injectable()
export class KnowledgeGraphService {
  constructor(
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    @InjectRepository(Edge)
    private readonly edgeRepository: Repository<Edge>,
  ) {}

  async createNode(nodeData: Partial<Node>): Promise<Node> {
    const node = this.nodeRepository.create(nodeData);
    return this.nodeRepository.save(node);
  }

  async createEdge(edgeData: Partial<Edge>): Promise<Edge> {
    const edge = this.edgeRepository.create(edgeData);
    return this.edgeRepository.save(edge);
  }

  async findNodeById(id: string): Promise<Node | null> {
    return this.nodeRepository.findOne({ where: { id } });
  }

  async findNodesByOrganization(organizationId: string): Promise<Node[]> {
    return this.nodeRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findEdgesByNode(nodeId: string): Promise<Edge[]> {
    return this.edgeRepository.find({
      where: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }],
      relations: ['sourceNode', 'targetNode'],
    });
  }

  async deleteNode(id: string): Promise<void> {
    await this.nodeRepository.delete(id);
  }

  async deleteEdge(id: string): Promise<void> {
    await this.edgeRepository.delete(id);
  }
}
