import { IGraphPath } from '../interfaces/graph.interface';
import { Node } from '../entities/node.entity';
import { Edge } from '../entities/edge.entity';

/**
 * Dijkstra's shortest path algorithm implementation
 *
 * Finds the shortest path between two nodes in a weighted graph.
 * Uses edge weights for path cost calculation.
 *
 * Time Complexity: O((V + E) log V) with binary heap
 * Space Complexity: O(V)
 */
export class ShortestPathAlgorithm {
  /**
   * Find the shortest path between source and target nodes using Dijkstra's algorithm
   *
   * @param sourceNode - Starting node
   * @param targetNode - Destination node
   * @param nodes - All nodes in the graph
   * @param edges - All edges in the graph
   * @param maxDepth - Optional maximum depth limit for the search
   * @returns IGraphPath with the shortest path or null if no path exists
   */
  static findShortestPath(
    sourceNode: Node,
    targetNode: Node,
    nodes: Node[],
    edges: Edge[],
    maxDepth?: number,
  ): IGraphPath | null {
    // Build adjacency list with weights
    const graph = new Map<string, Array<{ nodeId: string; weight: number; edge: Edge }>>();

    // Initialize graph with all nodes
    for (const node of nodes) {
      if (!graph.has(node.id)) {
        graph.set(node.id, []);
      }
    }

    // Add edges to graph
    for (const edge of edges) {
      if (edge.isActive) {
        const neighbors = graph.get(edge.sourceNodeId) || [];
        neighbors.push({
          nodeId: edge.targetNodeId,
          weight: edge.weight || 1.0,
          edge,
        });
        graph.set(edge.sourceNodeId, neighbors);
      }
    }

    // Initialize distances and previous nodes
    const distances = new Map<string, number>();
    const previousNodes = new Map<string, { nodeId: string; edge: Edge }>();
    const visitedDepths = new Map<string, number>();
    const unvisited = new Set<string>();

    for (const node of nodes) {
      distances.set(node.id, Infinity);
      unvisited.add(node.id);
    }

    distances.set(sourceNode.id, 0);
    visitedDepths.set(sourceNode.id, 0);

    while (unvisited.size > 0) {
      // Find unvisited node with minimum distance
      let minNode: string | null = null;
      let minDist = Infinity;

      for (const nodeId of unvisited) {
        const dist = distances.get(nodeId) || Infinity;
        if (dist < minDist) {
          minDist = dist;
          minNode = nodeId;
        }
      }

      if (minNode === null || minDist === Infinity) {
        break; // No more reachable nodes
      }

      unvisited.delete(minNode);

      // Early termination if target reached
      if (minNode === targetNode.id) {
        return this.reconstructPath(
          sourceNode,
          targetNode,
          previousNodes,
          nodes,
          distances,
        );
      }

      // Check depth constraint
      const currentDepth = visitedDepths.get(minNode) || 0;
      if (maxDepth && currentDepth >= maxDepth) {
        continue; // Skip expanding beyond max depth
      }

      // Update neighbors
      const neighbors = graph.get(minNode) || [];
      for (const { nodeId: neighborId, weight } of neighbors) {
        if (unvisited.has(neighborId)) {
          const newDist = minDist + weight;
          const currentDist = distances.get(neighborId) || Infinity;

          if (newDist < currentDist) {
            distances.set(neighborId, newDist);
            const edgeToNeighbor = edges.find(
              (e) => e.sourceNodeId === minNode && e.targetNodeId === neighborId,
            );
            if (edgeToNeighbor) {
              previousNodes.set(neighborId, { nodeId: minNode, edge: edgeToNeighbor });
            }
            visitedDepths.set(neighborId, currentDepth + 1);
          }
        }
      }
    }

    return null; // No path found
  }

