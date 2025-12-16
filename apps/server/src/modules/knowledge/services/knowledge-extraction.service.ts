import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import {
  Document,
  DocumentType,
} from '../../document/entities/document.entity';
import {
  KnowledgeRepository,
  CreateKnowledgeEntryDto,
} from './knowledge.repository';
import {
  KnowledgeEntry,
  KnowledgeEntryType,
  KnowledgeCategory,
} from '../entities/knowledge-entry.entity';

export interface ExtractionContext {
  task: Task;
  relatedDocuments?: Document[];
  codeChanges?: {
    filesChanged: string[];
    linesAdded: number;
    linesRemoved: number;
  };
  reviewComments?: string[];
}

@Injectable()
export class KnowledgeExtractionService {
  private readonly logger = new Logger(KnowledgeExtractionService.name);

  constructor(
    private readonly knowledgeRepo: KnowledgeRepository,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
  ) {}

  /**
   * Extract knowledge from a completed task
   * This method analyzes task completion data to identify learnings
   */
  async extractFromTaskCompletion(
    taskId: string,
    hollonId?: string,
  ): Promise<KnowledgeEntry | null> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['project', 'assignedHollon'],
    });

    if (!task) {
      this.logger.warn(`Task ${taskId} not found for knowledge extraction`);
      return null;
    }

    if (task.status !== TaskStatus.COMPLETED) {
      this.logger.debug(`Task ${taskId} is not completed, skipping extraction`);
      return null;
    }

    // Find related documents
    const relatedDocs = await this.documentRepo.find({
      where: { taskId },
    });

    // Build extraction context
    const context: ExtractionContext = {
      task,
      relatedDocuments: relatedDocs,
    };

    // Analyze and extract knowledge
    return this.analyzeAndExtract(context, hollonId);
  }

  /**
   * Analyze task context and extract meaningful knowledge
   */
  private async analyzeAndExtract(
    context: ExtractionContext,
    hollonId?: string,
  ): Promise<KnowledgeEntry | null> {
    const { task, relatedDocuments } = context;

    // Determine knowledge type based on task characteristics
    const knowledgeType = this.determineKnowledgeType(task, relatedDocuments);
    const category = this.determineCategory(task);

    // Extract key insights from description and documents
    const insights = this.extractInsights(task, relatedDocuments);

    if (!insights) {
      this.logger.debug(`No significant insights found for task ${task.id}`);
      return null;
    }

    // Generate tags
    const tags = this.generateTags(task, relatedDocuments);

    // Create knowledge entry
    const dto: CreateKnowledgeEntryDto = {
      title: this.generateTitle(task, knowledgeType),
      content: insights,
      type: knowledgeType,
      category,
      organizationId: task.organizationId,
      teamId: task.assignedTeamId || null,
      projectId: task.projectId || null,
      taskId: task.id,
      extractedByHollonId: hollonId || task.assignedHollonId || null,
      tags,
      sources: {
        taskIds: [task.id],
        documentIds: relatedDocuments?.map((d) => d.id) || [],
      },
      confidenceScore: this.calculateConfidenceScore(task, relatedDocuments),
      metadata: {
        context: {
          taskType: task.type,
          taskPriority: task.priority,
          completionTime: task.updatedAt,
        },
      },
    };

    try {
      const entry = await this.knowledgeRepo.create(dto);
      this.logger.log(
        `Knowledge entry created: ${entry.id} from task ${task.id}`,
      );
      return entry;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to create knowledge entry: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * Determine the type of knowledge based on task and documents
   */
  private determineKnowledgeType(
    task: Task,
    documents?: Document[],
  ): KnowledgeEntryType {
    // Check for error patterns
    if (
      task.description.toLowerCase().includes('fix') ||
      task.description.toLowerCase().includes('bug') ||
      task.description.toLowerCase().includes('error')
    ) {
      return KnowledgeEntryType.ERROR_PATTERN;
    }

    // Check for best practices
    const hasBestPracticeDoc = documents?.some(
      (d) =>
        d.content.toLowerCase().includes('best practice') ||
        d.content.toLowerCase().includes('recommended approach'),
    );
    if (hasBestPracticeDoc) {
      return KnowledgeEntryType.BEST_PRACTICE;
    }

    // Check for technical decisions
    const hasDecisionDoc = documents?.some(
      (d) => d.type === DocumentType.DECISION_LOG,
    );
    if (hasDecisionDoc) {
      return KnowledgeEntryType.TECHNICAL_DECISION;
    }

    // Check for optimization
    if (
      task.description.toLowerCase().includes('optimize') ||
      task.description.toLowerCase().includes('performance')
    ) {
      return KnowledgeEntryType.OPTIMIZATION_INSIGHT;
    }

    // Default to lesson learned
    return KnowledgeEntryType.LESSON_LEARNED;
  }

  /**
   * Determine the category based on task content
   */
  private determineCategory(task: Task): KnowledgeCategory {
    const desc = task.description.toLowerCase();

    if (
      desc.includes('architecture') ||
      desc.includes('design') ||
      desc.includes('structure')
    ) {
      return KnowledgeCategory.ARCHITECTURE;
    }

    if (desc.includes('performance') || desc.includes('optimize')) {
      return KnowledgeCategory.PERFORMANCE;
    }

    if (
      desc.includes('test') ||
      desc.includes('quality') ||
      desc.includes('review')
    ) {
      return KnowledgeCategory.QUALITY;
    }

    if (desc.includes('process') || desc.includes('workflow')) {
      return KnowledgeCategory.PROCESS;
    }

    if (desc.includes('team') || desc.includes('collaboration')) {
      return KnowledgeCategory.COLLABORATION;
    }

    return KnowledgeCategory.TECHNICAL;
  }

  /**
   * Extract meaningful insights from task and documents
   */
  private extractInsights(task: Task, documents?: Document[]): string | null {
    const insights: string[] = [];

    // Add task description as primary context
    insights.push(`## Context\n${task.description}\n`);

    // Extract from decision logs
    const decisionDocs = documents?.filter(
      (d) => d.type === DocumentType.DECISION_LOG,
    );
    if (decisionDocs && decisionDocs.length > 0) {
      insights.push(`## Decisions Made`);
      decisionDocs.forEach((doc) => {
        insights.push(`- ${doc.title}: ${doc.content.substring(0, 200)}...`);
      });
    }

    // Extract from code reviews
    const reviewDocs = documents?.filter(
      (d) => d.type === DocumentType.CODE_REVIEW,
    );
    if (reviewDocs && reviewDocs.length > 0) {
      insights.push(`\n## Review Insights`);
      reviewDocs.forEach((doc) => {
        insights.push(`- ${doc.content.substring(0, 150)}...`);
      });
    }

    // Extract from knowledge documents
    const knowledgeDocs = documents?.filter(
      (d) => d.type === DocumentType.KNOWLEDGE,
    );
    if (knowledgeDocs && knowledgeDocs.length > 0) {
      insights.push(`\n## Key Learnings`);
      knowledgeDocs.forEach((doc) => {
        insights.push(`- ${doc.title}: ${doc.content.substring(0, 150)}...`);
      });
    }

    // Always return insights if we have at least the task description
    return insights.length > 0 ? insights.join('\n') : null;
  }

  /**
   * Generate relevant tags for the knowledge entry
   */
  private generateTags(task: Task, documents?: Document[]): string[] {
    const tags: Set<string> = new Set();

    // Add task type
    tags.add(task.type);

    // Add priority
    tags.add(task.priority);

    // Extract keywords from description
    const keywords = this.extractKeywords(task.description);
    keywords.forEach((k) => tags.add(k));

    // Add tags from documents
    documents?.forEach((doc) => {
      doc.tags?.forEach((t) => tags.add(t));
    });

    return Array.from(tags).slice(0, 10); // Limit to 10 tags
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const commonWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !commonWords.has(w));

    // Get unique words
    return Array.from(new Set(words)).slice(0, 5);
  }

  /**
   * Generate a descriptive title for the knowledge entry
   */
  private generateTitle(task: Task, type: KnowledgeEntryType): string {
    const prefix = type
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const taskTitle = task.title.substring(0, 80);
    return `${prefix}: ${taskTitle}`;
  }

  /**
   * Calculate confidence score based on task and document quality
   */
  private calculateConfidenceScore(task: Task, documents?: Document[]): number {
    let score = 50; // Base score

    // Increase score if task has good documentation
    if (documents && documents.length > 0) {
      score += 10;
    }

    // Increase if has decision log
    if (documents?.some((d) => d.type === DocumentType.DECISION_LOG)) {
      score += 15;
    }

    // Increase if has code review
    if (documents?.some((d) => d.type === DocumentType.CODE_REVIEW)) {
      score += 10;
    }

    // Increase if description is detailed (> 100 chars)
    if (task.description.length > 100) {
      score += 10;
    }

    // Cap at 100
    return Math.min(100, score);
  }

  /**
   * Batch extract knowledge from multiple completed tasks
   */
  async batchExtractFromTasks(
    taskIds: string[],
    hollonId?: string,
  ): Promise<KnowledgeEntry[]> {
    const entries: KnowledgeEntry[] = [];

    for (const taskId of taskIds) {
      try {
        const entry = await this.extractFromTaskCompletion(taskId, hollonId);
        if (entry) {
          entries.push(entry);
        }
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Failed to extract knowledge from task ${taskId}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Batch extraction completed: ${entries.length}/${taskIds.length} entries created`,
    );
    return entries;
  }

  /**
   * Extract knowledge from an organization's completed tasks in a time range
   */
  async extractFromOrganization(
    organizationId: string,
    options?: {
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    },
  ): Promise<KnowledgeEntry[]> {
    const query = this.taskRepo
      .createQueryBuilder('task')
      .where('task.organization_id = :orgId', { orgId: organizationId })
      .andWhere('task.status = :status', { status: TaskStatus.COMPLETED });

    if (options?.fromDate) {
      query.andWhere('task.updated_at >= :fromDate', {
        fromDate: options.fromDate,
      });
    }

    if (options?.toDate) {
      query.andWhere('task.updated_at <= :toDate', {
        toDate: options.toDate,
      });
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    const tasks = await query.orderBy('task.updated_at', 'DESC').getMany();

    const taskIds = tasks.map((t) => t.id);
    return this.batchExtractFromTasks(taskIds);
  }
}
