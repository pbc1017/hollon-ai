/**
 * Knowledge Types
 *
 * Comprehensive type definitions for knowledge management including:
 * - Entity types
 * - Relationship types
 * - Metadata structures
 * - Query and filter types
 */

import { KnowledgeType } from '../entities/knowledge.entity';

/**
 * Knowledge confidence levels
 */
export enum ConfidenceLevel {
  VERY_LOW = 'very_low', // 0.0 - 0.2
  LOW = 'low', // 0.2 - 0.4
  MEDIUM = 'medium', // 0.4 - 0.6
  HIGH = 'high', // 0.6 - 0.8
  VERY_HIGH = 'very_high', // 0.8 - 1.0
}

/**
 * Knowledge lifecycle status
 */
export enum KnowledgeStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  DEPRECATED = 'deprecated',
}

/**
 * Knowledge visibility/access level
 */
export enum KnowledgeVisibility {
  PUBLIC = 'public', // Available to all organization members
  TEAM = 'team', // Limited to team members
  PROJECT = 'project', // Limited to project members
  PRIVATE = 'private', // Only accessible to creator
  RESTRICTED = 'restricted', // Requires specific permissions
}

/**
 * Entity types that can be extracted from knowledge
 */
export enum EntityType {
  PERSON = 'person',
  ORGANIZATION = 'organization',
  LOCATION = 'location',
  DATE = 'date',
  TIME = 'time',
  TECHNOLOGY = 'technology',
  PRODUCT = 'product',
  FEATURE = 'feature',
  BUG = 'bug',
  REQUIREMENT = 'requirement',
  DECISION = 'decision',
  RISK = 'risk',
  DEPENDENCY = 'dependency',
  METRIC = 'metric',
  URL = 'url',
  CODE_REFERENCE = 'code_reference',
  CUSTOM = 'custom',
}

/**
 * Relationship types between knowledge items
 */
export enum RelationshipType {
  RELATES_TO = 'relates_to',
  DERIVES_FROM = 'derives_from',
  SUPERSEDES = 'supersedes',
  REFERENCES = 'references',
  CONTRADICTS = 'contradicts',
  SUPPORTS = 'supports',
  DEPENDS_ON = 'depends_on',
  FOLLOWS = 'follows',
  PRECEDES = 'precedes',
  IMPLEMENTS = 'implements',
  DOCUMENTS = 'documents',
  EXPLAINS = 'explains',
  EXEMPLIFIES = 'exemplifies',
}

/**
 * Knowledge entity reference
 */
export interface EntityReference {
  /** Type of entity */
  type: EntityType;

  /** Entity value/content */
  value: string;

  /** Confidence in entity extraction */
  confidence: number;

  /** Position in source text */
  position?: {
    start: number;
    end: number;
  };

  /** Normalized form of entity */
  normalized?: string;

  /** Additional entity metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge relationship
 */
export interface KnowledgeRelationship {
  /** Source knowledge ID */
  sourceId: string;

  /** Target knowledge ID */
  targetId: string;

  /** Type of relationship */
  type: RelationshipType;

  /** Relationship strength/confidence (0-1) */
  strength: number;

  /** Bidirectional relationship */
  bidirectional?: boolean;

  /** Relationship metadata */
  metadata?: {
    /** When relationship was established */
    establishedAt?: Date;

    /** How relationship was determined */
    derivedBy?: 'manual' | 'automatic' | 'ml_inference';

    /** Evidence supporting relationship */
    evidence?: string[];

    /** Custom attributes */
    [key: string]: unknown;
  };
}

/**
 * Knowledge metadata structure
 */
export interface KnowledgeMetadata {
  /** Source information */
  source: {
    id: string;
    type: string;
    url?: string;
    title?: string;
    author?: {
      id: string;
      name?: string;
      type?: string;
    };
  };

  /** Extraction details */
  extraction?: {
    method: 'manual' | 'automatic' | 'hybrid';
    model?: string;
    version?: string;
    extractedAt: Date;
    processingTime?: number;
  };

  /** Quality metrics */
  quality?: {
    confidence: number;
    confidenceLevel: ConfidenceLevel;
    completeness?: number;
    accuracy?: number;
    relevance?: number;
  };

  /** Content classification */
  classification?: {
    primaryType: KnowledgeType;
    secondaryTypes?: KnowledgeType[];
    topics?: string[];
    categories?: string[];
    tags?: string[];
  };

  /** Entities found in content */
  entities?: EntityReference[];

  /** Keywords and concepts */
  keywords?: string[];

  /** Language and localization */
  language?: string;
  locale?: string;

  /** Timestamps */
  timestamps?: {
    created?: Date;
    modified?: Date;
    accessed?: Date;
    reviewed?: Date;
    published?: Date;
  };

  /** Access control */
  access?: {
    visibility: KnowledgeVisibility;
    ownerIds?: string[];
    teamIds?: string[];
    projectIds?: string[];
  };

  /** Versioning */
  version?: {
    number: number;
    previousVersionId?: string;
    changeLog?: string;
  };

  /** AI/ML specific */
  ml?: {
    embedding?: number[];
    embeddingModel?: string;
    clusterId?: string;
    topicId?: string;
  };

  /** Usage statistics */
  usage?: {
    viewCount?: number;
    referenceCount?: number;
    lastAccessedAt?: Date;
    lastReferencedAt?: Date;
  };

