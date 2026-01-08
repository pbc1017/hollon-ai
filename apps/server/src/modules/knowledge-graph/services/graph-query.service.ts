import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Node } from '../entities/node.entity';
import { Edge } from '../entities/edge.entity';
import {
  IGraphPath,
  IGraphTraversalOptions,
  IGraphStructure,
  IGraphMetadata,
} from '../interfaces/graph.interface';
import { ShortestPathAlgorithm } from '../algorithms/shortest-path';
import { GraphTraversal } from '../algorithms/traversal';
import { NodeType } from '../entities/node.entity';
import { RelationshipType } from '../../../knowledge/enums/relationship-type.enum';

/**
 * GraphQueryService
 *
 * Advanced querying and traversal capabilities for the knowledge graph.
 * Provides methods for:
 * - Finding shortest paths between nodes
 * - Querying neighbors with depth control
 * - Extracting subgraphs based on criteria
 * - Filtering relationships
 * - Graph analysis and traversal
 */
@Injectable()
export class GraphQueryService {
  constructor(
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    @InjectRepository(Edge)
    private readonly edgeRepository: Repository<Edge>,
  ) {}

  /**
   * Find the shortest path between two nodes using Dijkstra's algorithm
   *
   * @param sourceNodeId - Starting node ID
   * @param targetNodeId - Destination node ID
   * @param organizationId - Organization context
   * @param maxDepth - Optional maximum depth limit
   * @returns IGraphPath with the shortest path or null if no path exists
   */
  async findShortestPath(
    sourceNodeId: string,
    targetNodeId: string,
    organizationId: string,
    maxDepth?: number,
  ): Promise<IGraphPath | null> {
    const [sourceNode, targetNode, nodes, edges] = await Promise.all([
      this.nodeRepository.findOne({
        where: { id: sourceNodeId, organizationId, isActive: true },
      }),
      this.nodeRepository.findOne({
        where: { id: targetNodeId, organizationId, isActive: true },
      }),
      this.nodeRepository.find({
        where: { organizationId, isActive: true },
      }),
      this.edgeRepository.find({
        where: { organizationId, isActive: true },
        relations: ['sourceNode', 'targetNode'],
      }),
    ]);

    if (!sourceNode || !targetNode) {
      return null;
    }

    return ShortestPathAlgorithm.findShortestPath(
      sourceNode,
      targetNode,
      nodes,
      edges,
      maxDepth,
    );
  }

  /**
   * Find all shortest paths from a source node to all reachable nodes
   *
   * @param sourceNodeId - Starting node ID
   * @param organizationId - Organization context
   * @param maxDepth - Optional maximum depth limit
   * @returns Map of node IDs to their shortest paths
   */
  async findAllShortestPaths(
    sourceNodeId: string,
    organizationId: string,
    maxDepth?: number,
  ): Promise<Map<string, IGraphPath>> {
    const sourceNode = await this.nodeRepository.findOne({
      where: { id: sourceNodeId, organizationId, isActive: true },
    });

    if (!sourceNode) {
      return new Map();
    }

    const [nodes, edges] = await Promise.all([
      this.nodeRepository.find({
        where: { organizationId, isActive: true },
      }),
      this.edgeRepository.find({
        where: { organizationId, isActive: true },
        relations: ['sourceNode', 'targetNode'],
      }),
    ]);

    return ShortestPathAlgorithm.findAllShortestPaths(sourceNode, nodes, edges, maxDepth);
  }

