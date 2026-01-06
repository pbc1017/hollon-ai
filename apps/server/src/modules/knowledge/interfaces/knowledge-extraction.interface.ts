/**
 * Knowledge Extraction Interface
 *
 * Defines contracts for knowledge extraction operations including:
 * - Document input types
 * - Knowledge storage formats
 * - Retrieval query structures
 */

import { KnowledgeType } from '../entities/knowledge.entity';

/**
 * Document source types for knowledge extraction
 */
export enum DocumentSourceType {
  MESSAGE = 'message',
  MEETING = 'meeting',
  TASK = 'task',
  DOCUMENT = 'document',
  CODE_REVIEW = 'code_review',
  INCIDENT = 'incident',
  ESCALATION = 'escalation',
  CHAT = 'chat',
  EMAIL = 'email',
  WIKI = 'wiki',
  API = 'api',
  EXTERNAL = 'external',
}

/**
 * Input document for knowledge extraction
 */
export interface DocumentInput {
  /** Unique identifier for the source document */
  sourceId: string;

  /** Type of document source */
  sourceType: DocumentSourceType;

  /** Raw content to extract knowledge from */
  content: string;

  /** Optional title or summary */
  title?: string;

  /** Author or creator information */
  author?: {
    id: string;
    name?: string;
    type?: 'user' | 'hollon' | 'system';
  };

  /** Timestamp when the document was created */
  timestamp?: Date;

  /** Additional metadata about the document */
  metadata?: Record<string, unknown>;

  /** Organization context */
  organizationId: string;

  /** Optional team context */
  teamId?: string;

  /** Optional project context */
  projectId?: string;
}

/**
 * Options for knowledge extraction process
 */
export interface ExtractionOptions {
  /** Specific knowledge types to extract */
  targetTypes?: KnowledgeType[];

  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;

  /** Enable automatic categorization */
  autoCategorizе?: boolean;

  /** Extract relationships between entities */
  extractRelationships?: boolean;

  /** Generate embeddings for semantic search */
  generateEmbeddings?: boolean;

  /** Custom extraction rules or patterns */
  customRules?: Array<{
    pattern: string | RegExp;
    type: KnowledgeType;
    priority?: number;
  }>;

  /** Maximum number of knowledge items to extract */
  maxItems?: number;

  /** Language of the content */
  language?: string;
}

/**
 * Extracted knowledge entity
 */
export interface ExtractedKnowledge {
  /** Extracted content */
  content: string;

  /** Classified knowledge type */
  type: KnowledgeType;

  /** Confidence score (0-1) */
  confidence: number;

  /** Source reference */
  source: string;

  /** Structured metadata */
  metadata: {
    /** Original document source */
    sourceId: string;
    sourceType: DocumentSourceType;

    /** Extraction timestamp */
    extractedAt: Date;

    /** Entity references found in content */
    entities?: Array<{
      type: string;
      value: string;
      startPos?: number;
      endPos?: number;
    }>;

    /** Keywords or tags */
    keywords?: string[];

    /** Semantic embedding vector */
    embedding?: number[];

    /** Related knowledge items */
    relatedTo?: string[];

    /** Custom attributes */
    [key: string]: unknown;
  };

  /** Organization context */
  organizationId: string;

  /** Optional team context */
  teamId?: string;

  /** Optional project context */
  projectId?: string;
}

/**
 * Result of knowledge extraction operation
 */
export interface ExtractionResult {
  /** Successfully extracted knowledge items */
  extracted: ExtractedKnowledge[];

  /** Number of items extracted */
  count: number;

  /** Overall confidence score */
  overallConfidence: number;

  /** Processing time in milliseconds */
  processingTime: number;

  /** Warnings or non-critical issues */
  warnings?: string[];

  /** Summary statistics */
  stats?: {
    byType: Record<KnowledgeType, number>;
    avgConfidence: number;
    entitiesFound: number;
    relationshipsFound: number;
  };
}

/**
 * Query structure for retrieving knowledge
 */
export interface KnowledgeQuery {
  /** Organization scope */
  organizationId: string;

