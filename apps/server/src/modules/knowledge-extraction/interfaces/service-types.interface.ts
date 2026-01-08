/**
 * Service type definitions for KnowledgeExtractionService
 *
 * This file contains TypeScript interfaces for complex parameter objects
 * and return types used throughout the KnowledgeExtractionService.
 */

/**
 * Pagination result wrapper for knowledge items
 */
export interface PaginationResult<T> {
  /**
   * Array of items for the current page
   */
  items: T[];

  /**
   * Total count of items across all pages
   */
  total: number;

  /**
   * Current page number (1-indexed)
   */
  page: number;

  /**
   * Number of items per page
   */
  limit: number;
}

/**
 * Advanced search filter options
 */
export interface SearchFilters {
  /**
   * Organization ID (required)
   */
  organizationId: string;

  /**
   * Optional array of knowledge types to filter by
   */
  types?: string[];

  /**
   * Optional content search term (case-insensitive)
   */
  searchTerm?: string;

  /**
   * Optional start of date range (inclusive)
   */
  startDate?: Date;

  /**
   * Optional end of date range (inclusive)
   */
  endDate?: Date;

  /**
   * Optional maximum number of results
   */
  limit?: number;

  /**
   * Optional number of results to skip (for pagination)
   */
  offset?: number;

  /**
   * Optional sort field
   */
  orderBy?: 'extractedAt' | 'type' | 'createdAt';

  /**
   * Optional sort direction
   */
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * Count filters for knowledge items
 */
export interface CountFilters {
  /**
   * Organization ID (required)
   */
  organizationId: string;

  /**
   * Optional array of knowledge types to filter by
   */
  types?: string[];

  /**
   * Optional content search term
   */
  searchTerm?: string;

  /**
   * Optional start of date range
   */
  startDate?: Date;

  /**
   * Optional end of date range
   */
  endDate?: Date;
}

/**
 * Temporal distribution data point
 */
export interface TemporalDistribution {
  /**
   * Time period (date string)
   */
  period: string;

  /**
   * Count of items in this period
   */
  count: number;
}

/**
 * Document parsing options
 */
export interface DocumentParseOptions {
  /**
   * MIME type of the document (e.g., 'application/pdf')
   */
  mimeType: string;

  /**
   * Extract document metadata (default: true)
   */
  extractMetadata?: boolean;

  /**
   * Preserve document formatting information (default: false)
   */
  preserveFormatting?: boolean;

  /**
   * Extract embedded images (default: false)
   */
  extractImages?: boolean;

  /**
   * Extract table structures (default: false)
   */
  extractTables?: boolean;
}

/**
 * Document metadata extracted from parsing
 */
export interface DocumentMetadata {
  /**
   * Document title
   */
  title?: string;

  /**
   * Document author
   */
  author?: string;

  /**
   * Document creation date
   */
  creationDate?: Date;

  /**
   * Number of pages
   */
  pageCount?: number;

  /**
   * Additional metadata fields
   */
  [key: string]: unknown;
}

/**
 * Document heading structure
 */
export interface DocumentHeading {
  /**
   * Heading level (1-6)
   */
  level: number;

  /**
   * Heading text content
   */
  text: string;

  /**
   * Page number where heading appears
   */
  page?: number;
}

/**
 * Document table structure
 */
export interface DocumentTable {
  /**
   * Page number where table appears
   */
  page?: number;

  /**
   * Table rows (array of cell values)
   */
  rows: string[][];

  /**
   * Optional table headers
   */
  headers?: string[];
}

/**
 * Document image data
 */
export interface DocumentImage {
  /**
   * Page number where image appears
   */
  page?: number;

  /**
   * Image binary data
   */
  data: Buffer;

  /**
   * Image MIME type
   */
  mimeType: string;
}

/**
 * Document structure information
 */
export interface DocumentStructure {
  /**
   * Document headings
   */
  headings?: DocumentHeading[];

  /**
   * Document tables
   */
  tables?: DocumentTable[];

  /**
   * Document images
   */
  images?: DocumentImage[];
}

/**
 * Parsed document result
 */
export interface ParsedDocument {
  /**
   * Extracted text content
   */
  content: string;

  /**
   * Document metadata
   */
  metadata: DocumentMetadata;

  /**
   * Document structure (headings, tables, images)
   */
  structure?: DocumentStructure;
}

/**
 * Text extraction options
 */
export interface TextExtractionOptions {
  /**
   * MIME type of the document
   */
  mimeType: string;

  /**
   * Character encoding for text documents (default: 'utf-8')
   */
  encoding?: string;

  /**
   * Remove unnecessary line breaks (default: false)
   */
  removeLineBreaks?: boolean;

  /**
   * Normalize multiple spaces to single space (default: true)
   */
  normalizeWhitespace?: boolean;

  /**
   * Preserve paragraph structure (default: true)
   */
  preserveParagraphs?: boolean;

  /**
   * Maximum length of extracted text in characters
   */
  maxLength?: number;
}

/**
 * Content preprocessing options
 */
export interface PreprocessOptions {
  /**
   * Strip HTML tags if present (default: true)
   */
  removeHtml?: boolean;

  /**
   * Remove URLs from text (default: false)
   */
  removeUrls?: boolean;

  /**
   * Remove email addresses (default: false)
   */
  removeEmails?: boolean;

  /**
   * Convert text to lowercase (default: false)
   */
  lowercaseText?: boolean;

  /**
   * Remove common stopwords (default: false)
   */
  removeStopwords?: boolean;

  /**
   * Apply stemming to words (default: false)
   */
  stemming?: boolean;

  /**
   * Split text into sentences (default: false)
   */
  segmentSentences?: boolean;

  /**
   * Split text into paragraphs (default: false)
   */
  segmentParagraphs?: boolean;

  /**
   * Minimum word length to keep (default: 1)
   */
  minWordLength?: number;

  /**
   * Maximum word length to keep (default: 100)
   */
  maxWordLength?: number;
}

/**
 * Preprocessed content result (can be string or segmented)
 */
export interface PreprocessedContent {
  /**
   * Segmented sentences
   */
  sentences?: string[];

  /**
   * Segmented paragraphs
   */
  paragraphs?: string[];
}