  /**
   * Query neighbors of a node with configurable depth control
   *
   * @param nodeId - Center node ID
   * @param organizationId - Organization context
   * @param options - Traversal options (depth, direction, type filters)
   * @returns Neighbors grouped by depth
   */
  async queryNeighbors(
    nodeId: string,
    organizationId: string,
    options: Partial<IGraphTraversalOptions> = {},
  ): Promise<Map<number, Node[]>> {
    const node = await this.nodeRepository.findOne({
      where: { id: nodeId, organizationId, isActive: true },
    });

    if (!node) {
      return new Map();
    }

    const depth = options.maxDepth ?? 2;
    const direction = (options.direction as 'in' | 'out' | 'both') ?? 'out';

    const [nodes, edges] = await Promise.all([
      this.nodeRepository.find({
        where: { organizationId, isActive: true },
      }),
      this.edgeRepository.find({
        where: { organizationId, isActive: true },
      }),
    ]);

    return GraphTraversal.findNeighborsByDepth(node, nodes, edges, depth, direction);
  }

  /**
   * Get neighbors of a node at a specific depth with filtering
   *
   * @param nodeId - Center node ID
   * @param organizationId - Organization context
   * @param depth - Depth level to return (1 = direct neighbors)
   * @param filters - Optional filtering criteria
   * @returns Nodes at the specified depth
   */
  async getNeighborsAtDepth(
    nodeId: string,
    organizationId: string,
    depth: number,
    filters?: {
      nodeTypes?: NodeType[];
      edgeTypes?: RelationshipType[];
      direction?: 'in' | 'out' | 'both';
    },
  ): Promise<Node[]> {
    const neighbors = await this.queryNeighbors(nodeId, organizationId, {
      maxDepth: depth,
      direction: filters?.direction || 'out',
    });

    const nodesAtDepth = neighbors.get(depth) || [];

    // Apply type filters
    if (filters?.nodeTypes && filters.nodeTypes.length > 0) {
      return nodesAtDepth.filter((n) => filters.nodeTypes!.includes(n.type));
    }

    return nodesAtDepth;
  }

  /**
   * Extract a subgraph starting from a node with specified depth
   *
   * @param nodeId - Root node ID
   * @param organizationId - Organization context
   * @param depth - Maximum depth for subgraph extraction
   * @param filters - Optional filtering criteria
   * @returns IGraphStructure containing the subgraph
   */
  async extractSubgraph(
    nodeId: string,
    organizationId: string,
    depth: number,
    filters?: {
      nodeTypes?: NodeType[];
      edgeTypes?: RelationshipType[];
      includeInactive?: boolean;
    },
  ): Promise<IGraphStructure | null> {
    const rootNode = await this.nodeRepository.findOne({
      where: { id: nodeId, organizationId, isActive: true },
    });

    if (!rootNode) {
      return null;
    }

    const [allNodes, allEdges] = await Promise.all([
      this.nodeRepository.find({
        where: filters?.includeInactive
          ? { organizationId }
          : { organizationId, isActive: true },
      }),
      this.edgeRepository.find({
        where: filters?.includeInactive
          ? { organizationId }
          : { organizationId, isActive: true },
      }),
    ]);

    // Traverse to collect nodes
    const options: Partial<IGraphTraversalOptions> = {
      maxDepth: depth,
      direction: 'both',
      nodeTypes: filters?.nodeTypes,
      edgeTypes: filters?.edgeTypes,
    };

    const traversalOptions = {
      ...options,
      maxDepth: depth,
    };

    const traversedNodes = GraphTraversal.bfs(
      rootNode,
      allNodes,
      allEdges,
      traversalOptions as any,
    );

    const subgraphNodeIds = new Set(traversedNodes.map((n) => n.id));

    // Filter edges to only include those within the subgraph
    const subgraphEdges = allEdges.filter(
      (edge) =>
        subgraphNodeIds.has(edge.sourceNodeId) && subgraphNodeIds.has(edge.targetNodeId),
    );

    // Apply edge type filter if specified
    const filteredEdges = filters?.edgeTypes
      ? subgraphEdges.filter((e) => filters.edgeTypes!.includes(e.type))
      : subgraphEdges;

    return {
      nodes: traversedNodes,
      edges: filteredEdges,
      metadata: this.generateMetadata(traversedNodes, filteredEdges, organizationId, rootNode.id, depth),
    };
  }

