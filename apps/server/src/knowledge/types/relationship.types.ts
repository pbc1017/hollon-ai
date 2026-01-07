import { RelationshipType } from '../enums/relationship-type.enum';

/**
 * Metadata for relationship types providing additional semantic information.
 *
 * @property symmetric - Whether the relationship is symmetric (A->B implies B->A)
 * @property transitive - Whether the relationship is transitive (A->B and B->C implies A->C)
 * @property reflexive - Whether the relationship can be self-referential (A->A)
 * @property inverseOf - The relationship type that represents the inverse relationship
 */
export interface RelationshipTypeMetadata {
  symmetric: boolean;
  transitive: boolean;
  reflexive: boolean;
  inverseOf?: RelationshipType;
}

/**
 * Properties that can be attached to a relationship for additional context.
 *
 * @property confidence - Confidence score for the relationship (0-1)
 * @property source - Source system or process that created the relationship
 * @property evidence - Supporting evidence or reasoning for the relationship
 * @property metadata - Additional custom metadata
 * @property validFrom - Start of temporal validity (ISO 8601)
 * @property validUntil - End of temporal validity (ISO 8601)
 */
export interface RelationshipProperties {
  confidence?: number;
  source?: string;
  evidence?: string[];
  metadata?: Record<string, any>;
  validFrom?: string;
  validUntil?: string;
}

/**
 * Directional relationship between two nodes in the knowledge graph.
 *
 * @property sourceNodeId - UUID of the source node
 * @property targetNodeId - UUID of the target node
 * @property type - Type of relationship from RelationshipType enum
 * @property weight - Weight/strength of the relationship (default: 1.0)
 * @property properties - Additional properties and metadata
 * @property organizationId - Organization context for multi-tenancy
 * @property isActive - Soft delete flag
 */
export interface Relationship {
  sourceNodeId: string;
  targetNodeId: string;
  type: RelationshipType;
  weight?: number;
  properties?: RelationshipProperties;
  organizationId: string;
  isActive?: boolean;
}

/**
 * Bidirectional relationship representation for query results.
 * Includes both source and target node information.
 *
 * @property id - UUID of the edge/relationship
 * @property relationship - The relationship details
 * @property sourceNode - Source node data (when populated)
 * @property targetNode - Target node data (when populated)
 * @property createdAt - Timestamp of relationship creation
 * @property updatedAt - Timestamp of last update
 */
export interface BidirectionalRelationship extends Relationship {
  id: string;
  sourceNode?: any; // Node entity type
  targetNode?: any; // Node entity type
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mapping of relationship types to their semantic metadata.
 * Defines the logical properties of each relationship type.
 */
export const RELATIONSHIP_TYPE_METADATA: Record<
  RelationshipType,
  RelationshipTypeMetadata
> = {
  [RelationshipType.RELATES_TO]: {
    symmetric: true,
    transitive: false,
    reflexive: false,
  },
  [RelationshipType.DERIVED_FROM]: {
    symmetric: false,
    transitive: true,
    reflexive: false,
  },
  [RelationshipType.CONTRADICTS]: {
    symmetric: true,
    transitive: false,
    reflexive: false,
  },
  [RelationshipType.SUPPORTS]: {
    symmetric: false,
    transitive: false,
    reflexive: false,
    inverseOf: RelationshipType.REFUTES,
  },
  [RelationshipType.EXTENDS]: {
    symmetric: false,
    transitive: true,
    reflexive: false,
  },
  [RelationshipType.PREREQUISITE_OF]: {
    symmetric: false,
    transitive: true,
    reflexive: false,
  },
  [RelationshipType.PART_OF]: {
    symmetric: false,
    transitive: true,
    reflexive: false,
  },
  [RelationshipType.CHILD_OF]: {
    symmetric: false,
    transitive: true,
    reflexive: false,
  },
  [RelationshipType.REFERENCES]: {
    symmetric: false,
    transitive: false,
    reflexive: false,
  },
  [RelationshipType.IMPLEMENTS]: {
    symmetric: false,
    transitive: false,
    reflexive: false,
  },
  [RelationshipType.MANAGES]: {
    symmetric: false,
    transitive: false,
    reflexive: false,
  },
  [RelationshipType.CREATED_BY]: {
    symmetric: false,
    transitive: false,
    reflexive: false,
  },
  [RelationshipType.BELONGS_TO]: {
    symmetric: false,
    transitive: false,
    reflexive: false,
  },
  [RelationshipType.DEPENDS_ON]: {
    symmetric: false,
    transitive: true,
    reflexive: false,
  },
  [RelationshipType.COLLABORATES_WITH]: {
    symmetric: true,
    transitive: false,
    reflexive: false,
  },
  [RelationshipType.REFUTES]: {
    symmetric: false,
    transitive: false,
    reflexive: false,
    inverseOf: RelationshipType.SUPPORTS,
  },
  [RelationshipType.SIMILAR_TO]: {
    symmetric: true,
    transitive: false,
    reflexive: true,
  },
  [RelationshipType.EXPLAINS]: {
    symmetric: false,
    transitive: false,
    reflexive: false,
  },
  [RelationshipType.EXEMPLIFIES]: {
    symmetric: false,
    transitive: false,
    reflexive: false,
  },
  [RelationshipType.CUSTOM]: {
    symmetric: false,
    transitive: false,
    reflexive: false,
  },
};

/**
 * Constants for relationship operations and validation.
 */
export const RELATIONSHIP_CONSTANTS = {
  /** Default weight for unweighted relationships */
  DEFAULT_WEIGHT: 1.0,

  /** Minimum valid weight value */
  MIN_WEIGHT: 0.0,

  /** Maximum valid weight value */
  MAX_WEIGHT: 1.0,

  /** Default confidence score when not specified */
  DEFAULT_CONFIDENCE: 0.5,

  /** Minimum confidence score */
  MIN_CONFIDENCE: 0.0,

  /** Maximum confidence score */
  MAX_CONFIDENCE: 1.0,
} as const;

/**
 * Type guard to check if a relationship type is symmetric.
 *
 * @param type - The relationship type to check
 * @returns True if the relationship type is symmetric
 */
export function isSymmetricRelationship(type: RelationshipType): boolean {
  return RELATIONSHIP_TYPE_METADATA[type].symmetric;
}

/**
 * Type guard to check if a relationship type is transitive.
 *
 * @param type - The relationship type to check
 * @returns True if the relationship type is transitive
 */
export function isTransitiveRelationship(type: RelationshipType): boolean {
  return RELATIONSHIP_TYPE_METADATA[type].transitive;
}

/**
 * Type guard to check if a relationship type is reflexive.
 *
 * @param type - The relationship type to check
 * @returns True if the relationship type is reflexive
 */
export function isReflexiveRelationship(type: RelationshipType): boolean {
  return RELATIONSHIP_TYPE_METADATA[type].reflexive;
}

/**
 * Get the inverse relationship type if it exists.
 *
 * @param type - The relationship type to get the inverse of
 * @returns The inverse relationship type or undefined
 */
export function getInverseRelationship(
  type: RelationshipType,
): RelationshipType | undefined {
  return RELATIONSHIP_TYPE_METADATA[type].inverseOf;
}
