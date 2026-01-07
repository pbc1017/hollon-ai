import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Node } from '../../modules/knowledge-graph/entities/node.entity';
import { Edge } from '../../modules/knowledge-graph/entities/edge.entity';
import { RelationshipType } from '../../knowledge/enums/relationship-type.enum';

/**
 * GraphTraversalService
 *
 * Provides efficient graph traversal algorithms including:
 * - Breadth-First Search (BFS)
 * - Depth-First Search (DFS)
 * - Neighbor queries with depth control
 * - Path finding between nodes
 *
 * Optimized for performance with large graphs through:
 * - Caching visited nodes
 * - Configurable depth limits
 * - Selective relationship filtering
 */
@Injectable()
export class GraphTraversalService {
  private readonly logger = new Logger(GraphTraversalService.name);

  constructor(
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    @InjectRepository(Edge)
    private readonly edgeRepository: Repository<Edge>,
  ) {}

  /**
   * Breadth-First Search traversal from a starting node
   *
   * @param startNodeId - UUID of the starting node
   * @param organizationId - UUID of the organization (for multi-tenancy)
   * @param maxDepth - Maximum depth to traverse (default: unlimited)
   * @param relationshipTypes - Filter by specific relationship types (optional)
   * @param direction - 'outgoing', 'incoming', or 'both' (default: 'both')
   * @returns Promise resolving to ordered array of traversed nodes with their depth
   */
  async bfs(
    startNodeId: string,
    organizationId: string,
    maxDepth?: number,
    relationshipTypes?: RelationshipType[],
    direction: 'outgoing' | 'incoming' | 'both' = 'both',
  ): Promise<
    Array<{
      node: Node;
      depth: number;
      path: string[];
    }>
  > {
    this.logger.debug(
      `Starting BFS from node ${startNodeId} with max depth ${maxDepth}`,
    );

    const visited = new Set<string>();
    const result: Array<{
      node: Node;
      depth: number;
      path: string[];
    }> = [];
    const queue: Array<{
      nodeId: string;
      depth: number;
      path: string[];
    }> = [{ nodeId: startNodeId, depth: 0, path: [startNodeId] }];

    while (queue.length > 0) {
      const { nodeId, depth, path } = queue.shift()!;

      if (visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);

      // Fetch the node
      const node = await this.nodeRepository.findOne({
        where: {
          id: nodeId,
          organizationId,
          isActive: true,
        },
      });

      if (!node) {
        continue;
      }

      result.push({ node, depth, path });

      // Check depth limit
      if (maxDepth !== undefined && depth >= maxDepth) {
        continue;
      }

      // Get neighbors
      const neighbors = await this.getNeighbors(
        nodeId,
        organizationId,
        relationshipTypes,
        direction,
      );

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          queue.push({
            nodeId: neighbor.id,
            depth: depth + 1,
            path: [...path, neighbor.id],
          });
        }
      }
    }

    this.logger.debug(`BFS traversal completed. Visited ${visited.size} nodes`);
    return result;
  }

  /**
   * Depth-First Search traversal from a starting node
   *
   * @param startNodeId - UUID of the starting node
   * @param organizationId - UUID of the organization
   * @param maxDepth - Maximum depth to traverse (default: unlimited)
   * @param relationshipTypes - Filter by specific relationship types (optional)
   * @param direction - 'outgoing', 'incoming', or 'both' (default: 'both')
   * @returns Promise resolving to array of traversed nodes with depth info
   */
  async dfs(
    startNodeId: string,
    organizationId: string,
    maxDepth?: number,
    relationshipTypes?: RelationshipType[],
    direction: 'outgoing' | 'incoming' | 'both' = 'both',
  ): Promise<
    Array<{
      node: Node;
      depth: number;
      path: string[];
    }>
  > {
    this.logger.debug(
      `Starting DFS from node ${startNodeId} with max depth ${maxDepth}`,
    );

    const visited = new Set<string>();
    const result: Array<{
      node: Node;
      depth: number;
      path: string[];
    }> = [];

    const dfsHelper = async (
      nodeId: string,
      depth: number,
      path: string[],
    ): Promise<void> => {
      if (visited.has(nodeId)) {
        return;
      }

      if (maxDepth !== undefined && depth > maxDepth) {
        return;
      }

      visited.add(nodeId);

      // Fetch the node
      const node = await this.nodeRepository.findOne({
        where: {
          id: nodeId,
          organizationId,
          isActive: true,
        },
      });

      if (!node) {
        return;
      }

      result.push({ node, depth, path: [...path, nodeId] });

      // Check depth limit
      if (maxDepth !== undefined && depth >= maxDepth) {
        return;
      }

      // Get neighbors and recurse
      const neighbors = await this.getNeighbors(
        nodeId,
        organizationId,
        relationshipTypes,
        direction,
      );

      for (const neighbor of neighbors) {
        await dfsHelper(neighbor.id, depth + 1, [...path, nodeId]);
      }
    };

    await dfsHelper(startNodeId, 0, []);

    this.logger.debug(`DFS traversal completed. Visited ${visited.size} nodes`);
    return result;
  }

  /**
   * Get all neighbors of a node with configurable depth control
   *
   * @param nodeId - UUID of the node
   * @param organizationId - UUID of the organization
   * @param relationshipTypes - Filter by specific relationship types
   * @param direction - 'outgoing', 'incoming', or 'both'
   * @param depth - How many levels of neighbors to retrieve (default: 1)
   * @returns Promise resolving to array of neighbor nodes with relationship info
   */
  async getNeighbors(
    nodeId: string,
    organizationId: string,
    relationshipTypes?: RelationshipType[],
    direction: 'outgoing' | 'incoming' | 'both' = 'both',
    depth: number = 1,
  ): Promise<
    Array<{
      id: string;
      name: string;
      distance: number;
      relationshipType: RelationshipType;
      edgeId: string;
      edgeWeight: number;
    }>
  > {
    if (depth < 1) {
      return [];
    }

    const result: Array<{
      id: string;
      name: string;
      distance: number;
      relationshipType: RelationshipType;
      edgeId: string;
      edgeWeight: number;
    }> = [];

    const visited = new Set<string>();
    const queue: Array<{
      nodeId: string;
      distance: number;
    }> = [{ nodeId, distance: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.nodeId) || current.distance > depth) {
        continue;
      }

      visited.add(current.nodeId);

      // Get edges based on direction
      let edges: Edge[] = [];

      if (direction === 'outgoing' || direction === 'both') {
        const outgoing = await this.edgeRepository.find({
          where: {
            sourceNodeId: current.nodeId,
            organizationId,
            isActive: true,
            ...(relationshipTypes && { type: relationshipTypes as any }),
          },
          relations: ['targetNode'],
        });
        edges.push(...outgoing);
      }

      if (direction === 'incoming' || direction === 'both') {
        const incoming = await this.edgeRepository.find({
          where: {
            targetNodeId: current.nodeId,
            organizationId,
            isActive: true,
            ...(relationshipTypes && { type: relationshipTypes as any }),
          },
          relations: ['sourceNode'],
        });
        edges.push(...incoming);
      }

      for (const edge of edges) {
        const neighborId =
          edge.sourceNodeId === current.nodeId
            ? edge.targetNodeId
            : edge.sourceNodeId;

        if (!visited.has(neighborId)) {
          const neighbor =
            edge.sourceNodeId === current.nodeId
              ? edge.targetNode
              : edge.sourceNode;

          if (current.distance < depth) {
            queue.push({ nodeId: neighborId, distance: current.distance + 1 });
          }

          if (current.distance === 0) {
            result.push({
              id: neighborId,
              name: neighbor.name,
              distance: current.distance + 1,
              relationshipType: edge.type,
              edgeId: edge.id,
              edgeWeight: edge.weight,
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Find all paths between two nodes up to a maximum length
   *
   * @param sourceNodeId - UUID of the source node
   * @param targetNodeId - UUID of the target node
   * @param organizationId - UUID of the organization
   * @param maxPathLength - Maximum path length (default: 5)
   * @returns Promise resolving to array of paths (each path is an array of node IDs)
   */
  async findAllPaths(
    sourceNodeId: string,
    targetNodeId: string,
    organizationId: string,
    maxPathLength: number = 5,
  ): Promise<string[][]> {
    const paths: string[][] = [];

    const dfsPath = async (
      current: string,
      target: string,
      visited: Set<string>,
      path: string[],
    ): Promise<void> => {
      if (current === target) {
        paths.push([...path]);
        return;
      }

      if (path.length - 1 >= maxPathLength) {
        return;
      }

      visited.add(current);

      const neighbors = await this.getNeighbors(
        current,
        organizationId,
        undefined,
        'both',
        1,
      );

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          path.push(neighbor.id);
          await dfsPath(neighbor.id, target, new Set(visited), path);
          path.pop();
        }
      }
    };

    await dfsPath(sourceNodeId, targetNodeId, new Set(), [sourceNodeId]);

    this.logger.debug(
      `Found ${paths.length} paths from ${sourceNodeId} to ${targetNodeId}`,
    );
    return paths;
  }

  /**
   * Check if two nodes are connected
   *
   * @param sourceNodeId - UUID of the source node
   * @param targetNodeId - UUID of the target node
   * @param organizationId - UUID of the organization
   * @param maxDepth - Maximum depth to search (default: 10)
   * @returns Promise resolving to true if connected, false otherwise
   */
  async isConnected(
    sourceNodeId: string,
    targetNodeId: string,
    organizationId: string,
    maxDepth: number = 10,
  ): Promise<boolean> {
    const result = await this.bfs(
      sourceNodeId,
      organizationId,
      maxDepth,
      undefined,
      'both',
    );

    return result.some((item) => item.node.id === targetNodeId);
  }

  /**
   * Get the common neighbors of two nodes
   *
   * @param nodeId1 - UUID of the first node
   * @param nodeId2 - UUID of the second node
   * @param organizationId - UUID of the organization
   * @returns Promise resolving to array of common neighbor nodes
   */
  async getCommonNeighbors(
    nodeId1: string,
    nodeId2: string,
    organizationId: string,
  ): Promise<Node[]> {
    const neighbors1 = await this.getNeighbors(nodeId1, organizationId);
    const neighbors2 = await this.getNeighbors(nodeId2, organizationId);

    const neighbor1Ids = new Set(neighbors1.map((n) => n.id));
    const commonIds = neighbors2
      .filter((n) => neighbor1Ids.has(n.id))
      .map((n) => n.id);

    if (commonIds.length === 0) {
      return [];
    }

    return this.nodeRepository.find({
      where: {
        id: commonIds as any,
        organizationId,
        isActive: true,
      },
    });
  }

  /**
   * Get ancestor nodes (all nodes that can reach the given node)
   *
   * @param nodeId - UUID of the node
   * @param organizationId - UUID of the organization
   * @param maxDepth - Maximum depth to traverse
   * @returns Promise resolving to array of ancestor nodes
   */
  async getAncestors(
    nodeId: string,
    organizationId: string,
    maxDepth?: number,
  ): Promise<Node[]> {
    const result = await this.bfs(
      nodeId,
      organizationId,
      maxDepth,
      undefined,
      'incoming',
    );

    return result.map((item) => item.node);
  }

  /**
   * Get descendant nodes (all nodes reachable from the given node)
   *
   * @param nodeId - UUID of the node
   * @param organizationId - UUID of the organization
   * @param maxDepth - Maximum depth to traverse
   * @returns Promise resolving to array of descendant nodes
   */
  async getDescendants(
    nodeId: string,
    organizationId: string,
    maxDepth?: number,
  ): Promise<Node[]> {
    const result = await this.bfs(
      nodeId,
      organizationId,
      maxDepth,
      undefined,
      'outgoing',
    );

    return result.slice(1).map((item) => item.node); // Exclude the starting node
  }
}
