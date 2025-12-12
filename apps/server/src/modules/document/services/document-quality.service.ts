import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';

/**
 * Quality scoring weights
 * Total should sum to 1.0 (100%)
 */
const QUALITY_WEIGHTS = {
  COMPLETENESS: 0.3, // 30%
  USAGE_FREQUENCY: 0.25, // 25%
  USER_RATINGS: 0.25, // 25%
  FRESHNESS: 0.2, // 20%
} as const;

/**
 * Scoring thresholds and parameters
 */
const SCORING_PARAMS = {
  // Completeness thresholds
  MIN_CONTENT_LENGTH: 100, // Minimum characters for good content
  OPTIMAL_CONTENT_LENGTH: 1000, // Optimal length for max score
  MIN_TAGS: 1, // Minimum tags for good completeness
  OPTIMAL_TAGS: 5, // Optimal number of tags

  // Usage frequency thresholds
  HIGH_USAGE_THRESHOLD: 100, // Views considered "high usage"

  // Freshness decay (days)
  FRESHNESS_DECAY_DAYS: 90, // Days until score starts decaying
  MAX_AGE_DAYS: 365, // Maximum age for scoring purposes
} as const;

export interface QualityScoreBreakdown {
  totalScore: number;
  completenessScore: number;
  usageScore: number;
  ratingScore: number;
  freshnessScore: number;
}

@Injectable()
export class DocumentQualityService {
  private readonly logger = new Logger(DocumentQualityService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
  ) {}

  /**
   * Calculate quality score for a document
   * Returns a score between 0-100
   */
  calculateQualityScore(document: Document): QualityScoreBreakdown {
    const completenessScore = this.calculateCompletenessScore(document);
    const usageScore = this.calculateUsageScore(document);
    const ratingScore = this.calculateRatingScore(document);
    const freshnessScore = this.calculateFreshnessScore(document);

    const totalScore =
      completenessScore * QUALITY_WEIGHTS.COMPLETENESS +
      usageScore * QUALITY_WEIGHTS.USAGE_FREQUENCY +
      ratingScore * QUALITY_WEIGHTS.USER_RATINGS +
      freshnessScore * QUALITY_WEIGHTS.FRESHNESS;

    return {
      totalScore: Math.round(totalScore * 100) / 100, // Round to 2 decimal places
      completenessScore,
      usageScore,
      ratingScore,
      freshnessScore,
    };
  }

  /**
   * Completeness score (0-100)
   * Based on content length, tags, and metadata
   */
  private calculateCompletenessScore(document: Document): number {
    let score = 0;

    // Content length (50% of completeness)
    const contentLength = document.content?.length || 0;
    const contentScore = Math.min(
      100,
      (contentLength / SCORING_PARAMS.OPTIMAL_CONTENT_LENGTH) * 100,
    );
    score += contentScore * 0.5;

    // Title presence (10% of completeness)
    const titleScore = document.title && document.title.trim().length > 0 ? 100 : 0;
    score += titleScore * 0.1;

    // Tags (20% of completeness)
    const tagCount = document.tags?.length || 0;
    const tagScore = Math.min(
      100,
      (tagCount / SCORING_PARAMS.OPTIMAL_TAGS) * 100,
    );
    score += tagScore * 0.2;

    // Metadata (20% of completeness)
    const metadataScore =
      document.metadata && Object.keys(document.metadata).length > 0 ? 100 : 0;
    score += metadataScore * 0.2;

    return score;
  }

  /**
   * Usage frequency score (0-100)
   * Based on view count
   */
  private calculateUsageScore(document: Document): number {
    const viewCount = document.viewCount || 0;

    // Logarithmic scale to handle large view counts
    if (viewCount === 0) return 0;

    const score = Math.min(
      100,
      (Math.log10(viewCount + 1) /
        Math.log10(SCORING_PARAMS.HIGH_USAGE_THRESHOLD + 1)) *
        100,
    );

    return score;
  }

