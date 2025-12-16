import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  KnowledgeEntry,
  KnowledgeEntryType,
  KnowledgeCategory,
} from '../entities/knowledge-entry.entity';
import { KnowledgeRepository } from './knowledge.repository';

export interface SemanticSearchOptions {
  query: string;
  organizationId: string;
  teamId?: string;
  projectId?: string;
  type?: KnowledgeEntryType;
  category?: KnowledgeCategory;
  limit?: number;
  minConfidence?: number;
}

export interface RetrievalContext {
  taskDescription?: string;
  tags?: string[];
  skills?: string[];
  type?: string;
  priority?: string;
}

@Injectable()
export class KnowledgeRetrievalService {
  private readonly logger = new Logger(KnowledgeRetrievalService.name);

  constructor(
    private readonly knowledgeRepo: KnowledgeRepository,
    @InjectRepository(KnowledgeEntry)
    private readonly entryRepo: Repository<KnowledgeEntry>,
  ) {}

  /**
   * Perform semantic search using embeddings
   * TODO: Implement with pgvector once embedding generation is set up
   */
  async semanticSearch(
    options: SemanticSearchOptions,
  ): Promise<KnowledgeEntry[]> {
    this.logger.debug(`Semantic search for query: ${options.query}`);

    // TODO: Generate embedding for query using OpenAI/Anthropic
    // const queryEmbedding = await this.generateEmbedding(options.query);

    // For now, fall back to keyword-based search
    return this.keywordSearch(options);
  }

  /**
   * Keyword-based search (fallback until embeddings are implemented)
   */
  private async keywordSearch(
    options: SemanticSearchOptions,
  ): Promise<KnowledgeEntry[]> {
    const query = this.entryRepo
      .createQueryBuilder('ke')
      .where('ke.organization_id = :orgId', { orgId: options.organizationId })
      .andWhere('(ke.title ILIKE :query OR ke.content ILIKE :query)', {
        query: `%${options.query}%`,
      });

    if (options.teamId) {
      query.andWhere('ke.team_id = :teamId', { teamId: options.teamId });
    }

    if (options.projectId) {
      query.andWhere('ke.project_id = :projectId', {
        projectId: options.projectId,
      });
    }

    if (options.type) {
      query.andWhere('ke.type = :type', { type: options.type });
    }

    if (options.category) {
      query.andWhere('ke.category = :category', { category: options.category });
    }

    if (options.minConfidence !== undefined) {
      query.andWhere('ke.confidence_score >= :minConfidence', {
        minConfidence: options.minConfidence,
      });
    }

    if (options.limit) {
      query.limit(options.limit);
    }

    return query
      .orderBy('ke.confidence_score', 'DESC')
      .addOrderBy('ke.application_count', 'DESC')
      .getMany();
  }

  /**
   * Retrieve relevant knowledge for a given context
   * This combines tag-based and semantic search
   */
  async retrieveForContext(
    context: RetrievalContext,
    organizationId: string,
    options?: {
      teamId?: string;
      projectId?: string;
      limit?: number;
    },
  ): Promise<KnowledgeEntry[]> {
    const results = new Map<string, { entry: KnowledgeEntry; score: number }>();

    // 1. Tag-based retrieval if tags are provided
    if (context.tags && context.tags.length > 0) {
      const tagResults = await this.knowledgeRepo.findByTags(
        organizationId,
        context.tags,
        {
          teamId: options?.teamId,
          limit: options?.limit || 10,
        },
      );

      tagResults.forEach((entry) => {
        const matchingTags = entry.tags.filter((tag) =>
          context.tags?.includes(tag),
        );
        const score = matchingTags.length * 10 + entry.confidenceScore;
        results.set(entry.id, { entry, score });
      });
    }

    // 2. Semantic search if task description is provided
    if (context.taskDescription) {
      const semanticResults = await this.semanticSearch({
        query: context.taskDescription,
        organizationId,
        teamId: options?.teamId,
        projectId: options?.projectId,
        limit: options?.limit || 5,
      });

      semanticResults.forEach((entry) => {
        const existing = results.get(entry.id);
        if (existing) {
          // Boost score if found by multiple methods
          existing.score += 20;
        } else {
          results.set(entry.id, {
            entry,
            score: entry.confidenceScore + 10,
          });
        }
      });
    }

    // 3. Type-based search if type is provided
    if (context.type) {
      const typeResults = await this.knowledgeRepo.search({
        organizationId,
        teamId: options?.teamId,
        projectId: options?.projectId,
        tags: context.tags,
        limit: options?.limit || 10,
      });

      typeResults.forEach((entry) => {
        const existing = results.get(entry.id);
        if (existing) {
          existing.score += 5;
        } else {
          results.set(entry.id, { entry, score: entry.confidenceScore });
        }
      });
    }

    // Sort by score and return top results
    const sortedResults = Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, options?.limit || 10)
      .map((r) => r.entry);

