/**
 * Result of text extraction operation
 */
export interface ExtractFromTextResult {
  /**
   * Extracted knowledge content
   */
  content: string;

  /**
   * Confidence score of the extraction (0-1)
   */
  confidence: number;

  /**
   * Metadata about the extraction
   */
  metadata: {
    method: string;
    timestamp: string;
    [key: string]: unknown;
  };
}

/**
 * Input for text extraction
 */
export interface ExtractFromTextInput {
  /**
   * Source text to extract knowledge from
   */
  text: string;

  /**
   * Source identifier
   */
  source: string;

  /**
   * Organization ID
   */
  organizationId: string;

  /**
   * Optional extraction options
   */
  options?: {
    language?: string;
    maxLength?: number;
    [key: string]: unknown;
  };
}

/**
 * Extracted entity
 */
export interface ExtractedEntity {
  /**
   * Entity type (e.g., 'person', 'organization', 'location')
   */
  type: string;

  /**
   * Entity text/value
   */
  value: string;

  /**
   * Confidence score (0-1)
   */
  confidence: number;

  /**
   * Start position in source text
   */
  startPosition?: number;

  /**
   * End position in source text
   */
  endPosition?: number;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Result of entity extraction operation
 */
export interface ExtractEntitiesResult {
  /**
   * List of extracted entities
   */
  entities: ExtractedEntity[];

  /**
   * Total number of entities found
   */
  totalCount: number;

  /**
   * Metadata about the extraction
   */
  metadata: {
    method: string;
    timestamp: string;
    [key: string]: unknown;
  };
}

/**
 * Input for entity extraction
 */
export interface ExtractEntitiesInput {
  /**
   * Source text to extract entities from
   */
  text: string;

  /**
   * Optional entity types to filter
   */
  entityTypes?: string[];

  /**
   * Optional extraction options
   */
  options?: {
    language?: string;
    minConfidence?: number;
    [key: string]: unknown;
  };
}

/**
 * Extracted relationship between entities
 */
export interface ExtractedRelationship {
  /**
   * Source entity
   */
  source: {
    type: string;
    value: string;
  };

  /**
   * Target entity
   */
  target: {
    type: string;
    value: string;
  };

  /**
   * Relationship type (e.g., 'works_for', 'located_in')
   */
  relationType: string;

  /**
   * Confidence score (0-1)
   */
  confidence: number;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Result of relationship extraction operation
 */
export interface ExtractRelationshipsResult {
  /**
   * List of extracted relationships
   */
  relationships: ExtractedRelationship[];

  /**
   * Total number of relationships found
   */
  totalCount: number;

  /**
   * Metadata about the extraction
   */
  metadata: {
    method: string;
    timestamp: string;
    [key: string]: unknown;
  };
}

/**
 * Input for relationship extraction
 */
export interface ExtractRelationshipsInput {
  /**
   * Source text to extract relationships from
   */
  text: string;

  /**
   * Optional entities to use as context
   */
  entities?: ExtractedEntity[];

  /**
   * Optional relationship types to filter
   */
  relationshipTypes?: string[];

  /**
   * Optional extraction options
   */
  options?: {
    language?: string;
    minConfidence?: number;
    [key: string]: unknown;
  };
}
