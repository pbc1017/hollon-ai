import { Node } from '../entities/node.entity';
import { Edge } from '../entities/edge.entity';
import { RelationshipType } from '../../../knowledge/enums/relationship-type.enum';
import { IGraphTraversalOptions } from '../interfaces/graph.interface';

/**
 * Graph Traversal Options with defaults
 */
interface TraversalOptions extends Partial<IGraphTraversalOptions> {
  maxDepth: number;
}

/**
 * Graph Traversal Utilities
 *
 * Provides BFS and DFS algorithms for exploring the knowledge graph.
 * Supports filtering by node types, edge types, and depth constraints.
 */
export class GraphTraversal {
  /**
   * Breadth-First Search (BFS) traversal
   *
   * Explores the graph level by level, visiting all neighbors at current depth
   * before moving to the next depth. Useful for finding shortest paths and nearest neighbors.
   *
   * Time Complexity: O(V + E)
   * Space Complexity: O(V)
   *
   * @param startNode - Starting node for traversal
   * @param nodes - All nodes in the graph
   * @param edges - All edges in the graph
   * @param options - Traversal configuration options
   * @returns Array of visited nodes in BFS order
   */
  static bfs(
    startNode: Node,
    nodes: Node[],
    edges: Edge[],
    options: TraversalOptions,
  ): Node[] {
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; depth: number }> = [
      { nodeId: startNode.id, depth: 0 },
    ];
    const result: Node[] = [];
    const nodeMap = new Map<string, Node>();

    // Build node map for quick lookup
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Build adjacency list filtered by options
    const graph = this.buildFilteredAdjacencyList(edges, options);

    visited.add(startNode.id);
    result.push(startNode);

    let processedCount = 0;
    const maxNodes = options.maxNodes || Infinity;

    while (queue.length > 0 && processedCount < maxNodes) {
      const { nodeId, depth } = queue.shift()!;

      if (depth >= options.maxDepth) {
        continue;
      }

      const neighbors = this.getNeighbors(
        nodeId,
        graph,
        options.direction || 'both',
        nodeMap,
        options,
      );

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);

          if (processedCount < maxNodes) {
            result.push(neighbor);
            processedCount++;
          }

