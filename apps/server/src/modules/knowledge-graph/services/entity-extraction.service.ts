import { Injectable, Logger } from '@nestjs/common';
import { GraphNode, NodeType } from '../entities/graph-node.entity';
import { createHash } from 'crypto';

/**
 * Entity Extraction Service
 *
 * Responsible for extracting entities and their properties from structured data.
 * Handles entity recognition, property extraction, and content hashing for
 * duplicate detection.
 */
@Injectable()
export class EntityExtractionService {
  private readonly logger = new Logger(EntityExtractionService.name);

  /**
   * Extract entities from raw data
   *
   * @param rawData - Unstructured or semi-structured data
   * @param organizationId - Organization context
   * @returns Array of extracted entity objects
   */
  async extractEntities(
    rawData: Record<string, any>,
    organizationId: string,
  ): Promise<Partial<GraphNode>[]> {
    this.logger.debug(
      `Extracting entities from data for organization ${organizationId}`,
    );

    const entities: Partial<GraphNode>[] = [];

    if (!rawData || typeof rawData !== 'object') {
      this.logger.warn('Invalid raw data provided for entity extraction');
      return entities;
    }

    // Extract main entity
    const mainEntity = this.extractEntity(rawData, organizationId);
    if (mainEntity) {
      entities.push(mainEntity);
    }

    // Extract nested entities if present
    if (rawData.relatedEntities && Array.isArray(rawData.relatedEntities)) {
      for (const relatedData of rawData.relatedEntities) {
        const relatedEntity = this.extractEntity(relatedData, organizationId);
        if (relatedEntity) {
          entities.push(relatedEntity);
        }
      }
    }

    this.logger.debug(`Extracted ${entities.length} entities`);
    return entities;
  }

  /**
   * Extract a single entity from data
   *
   * @param data - Entity data
   * @param organizationId - Organization context
   * @returns Partial GraphNode object or null if invalid
   */
  private extractEntity(
    data: Record<string, any>,
    organizationId: string,
  ): Partial<GraphNode> | null {
    if (!data.label || typeof data.label !== 'string') {
      return null;
    }

    const label = data.label.trim();
    if (label.length === 0) {
      return null;
    }

    const nodeType = this.inferNodeType(data);
    const properties = this.extractProperties(data);
    const contentHash = this.computeContentHash(label, data);

    return {
      organizationId,
      label,
      nodeType,
      description: data.description || null,
      properties: {
        ...properties,
        contentHash,
        sourceType: data.sourceType || 'unknown',
      },
      externalId: data.externalId || null,
      externalType: data.externalType || null,
    };
  }

  /**
   * Infer the node type from data
   *
   * @param data - Entity data
   * @returns Inferred NodeType
   */
  private inferNodeType(data: Record<string, any>): NodeType {
    if (data.nodeType && Object.values(NodeType).includes(data.nodeType)) {
      return data.nodeType as NodeType;
    }

    if (data.type) {
      const typeMap: Record<string, NodeType> = {
        concept: NodeType.CONCEPT,
        entity: NodeType.ENTITY,
        event: NodeType.EVENT,
        attribute: NodeType.ATTRIBUTE,
        task: NodeType.TASK,
        hollon: NodeType.HOLLON,
        document: NodeType.DOCUMENT,
      };

      const inferred = typeMap[data.type.toLowerCase()];
      if (inferred) {
        return inferred;
      }
    }

    // Default to ENTITY if type cannot be inferred
    return NodeType.ENTITY;
  }

  /**
   * Extract properties from entity data
   *
   * @param data - Entity data
   * @returns Object containing extracted properties
   */
  private extractProperties(data: Record<string, any>): Record<string, any> {
    const properties: Record<string, any> = {};
    const excludedKeys = new Set([
      'label',
      'description',
      'nodeType',
      'type',
      'externalId',
      'externalType',
      'sourceType',
      'relatedEntities',
    ]);

    for (const [key, value] of Object.entries(data)) {
      if (!excludedKeys.has(key) && value !== undefined && value !== null) {
        // Skip complex nested objects except for simple arrays and objects
        if (typeof value === 'object' && !Array.isArray(value)) {
          // Store only simple object properties
          try {
            properties[key] = JSON.parse(JSON.stringify(value));
          } catch {
            // Skip non-serializable values
          }
        } else if (Array.isArray(value)) {
          // Store array as-is if it's simple (strings, numbers)
          const isSimpleArray = value.every(
            (item) =>
              typeof item === 'string' ||
              typeof item === 'number' ||
              typeof item === 'boolean',
          );
          if (isSimpleArray) {
            properties[key] = value;
          }
        } else {
          properties[key] = value;
        }
      }
    }

    return properties;
  }

