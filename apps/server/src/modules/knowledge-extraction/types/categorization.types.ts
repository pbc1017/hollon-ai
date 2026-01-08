/**
 * Knowledge Categorization Types
 *
 * Defines the categorization system for extracted knowledge items.
 * This type system supports rule-based categorization and is designed
 * to be extensible for future category types.
 */

/**
 * Primary knowledge category types
 *
 * These categories represent the fundamental types of knowledge
 * that can be extracted from various sources.
 */
export enum KnowledgeCategory {
  /**
   * Facts: Objective, verifiable information
   * Examples: "The project uses TypeScript", "Database is PostgreSQL"
   */
  FACT = 'fact',

  /**
   * Preferences: Subjective choices, opinions, or preferred approaches
   * Examples: "We prefer using async/await over promises", "Team likes daily standups"
   */
  PREFERENCE = 'preference',

  /**
   * Context: Background information, situational details, or environmental factors
   * Examples: "This feature was built for mobile users", "Working in EST timezone"
   */
  CONTEXT = 'context',

  /**
   * Relationships: Connections, dependencies, or associations between entities
   * Examples: "User belongs to Team", "Service depends on Database"
   */
  RELATIONSHIP = 'relationship',
}

/**
 * Categorization confidence levels
 */
export enum CategorizationConfidence {
  VERY_LOW = 'very_low', // 0.0 - 0.2
  LOW = 'low', // 0.2 - 0.4
  MEDIUM = 'medium', // 0.4 - 0.6
  HIGH = 'high', // 0.6 - 0.8
  VERY_HIGH = 'very_high', // 0.8 - 1.0
}

/**
 * Pattern matching rule for categorization
 */
export interface CategorizationRule {
  /** Unique identifier for the rule */
  id: string;

  /** Rule name/description */
  name: string;

  /** Target category for this rule */
  category: KnowledgeCategory;

  /** Pattern matchers */
  patterns: {
    /** Content patterns (regex or keywords) */
    content?: string[];

    /** Metadata field patterns */
    metadata?: Record<string, unknown>;

    /** Entity type patterns */
    entityTypes?: string[];
  };

  /** Weight/priority of this rule (higher = more important) */
  weight: number;

  /** Confidence multiplier (0-1) */
  confidenceMultiplier: number;

  /** Whether this rule is active */
  enabled: boolean;
}

/**
 * Categorization result for a knowledge item
 */
export interface CategorizationResult {
  /** Primary category */
  category: KnowledgeCategory;

  /** Confidence score (0-1) */
  confidence: number;

  /** Confidence level enum */
  confidenceLevel: CategorizationConfidence;

  /** Alternative categories with their scores */
  alternatives?: Array<{
    category: KnowledgeCategory;
    confidence: number;
  }>;

  /** Rules that matched */
  matchedRules?: string[];

  /** Categorization metadata */
  metadata?: {
    /** Method used for categorization */
    method: 'rule-based' | 'ml' | 'hybrid' | 'manual';

    /** Timestamp of categorization */
    timestamp: Date;

    /** Processing time in milliseconds */
    processingTime?: number;

    /** Model version (if ML) */
    modelVersion?: string;
  };
}

/**
 * Input for categorization
 */
export interface CategorizationInput {
  /** Content to categorize */
  content: string;

  /** Optional metadata to assist categorization */
  metadata?: Record<string, unknown>;

  /** Optional entity information */
  entities?: Array<{
    type: string;
    value: string;
  }>;

  /** Optional context from source */
  sourceContext?: {
    type?: string;
    author?: string;
    timestamp?: Date;
  };
}

/**
 * Categorization options
 */
export interface CategorizationOptions {
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;

  /** Return alternative categories */
  includeAlternatives?: boolean;

  /** Maximum number of alternatives to return */
  maxAlternatives?: number;

  /** Custom rules to use */
  customRules?: CategorizationRule[];

  /** Enable/disable default rules */
  useDefaultRules?: boolean;
}

/**
 * Batch categorization result
 */
export interface BatchCategorizationResult {
  /** Total items processed */
  total: number;

  /** Successfully categorized */
  categorized: number;

  /** Failed categorizations */
  failed: number;

  /** Individual results */
  results: Array<{
    index: number;
    input: CategorizationInput;
    result?: CategorizationResult;
    error?: string;
  }>;

  /** Processing time in milliseconds */
  processingTime: number;

  /** Statistics */
  statistics: {
    /** Count by category */
    byCategory: Record<KnowledgeCategory, number>;

    /** Average confidence */
    avgConfidence: number;

    /** Confidence distribution */
    confidenceDistribution: Record<CategorizationConfidence, number>;
  };
}

/**
 * Rule set for categorization
 */
export interface CategorizationRuleSet {
  /** Version of the rule set */
  version: string;

  /** Description */
  description: string;

  /** List of rules */
  rules: CategorizationRule[];

  /** Metadata */
  metadata?: {
    createdAt: Date;
    updatedAt?: Date;
    author?: string;
  };
}