  /**
   * Find all shortest paths to all reachable nodes from source
   *
   * @param sourceNode - Starting node
   * @param nodes - All nodes in the graph
   * @param edges - All edges in the graph
   * @param maxDepth - Optional maximum depth limit
   * @returns Map of node IDs to their shortest paths
   */
  static findAllShortestPaths(
    sourceNode: Node,
    nodes: Node[],
    edges: Edge[],
    maxDepth?: number,
  ): Map<string, IGraphPath> {
    const graph = new Map<string, Array<{ nodeId: string; weight: number; edge: Edge }>>();

    // Initialize and build adjacency list
    for (const node of nodes) {
      if (!graph.has(node.id)) {
        graph.set(node.id, []);
      }
    }

    for (const edge of edges) {
      if (edge.isActive) {
        const neighbors = graph.get(edge.sourceNodeId) || [];
        neighbors.push({
          nodeId: edge.targetNodeId,
          weight: edge.weight || 1.0,
          edge,
        });
        graph.set(edge.sourceNodeId, neighbors);
      }
    }

    // Run Dijkstra from source
    const distances = new Map<string, number>();
    const previousNodes = new Map<string, { nodeId: string; edge: Edge }>();
    const visitedDepths = new Map<string, number>();
    const unvisited = new Set<string>();

    for (const node of nodes) {
      distances.set(node.id, Infinity);
      unvisited.add(node.id);
    }

    distances.set(sourceNode.id, 0);
    visitedDepths.set(sourceNode.id, 0);

    while (unvisited.size > 0) {
      let minNode: string | null = null;
      let minDist = Infinity;

      for (const nodeId of unvisited) {
        const dist = distances.get(nodeId) || Infinity;
        if (dist < minDist) {
          minDist = dist;
          minNode = nodeId;
        }
      }

      if (minNode === null || minDist === Infinity) {
        break;
      }

      unvisited.delete(minNode);

      const currentDepth = visitedDepths.get(minNode) || 0;
      if (maxDepth && currentDepth >= maxDepth) {
        continue;
      }

      const neighbors = graph.get(minNode) || [];
      for (const { nodeId: neighborId, weight } of neighbors) {
        if (unvisited.has(neighborId)) {
          const newDist = minDist + weight;
          const currentDist = distances.get(neighborId) || Infinity;

          if (newDist < currentDist) {
            distances.set(neighborId, newDist);
            const edgeToNeighbor = edges.find(
              (e) => e.sourceNodeId === minNode && e.targetNodeId === neighborId,
            );
            if (edgeToNeighbor) {
              previousNodes.set(neighborId, { nodeId: minNode, edge: edgeToNeighbor });
            }
            visitedDepths.set(neighborId, currentDepth + 1);
          }
        }
      }
    }

    // Reconstruct all paths
    const results = new Map<string, IGraphPath>();
    const nodeMap = new Map<string, Node>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    for (const [targetId] of distances) {
      if (targetId !== sourceNode.id && distances.get(targetId) !== Infinity) {
        const targetNode = nodeMap.get(targetId);
        if (targetNode) {
          const path = this.reconstructPath(
            sourceNode,
            targetNode,
            previousNodes,
            nodes,
            distances,
          );
          if (path) {
            results.set(targetId, path);
          }
        }
      }
    }

    return results;
  }

  /**
   * Reconstruct path from source to target using previous nodes map
   *
   * @private
   * @param sourceNode - Starting node
   * @param targetNode - Destination node
   * @param previousNodes - Map of previous nodes in the path
   * @param nodes - All nodes in the graph
   * @param distances - Map of distances from source
   * @returns Reconstructed path
   */
  private static reconstructPath(
    sourceNode: Node,
    targetNode: Node,
    previousNodes: Map<string, { nodeId: string; edge: Edge }>,
    nodes: Node[],
    distances: Map<string, number>,
  ): IGraphPath | null {
    const path: string[] = [];
    const edges: Edge[] = [];
    let current = targetNode.id;

    while (current !== sourceNode.id && previousNodes.has(current)) {
      const prev = previousNodes.get(current)!;
      edges.unshift(prev.edge);
      path.unshift(current);
      current = prev.nodeId;
    }

    if (current !== sourceNode.id) {
      return null; // Path reconstruction failed
    }

    path.unshift(sourceNode.id);

    const nodeMap = new Map<string, Node>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const pathNodes = path
      .map((id) => nodeMap.get(id))
      .filter((node): node is Node => node !== undefined);

    const totalWeight = (distances.get(targetNode.id) || 0);

    return {
      nodes: pathNodes,
      edges,
      length: pathNodes.length,
      totalWeight,
    };
  }
}

