import { Injectable, Logger } from '@nestjs/common';

export enum DecisionType {
  SPLIT_TASK = 'split_task',
  ESCALATE = 'escalate',
  RETRY = 'retry',
  ARCHITECTURAL = 'architectural',
  QUALITY_GATE = 'quality_gate',
  OTHER = 'other',
}

export interface Decision {
  id: string;
  type: DecisionType;
  taskId: string;
  hollonId: string;
  question: string; // The decision question/context
  answer: string; // The decision made
  reasoning: string; // Why this decision was made
  metadata?: Record<string, unknown>; // Additional context
  timestamp: Date;
  tags?: string[]; // For categorization and search
}

export interface DecisionSearchResult {
  decision: Decision;
  relevanceScore: number; // 0-1, based on keyword match
  similarity?: string; // Description of why this is relevant
}

export interface DecisionConsistencyCheck {
  isConsistent: boolean;
  conflictingDecisions: Decision[];
  recommendation: string;
}

@Injectable()
export class DecisionLogService {
  private readonly logger = new Logger(DecisionLogService.name);

  // In-memory storage for decisions
  // In production, this would be persisted to a database
  private decisions: Map<string, Decision> = new Map();

  // Index by taskId for quick lookup
  private taskDecisions: Map<string, string[]> = new Map();

  // Index by hollonId for quick lookup
  private hollonDecisions: Map<string, string[]> = new Map();

  /**
   * Record a new decision
   */
  recordDecision(decision: Omit<Decision, 'id' | 'timestamp'>): Decision {
    const id = this.generateDecisionId();
    const fullDecision: Decision = {
      ...decision,
      id,
      timestamp: new Date(),
    };

    this.decisions.set(id, fullDecision);

    // Update indices
    if (!this.taskDecisions.has(decision.taskId)) {
      this.taskDecisions.set(decision.taskId, []);
    }
    this.taskDecisions.get(decision.taskId)!.push(id);

    if (!this.hollonDecisions.has(decision.hollonId)) {
      this.hollonDecisions.set(decision.hollonId, []);
    }
    this.hollonDecisions.get(decision.hollonId)!.push(id);

    this.logger.log(
      `Decision recorded: ${id} for task ${decision.taskId} by hollon ${decision.hollonId}`,
    );

    return fullDecision;
  }

  /**
   * Get all decisions for a task
   */
  getDecisionsForTask(taskId: string): Decision[] {
    const decisionIds = this.taskDecisions.get(taskId) || [];
    return decisionIds
      .map((id) => this.decisions.get(id))
      .filter((d): d is Decision => d !== undefined);
  }

  /**
   * Get all decisions by a specific hollon
   */
  getDecisionsByHollon(hollonId: string): Decision[] {
    const decisionIds = this.hollonDecisions.get(hollonId) || [];
    return decisionIds
      .map((id) => this.decisions.get(id))
      .filter((d): d is Decision => d !== undefined);
  }

  /**
   * Get a specific decision by ID
   */
  getDecision(decisionId: string): Decision | null {
    return this.decisions.get(decisionId) || null;
  }

