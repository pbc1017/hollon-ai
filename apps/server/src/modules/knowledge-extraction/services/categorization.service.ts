import { Injectable, Logger } from '@nestjs/common';
import {
  KnowledgeCategory,
  CategorizationConfidence,
  CategorizationRule,
  CategorizationResult,
  CategorizationInput,
  CategorizationOptions,
  BatchCategorizationResult,
  CategorizationRuleSet,
} from '../types/categorization.types';

/**
 * Knowledge Categorization Service
 *
 * Provides rule-based categorization of knowledge items into predefined categories.
 * Uses pattern matching and confidence scoring to classify knowledge content.
 *
 * ## Design Principles
 *
 * - **Extensibility**: Easy to add new categories and rules
 * - **Transparency**: Clear scoring and rule matching
 * - **Flexibility**: Configurable rules and thresholds
 * - **Performance**: Optimized for batch processing
 *
 * ## Categories
 *
 * 1. **Facts**: Objective, verifiable information
 * 2. **Preferences**: Subjective choices and opinions
 * 3. **Context**: Background and situational information
 * 4. **Relationships**: Connections between entities
 */
@Injectable()
export class CategorizationService {
  private readonly logger = new Logger(CategorizationService.name);
  private defaultRules: CategorizationRule[];

  constructor() {
    this.defaultRules = this.initializeDefaultRules();
  }

  /**
   * Categorize a single knowledge item
   *
   * @param input - The input to categorize
   * @param options - Categorization options
   * @returns Categorization result with confidence scores
   */
  categorize(
    input: CategorizationInput,
    options?: CategorizationOptions,
  ): CategorizationResult {
    const startTime = Date.now();

    // Merge options with defaults
    const opts: Required<CategorizationOptions> = {
      minConfidence: options?.minConfidence ?? 0.3,
      includeAlternatives: options?.includeAlternatives ?? true,
      maxAlternatives: options?.maxAlternatives ?? 3,
      customRules: options?.customRules ?? [],
      useDefaultRules: options?.useDefaultRules ?? true,
    };

    // Get applicable rules
    const rules = this.getApplicableRules(opts);

    // Score each category
    const categoryScores = this.scoreCategoriesWithRules(input, rules);

    // Find best category
    const sortedCategories = Object.entries(categoryScores).sort(
      ([, a], [, b]) => b.score - a.score,
    );

    const [primaryCategory, primaryScore] = sortedCategories[0];
    const confidence = Math.min(primaryScore.score, 1.0);
    const confidenceLevel = this.getConfidenceLevel(confidence);

    // Build result
    const result: CategorizationResult = {
      category: primaryCategory as KnowledgeCategory,
      confidence,
      confidenceLevel,
      matchedRules: primaryScore.matchedRules,
      metadata: {
        method: 'rule-based',
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
      },
    };

    // Add alternatives if requested
    if (opts.includeAlternatives && sortedCategories.length > 1) {
      result.alternatives = sortedCategories
        .slice(1, opts.maxAlternatives + 1)
        .filter(([, score]) => score.score >= opts.minConfidence)
        .map(([category, score]) => ({
          category: category as KnowledgeCategory,
          confidence: Math.min(score.score, 1.0),
        }));
    }

    return result;
  }