  /**
   * Get related nodes filtered by relationship type
   *
   * @param nodeId - Source node ID
   * @param organizationId - Organization context
   * @param relationshipType - Type of relationships to follow
   * @param direction - Relationship direction
   * @param depth - Maximum depth for search
   * @returns Related nodes
   */
  async getRelatedNodesByType(
    nodeId: string,
    organizationId: string,
    relationshipType: RelationshipType,
    direction: 'in' | 'out' | 'both' = 'out',
    depth: number = 1,
  ): Promise<Node[]> {
    const sourceNode = await this.nodeRepository.findOne({
      where: { id: nodeId, organizationId, isActive: true },
    });

    if (!sourceNode) {
      return [];
    }

    const edges = await this.edgeRepository.find({
      where: {
        type: relationshipType,
        organizationId,
        isActive: true,
      },
      relations: ['sourceNode', 'targetNode'],
    });

    const allNodes = await this.nodeRepository.find({
      where: { organizationId, isActive: true },
    });

    // Build graph with only the specified relationship type
    const graph = new Map<string, string[]>();

    for (const edge of edges) {
      if (direction === 'out' || direction === 'both') {
        if (!graph.has(edge.sourceNodeId)) {
          graph.set(edge.sourceNodeId, []);
        }
        graph.get(edge.sourceNodeId)!.push(edge.targetNodeId);
      }

      if (direction === 'in' || direction === 'both') {
        const inKey = `in:${edge.targetNodeId}`;
        if (!graph.has(inKey)) {
          graph.set(inKey, []);
        }
        graph.get(inKey)!.push(edge.sourceNodeId);
      }
    }

    // BFS with the filtered graph
    const visited = new Set<string>();
    const result: Node[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];
    visited.add(nodeId);

    const nodeMap = new Map<string, Node>();
    for (const n of allNodes) {
      nodeMap.set(n.id, n);
    }

    while (queue.length > 0) {
      const { id: currentId, depth: currentDepth } = queue.shift()!;

      if (currentDepth > 0) {
        const node = nodeMap.get(currentId);
        if (node) {
          result.push(node);
        }
      }

      if (currentDepth >= depth) {
        continue;
      }

      // Get outgoing neighbors
      const outNeighbors = (graph.get(currentId) || []) as string[];
      for (const neighborId of outNeighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ id: neighborId, depth: currentDepth + 1 });
        }
      }

      // Get incoming neighbors if direction allows
      if (direction === 'in' || direction === 'both') {
        const inKey = `in:${currentId}`;
        const inNeighbors = (graph.get(inKey) || []) as string[];
        for (const neighborId of inNeighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push({ id: neighborId, depth: currentDepth + 1 });
          }
        }
      }
    }

    return result;
  }

  /**
   * Find common neighbors between two nodes
   *
   * @param nodeId1 - First node ID
   * @param nodeId2 - Second node ID
   * @param organizationId - Organization context
   * @returns Nodes that are neighbors of both input nodes
   */
  async findCommonNeighbors(
    nodeId1: string,
    nodeId2: string,
    organizationId: string,
  ): Promise<Node[]> {
    const [node1Neighbors, node2Neighbors] = await Promise.all([
      this.queryNeighbors(nodeId1, organizationId, { maxDepth: 1, direction: 'out' }),
      this.queryNeighbors(nodeId2, organizationId, { maxDepth: 1, direction: 'out' }),
    ]);

    const neighbors1 = new Set((node1Neighbors.get(1) || []).map((n) => n.id));
    const neighbors2 = node2Neighbors.get(1) || [];

    return neighbors2.filter((n) => neighbors1.has(n.id));
  }

  /**
   * Query relationship count and types between nodes
   *
   * @param sourceNodeId - Source node
   * @param targetNodeId - Target node
   * @param organizationId - Organization context
   * @returns Edge count and types between the nodes
   */
  async queryRelationshipsBetween(
    sourceNodeId: string,
    targetNodeId: string,
    organizationId: string,
  ): Promise<{
    directEdges: Edge[];
    reverseEdges: Edge[];
    relationshipTypes: RelationshipType[];
  }> {
    const [directEdges, reverseEdges] = await Promise.all([
      this.edgeRepository.find({
        where: {
          sourceNodeId,
          targetNodeId,
          organizationId,
          isActive: true,
        },
      }),
      this.edgeRepository.find({
        where: {
          sourceNodeId: targetNodeId,
          targetNodeId: sourceNodeId,
          organizationId,
          isActive: true,
        },
      }),
    ]);

    const allEdges = [...directEdges, ...reverseEdges];
    const relationshipTypes = Array.from(new Set(allEdges.map((e) => e.type)));

    return {
      directEdges,
      reverseEdges,
      relationshipTypes,
    };
  }

  /**
   * Find nodes matching multiple criteria (advanced filtering)
   *
   * @param organizationId - Organization context
   * @param filters - Filtering criteria
   * @returns Matching nodes
   */
  async findNodesByCriteria(
    organizationId: string,
    filters: {
      nodeTypes?: NodeType[];
      namePattern?: string;
      tags?: string[];
      matchAllTags?: boolean;
      includeInactive?: boolean;
    },
  ): Promise<Node[]> {
    let query = this.nodeRepository
      .createQueryBuilder('node')
      .where('node.organizationId = :organizationId', { organizationId });

    if (!filters.includeInactive) {
      query = query.andWhere('node.isActive = :isActive', { isActive: true });
    }

    if (filters.nodeTypes && filters.nodeTypes.length > 0) {
      query = query.andWhere('node.type IN (:...nodeTypes)', {
        nodeTypes: filters.nodeTypes,
      });
    }

    if (filters.namePattern) {
      query = query.andWhere('node.name ILIKE :namePattern', {
        namePattern: `%${filters.namePattern}%`,
      });
    }

    if (filters.tags && filters.tags.length > 0) {
      if (filters.matchAllTags) {
        // Match all tags
        for (const tag of filters.tags) {
          query = query.andWhere(':tag = ANY(node.tags)', { tag });
        }
      } else {
        // Match any tag
        query = query.andWhere('node.tags && :tags', { tags: filters.tags });
      }
    }

    return query.getMany();
  }

  /**
   * Generate graph statistics
   *
   * @param organizationId - Organization context
   * @returns Graph statistics including node/edge counts and distributions
   */
  async getGraphStatistics(organizationId: string): Promise<{
    nodeCount: number;
    edgeCount: number;
    nodeTypeDistribution: Record<NodeType, number>;
    edgeTypeDistribution: Record<RelationshipType, number>;
    averageNodeDegree: number;
  }> {
    const [nodes, edges] = await Promise.all([
      this.nodeRepository.find({
        where: { organizationId, isActive: true },
      }),
      this.edgeRepository.find({
        where: { organizationId, isActive: true },
      }),
    ]);

    const nodeTypeDistribution: Record<string, number> = {};
    const edgeTypeDistribution: Record<string, number> = {};

    for (const node of nodes) {
      nodeTypeDistribution[node.type] = (nodeTypeDistribution[node.type] || 0) + 1;
    }

    for (const edge of edges) {
      edgeTypeDistribution[edge.type] = (edgeTypeDistribution[edge.type] || 0) + 1;
    }

    const averageNodeDegree = nodes.length > 0 ? (edges.length * 2) / nodes.length : 0;

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypeDistribution: nodeTypeDistribution as Record<NodeType, number>,
      edgeTypeDistribution: edgeTypeDistribution as Record<RelationshipType, number>,
      averageNodeDegree,
    };
  }

  /**
   * Detect cycles in the graph
   *
   * @param organizationId - Organization context
   * @returns Array of detected cycles (each cycle is an array of node IDs)
   */
  async detectCycles(organizationId: string): Promise<string[][]> {
    const [nodes, edges] = await Promise.all([
      this.nodeRepository.find({
        where: { organizationId, isActive: true },
      }),
      this.edgeRepository.find({
        where: { organizationId, isActive: true },
      }),
    ]);

    return GraphTraversal.detectCycles(nodes, edges);
  }

  /**
   * Find connected components in the graph
   *
   * @param organizationId - Organization context
   * @returns Array of connected components (each is an array of node IDs)
   */
  async findConnectedComponents(organizationId: string): Promise<string[][]> {
    const [nodes, edges] = await Promise.all([
      this.nodeRepository.find({
        where: { organizationId, isActive: true },
      }),
      this.edgeRepository.find({
        where: { organizationId, isActive: true },
      }),
    ]);

    return GraphTraversal.findConnectedComponents(nodes, edges);
  }

  /**
   * Calculate node degree (in-degree and out-degree)
   *
   * @param nodeId - Node ID
   * @param organizationId - Organization context
   * @returns In-degree and out-degree values
   */
  async getNodeDegree(
    nodeId: string,
    organizationId: string,
  ): Promise<{ inDegree: number; outDegree: number } | null> {
    const node = await this.nodeRepository.findOne({
      where: { id: nodeId, organizationId, isActive: true },
    });

    if (!node) {
      return null;
    }

    const [incomingEdges, outgoingEdges] = await Promise.all([
      this.edgeRepository.count({
        where: { targetNodeId: nodeId, organizationId, isActive: true },
      }),
      this.edgeRepository.count({
        where: { sourceNodeId: nodeId, organizationId, isActive: true },
      }),
    ]);

    return {
      inDegree: incomingEdges,
      outDegree: outgoingEdges,
    };
  }

  /**
   * Find hub nodes (highly connected nodes)
   *
   * @param organizationId - Organization context
   * @param limit - Number of hubs to return
   * @param minDegree - Minimum degree threshold
   * @returns Most connected nodes
   */
  async findHubNodes(
    organizationId: string,
    limit: number = 10,
    minDegree: number = 2,
  ): Promise<Array<Node & { degree: number }>> {
    const nodes = await this.nodeRepository.find({
      where: { organizationId, isActive: true },
    });

    const nodesWithDegree: Array<Node & { degree: number }> = [];

    for (const node of nodes) {
      const degree = await this.edgeRepository.count({
        where: [
          { sourceNodeId: node.id, organizationId, isActive: true },
          { targetNodeId: node.id, organizationId, isActive: true },
        ],
      });

      if (degree >= minDegree) {
        nodesWithDegree.push({ ...node, degree });
      }
    }

    return nodesWithDegree.sort((a, b) => b.degree - a.degree).slice(0, limit);
  }

  /**
   * Generate metadata for a subgraph or graph
   *
   * @private
   */
  private generateMetadata(
    nodes: Node[],
    edges: Edge[],
    organizationId: string,
    rootNodeId?: string,
    maxDepth?: number,
  ): IGraphMetadata {
    const nodeTypeDistribution: Record<string, number> = {};
    const edgeTypeDistribution: Record<string, number> = {};

    for (const node of nodes) {
      nodeTypeDistribution[node.type] = (nodeTypeDistribution[node.type] || 0) + 1;
    }

    for (const edge of edges) {
      edgeTypeDistribution[edge.type] = (edgeTypeDistribution[edge.type] || 0) + 1;
    }

    const now = new Date();

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      organizationId,
      createdAt: nodes.length > 0 ? Math.min(...nodes.map((n) => n.createdAt.getTime())) as any : now,
      updatedAt: nodes.length > 0 ? Math.max(...nodes.map((n) => n.updatedAt.getTime())) as any : now,
      nodeTypeDistribution: nodeTypeDistribution as Record<NodeType, number>,
      edgeTypeDistribution: edgeTypeDistribution as Record<RelationshipType, number>,
      rootNodeId,
      maxDepth,
      schemaVersion: '1.0.0',
    };
  }
}
