/**
 * Interfaces and API contracts for similarity calculation services
 *
 * These interfaces define the contracts for various similarity calculation
 * operations including cosine similarity, Jaccard similarity, and skill matching.
 */

import {
  Document,
  TfIdfVector,
  TfIdfOptions,
  SimilarityResult,
  SkillSet,
  SkillMatchOptions,
  SkillMatchResult,
  TokenizationOptions,
  Vocabulary,
  WeightedVector,
  BatchSimilarityRequest,
  BatchSimilarityResult,
  TokenComparisonOptions,
} from './types';

/**
 * Interface for text tokenization service
 */
export interface ITokenizer {
  /**
   * Tokenize text into individual tokens
   * @param text - Input text to tokenize
   * @param options - Tokenization options
   * @returns Array of token strings
   */
  tokenize(text: string, options?: TokenizationOptions): string[];

  /**
   * Tokenize text and return tokens with frequencies
   * @param text - Input text to tokenize
   * @param options - Tokenization options
   * @returns Map of token to frequency count
   */
  tokenizeWithFrequency(
    text: string,
    options?: TokenizationOptions,
  ): Map<string, number>;

  /**
   * Remove stop words from token array
   * @param tokens - Array of tokens
   * @param stopWords - Custom stop words (if not provided, uses default)
   * @returns Filtered tokens
   */
  removeStopWords(tokens: string[], stopWords?: string[]): string[];
}

/**
 * Interface for TF-IDF vectorization service
 */
export interface ITfIdfVectorizer {
  /**
   * Build vocabulary from a collection of documents
   * @param documents - Array of documents
   * @param options - TF-IDF options
   * @returns Vocabulary containing all terms and their document frequencies
   */
  buildVocabulary(
    documents: Document[],
    options?: TfIdfOptions,
  ): Promise<Vocabulary>;

  /**
   * Convert a document to TF-IDF vector
   * @param document - Document to vectorize
   * @param vocabulary - Pre-built vocabulary
   * @param options - TF-IDF options
   * @returns TF-IDF vector representation
   */
  vectorize(
    document: Document,
    vocabulary: Vocabulary,
    options?: TfIdfOptions,
  ): Promise<TfIdfVector>;

  /**
   * Batch vectorize multiple documents
   * @param documents - Array of documents
   * @param options - TF-IDF options
   * @returns Array of TF-IDF vectors
   */
  vectorizeDocuments(
    documents: Document[],
    options?: TfIdfOptions,
  ): Promise<TfIdfVector[]>;

  /**
   * Calculate term frequency for a term in a document
   * @param term - Term to calculate frequency for
   * @param document - Document context
   * @param sublinear - Whether to use sublinear scaling
   * @returns Term frequency score
   */
  calculateTermFrequency(
    term: string,
    document: Document,
    sublinear?: boolean,
  ): number;

  /**
   * Calculate inverse document frequency for a term
   * @param term - Term to calculate IDF for
   * @param vocabulary - Vocabulary containing document frequencies
   * @param smooth - Whether to smooth IDF
   * @returns Inverse document frequency score
   */
  calculateInverseDocumentFrequency(
    term: string,
    vocabulary: Vocabulary,
    smooth?: boolean,
  ): number;
}

/**
 * Interface for cosine similarity calculation
 */
export interface ICosineSimilarity {
  /**
   * Calculate cosine similarity between two TF-IDF vectors
   * @param vector1 - First TF-IDF vector
   * @param vector2 - Second TF-IDF vector
   * @returns Similarity score between 0 and 1
   */
  calculate(vector1: TfIdfVector, vector2: TfIdfVector): number;

  /**
   * Calculate cosine similarity between two weighted vectors
   * @param vector1 - First weighted vector
   * @param vector2 - Second weighted vector
   * @returns Similarity score between 0 and 1
   */
  calculateWeighted(vector1: WeightedVector, vector2: WeightedVector): number;

  /**
   * Calculate cosine similarity between two documents
   * @param doc1 - First document
   * @param doc2 - Second document
   * @param options - TF-IDF options
   * @returns Similarity result
   */
  compareDocuments(
    doc1: Document,
    doc2: Document,
    options?: TfIdfOptions,
  ): Promise<SimilarityResult>;

  /**
   * Calculate dot product of two vectors
   * @param vector1 - First vector
   * @param vector2 - Second vector
   * @returns Dot product value
   */
  dotProduct(vector1: TfIdfVector, vector2: TfIdfVector): number;

  /**
   * Calculate magnitude (norm) of a vector
   * @param vector - Vector to calculate magnitude for
   * @returns Magnitude value
   */
  magnitude(vector: TfIdfVector): number;
}

/**
 * Interface for Jaccard similarity calculation
 */
export interface IJaccardSimilarity {
  /**
   * Calculate Jaccard similarity between two sets of tokens
   * @param tokens1 - First set of tokens
   * @param tokens2 - Second set of tokens
   * @param options - Token comparison options
   * @returns Similarity score between 0 and 1
   */
  calculate(
    tokens1: string[],
    tokens2: string[],
    options?: TokenComparisonOptions,
  ): number;

  /**
   * Calculate Jaccard similarity between two documents
   * @param doc1 - First document
   * @param doc2 - Second document
   * @param tokenizationOptions - Options for tokenizing documents
   * @returns Similarity result
   */
  compareDocuments(
    doc1: Document,
    doc2: Document,
    tokenizationOptions?: TokenizationOptions,
  ): Promise<SimilarityResult>;

  /**
   * Calculate Jaccard similarity between two sets
   * @param set1 - First set
   * @param set2 - Second set
   * @returns Similarity score between 0 and 1
   */
  calculateSetSimilarity<T>(set1: Set<T>, set2: Set<T>): number;