  /**
   * Search for similar decisions using keyword matching
   * Useful for finding precedent decisions before making new ones
   */
  searchSimilarDecisions(
    query: string,
    options: {
      type?: DecisionType;
      hollonId?: string;
      limit?: number;
    } = {},
  ): DecisionSearchResult[] {
    const { type, hollonId, limit = 10 } = options;

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

    let candidateDecisions = Array.from(this.decisions.values());

    // Filter by type if specified
    if (type) {
      candidateDecisions = candidateDecisions.filter((d) => d.type === type);
    }

    // Filter by hollon if specified
    if (hollonId) {
      candidateDecisions = candidateDecisions.filter(
        (d) => d.hollonId === hollonId,
      );
    }

    // Score each decision based on keyword matches
    const scoredResults: DecisionSearchResult[] = candidateDecisions
      .map((decision) => {
        const searchText = [
          decision.question,
          decision.answer,
          decision.reasoning,
          ...(decision.tags || []),
        ]
          .join(' ')
          .toLowerCase();

        // Count matching words
        let matchCount = 0;
        let totalWords = queryWords.length;

        for (const word of queryWords) {
          if (searchText.includes(word)) {
            matchCount++;
          }
        }

        const relevanceScore = totalWords > 0 ? matchCount / totalWords : 0;

        // Find which parts matched for similarity description
        const matchingParts: string[] = [];
        if (
          decision.question.toLowerCase().includes(queryLower.substring(0, 20))
        ) {
          matchingParts.push('question');
        }
        if (
          decision.answer.toLowerCase().includes(queryLower.substring(0, 20))
        ) {
          matchingParts.push('answer');
        }
        if (
          decision.reasoning.toLowerCase().includes(queryLower.substring(0, 20))
        ) {
          matchingParts.push('reasoning');
        }

        return {
          decision,
          relevanceScore,
          similarity:
            matchingParts.length > 0
              ? `Matches in ${matchingParts.join(', ')}`
              : 'Keyword match',
        };
      })
      .filter((result) => result.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    this.logger.log(
      `Found ${scoredResults.length} similar decisions for query: "${query}"`,
    );

    return scoredResults;
  }

  /**
   * Check if a new decision is consistent with previous decisions
   * Looks for conflicting decisions on similar topics
   */
  checkConsistency(
    proposedDecision: Omit<Decision, 'id' | 'timestamp'>,
  ): DecisionConsistencyCheck {
    // Search for similar past decisions
    const similarDecisions = this.searchSimilarDecisions(
      `${proposedDecision.question} ${proposedDecision.answer}`,
      {
        type: proposedDecision.type,
        limit: 5,
      },
    );

    if (similarDecisions.length === 0) {
      return {
        isConsistent: true,
        conflictingDecisions: [],
        recommendation:
          'No similar previous decisions found. This is a new decision.',
      };
    }

    // Check for conflicts by comparing answers
    const conflictingDecisions: Decision[] = [];
    const proposedAnswerLower = proposedDecision.answer.toLowerCase();

    for (const result of similarDecisions) {
      const pastDecision = result.decision;
      const pastAnswerLower = pastDecision.answer.toLowerCase();

      // Simple conflict detection: opposite keywords
      const hasConflict = this.detectConflict(
        proposedAnswerLower,
        pastAnswerLower,
      );

      if (hasConflict) {
        conflictingDecisions.push(pastDecision);
      }
    }

    if (conflictingDecisions.length > 0) {
      return {
        isConsistent: false,
        conflictingDecisions,
        recommendation: `Found ${conflictingDecisions.length} potentially conflicting decision(s). Review these before proceeding to ensure consistency.`,
      };
    }

    return {
      isConsistent: true,
      conflictingDecisions: [],
      recommendation: `Decision is consistent with ${similarDecisions.length} similar past decision(s).`,
    };
  }

  /**
   * Detect if two answers conflict using simple heuristics
   */
  private detectConflict(answer1: string, answer2: string): boolean {
    // Pairs of opposite keywords
    const opposites = [
      ['yes', 'no'],
      ['split', 'merge'],
      ['split', 'keep'],
      ['escalate', 'continue'],
      ['retry', 'fail'],
      ['approve', 'reject'],
      ['accept', 'reject'],
      ['increase', 'decrease'],
      ['add', 'remove'],
    ];

    for (const [word1, word2] of opposites) {
      const has1InFirst = answer1.includes(word1);
      const has2InFirst = answer1.includes(word2);
      const has1InSecond = answer2.includes(word1);
      const has2InSecond = answer2.includes(word2);

      // If answer1 contains word1 and answer2 contains word2 (opposite)
      if ((has1InFirst && has2InSecond) || (has2InFirst && has1InSecond)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get decision statistics
   */
  getStatistics(): {
    totalDecisions: number;
    decisionsByType: Record<DecisionType, number>;
    decisionsByHollon: Record<string, number>;
    recentDecisions: Decision[];
  } {
    const allDecisions = Array.from(this.decisions.values());

    const decisionsByType = allDecisions.reduce(
      (acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1;
        return acc;
      },
      {} as Record<DecisionType, number>,
    );

    const decisionsByHollon = allDecisions.reduce(
      (acc, d) => {
        acc[d.hollonId] = (acc[d.hollonId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const recentDecisions = allDecisions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalDecisions: allDecisions.length,
      decisionsByType,
      decisionsByHollon,
      recentDecisions,
    };
  }

  /**
   * Clear all decisions (useful for testing)
   */
  clearAll(): void {
    this.decisions.clear();
    this.taskDecisions.clear();
    this.hollonDecisions.clear();
    this.logger.log('All decisions cleared');
  }

  /**
   * Generate a unique decision ID
   */
  private generateDecisionId(): string {
    return `decision_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get all decisions (primarily for testing/debugging)
   */
  getAllDecisions(): Decision[] {
    return Array.from(this.decisions.values());
  }

  /**
   * Delete a specific decision
   */
  deleteDecision(decisionId: string): boolean {
    const decision = this.decisions.get(decisionId);
    if (!decision) {
      return false;
    }

    // Remove from main storage
    this.decisions.delete(decisionId);

    // Remove from task index
    const taskIds = this.taskDecisions.get(decision.taskId);
    if (taskIds) {
      const index = taskIds.indexOf(decisionId);
      if (index > -1) {
        taskIds.splice(index, 1);
      }
    }

    // Remove from hollon index
    const hollonIds = this.hollonDecisions.get(decision.hollonId);
    if (hollonIds) {
      const index = hollonIds.indexOf(decisionId);
      if (index > -1) {
        hollonIds.splice(index, 1);
      }
    }

    this.logger.log(`Decision deleted: ${decisionId}`);
    return true;
  }

  /**
   * Get decisions by type
   */
  getDecisionsByType(type: DecisionType): Decision[] {
    return Array.from(this.decisions.values()).filter((d) => d.type === type);
  }

  /**
   * Get decisions within a time range
   */
  getDecisionsByTimeRange(startDate: Date, endDate: Date): Decision[] {
    return Array.from(this.decisions.values()).filter(
      (d) => d.timestamp >= startDate && d.timestamp <= endDate,
    );
  }
}
