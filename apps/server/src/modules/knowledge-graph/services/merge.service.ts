import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GraphNode } from '../entities/graph-node.entity';
import { GraphEdge } from '../entities/graph-edge.entity';
import { EntityExtractionService } from './entity-extraction.service';

/**
 * Merge Strategy Enumeration
 */
export enum MergeStrategy {
  KEEP_NEWEST = 'keep_newest',
  KEEP_MOST_CONNECTED = 'keep_most_connected',
  MERGE_PROPERTIES = 'merge_properties',
}

/**
 * Duplicate Detection Result
 */
export interface DuplicateDetectionResult {
  primaryNode: GraphNode;
  duplicates: GraphNode[];
  similarityScores: number[];
  confidence: number;
  suggestedStrategy: MergeStrategy;
}

/**
 * Merge Result
 */
export interface MergeResult {
  mergedNode: GraphNode;
  removedNodeIds: string[];
  redirectedEdgeCount: number;
  strategyUsed: MergeStrategy;
}

/**
 * Merge Service
 *
 * Handles detection and merging of duplicate nodes in the knowledge graph.
 * Provides conflict resolution and data integrity preservation.
 */
@Injectable()
export class MergeService {
  private readonly logger = new Logger(MergeService.name);

  constructor(
    @InjectRepository(GraphNode)
    private readonly graphNodeRepository: Repository<GraphNode>,
    @InjectRepository(GraphEdge)
    private readonly graphEdgeRepository: Repository<GraphEdge>,
    private readonly entityExtractionService: EntityExtractionService,
  ) {}

  /**
   * Detect potential duplicates for a given node
   *
   * Uses multiple detection strategies: content hash, label similarity, and properties.
   *
   * @param node - Node to find duplicates for
   * @param threshold - Similarity threshold (0-1)
   * @returns Detection results with ranked duplicates
   */
  async detectDuplicates(
    node: GraphNode,
    threshold: number = 0.8,
  ): Promise<DuplicateDetectionResult | null> {
    this.logger.debug(
      `Detecting duplicates for node ${node.id} (${node.label})`,
    );

    const candidates = await this.graphNodeRepository.find({
      where: {
        organizationId: node.organizationId,
        nodeType: node.nodeType,
      },
    });

    const duplicates: GraphNode[] = [];
    const similarityScores: number[] = [];

    // Filter out the node itself
    const filteredCandidates = candidates.filter((c) => c.id !== node.id);

    for (const candidate of filteredCandidates) {
      const similarity = await this.calculateSimilarity(node, candidate);

      if (similarity >= threshold) {
        duplicates.push(candidate);
        similarityScores.push(similarity);
      }
    }

    if (duplicates.length === 0) {
      return null;
    }

    // Sort by similarity descending
    const indices = Array.from({ length: duplicates.length }, (_, i) => i).sort(
      (a, b) => similarityScores[b] - similarityScores[a],
    );

    const sortedDuplicates = indices.map((i) => duplicates[i]);
    const sortedScores = indices.map((i) => similarityScores[i]);

    // Determine suggested strategy
    const suggestedStrategy = await this.suggestMergeStrategy(
      node,
      sortedDuplicates,
    );

    const confidence = sortedScores.length > 0 ? sortedScores[0] : 0;

    return {
      primaryNode: node,
      duplicates: sortedDuplicates,
      similarityScores: sortedScores,
      confidence,
      suggestedStrategy,
    };
  }

  /**
   * Scan entire graph for duplicates
   *
   * @param organizationId - Organization context
   * @param threshold - Similarity threshold
   * @returns Array of all detected duplicate groups
   */
  async scanForDuplicates(
    organizationId: string,
    threshold: number = 0.8,
  ): Promise<DuplicateDetectionResult[]> {
    this.logger.log(`Scanning for duplicates in organization ${organizationId}`);

    const nodes = await this.graphNodeRepository.find({
      where: { organizationId },
    });

    const results: DuplicateDetectionResult[] = [];
    const processedNodeIds = new Set<string>();

    for (const node of nodes) {
      if (processedNodeIds.has(node.id)) {
        continue;
      }

      const detection = await this.detectDuplicates(node, threshold);
      if (detection) {
        results.push(detection);
        processedNodeIds.add(node.id);
        for (const dup of detection.duplicates) {
          processedNodeIds.add(dup.id);
        }
      }
    }

    this.logger.log(`Found ${results.length} duplicate groups`);
    return results;
  }