  /**
   * User rating score (0-100)
   * Based on average rating (1-5 scale)
   */
  private calculateRatingScore(document: Document): number {
    const ratingCount = document.ratingCount || 0;
    const ratingSum = document.ratingSum || 0;

    if (ratingCount === 0) {
      // No ratings yet - return neutral score
      return 50;
    }

    const averageRating = ratingSum / ratingCount;
    // Convert 1-5 scale to 0-100 scale
    const score = ((averageRating - 1) / 4) * 100;

    return score;
  }

  /**
   * Freshness score (0-100)
   * Based on last update or access time
   */
  private calculateFreshnessScore(document: Document): number {
    const now = new Date();
    const lastUpdate = document.lastAccessedAt || document.updatedAt;

    if (!lastUpdate) {
      // If no update time, use created time
      return this.calculateFreshnessFromDate(document.createdAt, now);
    }

    return this.calculateFreshnessFromDate(lastUpdate, now);
  }

  private calculateFreshnessFromDate(date: Date, now: Date): number {
    const daysSinceUpdate =
      (now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate <= SCORING_PARAMS.FRESHNESS_DECAY_DAYS) {
      // Full freshness score if within decay period
      return 100;
    }

    if (daysSinceUpdate >= SCORING_PARAMS.MAX_AGE_DAYS) {
      // Minimum score if too old
      return 0;
    }

    // Linear decay between decay threshold and max age
    const decayRange =
      SCORING_PARAMS.MAX_AGE_DAYS - SCORING_PARAMS.FRESHNESS_DECAY_DAYS;
    const daysInDecay = daysSinceUpdate - SCORING_PARAMS.FRESHNESS_DECAY_DAYS;
    const score = 100 - (daysInDecay / decayRange) * 100;

    return Math.max(0, score);
  }

  /**
   * Update quality score for a single document
   */
  async updateDocumentScore(documentId: string): Promise<Document> {
    const document = await this.documentRepo.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const scoreBreakdown = this.calculateQualityScore(document);
    document.qualityScore = scoreBreakdown.totalScore;

    await this.documentRepo.save(document);

    this.logger.debug(
      `Updated quality score for document ${documentId}: ${scoreBreakdown.totalScore}`,
    );

    return document;
  }

  /**
   * Increment view count and update last accessed time
   */
  async recordDocumentView(documentId: string): Promise<void> {
    await this.documentRepo.increment(
      { id: documentId },
      'viewCount',
      1,
    );

    await this.documentRepo.update(
      { id: documentId },
      { lastAccessedAt: new Date() },
    );

    // Recalculate quality score after view
    await this.updateDocumentScore(documentId);
  }

  /**
   * Add or update a user rating
   * @param rating - Rating value (1-5)
   */
  async rateDocument(
    documentId: string,
    rating: number,
  ): Promise<Document> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const document = await this.documentRepo.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Increment rating count and add to sum
    document.ratingCount += 1;
    document.ratingSum += rating;

    await this.documentRepo.save(document);

    // Recalculate quality score after rating
    return this.updateDocumentScore(documentId);
  }

  /**
   * Batch update quality scores for multiple documents
   */
  async batchUpdateScores(documentIds: string[]): Promise<void> {
    this.logger.log(`Batch updating scores for ${documentIds.length} documents`);

    for (const id of documentIds) {
      try {
        await this.updateDocumentScore(id);
      } catch (error) {
        this.logger.error(`Failed to update score for document ${id}:`, error);
      }
    }
  }

  /**
   * Update scores for all documents in an organization
   */
  async updateOrganizationScores(organizationId: string): Promise<void> {
    const documents = await this.documentRepo.find({
      where: { organizationId },
      select: ['id'],
    });

    const documentIds = documents.map((d) => d.id);
    await this.batchUpdateScores(documentIds);
  }

  /**
   * Get quality score breakdown for a document
   */
  async getScoreBreakdown(documentId: string): Promise<QualityScoreBreakdown> {
    const document = await this.documentRepo.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    return this.calculateQualityScore(document);
  }
}