  /**
   * Calculate intersection of two token sets
   * @param tokens1 - First set of tokens
   * @param tokens2 - Second set of tokens
   * @returns Intersection size
   */
  intersection(tokens1: string[], tokens2: string[]): number;

  /**
   * Calculate union of two token sets
   * @param tokens1 - First set of tokens
   * @param tokens2 - Second set of tokens
   * @returns Union size
   */
  union(tokens1: string[], tokens2: string[]): number;
}

/**
 * Interface for skill-based similarity matching
 */
export interface ISkillMatcher {
  /**
   * Calculate similarity between two skill sets
   * @param skillSet1 - First skill set
   * @param skillSet2 - Second skill set
   * @param options - Skill matching options
   * @returns Detailed skill match result
   */
  matchSkills(
    skillSet1: SkillSet,
    skillSet2: SkillSet,
    options?: SkillMatchOptions,
  ): Promise<SkillMatchResult>;

  /**
   * Find best matching skills between two sets
   * @param skillSet1 - First skill set
   * @param skillSet2 - Second skill set
   * @param options - Skill matching options
   * @returns Array of matched skill pairs with similarity scores
   */
  findMatchingSkills(
    skillSet1: SkillSet,
    skillSet2: SkillSet,
    options?: SkillMatchOptions,
  ): Promise<
    Array<{
      skill1: { name: string; level?: number };
      skill2: { name: string; level?: number };
      similarity: number;
    }>
  >;

  /**
   * Calculate overall skill match score
   * @param skillSet1 - First skill set
   * @param skillSet2 - Second skill set
   * @param options - Skill matching options
   * @returns Overall similarity score between 0 and 1
   */
  calculateMatchScore(
    skillSet1: SkillSet,
    skillSet2: SkillSet,
    options?: SkillMatchOptions,
  ): Promise<number>;

  /**
   * Calculate similarity between two individual skills
   * @param skill1 - First skill
   * @param skill2 - Second skill
   * @param options - Skill matching options
   * @returns Similarity score between 0 and 1
   */
  calculateSkillSimilarity(
    skill1: { name: string; level?: number; category?: string },
    skill2: { name: string; level?: number; category?: string },
    options?: SkillMatchOptions,
  ): number;

  /**
   * Calculate proficiency level similarity
   * @param level1 - First proficiency level
   * @param level2 - Second proficiency level
   * @returns Similarity score between 0 and 1
   */
  calculateLevelSimilarity(level1: number, level2: number): number;
}

/**
 * Main similarity service interface
 */
export interface ISimilarityService {
  /**
   * Calculate similarity using specified method
   * @param entity1Id - First entity identifier
   * @param entity2Id - Second entity identifier
   * @param method - Similarity calculation method
   * @param options - Method-specific options
   * @returns Similarity result
   */
  calculateSimilarity(
    entity1Id: string,
    entity2Id: string,
    method: string,
    options?: Record<string, unknown>,
  ): Promise<SimilarityResult>;

  /**
   * Find most similar entities to a given entity
   * @param entityId - Source entity identifier
   * @param candidateIds - Candidate entity identifiers to compare against
   * @param method - Similarity calculation method
   * @param topK - Number of top results to return
   * @param threshold - Minimum similarity threshold
   * @returns Array of similarity results sorted by score (descending)
   */
  findMostSimilar(
    entityId: string,
    candidateIds: string[],
    method: string,
    topK?: number,
    threshold?: number,
  ): Promise<SimilarityResult[]>;

  /**
   * Batch calculate similarities
   * @param request - Batch similarity request
   * @returns Batch similarity result
   */
  calculateBatchSimilarity(
    request: BatchSimilarityRequest,
  ): Promise<BatchSimilarityResult>;
}

/**
 * Interface for vector normalization utilities
 */
export interface IVectorNormalizer {
  /**
   * Normalize a TF-IDF vector to unit length
   * @param vector - Vector to normalize
   * @returns Normalized vector
   */
  normalize(vector: TfIdfVector): TfIdfVector;

  /**
   * Normalize a weighted vector to unit length
   * @param vector - Vector to normalize
   * @returns Normalized vector
   */
  normalizeWeighted(vector: WeightedVector): WeightedVector;

  /**
   * Check if a vector is normalized
   * @param vector - Vector to check
   * @param tolerance - Tolerance for floating point comparison
   * @returns True if vector is normalized
   */
  isNormalized(vector: TfIdfVector | WeightedVector, tolerance?: number): boolean;
}

/**
 * Interface for similarity caching to improve performance
 */
export interface ISimilarityCache {
  /**
   * Get cached similarity result
   * @param key - Cache key (typically combination of entity IDs and method)
   * @returns Cached result or null if not found
   */
  get(key: string): Promise<SimilarityResult | null>;

  /**
   * Store similarity result in cache
   * @param key - Cache key
   * @param result - Similarity result to cache
   * @param ttl - Time to live in seconds
   */
  set(key: string, result: SimilarityResult, ttl?: number): Promise<void>;

  /**
   * Generate cache key from parameters
   * @param entity1Id - First entity ID
   * @param entity2Id - Second entity ID
   * @param method - Similarity method
   * @returns Cache key
   */
  generateKey(entity1Id: string, entity2Id: string, method: string): string;

  /**
   * Clear cache
   */
  clear(): Promise<void>;

  /**
   * Invalidate cache entries for a specific entity
   * @param entityId - Entity ID to invalidate
   */
  invalidateEntity(entityId: string): Promise<void>;
}