  /**
   * Calculate similarity between two nodes
   *
   * Uses multiple signals: content hash, label similarity, and property matching.
   *
   * @param node1 - First node
   * @param node2 - Second node
   * @returns Similarity score (0-1)
   */
  async calculateSimilarity(node1: GraphNode, node2: GraphNode): Promise<number> {
    let score = 0;
    let signalCount = 0;

    // Signal 1: Content hash comparison (100% match)
    if (
      node1.properties &&
      node2.properties &&
      node1.properties.contentHash &&
      node2.properties.contentHash &&
      node1.properties.contentHash === node2.properties.contentHash
    ) {
      return 1.0;
    }

    // Signal 2: Label similarity (weighted 0.4)
    const labelSimilarity =
      this.entityExtractionService.calculateLabelSimilarity(
        node1.label,
        node2.label,
      );
    if (labelSimilarity > 0.6) {
      score += labelSimilarity * 0.4;
      signalCount += 1;
    }

    // Signal 3: Description similarity (weighted 0.3)
    if (node1.description && node2.description) {
      const descriptionSimilarity =
        this.entityExtractionService.calculateLabelSimilarity(
          node1.description,
          node2.description,
        );
      score += descriptionSimilarity * 0.3;
      signalCount += 1;
    }

    // Signal 4: External ID match (weighted 0.2)
    if (
      node1.externalId &&
      node2.externalId &&
      node1.externalId === node2.externalId
    ) {
      score += 1.0 * 0.2;
      signalCount += 1;
    }

    // Signal 5: Properties overlap (weighted 0.1)
    if (node1.properties && node2.properties) {
      const propertyOverlap = this.calculatePropertyOverlap(
        node1.properties,
        node2.properties,
      );
      score += propertyOverlap * 0.1;
      signalCount += 1;
    }

    // Normalize by number of signals used
    if (signalCount === 0) {
      return 0;
    }

    return Math.min(score / signalCount, 1.0);
  }

  /**
   * Calculate property overlap between two objects
   *
   * @param props1 - First properties object
   * @param props2 - Second properties object
   * @returns Overlap score (0-1)
   */
  private calculatePropertyOverlap(
    props1: Record<string, any>,
    props2: Record<string, any>,
  ): number {
    const keys1 = Object.keys(props1);
    const keys2 = Object.keys(props2);

    if (keys1.length === 0 && keys2.length === 0) {
      return 1.0;
    }

    const allKeys = new Set([...keys1, ...keys2]);
    let matchCount = 0;

    for (const key of allKeys) {
      if (
        props1[key] === props2[key] &&
        typeof props1[key] !== 'object' &&
        typeof props2[key] !== 'object'
      ) {
        matchCount++;
      }
    }

    return matchCount / allKeys.size;
  }

  /**
   * Suggest best merge strategy
   *
   * @param primaryNode - Primary node for merge
   * @param duplicates - Duplicate nodes
   * @returns Suggested merge strategy
   */
  private async suggestMergeStrategy(
    primaryNode: GraphNode,
    duplicates: GraphNode[],
  ): Promise<MergeStrategy> {
    if (duplicates.length === 0) {
      return MergeStrategy.KEEP_NEWEST;
    }

    // Get edge counts for each node
    const primaryEdges = await this.graphEdgeRepository.count({
      where: [
        { sourceNodeId: primaryNode.id },
        { targetNodeId: primaryNode.id },
      ],
    });

    const duplicateEdgeCounts = await Promise.all(
      duplicates.map(async (dup) => ({
        nodeId: dup.id,
        count: await this.graphEdgeRepository.count({
          where: [
            { sourceNodeId: dup.id },
            { targetNodeId: dup.id },
          ],
        }),
      })),
    );

    const maxDuplicateEdges = Math.max(
      0,
      ...duplicateEdgeCounts.map((d) => d.count),
    );

    // Strategy: Keep most connected node as primary
    if (maxDuplicateEdges > primaryEdges) {
      return MergeStrategy.KEEP_MOST_CONNECTED;
    }

    // Strategy: Keep newest
    const newest = [primaryNode, ...duplicates].sort((a, b) => {
      const timeA = new Date(a.updatedAt).getTime();
      const timeB = new Date(b.updatedAt).getTime();
      return timeB - timeA;
    })[0];

    if (newest.id !== primaryNode.id) {
      return MergeStrategy.KEEP_NEWEST;
    }

    // Default: Merge properties
    return MergeStrategy.MERGE_PROPERTIES;
  }

