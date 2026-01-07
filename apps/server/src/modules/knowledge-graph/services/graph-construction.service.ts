import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GraphNode, NodeType } from '../entities/graph-node.entity';
import { GraphEdge, EdgeType } from '../entities/graph-edge.entity';
import { RelationshipType } from '../../../knowledge/enums/relationship-type.enum';
import { EntityExtractionService } from './entity-extraction.service';

/**
 * Graph Construction Service
 *
 * Builds the knowledge graph from extracted entities and relationships.
 * Handles incremental updates, relationship identification, and graph consistency validation.
 */
@Injectable()
export class GraphConstructionService {
  private readonly logger = new Logger(GraphConstructionService.name);

  constructor(
    @InjectRepository(GraphNode)
    private readonly graphNodeRepository: Repository<GraphNode>,
    @InjectRepository(GraphEdge)
    private readonly graphEdgeRepository: Repository<GraphEdge>,
    private readonly entityExtractionService: EntityExtractionService,
  ) {}

  /**
   * Build complete graph from raw data
   *
   * Extracts entities, identifies relationships, and constructs the graph.
   *
   * @param rawData - Raw data to build graph from
   * @param organizationId - Organization context
   * @returns Object containing created nodes and edges
   */
  async buildGraph(
    rawData: Record<string, any>,
    organizationId: string,
  ): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    this.logger.log(`Building graph for organization ${organizationId}`);

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    try {
      // Extract entities
      const extractedEntities = await this.entityExtractionService.extractEntities(
        rawData,
        organizationId,
      );

      // Validate entities
      const validation = await this.entityExtractionService.validateEntities(
        extractedEntities,
      );
      if (!validation.valid) {
        throw new BadRequestException(`Entity validation failed: ${validation.issues.join(', ')}`);
      }

      // Create nodes
      for (const entityData of extractedEntities) {
        const node = await this.createNode(entityData);
        nodes.push(node);
      }

      // Extract and create relationships
      const relationships = await this.entityExtractionService.extractRelationships(
        rawData,
      );
      for (const rel of relationships) {
        const sourceNode = nodes.find(
          (n) => this.normalizeLabel(n.label) === this.normalizeLabel(rel.sourceLabel),
        );
        const targetNode = nodes.find(
          (n) => this.normalizeLabel(n.label) === this.normalizeLabel(rel.targetLabel),
        );

        if (sourceNode && targetNode) {
          const edge = await this.createEdge({
            sourceNodeId: sourceNode.id,
            targetNodeId: targetNode.id,
            organizationId,
            edgeType: this.mapRelationshipType(rel.type),
            properties: rel.properties || {},
          });
          edges.push(edge);
        }
      }

      this.logger.log(`Graph built with ${nodes.length} nodes and ${edges.length} edges`);
      return { nodes, edges };
    } catch (error) {
      this.logger.error(`Error building graph: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Create a node in the graph
   *
   * @param nodeData - Node data to create
   * @returns Created GraphNode
   */
  async createNode(nodeData: Partial<GraphNode>): Promise<GraphNode> {
    if (!nodeData.label || !nodeData.organizationId) {
      throw new BadRequestException('Label and organization ID are required');
    }

    const node = this.graphNodeRepository.create({
      ...nodeData,
      nodeType: nodeData.nodeType || NodeType.ENTITY,
    });

    return this.graphNodeRepository.save(node);
  }

  /**
   * Create an edge in the graph
   *
   * Validates that both source and target nodes exist.
   *
   * @param edgeData - Edge data to create
   * @returns Created GraphEdge
   */
  async createEdge(edgeData: Partial<GraphEdge>): Promise<GraphEdge> {
    const {
      sourceNodeId,
      targetNodeId,
      organizationId,
      edgeType,
    } = edgeData;

    if (!sourceNodeId || !targetNodeId || !organizationId) {
      throw new BadRequestException(
        'Source node, target node, and organization ID are required',
      );
    }

    // Validate nodes exist
    const [sourceNode, targetNode] = await Promise.all([
      this.graphNodeRepository.findOne({ where: { id: sourceNodeId } }),
      this.graphNodeRepository.findOne({ where: { id: targetNodeId } }),
    ]);

    if (!sourceNode || !targetNode) {
      throw new BadRequestException('Source or target node not found');
    }

    // Prevent self-loops
    if (sourceNodeId === targetNodeId) {
      this.logger.warn(
        `Attempted to create self-loop edge on node ${sourceNodeId}`,
      );
      throw new BadRequestException('Cannot create edges from a node to itself');
    }

    const edge = this.graphEdgeRepository.create({
      ...edgeData,
      edgeType: edgeType || EdgeType.RELATED_TO,
      weight: edgeData.weight ?? 1.0,
    });

    return this.graphEdgeRepository.save(edge);
  }

  /**
   * Apply incremental update to the graph
   *
   * Handles adding, updating, or removing nodes and edges.
   *
   * @param operation - Update operation to apply
   */
  async applyUpdate(operation: {
    type: 'add_node' | 'update_node' | 'remove_node' | 'add_edge' | 'update_edge' | 'remove_edge';
    nodeData?: Partial<GraphNode>;
    edgeData?: Partial<GraphEdge>;
    nodeId?: string;
    edgeId?: string;
  }): Promise<void> {
    this.logger.debug(`Applying ${operation.type} operation`);

    switch (operation.type) {
      case 'add_node':
        if (!operation.nodeData) {
          throw new BadRequestException('Node data is required for add_node operation');
        }
        await this.createNode(operation.nodeData);
        break;

      case 'update_node':
        if (!operation.nodeId || !operation.nodeData) {
          throw new BadRequestException('Node ID and data are required for update_node operation');
        }
        await this.graphNodeRepository.update(operation.nodeId, operation.nodeData);
        break;

      case 'remove_node':
        if (!operation.nodeId) {
          throw new BadRequestException('Node ID is required for remove_node operation');
        }
        // Remove associated edges first (CASCADE is handled by DB, but explicit is safer)
        await this.graphEdgeRepository.delete({
          sourceNodeId: operation.nodeId,
        });
        await this.graphEdgeRepository.delete({
          targetNodeId: operation.nodeId,
        });
        await this.graphNodeRepository.delete(operation.nodeId);
        break;

      case 'add_edge':
        if (!operation.edgeData) {
          throw new BadRequestException('Edge data is required for add_edge operation');
        }
        await this.createEdge(operation.edgeData);
        break;

      case 'update_edge':
        if (!operation.edgeId || !operation.edgeData) {
          throw new BadRequestException('Edge ID and data are required for update_edge operation');
        }
        await this.graphEdgeRepository.update(operation.edgeId, operation.edgeData);
        break;

      case 'remove_edge':
        if (!operation.edgeId) {
          throw new BadRequestException('Edge ID is required for remove_edge operation');
        }
        await this.graphEdgeRepository.delete(operation.edgeId);
        break;

      default:
        throw new BadRequestException(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Identify relationships between entities
   *
   * Uses various strategies to detect relationships between nodes.
   *
   * @param nodes - Nodes to analyze for relationships
   * @returns Array of identified relationships
   */
  async identifyRelationships(
    nodes: GraphNode[],
  ): Promise<
    Array<{
      sourceNodeId: string;
      targetNodeId: string;
      edgeType: EdgeType;
      confidence: number;
      properties: Record<string, any>;
    }>
  > {
    const relationships: Array<{
      sourceNodeId: string;
      targetNodeId: string;
      edgeType: EdgeType;
      confidence: number;
      properties: Record<string, any>;
    }> = [];

    if (nodes.length < 2) {
      return relationships;
    }

    // Strategy 1: Label similarity-based relationships
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        const similarity = this.entityExtractionService.calculateLabelSimilarity(
          node1.label,
          node2.label,
        );

        if (similarity > 0.6 && similarity < 1.0) {
          relationships.push({
            sourceNodeId: node1.id,
            targetNodeId: node2.id,
            edgeType: EdgeType.RELATED_TO,
            confidence: similarity,
            properties: {
              detectionMethod: 'label_similarity',
              similarityScore: similarity,
            },
          });
        }
      }
    }

    // Strategy 2: External type matching
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;

        const node1 = nodes[i];
        const node2 = nodes[j];

        if (
          node1.externalType &&
          node2.externalType &&
          node1.externalType === node2.externalType &&
          node1.nodeType === node2.nodeType
        ) {
          const existingEdge = relationships.some(
            (r) =>
              (r.sourceNodeId === node1.id && r.targetNodeId === node2.id) ||
              (r.sourceNodeId === node2.id && r.targetNodeId === node1.id),
          );

          if (!existingEdge) {
            relationships.push({
              sourceNodeId: node1.id,
              targetNodeId: node2.id,
              edgeType: EdgeType.RELATED_TO,
              confidence: 0.8,
              properties: {
                detectionMethod: 'external_type_match',
                externalType: node1.externalType,
              },
            });
          }
        }
      }
    }

    this.logger.debug(`Identified ${relationships.length} relationships`);
    return relationships;
  }

  /**
   * Validate graph consistency
   *
   * Checks for data integrity issues and consistency violations.
   *
   * @param nodes - Nodes to validate
   * @param edges - Edges to validate
   * @returns Validation result
   */
  async validateGraphConsistency(
    nodes: GraphNode[],
    edges: GraphEdge[],
  ): Promise<{
    valid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for duplicate node labels within organization
    const nodesByOrg = new Map<string, Map<string, GraphNode[]>>();
    for (const node of nodes) {
      if (!nodesByOrg.has(node.organizationId)) {
        nodesByOrg.set(node.organizationId, new Map());
      }

      const orgNodes = nodesByOrg.get(node.organizationId)!;
      const key = this.normalizeLabel(node.label);

      if (!orgNodes.has(key)) {
        orgNodes.set(key, []);
      }
      orgNodes.get(key)!.push(node);
    }

    for (const [, orgNodes] of nodesByOrg) {
      for (const [, nodeGroup] of orgNodes) {
        if (nodeGroup.length > 1) {
          warnings.push(
            `Found ${nodeGroup.length} nodes with similar labels: ${nodeGroup[0].label}`,
          );
        }
      }
    }

    // Check edge references
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const edge of edges) {
      if (!nodeIds.has(edge.sourceNodeId)) {
        issues.push(
          `Edge ${edge.id} references non-existent source node ${edge.sourceNodeId}`,
        );
      }
      if (!nodeIds.has(edge.targetNodeId)) {
        issues.push(
          `Edge ${edge.id} references non-existent target node ${edge.targetNodeId}`,
        );
      }

      if (edge.sourceNodeId === edge.targetNodeId) {
        issues.push(`Edge ${edge.id} is a self-loop`);
      }
    }

    // Check organization consistency
    const edgesByOrg = new Map<string, GraphEdge[]>();
    for (const edge of edges) {
      if (!edgesByOrg.has(edge.organizationId)) {
        edgesByOrg.set(edge.organizationId, []);
      }
      edgesByOrg.get(edge.organizationId)!.push(edge);
    }

    for (const [orgId, orgEdges] of edgesByOrg) {
      const orgNodeIds = new Set(
        nodes.filter((n) => n.organizationId === orgId).map((n) => n.id),
      );
      for (const edge of orgEdges) {
        if (!orgNodeIds.has(edge.sourceNodeId)) {
          issues.push(
            `Edge in org ${orgId} references node from different organization`,
          );
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Get graph statistics
   *
   * Returns metrics about graph structure and content.
   *
   * @param organizationId - Organization context
   * @returns Graph statistics
   */
  async getGraphStatistics(organizationId: string): Promise<{
    nodeCount: number;
    edgeCount: number;
    nodeTypeDistribution: Record<string, number>;
    edgeTypeDistribution: Record<string, number>;
    averageNodeDegree: number;
    networkDensity: number;
  }> {
    const nodes = await this.graphNodeRepository.find({
      where: { organizationId },
    });
    const edges = await this.graphEdgeRepository.find({
      where: { organizationId },
    });

    // Calculate node type distribution
    const nodeTypeDistribution: Record<string, number> = {};
    for (const node of nodes) {
      nodeTypeDistribution[node.nodeType] =
        (nodeTypeDistribution[node.nodeType] || 0) + 1;
    }

    // Calculate edge type distribution
    const edgeTypeDistribution: Record<string, number> = {};
    for (const edge of edges) {
      edgeTypeDistribution[edge.edgeType] =
        (edgeTypeDistribution[edge.edgeType] || 0) + 1;
    }

    // Calculate metrics
    const totalDegree = nodes.reduce((sum, node) => {
      const inDegree = edges.filter((e) => e.targetNodeId === node.id).length;
      const outDegree = edges.filter((e) => e.sourceNodeId === node.id).length;
      return sum + inDegree + outDegree;
    }, 0);

    const averageNodeDegree =
      nodes.length > 0 ? totalDegree / nodes.length : 0;
    const possibleEdges = nodes.length * (nodes.length - 1);
    const networkDensity =
      possibleEdges > 0 ? edges.length / possibleEdges : 0;

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypeDistribution,
      edgeTypeDistribution,
      averageNodeDegree,
      networkDensity,
    };
  }

  /**
   * Map relationship type to edge type
   *
   * Converts semantic relationship types to graph edge types.
   *
   * @param relationshipType - Semantic relationship type
   * @returns Corresponding EdgeType
   */
  private mapRelationshipType(relationshipType: string): EdgeType {
    const typeMap: Record<string, EdgeType> = {
      [RelationshipType.RELATES_TO]: EdgeType.RELATED_TO,
      [RelationshipType.DERIVED_FROM]: EdgeType.RELATED_TO,
      [RelationshipType.SUPPORTS]: EdgeType.RELATED_TO,
      [RelationshipType.PART_OF]: EdgeType.PART_OF,
      [RelationshipType.DEPENDS_ON]: EdgeType.DEPENDS_ON,
      [RelationshipType.CREATED_BY]: EdgeType.CREATED_BY,
      [RelationshipType.REFERENCES]: EdgeType.REFERENCES,
      [RelationshipType.FOLLOWS]: EdgeType.RELATED_TO,
    };

    return typeMap[relationshipType] || EdgeType.RELATED_TO;
  }

  /**
   * Normalize label for comparison
   *
   * @param label - Label to normalize
   * @returns Normalized label
   */
  private normalizeLabel(label: string): string {
    return label.toLowerCase().trim();
  }
}