  /**
   * Categorize multiple knowledge items in batch
   *
   * @param inputs - Array of inputs to categorize
   * @param options - Categorization options
   * @returns Batch categorization results with statistics
   */
  batchCategorize(
    inputs: CategorizationInput[],
    options?: CategorizationOptions,
  ): BatchCategorizationResult {
    const startTime = Date.now();
    const results: BatchCategorizationResult['results'] = [];
    let categorized = 0;
    let failed = 0;

    // Categorize each input
    for (let i = 0; i < inputs.length; i++) {
      try {
        const result = this.categorize(inputs[i], options);
        results.push({ index: i, input: inputs[i], result });
        categorized++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to categorize item at index ${i}: ${errorMessage}`,
        );
        results.push({
          index: i,
          input: inputs[i],
          error: errorMessage,
        });
        failed++;
      }
    }

    // Calculate statistics
    const byCategory: Record<KnowledgeCategory, number> = {
      [KnowledgeCategory.FACT]: 0,
      [KnowledgeCategory.PREFERENCE]: 0,
      [KnowledgeCategory.CONTEXT]: 0,
      [KnowledgeCategory.RELATIONSHIP]: 0,
    };

    const confidenceDistribution: Record<CategorizationConfidence, number> = {
      [CategorizationConfidence.VERY_LOW]: 0,
      [CategorizationConfidence.LOW]: 0,
      [CategorizationConfidence.MEDIUM]: 0,
      [CategorizationConfidence.HIGH]: 0,
      [CategorizationConfidence.VERY_HIGH]: 0,
    };

    let totalConfidence = 0;

    results.forEach(({ result }) => {
      if (result) {
        byCategory[result.category]++;
        confidenceDistribution[result.confidenceLevel]++;
        totalConfidence += result.confidence;
      }
    });

    return {
      total: inputs.length,
      categorized,
      failed,
      results,
      processingTime: Date.now() - startTime,
      statistics: {
        byCategory,
        avgConfidence: categorized > 0 ? totalConfidence / categorized : 0,
        confidenceDistribution,
      },
    };
  }

  /**
   * Add a custom categorization rule
   *
   * @param rule - The rule to add
   * @returns The added rule
   */
  addRule(rule: CategorizationRule): CategorizationRule {
    this.defaultRules.push(rule);
    this.logger.log(`Added categorization rule: ${rule.name}`);
    return rule;
  }

  /**
   * Get all active rules
   *
   * @returns Array of active rules
   */
  getRules(): CategorizationRule[] {
    return this.defaultRules.filter((rule) => rule.enabled);
  }

  /**
   * Get rule set
   *
   * @returns Current rule set
   */
  getRuleSet(): CategorizationRuleSet {
    return {
      version: '1.0.0',
      description: 'Default knowledge categorization rules',
      rules: this.defaultRules,
      metadata: {
        createdAt: new Date(),
      },
    };
  }

  /**
   * Update a rule by ID
   *
   * @param id - Rule ID
   * @param updates - Partial rule updates
   * @returns Updated rule or undefined if not found
   */
  updateRule(
    id: string,
    updates: Partial<CategorizationRule>,
  ): CategorizationRule | undefined {
    const ruleIndex = this.defaultRules.findIndex((rule) => rule.id === id);
    if (ruleIndex === -1) {
      return undefined;
    }

    this.defaultRules[ruleIndex] = {
      ...this.defaultRules[ruleIndex],
      ...updates,
    };

    this.logger.log(`Updated categorization rule: ${id}`);
    return this.defaultRules[ruleIndex];
  }

  /**
   * Remove a rule by ID
   *
   * @param id - Rule ID
   * @returns True if removed, false if not found
   */
  removeRule(id: string): boolean {
    const initialLength = this.defaultRules.length;
    this.defaultRules = this.defaultRules.filter((rule) => rule.id !== id);

    if (this.defaultRules.length < initialLength) {
      this.logger.log(`Removed categorization rule: ${id}`);
      return true;
    }

    return false;
  }

  /**
   * Initialize default categorization rules
   *
   * @private
   * @returns Array of default rules
   */
  private initializeDefaultRules(): CategorizationRule[] {
    return [
      // FACT rules
      {
        id: 'fact-001',
        name: 'Factual statements with "is", "are", "was", "were"',
        category: KnowledgeCategory.FACT,
        patterns: {
          content: [
            '\\b(is|are|was|were)\\b',
            '\\b(uses|using|based on|built with)\\b',
            '\\b(version|release|date)\\b',
          ],
        },
        weight: 1.0,
        confidenceMultiplier: 0.7,
        enabled: true,
      },
      {
        id: 'fact-002',
        name: 'Technical specifications and configurations',
        category: KnowledgeCategory.FACT,
        patterns: {
          content: [
            '\\b(database|server|api|endpoint|port|host)\\b',
            '\\b(typescript|javascript|python|java|node)\\b',
            '\\b(config|configuration|setting)\\b',
          ],
        },
        weight: 1.2,
        confidenceMultiplier: 0.8,
        enabled: true,
      },
      {
        id: 'fact-003',
        name: 'Numerical data and metrics',
        category: KnowledgeCategory.FACT,
        patterns: {
          content: ['\\d+\\s*(ms|seconds|minutes|hours|days|MB|GB|%)'],
        },
        weight: 1.5,
        confidenceMultiplier: 0.9,
        enabled: true,
      },

      // PREFERENCE rules
      {
        id: 'pref-001',
        name: 'Opinion indicators',
        category: KnowledgeCategory.PREFERENCE,
        patterns: {
          content: [
            '\\b(prefer|prefers|preferred|like|likes|love|loves)\\b',
            '\\b(should|ought to|better to|best to)\\b',
            '\\b(recommend|suggest|advise)\\b',
          ],
        },
        weight: 1.5,
        confidenceMultiplier: 0.85,
        enabled: true,
      },
      {
        id: 'pref-002',
        name: 'Comparative statements',
        category: KnowledgeCategory.PREFERENCE,
        patterns: {
          content: [
            '\\b(better than|worse than|superior to|inferior to)\\b',
            '\\b(rather than|instead of|over)\\b',
          ],
        },
        weight: 1.3,
        confidenceMultiplier: 0.75,
        enabled: true,
      },
      {
        id: 'pref-003',
        name: 'Team conventions and standards',
        category: KnowledgeCategory.PREFERENCE,
        patterns: {
          content: [
            '\\b(convention|standard|guideline|style)\\b',
            '\\b(we use|we follow|we adopt|our approach)\\b',
          ],
        },
        weight: 1.2,
        confidenceMultiplier: 0.8,
        enabled: true,
      },

      // CONTEXT rules
      {
        id: 'ctx-001',
        name: 'Background and history',
        category: KnowledgeCategory.CONTEXT,
        patterns: {
          content: [
            '\\b(background|history|originally|initially)\\b',
            '\\b(context|situation|circumstance)\\b',
            '\\b(because|since|due to|reason)\\b',
          ],
        },
        weight: 1.3,
        confidenceMultiplier: 0.75,
        enabled: true,
      },
      {
        id: 'ctx-002',
        name: 'Environmental and situational factors',
        category: KnowledgeCategory.CONTEXT,
        patterns: {
          content: [
            '\\b(environment|platform|deployment|infrastructure)\\b',
            '\\b(timezone|location|region)\\b',
            '\\b(for|intended for|designed for|targeting)\\b',
          ],
        },
        weight: 1.1,
        confidenceMultiplier: 0.7,
        enabled: true,
      },
      {
        id: 'ctx-003',
        name: 'Purpose and motivation',
        category: KnowledgeCategory.CONTEXT,
        patterns: {
          content: [
            '\\b(purpose|goal|objective|aim)\\b',
            '\\b(why|reason|motivation)\\b',
            '\\b(in order to|so that|to enable)\\b',
          ],
        },
        weight: 1.2,
        confidenceMultiplier: 0.75,
        enabled: true,
      },

      // RELATIONSHIP rules
      {
        id: 'rel-001',
        name: 'Direct relationships',
        category: KnowledgeCategory.RELATIONSHIP,
        patterns: {
          content: [
            '\\b(depends on|requires|needs)\\b',
            '\\b(belongs to|part of|member of)\\b',
            '\\b(connects to|linked to|associated with)\\b',
          ],
        },
        weight: 1.6,
        confidenceMultiplier: 0.9,
        enabled: true,
      },
      {
        id: 'rel-002',
        name: 'Hierarchical relationships',
        category: KnowledgeCategory.RELATIONSHIP,
        patterns: {
          content: [
            '\\b(parent|child|ancestor|descendant)\\b',
            '\\b(owns|owned by|contains|contained by)\\b',
            '\\b(manages|managed by|reports to)\\b',
          ],
        },
        weight: 1.5,
        confidenceMultiplier: 0.85,
        enabled: true,
      },
      {
        id: 'rel-003',
        name: 'Entity relationships in metadata',
        category: KnowledgeCategory.RELATIONSHIP,
        patterns: {
          entityTypes: ['relationship', 'dependency', 'association'],
        },
        weight: 1.8,
        confidenceMultiplier: 0.95,
        enabled: true,
      },
    ];
  }

  /**
   * Get applicable rules based on options
   *
   * @private
   * @param options - Categorization options
   * @returns Array of applicable rules
   */
  private getApplicableRules(
    options: Required<CategorizationOptions>,
  ): CategorizationRule[] {
    const rules: CategorizationRule[] = [];

    if (options.useDefaultRules) {
      rules.push(...this.defaultRules.filter((rule) => rule.enabled));
    }

    if (options.customRules.length > 0) {
      rules.push(...options.customRules.filter((rule) => rule.enabled));
    }

    return rules;
  }

  /**
   * Score categories based on rule matching
   *
   * @private
   * @param input - Input to categorize
   * @param rules - Rules to apply
   * @returns Category scores with matched rules
   */
  private scoreCategoriesWithRules(
    input: CategorizationInput,
    rules: CategorizationRule[],
  ): Record<
    KnowledgeCategory,
    { score: number; matchedRules: string[] }
  > {
    const scores: Record<
      KnowledgeCategory,
      { score: number; matchedRules: string[] }
    > = {
      [KnowledgeCategory.FACT]: { score: 0, matchedRules: [] },
      [KnowledgeCategory.PREFERENCE]: { score: 0, matchedRules: [] },
      [KnowledgeCategory.CONTEXT]: { score: 0, matchedRules: [] },
      [KnowledgeCategory.RELATIONSHIP]: { score: 0, matchedRules: [] },
    };

    // Apply each rule
    for (const rule of rules) {
      const matchScore = this.evaluateRule(rule, input);
      if (matchScore > 0) {
        scores[rule.category].score +=
          matchScore * rule.weight * rule.confidenceMultiplier;
        scores[rule.category].matchedRules.push(rule.id);
      }
    }

    return scores;
  }

  /**
   * Evaluate a single rule against input
   *
   * @private
   * @param rule - Rule to evaluate
   * @param input - Input to evaluate against
   * @returns Match score (0-1)
   */
  private evaluateRule(
    rule: CategorizationRule,
    input: CategorizationInput,
  ): number {
    let matchScore = 0;
    let matchCount = 0;
    let totalChecks = 0;

    // Check content patterns
    if (rule.patterns.content && rule.patterns.content.length > 0) {
      const content = input.content.toLowerCase();
      for (const pattern of rule.patterns.content) {
        totalChecks++;
        const regex = new RegExp(pattern, 'gi');
        const matches = content.match(regex);
        if (matches) {
          matchCount += matches.length;
        }
      }
    }

    // Check entity type patterns
    if (
      rule.patterns.entityTypes &&
      rule.patterns.entityTypes.length > 0 &&
      input.entities
    ) {
      const entityTypes = input.entities.map((e) => e.type.toLowerCase());
      for (const pattern of rule.patterns.entityTypes) {
        totalChecks++;
        if (entityTypes.includes(pattern.toLowerCase())) {
          matchCount++;
        }
      }
    }

    // Check metadata patterns
    if (
      rule.patterns.metadata &&
      Object.keys(rule.patterns.metadata).length > 0 &&
      input.metadata
    ) {
      for (const [key, value] of Object.entries(rule.patterns.metadata)) {
        totalChecks++;
        if (input.metadata[key] === value) {
          matchCount++;
        }
      }
    }

    // Calculate score
    if (totalChecks > 0) {
      matchScore = matchCount / totalChecks;
    }

    return matchScore;
  }

  /**
   * Convert confidence score to level enum
   *
   * @private
   * @param confidence - Confidence score (0-1)
   * @returns Confidence level enum
   */
  private getConfidenceLevel(confidence: number): CategorizationConfidence {
    if (confidence >= 0.8) return CategorizationConfidence.VERY_HIGH;
    if (confidence >= 0.6) return CategorizationConfidence.HIGH;
    if (confidence >= 0.4) return CategorizationConfidence.MEDIUM;
    if (confidence >= 0.2) return CategorizationConfidence.LOW;
    return CategorizationConfidence.VERY_LOW;
  }
}