  /** Optional team filter */
  teamId?: string;

  /** Optional project filter */
  projectId?: string;

  /** Filter by knowledge types */
  types?: KnowledgeType[];

  /** Filter by source types */
  sourceTypes?: DocumentSourceType[];

  /** Text search query */
  searchText?: string;

  /** Semantic search (requires embeddings) */
  semanticSearch?: {
    query: string;
    topK?: number;
    minSimilarity?: number;
  };

  /** Filter by date range */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /** Filter by confidence threshold */
  minConfidence?: number;

  /** Filter by metadata fields */
  metadataFilters?: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
    value: unknown;
  }>;

  /** Sort options */
  sort?: {
    field: 'createdAt' | 'confidence' | 'relevance';
    order: 'asc' | 'desc';
  };

  /** Pagination */
  pagination?: {
    page: number;
    limit: number;
  };
}

/**
 * Knowledge retrieval result with pagination
 */
export interface KnowledgeRetrievalResult {
  /** Retrieved knowledge items */
  items: ExtractedKnowledge[];

  /** Total count matching query */
  total: number;

  /** Current page */
  page: number;

  /** Items per page */
  limit: number;

  /** Has more pages */
  hasMore: boolean;

  /** Query execution time in milliseconds */
  executionTime: number;
}

/**
 * Knowledge storage format for persistence
 */
export interface KnowledgeStorage {
  /** Storage identifier */
  id: string;

  /** Knowledge content */
  content: string;

  /** Knowledge type */
  type: KnowledgeType;

  /** Source reference */
  source: string;

  /** JSON metadata */
  metadata: Record<string, unknown>;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;

  /** Organization reference */
  organizationId: string;
}

/**
 * Batch extraction request
 */
export interface BatchExtractionRequest {
  /** Multiple documents to process */
  documents: DocumentInput[];

  /** Shared extraction options */
  options?: ExtractionOptions;

  /** Enable parallel processing */
  parallel?: boolean;

  /** Maximum concurrent operations */
  maxConcurrency?: number;
}

/**
 * Batch extraction result
 */
export interface BatchExtractionResult {
  /** Results per document */
  results: Array<{
    sourceId: string;
    success: boolean;
    extraction?: ExtractionResult;
    error?: string;
  }>;

  /** Overall statistics */
  summary: {
    totalDocuments: number;
    successCount: number;
    failureCount: number;
    totalExtracted: number;
    totalProcessingTime: number;
  };
}

/**
 * Knowledge extraction service interface
 */
export interface IKnowledgeExtractionService {
  /**
   * Extract knowledge from a single document
   */
  extractFromDocument(
    document: DocumentInput,
    options?: ExtractionOptions,
  ): Promise<ExtractionResult>;

  /**
   * Extract knowledge from multiple documents
   */
  batchExtract(request: BatchExtractionRequest): Promise<BatchExtractionResult>;

  /**
   * Query and retrieve knowledge
   */
  queryKnowledge(query: KnowledgeQuery): Promise<KnowledgeRetrievalResult>;

  /**
   * Store extracted knowledge
   */
  storeKnowledge(knowledge: ExtractedKnowledge): Promise<KnowledgeStorage>;

  /**
   * Store multiple knowledge items
   */
  batchStore(knowledge: ExtractedKnowledge[]): Promise<KnowledgeStorage[]>;

  /**
   * Update existing knowledge
   */
  updateKnowledge(
    id: string,
    updates: Partial<ExtractedKnowledge>,
  ): Promise<KnowledgeStorage>;

  /**
   * Delete knowledge by ID
   */
  deleteKnowledge(id: string): Promise<boolean>;

  /**
   * Get knowledge by ID
   */
  getKnowledgeById(id: string): Promise<KnowledgeStorage | null>;

  /**
   * Find similar knowledge items
   */
  findSimilar(
    content: string,
    organizationId: string,
    options?: {
      topK?: number;
      minSimilarity?: number;
      types?: KnowledgeType[];
    },
  ): Promise<ExtractedKnowledge[]>;
}
