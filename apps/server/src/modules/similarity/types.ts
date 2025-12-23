/**
 * Core types for similarity calculation module
 *
 * This module provides type definitions for various similarity calculations
 * including cosine similarity, Jaccard similarity, and skill matching.
 */

/**
 * Represents a token (word) with its frequency information
 */
export interface Token {
  /** The actual token string */
  value: string;
  /** Frequency of the token in the document */
  frequency: number;
}

/**
 * Document representation for similarity calculations
 */
export interface Document {
  /** Unique identifier for the document */
  id: string;
  /** Raw text content of the document */
  content: string;
  /** Tokens extracted from the content */
  tokens?: Token[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * TF-IDF (Term Frequency-Inverse Document Frequency) vector representation
 */
export interface TfIdfVector {
  /** Document identifier */
  documentId: string;
  /** Map of term to its TF-IDF weight */
  weights: Map<string, number>;
  /** Magnitude of the vector (used for normalization) */
  magnitude: number;
}

/**
 * Vocabulary containing all unique terms across documents
 */
export interface Vocabulary {
  /** Set of all unique terms */
  terms: Set<string>;
  /** Document frequency for each term (how many documents contain the term) */
  documentFrequency: Map<string, number>;
  /** Total number of documents */
  totalDocuments: number;
}

/**
 * Options for text tokenization
 */
export interface TokenizationOptions {
  /** Convert to lowercase before tokenization */
  lowercase?: boolean;
  /** Remove punctuation */
  removePunctuation?: boolean;
  /** Minimum token length */
  minLength?: number;
  /** Maximum token length */
  maxLength?: number;
  /** Custom stop words to remove */
  stopWords?: string[];
  /** Use default English stop words */
  useDefaultStopWords?: boolean;
  /** Custom tokenization pattern (regex) */
  pattern?: RegExp;
}

/**
 * Options for TF-IDF vectorization
 */
export interface TfIdfOptions {
  /** Tokenization options */
  tokenization?: TokenizationOptions;
  /** Use sublinear TF scaling (1 + log(tf)) instead of raw frequency */
  sublinearTfScaling?: boolean;
  /** Smooth IDF weights to prevent zero-division */
  smoothIdf?: boolean;
  /** Normalize vectors to unit length */
  normalize?: boolean;
}

/**
 * Result of a similarity calculation between two entities
 */
export interface SimilarityResult {
  /** Identifier of the first entity */
  id1: string;
  /** Identifier of the second entity */
  id2: string;
  /** Similarity score (typically 0-1) */
  score: number;
  /** Type of similarity calculation used */
  method: SimilarityMethod;
  /** Optional breakdown of how the score was calculated */
  breakdown?: Record<string, number>;
  /** Optional metadata about the comparison */
  metadata?: Record<string, unknown>;
}

/**
 * Types of similarity calculation methods
 */
export enum SimilarityMethod {
  COSINE = 'cosine',
  JACCARD = 'jaccard',
  EUCLIDEAN = 'euclidean',
  MANHATTAN = 'manhattan',
  SKILL_MATCH = 'skill_match',
  HYBRID = 'hybrid',
}

/**
 * Skill representation for skill-based matching
 */
export interface Skill {
  /** Skill identifier or name */
  name: string;
  /** Proficiency level (0-1 or 0-100) */
  level?: number;
  /** Category or domain of the skill */
  category?: string;
  /** Optional weight for importance */
  weight?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Skill set for an entity (hollon, role, task, etc.)
 */
export interface SkillSet {
  /** Entity identifier */
  entityId: string;
  /** List of skills */
  skills: Skill[];
  /** Entity type */
  entityType?: string;
}

/**
 * Options for skill matching calculations
 */
export interface SkillMatchOptions {
  /** Weight for exact name matches (0-1) */
  exactMatchWeight?: number;
  /** Weight for proficiency level similarity (0-1) */
  levelWeight?: number;
  /** Weight for category matches (0-1) */
  categoryWeight?: number;
  /** Minimum proficiency level to consider */
  minLevel?: number;
  /** Whether to apply skill weights */
  useSkillWeights?: boolean;
  /** Threshold for considering a match */
  matchThreshold?: number;
}

/**
 * Result of skill-based similarity calculation
 */
export interface SkillMatchResult extends SimilarityResult {
  /** Skills that matched between entities */
  matchedSkills: Array<{
    skill1: Skill;
    skill2: Skill;
    similarity: number;
  }>;
  /** Skills only in first entity */
  uniqueToFirst: Skill[];
  /** Skills only in second entity */
  uniqueToSecond: Skill[];
  /** Breakdown by skill category */
  categoryScores?: Map<string, number>;
}

/**
 * Weighted vector for similarity calculations
 */
export interface WeightedVector {
  /** Vector components */
  components: number[];
  /** Optional feature names corresponding to components */
  features?: string[];
  /** Whether the vector is normalized */
  normalized?: boolean;
}

/**
 * Comparison strategy for token-based similarity
 */
export enum TokenComparisonStrategy {
  /** Exact string matching */
  EXACT = 'exact',
  /** Case-insensitive matching */
  CASE_INSENSITIVE = 'case_insensitive',
  /** Stemmed token matching */
  STEMMED = 'stemmed',
  /** Lemmatized token matching */
  LEMMATIZED = 'lemmatized',
  /** N-gram based matching */
  NGRAM = 'ngram',
}

/**
 * Options for token comparison
 */
export interface TokenComparisonOptions {
  /** Strategy to use for comparing tokens */
  strategy?: TokenComparisonStrategy;
  /** N-gram size (for n-gram strategy) */
  ngramSize?: number;
  /** Similarity threshold for fuzzy matching (0-1) */
  similarityThreshold?: number;
}

/**
 * Batch similarity calculation request
 */
export interface BatchSimilarityRequest {
  /** Source entities to compare */
  sources: string[];
  /** Target entities to compare against */
  targets: string[];
  /** Similarity method to use */
  method: SimilarityMethod;
  /** Optional threshold to filter results */
  threshold?: number;
  /** Maximum number of results per source */
  topK?: number;
}

/**
 * Batch similarity calculation result
 */
export interface BatchSimilarityResult {
  /** Results grouped by source entity */
  results: Map<string, SimilarityResult[]>;
  /** Total number of comparisons performed */
  totalComparisons: number;
  /** Computation time in milliseconds */
  computationTime?: number;
}