/**
 * A* (A-star) pathfinding algorithm implementation
 *
 * Finds shortest path using heuristic function to guide search.
 * More efficient than Dijkstra when a good heuristic is available.
 *
 * Time Complexity: O((V + E) log V) with good heuristic
 * Space Complexity: O(V)
 */
export class AStarAlgorithm {
  /**
   * Find shortest path using A* algorithm
   *
   * @param sourceNode - Starting node
   * @param targetNode - Destination node
   * @param nodes - All nodes in the graph
   * @param edges - All edges in the graph
   * @param heuristic - Heuristic function for node evaluation (default: 0)
   * @returns IGraphPath or null if no path exists
   */
  static findPath(
    sourceNode: Node,
    targetNode: Node,
    nodes: Node[],
    edges: Edge[],
    heuristic?: (node: Node, target: Node) => number,
  ): IGraphPath | null {
    // Default heuristic: always 0 (degrades to Dijkstra)
    const h = heuristic || (() => 0);

    // Build adjacency list
    const graph = new Map<string, Array<{ nodeId: string; weight: number; edge: Edge }>>();

    for (const node of nodes) {
      if (!graph.has(node.id)) {
        graph.set(node.id, []);
      }
    }

    for (const edge of edges) {
      if (edge.isActive) {
        const neighbors = graph.get(edge.sourceNodeId) || [];
        neighbors.push({
          nodeId: edge.targetNodeId,
          weight: edge.weight || 1.0,
          edge,
        });
        graph.set(edge.sourceNodeId, neighbors);
      }
    }

    const openSet = new Set<string>([sourceNode.id]);
    const cameFrom = new Map<string, { nodeId: string; edge: Edge }>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const nodeMap = new Map<string, Node>();

    for (const node of nodes) {
      nodeMap.set(node.id, node);
      gScore.set(node.id, Infinity);
      fScore.set(node.id, Infinity);
    }

    gScore.set(sourceNode.id, 0);
    fScore.set(sourceNode.id, h(sourceNode, targetNode));

    while (openSet.size > 0) {
      // Find node with lowest fScore in openSet
      let current: string | null = null;
      let lowestF = Infinity;

      for (const nodeId of openSet) {
        const f = fScore.get(nodeId) || Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = nodeId;
        }
      }

      if (current === null) {
        break;
      }

      if (current === targetNode.id) {
        return this.reconstructPath(sourceNode, targetNode, cameFrom, nodeMap);
      }

      openSet.delete(current);

      const neighbors = graph.get(current) || [];
      const currentGScore = gScore.get(current) || Infinity;
      for (const { nodeId: neighbor, weight } of neighbors) {
        const tentativeGScore = currentGScore + weight;
        const neighborGScore = gScore.get(neighbor) || Infinity;

        if (tentativeGScore < neighborGScore) {
          const neighborNode = nodeMap.get(neighbor);
          if (neighborNode) {
            const edgeToNeighbor = edges.find(
              (e) => e.sourceNodeId === current && e.targetNodeId === neighbor,
            );

            cameFrom.set(neighbor, {
              nodeId: current,
              edge: edgeToNeighbor!,
            });
            gScore.set(neighbor, tentativeGScore);
            fScore.set(neighbor, tentativeGScore + h(neighborNode, targetNode));

            if (!openSet.has(neighbor)) {
              openSet.add(neighbor);
            }
          }
        }
      }
    }

    return null; // No path found
  }

  /**
   * Reconstruct path from A* search
   *
   * @private
   */
  private static reconstructPath(
    sourceNode: Node,
    targetNode: Node,
    cameFrom: Map<string, { nodeId: string; edge: Edge }>,
    nodeMap: Map<string, Node>,
  ): IGraphPath {
    const path: string[] = [targetNode.id];
    const edges: Edge[] = [];
    let current = targetNode.id;

    while (cameFrom.has(current)) {
      const prev = cameFrom.get(current)!;
      edges.unshift(prev.edge);
      path.unshift(prev.nodeId);
      current = prev.nodeId;
    }

    const pathNodes = path
      .map((id) => nodeMap.get(id))
      .filter((node): node is Node => node !== undefined);

    let totalWeight = 0;
    for (const edge of edges) {
      totalWeight += edge.weight || 1.0;
    }

    return {
      nodes: pathNodes,
      edges,
      length: pathNodes.length,
      totalWeight,
    };
  }
}