  /**
   * Compute content hash for duplicate detection
   *
   * Uses SHA-256 hash of normalized content for reliable duplicate detection.
   *
   * @param label - Entity label
   * @param data - Entity data
   * @returns SHA-256 hash string
   */
  private computeContentHash(label: string, data: Record<string, any>): string {
    const contentParts = [label.toLowerCase()];

    // Include key properties in hash
    const keyProperties = ['description', 'externalId', 'externalType', 'type'];
    for (const key of keyProperties) {
      if (data[key]) {
        contentParts.push(String(data[key]).toLowerCase());
      }
    }

    const content = contentParts.join('|');
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Extract relationships from entity data
   *
   * Identifies and extracts relationship information from raw data.
   *
   * @param data - Entity data that may contain relationship info
   * @returns Array of relationship definitions
   */
  async extractRelationships(data: Record<string, any>): Promise<
    Array<{
      sourceLabel: string;
      targetLabel: string;
      type: string;
      properties?: Record<string, any>;
    }>
  > {
    const relationships: Array<{
      sourceLabel: string;
      targetLabel: string;
      type: string;
      properties?: Record<string, any>;
    }> = [];

    if (!data || typeof data !== 'object') {
      return relationships;
    }

    // Extract explicit relationships
    if (data.relationships && Array.isArray(data.relationships)) {
      for (const rel of data.relationships) {
        if (rel.source && rel.target && rel.type) {
          relationships.push({
            sourceLabel: rel.source,
            targetLabel: rel.target,
            type: rel.type,
            properties: rel.properties || {},
          });
        }
      }
    }

    // Extract relationships from related entities
    if (
      data.relatedEntities &&
      Array.isArray(data.relatedEntities) &&
      data.label
    ) {
      for (const related of data.relatedEntities) {
        if (related.label) {
          relationships.push({
            sourceLabel: data.label,
            targetLabel: related.label,
            type: related.relationshipType || 'relates_to',
            properties: {
              inferred: true,
              ...related.properties,
            },
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Validate extracted entities
   *
   * Checks for data integrity and consistency.
   *
   * @param entities - Entities to validate
   * @returns Validation result with any issues found
   */
  async validateEntities(
    entities: Partial<GraphNode>[],
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    if (!Array.isArray(entities)) {
      return { valid: false, issues: ['Invalid entities format'] };
    }

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];

      if (!entity.label || entity.label.trim().length === 0) {
        issues.push(`Entity ${i}: Label is required and cannot be empty`);
      }

      if (!entity.organizationId) {
        issues.push(`Entity ${i}: Organization ID is required`);
      }

      if (
        !entity.nodeType ||
        !Object.values(NodeType).includes(entity.nodeType)
      ) {
        issues.push(`Entity ${i}: Invalid node type "${entity.nodeType}"`);
      }

      if (entity.properties && typeof entity.properties !== 'object') {
        issues.push(`Entity ${i}: Properties must be an object`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Normalize entity label for comparison
   *
   * Removes special characters, extra whitespace, and converts to lowercase.
   *
   * @param label - Label to normalize
   * @returns Normalized label
   */
  normalizeLabel(label: string): string {
    return label
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '');
  }

  /**
   * Calculate similarity between two labels
   *
   * Uses Levenshtein distance for string similarity.
   *
   * @param label1 - First label
   * @param label2 - Second label
   * @returns Similarity score (0-1)
   */
  calculateLabelSimilarity(label1: string, label2: string): number {
    const normalized1 = this.normalizeLabel(label1);
    const normalized2 = this.normalizeLabel(label2);

    if (normalized1 === normalized2) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);

    if (maxLength === 0) {
      return 1.0;
    }

    return 1.0 - distance / maxLength;
  }

  /**
   * Compute Levenshtein distance between two strings
   *
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Edit distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const track = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i += 1) {
      track[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j += 1) {
      track[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1,
          track[j - 1][i] + 1,
          track[j - 1][i - 1] + indicator,
        );
      }
    }

    return track[str2.length][str1.length];
  }
}
