import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Node } from './entities/node.entity';
import { Edge } from './entities/edge.entity';
import { RelationshipType } from '../../knowledge/enums/relationship-type.enum';

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

  /**
   * Create a query builder for nodes
   * Useful for building complex queries with filters
   */
  createNodeQuery(): SelectQueryBuilder<Node> {
    return this.nodeRepository.createQueryBuilder('node');
  }

  /**
   * Create a query builder for edges
   * Useful for building complex queries with filters
   */
  createEdgeQuery(): SelectQueryBuilder<Edge> {
    return this.edgeRepository
      .createQueryBuilder('edge')
      .leftJoinAndSelect('edge.sourceNode', 'sourceNode')
      .leftJoinAndSelect('edge.targetNode', 'targetNode');
  }

  /**
   * Extract a subgraph from a starting node using BFS traversal
   * Returns all nodes and edges within the specified depth
   *
   * @param nodeId Root node ID
   * @param depth Maximum depth for traversal
   * @param includeActive Whether to include only active nodes
   * @param relationshipTypes Optional filter for relationship types to follow
   * @returns Object containing nodes and edges in the subgraph
   */
  async extractSubgraph(
    nodeId: string,
    depth: number,
    includeActive: boolean = true,
    relationshipTypes?: RelationshipType[],
  ): Promise<{ nodes: Node[]; edges: Edge[] }> {
    const visited = new Set<string>();
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const queue: Array<{ id: string; currentDepth: number }> = [{ id: nodeId, currentDepth: 0 }];

    // BFS traversal
    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!;

      // Skip if already visited or depth exceeded
      if (visited.has(id) || currentDepth > depth) {
        continue;
      }
      visited.add(id);

      // Fetch node
      const node = await this.nodeRepository.findOne({ where: { id } });
      if (!node || (includeActive && !node.isActive)) {
        continue;
      }
      nodes.push(node);

      // Skip if max depth reached
      if (currentDepth === depth) {
        continue;
      }

      // Find connected edges
      let edgeQuery = this.edgeRepository
        .createQueryBuilder('edge')
        .where('(edge.sourceNodeId = :nodeId OR edge.targetNodeId = :nodeId)', { nodeId: id });

      if (includeActive) {
        edgeQuery = edgeQuery.andWhere('edge.isActive = true');
      }

      if (relationshipTypes && relationshipTypes.length > 0) {
        edgeQuery = edgeQuery.andWhere('edge.type IN (:...types)', { types: relationshipTypes });
      }

      const connectedEdges = await edgeQuery.getMany();

      // Add edges and queue connected nodes
      for (const edge of connectedEdges) {
        if (includeActive && !edge.isActive) {
          continue;
        }

        const connectedNodeId =
          edge.sourceNodeId === id ? edge.targetNodeId : edge.sourceNodeId;

        if (!visited.has(connectedNodeId)) {
          queue.push({ id: connectedNodeId, currentDepth: currentDepth + 1 });
        }

        // Only include edges if both nodes are in the subgraph
        if (visited.has(edge.sourceNodeId) && visited.has(edge.targetNodeId)) {
          edges.push(edge);
        }
      }
    }

    // Filter edges to only include those where both nodes are in the subgraph
    const nodeIds = new Set(nodes.map((n) => n.id));
    const filteredEdges = edges.filter(
      (e) => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId),
    );

    return { nodes, edges: filteredEdges };
  }
}