          // Check if we should continue exploring from this node
          if (!this.shouldStop(neighbor, options)) {
            queue.push({ nodeId: neighbor.id, depth: depth + 1 });
          }
        }
      }
    }

    return result;
  }

  /**
   * Depth-First Search (DFS) traversal
   *
   * Explores as far as possible along each branch before backtracking.
   * Useful for detecting cycles and exploring deep hierarchical structures.
   *
   * Time Complexity: O(V + E)
   * Space Complexity: O(V)
   *
   * @param startNode - Starting node for traversal
   * @param nodes - All nodes in the graph
   * @param edges - All edges in the graph
   * @param options - Traversal configuration options
   * @returns Array of visited nodes in DFS order
   */
  static dfs(
    startNode: Node,
    nodes: Node[],
    edges: Edge[],
    options: TraversalOptions,
  ): Node[] {
    const visited = new Set<string>();
    const result: Node[] = [];
    const nodeMap = new Map<string, Node>();

    // Build node map
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Build adjacency list
    const graph = this.buildFilteredAdjacencyList(edges, options);

    const maxNodes = options.maxNodes || Infinity;
    let processedCount = 0;

    const dfsHelper = (nodeId: string, depth: number) => {
      if (processedCount >= maxNodes) {
        return;
      }

      visited.add(nodeId);
      const node = nodeMap.get(nodeId);

      if (node) {
        result.push(node);
        processedCount++;
      }

      if (depth >= options.maxDepth) {
        return;
      }

      const neighbors = this.getNeighbors(
        nodeId,
        graph,
        options.direction || 'both',
        nodeMap,
        options,
      );

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id) && processedCount < maxNodes) {
          if (!this.shouldStop(neighbor, options)) {
            dfsHelper(neighbor.id, depth + 1);
          } else {
            visited.add(neighbor.id);
            result.push(neighbor);
            processedCount++;
          }
        }
      }
    };

    dfsHelper(startNode.id, 0);
    return result;
  }

  /**
   * Get neighbors of a node with direction and filtering applied
   *
   * @private
   */
  private static getNeighbors(
    nodeId: string,
    graph: Map<string, Array<{ targetId: string; edgeType: RelationshipType }>>,
    direction: 'in' | 'out' | 'both',
    nodeMap: Map<string, Node>,
    options: TraversalOptions,
  ): Node[] {
    const neighbors: Node[] = [];
    const addedIds = new Set<string>();

    if (
      (direction === 'out' || direction === 'both') &&
      graph.has(`out:${nodeId}`)
    ) {
      const outgoing = graph.get(`out:${nodeId}`) || [];
      for (const { targetId } of outgoing) {
        if (!addedIds.has(targetId)) {
          const node = nodeMap.get(targetId);
          if (node && this.matchesNodeTypeFilter(node, options)) {
            neighbors.push(node);
            addedIds.add(targetId);
          }
        }
      }
    }

    if (
      (direction === 'in' || direction === 'both') &&
      graph.has(`in:${nodeId}`)
    ) {
      const incoming = graph.get(`in:${nodeId}`) || [];
      for (const { targetId } of incoming) {
        if (!addedIds.has(targetId)) {
          const node = nodeMap.get(targetId);
          if (node && this.matchesNodeTypeFilter(node, options)) {
            neighbors.push(node);
            addedIds.add(targetId);
          }
        }
      }
    }

    return neighbors;
  }

  /**
   * Build adjacency list filtered by edge types
   *
   * @private
   */
  private static buildFilteredAdjacencyList(
    edges: Edge[],
    options: TraversalOptions,
  ): Map<string, Array<{ targetId: string; edgeType: RelationshipType }>> {
    const graph = new Map<
      string,
      Array<{ targetId: string; edgeType: RelationshipType }>
    >();

    for (const edge of edges) {
      if (!edge.isActive) {
        continue;
      }

      // Check if edge type is allowed
      if (options.edgeTypes && !options.edgeTypes.includes(edge.type)) {
        continue;
      }

      const outKey = `out:${edge.sourceNodeId}`;
      const inKey = `in:${edge.targetNodeId}`;

      if (!graph.has(outKey)) {
        graph.set(outKey, []);
      }
      if (!graph.has(inKey)) {
        graph.set(inKey, []);
      }

      graph.get(outKey)!.push({
        targetId: edge.targetNodeId,
        edgeType: edge.type,
      });

      graph.get(inKey)!.push({
        targetId: edge.sourceNodeId,
        edgeType: edge.type,
      });
    }

    return graph;
  }

  /**
   * Check if node matches type filter
   *
   * @private
   */
  private static matchesNodeTypeFilter(
    node: Node,
    options: TraversalOptions,
  ): boolean {
    if (!options.nodeTypes || options.nodeTypes.length === 0) {
      return true;
    }
    return options.nodeTypes.includes(node.type);
  }

  /**
   * Check if traversal should stop at this node
   *
   * @private
   */
  private static shouldStop(node: Node, options: TraversalOptions): boolean {
    if (!options.stopAtNodeTypes || options.stopAtNodeTypes.length === 0) {
      return false;
    }
    return options.stopAtNodeTypes.includes(node.type);
  }

  /**
   * Find all neighbors of a node up to a certain depth
   *
   * @param startNode - Node to find neighbors for
   * @param nodes - All nodes in the graph
   * @param edges - All edges in the graph
   * @param depth - Maximum depth for neighbor search (1 = direct neighbors)
   * @param direction - Direction of traversal
   * @returns Map of depth to nodes at that depth
   */
  static findNeighborsByDepth(
    startNode: Node,
    nodes: Node[],
    edges: Edge[],
    depth: number,
    direction: 'in' | 'out' | 'both' = 'out',
  ): Map<number, Node[]> {
    const nodeMap = new Map<string, Node>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const graph = this.buildSimpleAdjacencyList(edges, direction);
    const result = new Map<number, Node[]>();
    const visited = new Set<string>([startNode.id]);

    // Depth 0: the node itself
    result.set(0, [startNode]);

    let currentLevel = [startNode.id];

    for (let d = 1; d <= depth && currentLevel.length > 0; d++) {
      const nextLevel: string[] = [];

      for (const nodeId of currentLevel) {
        const neighbors = this.getDirectNeighbors(
          nodeId,
          graph,
          direction,
          nodeMap,
        );

        for (const neighbor of neighbors) {
          if (!visited.has(neighbor.id)) {
            visited.add(neighbor.id);
            nextLevel.push(neighbor.id);

            if (!result.has(d)) {
              result.set(d, []);
            }
            result.get(d)!.push(neighbor);
          }
        }
      }

      currentLevel = nextLevel;
    }

    return result;
  }

  /**
   * Build simple adjacency list for efficient neighbor lookup
   *
   * @private
   */
  private static buildSimpleAdjacencyList(
    edges: Edge[],
    direction: 'in' | 'out' | 'both',
  ): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const edge of edges) {
      if (!edge.isActive) {
        continue;
      }

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

    return graph;
  }

  /**
   * Get direct neighbors of a node
   *
   * @private
   */
  private static getDirectNeighbors(
    nodeId: string,
    graph: Map<string, string[]>,
    direction: 'in' | 'out' | 'both',
    nodeMap: Map<string, Node>,
  ): Node[] {
    const neighborIds = new Set<string>();

    if ((direction === 'out' || direction === 'both') && graph.has(nodeId)) {
      const outgoing = graph.get(nodeId) || [];
      for (const id of outgoing) {
        neighborIds.add(id);
      }
    }

    if (
      (direction === 'in' || direction === 'both') &&
      graph.has(`in:${nodeId}`)
    ) {
      const incoming = graph.get(`in:${nodeId}`) || [];
      for (const id of incoming) {
        neighborIds.add(id);
      }
    }

    const result: Node[] = [];
    for (const id of neighborIds) {
      const node = nodeMap.get(id);
      if (node) {
        result.push(node);
      }
    }

    return result;
  }

  /**
   * Check for cycles in the graph using DFS
   *
   * @param nodes - All nodes
   * @param edges - All edges
   * @returns Array of cycles found (each cycle is an array of node IDs)
   */
  static detectCycles(nodes: Node[], edges: Edge[]): string[][] {
    const graph = new Map<string, string[]>();
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];

    // Build adjacency list
    for (const edge of edges) {
      if (!edge.isActive) {
        continue;
      }
      if (!graph.has(edge.sourceNodeId)) {
        graph.set(edge.sourceNodeId, []);
      }
      graph.get(edge.sourceNodeId)!.push(edge.targetNodeId);
    }

    const dfsForCycles = (nodeId: string, path: string[]) => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfsForCycles(neighbor, [...path]);
        } else if (recStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            const cycle = path.slice(cycleStart).concat([neighbor]);
            cycles.push(cycle);
          }
        }
      }

      recStack.delete(nodeId);
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfsForCycles(node.id, []);
      }
    }

    return cycles;
  }

  /**
   * Find all connected components in the graph
   *
   * @param nodes - All nodes
   * @param edges - All edges
   * @returns Array of components, each component is an array of node IDs
   */
  static findConnectedComponents(nodes: Node[], edges: Edge[]): string[][] {
    const graph = new Map<string, string[]>();
    const visited = new Set<string>();
    const components: string[][] = [];

    // Build adjacency list (undirected)
    for (const edge of edges) {
      if (!edge.isActive) {
        continue;
      }
      if (!graph.has(edge.sourceNodeId)) {
        graph.set(edge.sourceNodeId, []);
      }
      if (!graph.has(edge.targetNodeId)) {
        graph.set(edge.targetNodeId, []);
      }
      graph.get(edge.sourceNodeId)!.push(edge.targetNodeId);
      graph.get(edge.targetNodeId)!.push(edge.sourceNodeId);
    }

    const bfsComponent = (startId: string): string[] => {
      const component: string[] = [];
      const queue = [startId];
      visited.add(startId);

      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        component.push(nodeId);

        const neighbors = graph.get(nodeId) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      return component;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const component = bfsComponent(node.id);
        components.push(component);
      }
    }

    return components;
  }
}