  /**
   * Merge duplicate nodes
   *
   * Applies specified strategy and handles edge redirection.
   *
   * @param primaryNodeId - ID of primary/surviving node
   * @param duplicateNodeIds - IDs of duplicate nodes to merge
   * @param strategy - Merge strategy to use
   * @returns Merge result
   */
  async mergeDuplicates(
    primaryNodeId: string,
    duplicateNodeIds: string[],
    strategy: MergeStrategy = MergeStrategy.MERGE_PROPERTIES,
  ): Promise<MergeResult> {
    this.logger.log(
      `Merging ${duplicateNodeIds.length} nodes into ${primaryNodeId} using ${strategy}`,
    );

    if (duplicateNodeIds.includes(primaryNodeId)) {
      throw new BadRequestException(
        'Primary node cannot be in duplicate list',
      );
    }

    const primaryNode = await this.graphNodeRepository.findOne({
      where: { id: primaryNodeId },
    });

    if (!primaryNode) {
      throw new BadRequestException(`Primary node ${primaryNodeId} not found`);
    }

    const duplicateNodes = await this.graphNodeRepository.find({
      where: { id: Array.isArray(duplicateNodeIds) ? undefined : duplicateNodeIds },
    });

    if (duplicateNodes.length !== duplicateNodeIds.length) {
      throw new BadRequestException('Some duplicate nodes not found');
    }

    // Apply merge strategy
    const updatedPrimaryNode = await this.applyMergeStrategy(
      primaryNode,
      duplicateNodes,
      strategy,
    );

    // Redirect edges from duplicates to primary
    let redirectedEdgeCount = 0;

    for (const duplicateNode of duplicateNodes) {
      // Redirect incoming edges
      const incomingEdges = await this.graphEdgeRepository.find({
        where: { targetNodeId: duplicateNode.id },
      });

      for (const edge of incomingEdges) {
        // Check if edge already exists
        const existingEdge = await this.graphEdgeRepository.findOne({
          where: {
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: primaryNodeId,
          },
        });

        if (!existingEdge) {
          edge.targetNodeId = primaryNodeId;
          await this.graphEdgeRepository.save(edge);
          redirectedEdgeCount++;
        } else {
          // Delete duplicate edge
          await this.graphEdgeRepository.remove(edge);
        }
      }

      // Redirect outgoing edges
      const outgoingEdges = await this.graphEdgeRepository.find({
        where: { sourceNodeId: duplicateNode.id },
      });

      for (const edge of outgoingEdges) {
        // Check if edge already exists
        const existingEdge = await this.graphEdgeRepository.findOne({
          where: {
            sourceNodeId: primaryNodeId,
            targetNodeId: edge.targetNodeId,
          },
        });

        if (!existingEdge) {
          edge.sourceNodeId = primaryNodeId;
          await this.graphEdgeRepository.save(edge);
          redirectedEdgeCount++;
        } else {
          // Delete duplicate edge
          await this.graphEdgeRepository.remove(edge);
        }
      }
    }

    // Delete duplicate nodes
    await this.graphNodeRepository.remove(duplicateNodes);

    this.logger.log(
      `Merged ${duplicateNodes.length} nodes, redirected ${redirectedEdgeCount} edges`,
    );

    return {
      mergedNode: updatedPrimaryNode,
      removedNodeIds: duplicateNodes.map((n) => n.id),
      redirectedEdgeCount,
      strategyUsed: strategy,
    };
  }