  /** Custom fields */
  [key: string]: unknown;
}

/**
 * Knowledge search filter
 */
export interface KnowledgeFilter {
  /** Filter by types */
  types?: KnowledgeType[];

  /** Filter by status */
  status?: KnowledgeStatus[];

  /** Filter by visibility */
  visibility?: KnowledgeVisibility[];

  /** Filter by confidence level */
  confidenceLevel?: ConfidenceLevel[];

  /** Filter by source types */
  sourceTypes?: string[];

  /** Filter by tags */
  tags?: string[];

  /** Filter by keywords */
  keywords?: string[];

  /** Filter by entity types */
  entityTypes?: EntityType[];

  /** Filter by date created */
  createdAfter?: Date;
  createdBefore?: Date;

  /** Filter by date modified */
  modifiedAfter?: Date;
  modifiedBefore?: Date;

  /** Filter by owner */
  ownerIds?: string[];

  /** Filter by team */
  teamIds?: string[];

  /** Filter by project */
  projectIds?: string[];
}

/**
 * Knowledge sort options
 */
export interface KnowledgeSort {
  /** Field to sort by */
  field:
    | 'createdAt'
    | 'updatedAt'
    | 'confidence'
    | 'relevance'
    | 'viewCount'
    | 'referenceCount';

  /** Sort direction */
  order: 'asc' | 'desc';
}

/**
 * Knowledge aggregation result
 */
export interface KnowledgeAggregation {
  /** Aggregation by type */
  byType: Record<KnowledgeType, number>;

  /** Aggregation by status */
  byStatus?: Record<KnowledgeStatus, number>;

  /** Aggregation by visibility */
  byVisibility?: Record<KnowledgeVisibility, number>;

  /** Aggregation by confidence level */
  byConfidenceLevel?: Record<ConfidenceLevel, number>;

  /** Total count */
  total: number;

  /** Average confidence */
  avgConfidence?: number;

  /** Date range */
  dateRange?: {
    earliest: Date;
    latest: Date;
  };
}

/**
 * Knowledge statistics
 */
export interface KnowledgeStatistics {
  /** Total knowledge items */
  totalCount: number;

  /** Count by type */
  countByType: Record<KnowledgeType, number>;

  /** Count by source */
  countBySource: Record<string, number>;

  /** Average confidence score */
  avgConfidence: number;

  /** Confidence distribution */
  confidenceDistribution: Record<ConfidenceLevel, number>;

  /** Growth over time */
  growth?: {
    daily: number;
    weekly: number;
    monthly: number;
  };

  /** Top keywords */
  topKeywords?: Array<{
    keyword: string;
    count: number;
  }>;

  /** Top entities */
  topEntities?: Array<{
    type: EntityType;
    value: string;
    count: number;
  }>;

  /** Relationship statistics */
  relationships?: {
    totalCount: number;
    byType: Record<RelationshipType, number>;
    avgStrength: number;
  };
}

/**
 * Knowledge validation result
 */
export interface KnowledgeValidation {
  /** Is valid */
  valid: boolean;

  /** Validation errors */
  errors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;

  /** Validation warnings */
  warnings?: Array<{
    field: string;
    message: string;
    code: string;
  }>;

  /** Suggestions for improvement */
  suggestions?: string[];
}

/**
 * Knowledge export format options
 */
export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  XML = 'xml',
  MARKDOWN = 'markdown',
  PDF = 'pdf',
  HTML = 'html',
}

/**
 * Knowledge export options
 */
export interface KnowledgeExportOptions {
  /** Export format */
  format: ExportFormat;

  /** Include metadata */
  includeMetadata?: boolean;

  /** Include relationships */
  includeRelationships?: boolean;

  /** Include entities */
  includeEntities?: boolean;

  /** Date range filter */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /** Custom fields to include */
  fields?: string[];

  /** Compression */
  compress?: boolean;
}

/**
 * Knowledge import options
 */
export interface KnowledgeImportOptions {
  /** Source format */
  format: ExportFormat;

  /** Merge strategy for duplicates */
  mergeStrategy?: 'skip' | 'replace' | 'merge' | 'create_new';

  /** Validate before import */
  validate?: boolean;

  /** Automatic categorization */
  autoCategorizе?: boolean;

  /** Organization context */
  organizationId: string;

  /** Optional team context */
  teamId?: string;

  /** Optional project context */
  projectId?: string;
}

/**
 * Knowledge import result
 */
export interface KnowledgeImportResult {
  /** Successfully imported items */
  imported: number;

  /** Skipped items */
  skipped: number;

  /** Failed items */
  failed: number;

  /** Errors encountered */
  errors?: Array<{
    index: number;
    message: string;
    data?: unknown;
  }>;

  /** Created knowledge IDs */
  createdIds: string[];

  /** Processing time in milliseconds */
  processingTime: number;
}

/**
 * Knowledge update payload
 */
export interface KnowledgeUpdate {
  /** Updated content */
  content?: string;

  /** Updated type */
  type?: KnowledgeType;

  /** Updated metadata */
  metadata?: Partial<KnowledgeMetadata>;

  /** Status change */
  status?: KnowledgeStatus;

  /** Visibility change */
  visibility?: KnowledgeVisibility;

  /** Change notes */
  changeNotes?: string;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  /** Total items processed */
  total: number;

  /** Successfully processed */
  success: number;

  /** Failed to process */
  failed: number;

  /** Processing errors */
  errors?: Array<{
    id: string;
    error: string;
  }>;

  /** Processing time */
  processingTime: number;
}