    this.logger.log(
      `Retrieved ${sortedResults.length} knowledge entries for context`,
    );

    return sortedResults;
  }

  /**
   * Find similar knowledge entries based on an existing entry
   */
  async findSimilar(
    entryId: string,
    options?: {
      limit?: number;
      minConfidence?: number;
    },
  ): Promise<KnowledgeEntry[]> {
    const entry = await this.knowledgeRepo.findOne(entryId);

    // Use tags and category to find similar entries
    const similar = await this.knowledgeRepo.search({
      organizationId: entry.organizationId,
      teamId: entry.teamId || undefined,
      category: entry.category,
      tags: entry.tags,
      minConfidence: options?.minConfidence,
      limit: (options?.limit || 5) + 1, // +1 to exclude the original entry
    });

    // Filter out the original entry
    return similar
      .filter((e) => e.id !== entryId)
      .slice(0, options?.limit || 5);
  }

  /**
   * Get recommended knowledge for a task
   */
  async getRecommendationsForTask(
    taskId: string,
    organizationId: string,
    options?: {
      tags?: string[];
      type?: string;
      limit?: number;
    },
  ): Promise<KnowledgeEntry[]> {
    // First check if there's already knowledge for this task
    const existingKnowledge = await this.knowledgeRepo.findByTask(taskId);
    if (existingKnowledge.length > 0) {
      return existingKnowledge;
    }

    // Otherwise, retrieve based on tags and type
    return this.retrieveForContext(
      {
        tags: options?.tags,
        type: options?.type,
      },
      organizationId,
      {
        limit: options?.limit || 5,
      },
    );
  }

  /**
   * Get knowledge statistics and insights
   */
  async getInsights(organizationId: string): Promise<{
    totalEntries: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    topTags: Array<{ tag: string; count: number }>;
    averageConfidence: number;
    mostApplied: KnowledgeEntry[];
  }> {
    const stats = await this.knowledgeRepo.getStatistics(organizationId);

    // Get top tags
    const entries = await this.entryRepo.find({
      where: { organizationId },
      select: ['tags'],
    });

    const tagCounts = new Map<string, number>();
    entries.forEach((entry) => {
      entry.tags?.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get most applied knowledge
    const mostApplied = await this.entryRepo.find({
      where: { organizationId },
      order: { applicationCount: 'DESC' },
      take: 10,
    });

    return {
      ...stats,
      topTags,
      mostApplied,
    };
  }

  /**
   * TODO: Generate embedding for text using AI service
   * This would integrate with OpenAI/Anthropic for embedding generation
   */
  private async generateEmbedding(_text: string): Promise<number[]> {
    // Placeholder for embedding generation
    // In production, this would call:
    // - OpenAI embeddings API
    // - Anthropic embeddings (when available)
    // - Or use a local model
    this.logger.warn('Embedding generation not yet implemented');
    return [];
  }

  /**
   * TODO: Batch update embeddings for existing entries
   */
  async updateEmbeddings(organizationId: string): Promise<number> {
    const entries = await this.entryRepo.find({
      where: { organizationId },
      select: ['id', 'title', 'content', 'embedding'],
    });

    let updated = 0;
    for (const entry of entries) {
      if (!entry.embedding) {
        // Generate embedding for title + content
        const text = `${entry.title}\n\n${entry.content}`;
        const embedding = await this.generateEmbedding(text);

        if (embedding.length > 0) {
          entry.embedding = JSON.stringify(embedding);
          await this.entryRepo.save(entry);
          updated++;
        }
      }
    }

    this.logger.log(`Updated embeddings for ${updated} entries`);
    return updated;
  }
}