  /**
   * Apply merge strategy to nodes
   *
   * @param primaryNode - Primary node
   * @param duplicateNodes - Nodes to merge
   * @param strategy - Merge strategy
   * @returns Updated primary node
   */
  private async applyMergeStrategy(
    primaryNode: GraphNode,
    duplicateNodes: GraphNode[],
    strategy: MergeStrategy,
  ): Promise<GraphNode> {
    switch (strategy) {
      case MergeStrategy.KEEP_NEWEST: {
        const newestNode = [primaryNode, ...duplicateNodes].sort((a, b) => {
          const timeA = new Date(a.updatedAt).getTime();
          const timeB = new Date(b.updatedAt).getTime();
          return timeB - timeA;
        })[0];

        if (newestNode.id !== primaryNode.id) {
          // Copy newer properties to primary
          primaryNode.label = newestNode.label;
          primaryNode.description = newestNode.description;
          primaryNode.properties = newestNode.properties;
        }
        break;
      }

      case MergeStrategy.KEEP_MOST_CONNECTED: {
        const nodeCounts = await Promise.all(
          [primaryNode, ...duplicateNodes].map(async (node) => ({
            node,
            count: await this.graphEdgeRepository.count({
              where: [
                { sourceNodeId: node.id },
                { targetNodeId: node.id },
              ],
            }),
          })),
        );

        const mostConnected = nodeCounts.sort((a, b) => b.count - a.count)[0];

        if (mostConnected.node.id !== primaryNode.id) {
          primaryNode.label = mostConnected.node.label;
          primaryNode.description = mostConnected.node.description;
          primaryNode.properties = mostConnected.node.properties;
        }
        break;
      }

      case MergeStrategy.MERGE_PROPERTIES: {
        const mergedProperties = this.mergeProperties(
          primaryNode.properties || {},
          ...duplicateNodes.map((n) => n.properties || {}),
        );

        primaryNode.properties = {
          ...mergedProperties,
          originalLabel: primaryNode.label,
          mergedFromNodeCount: duplicateNodes.length + 1,
          mergedAt: new Date(),
        };
        break;
      }
    }

    return this.graphNodeRepository.save(primaryNode);
  }

  /**
   * Deep merge multiple property objects
   *
   * Combines properties from multiple nodes, preferring non-null values.
   *
   * @param props - Properties objects to merge
   * @returns Merged properties
   */
  private mergeProperties(
    ...propsArray: Record<string, any>[]
  ): Record<string, any> {
    const merged: Record<string, any> = {};

    for (const props of propsArray) {
      if (!props || typeof props !== 'object') {
        continue;
      }

      for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined) {
          continue;
        }

        if (!Object.prototype.hasOwnProperty.call(merged, key)) {
          merged[key] = value;
        } else if (Array.isArray(merged[key]) && Array.isArray(value)) {
          // Merge arrays, removing duplicates
          merged[key] = Array.from(new Set([...merged[key], ...value]));
        } else if (typeof merged[key] === 'object' && typeof value === 'object') {
          // Recursively merge objects
          merged[key] = this.mergeProperties(merged[key], value);
        }
      }
    }

    return merged;
  }

  /**
   * Auto-merge duplicates with high confidence
   *
   * Automatically merges nodes that are highly likely to be duplicates.
   *
   * @param organizationId - Organization context
   * @param confidenceThreshold - Confidence threshold for auto-merge
   * @returns Array of merge results
   */
  async autoMergeDuplicates(
    organizationId: string,
    confidenceThreshold: number = 0.95,
  ): Promise<MergeResult[]> {
    this.logger.log(
      `Auto-merging duplicates in organization ${organizationId}`,
    );

    const duplicateGroups = await this.scanForDuplicates(
      organizationId,
      confidenceThreshold,
    );

    const results: MergeResult[] = [];

    for (const group of duplicateGroups) {
      if (group.confidence >= confidenceThreshold) {
        const result = await this.mergeDuplicates(
          group.primaryNode.id,
          group.duplicates.map((d) => d.id),
          group.suggestedStrategy,
        );
        results.push(result);
      }
    }

    this.logger.log(`Auto-merged ${results.length} duplicate groups`);
    return results;
  }
}
