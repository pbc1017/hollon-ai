import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../../task/entities/task.entity';
import { BrainProviderService } from '../../brain-provider/brain-provider.service';
import { SubtaskDefinition } from './subtask-creation.service';

export type ComplexityLevel = 'low' | 'medium' | 'high' | 'very_high';

export interface TaskComplexityAnalysis {
  complexity: ComplexityLevel;
  score: number; // 0-100
  factors: {
    descriptionLength: number;
    acceptanceCriteriaCount: number;
    affectedFilesCount: number;
    hasSubtasks: boolean;
    estimatedLinesOfCode?: number;
  };
  recommendation: 'can_execute' | 'should_split' | 'must_split';
  reasoning: string;
}

export interface SubtaskSuggestion {
  subtaskDefinitions: SubtaskDefinition[];
  strategy: 'sequential' | 'parallel' | 'mixed';
  reasoning: string;
  usedAI: boolean;
}

export interface TaskAnalysisOptions {
  useAI?: boolean; // Use LLM for deeper analysis
  organizationId?: string; // Required if useAI is true
  hollonId?: string;
}

@Injectable()
export class TaskAnalyzerService {
  private readonly logger = new Logger(TaskAnalyzerService.name);

  // Configuration
  private readonly COMPLEXITY_THRESHOLDS = {
    LOW_MAX: 25,
    MEDIUM_MAX: 50,
    HIGH_MAX: 75,
  };

  private readonly SPLIT_RECOMMENDATIONS = {
    SHOULD_SPLIT_SCORE: 60,
    MUST_SPLIT_SCORE: 80,
  };

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly brainProvider: BrainProviderService,
  ) {}

  /**
   * Analyze task complexity using heuristics
   * Returns complexity level and recommendation for splitting
   */
  async analyzeComplexity(
    taskId: string,
    options: TaskAnalysisOptions = {},
  ): Promise<TaskComplexityAnalysis> {
    this.logger.log(`Analyzing complexity for task ${taskId}`);

    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['subtasks'],
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Calculate heuristic score
    const heuristicAnalysis = this.calculateHeuristicComplexity(task);

    // If AI analysis is requested and available, enhance with LLM
    if (options.useAI && options.organizationId) {
      try {
        return await this.enhanceWithAIAnalysis(
          task,
          heuristicAnalysis,
          options.organizationId,
          options.hollonId,
        );
      } catch (error) {
        this.logger.warn(
          `AI analysis failed, falling back to heuristics: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return heuristicAnalysis;
  }

  /**
   * Calculate complexity using heuristic rules
   * Based on task properties without AI
   */
  private calculateHeuristicComplexity(task: Task): TaskComplexityAnalysis {
    let score = 0;
    const factors = {
      descriptionLength: task.description.length,
      acceptanceCriteriaCount: task.acceptanceCriteria?.length || 0,
      affectedFilesCount: task.affectedFiles?.length || 0,
      hasSubtasks: (task.subtasks?.length || 0) > 0,
    };

    // Factor 1: Description length (0-20 points)
    // Longer descriptions often indicate more complex tasks
    if (factors.descriptionLength < 100) {
      score += 5;
    } else if (factors.descriptionLength < 500) {
      score += 10;
    } else if (factors.descriptionLength < 1000) {
      score += 15;
    } else {
      score += 20;
    }

    // Factor 2: Acceptance criteria count (0-30 points)
    // More criteria = more complex requirements
    const criteriaCount = factors.acceptanceCriteriaCount;
    if (criteriaCount === 0) {
      score += 10; // Unclear requirements also add complexity
    } else if (criteriaCount <= 2) {
      score += 5;
    } else if (criteriaCount <= 5) {
      score += 15;
    } else if (criteriaCount <= 10) {
      score += 25;
    } else {
      score += 30;
    }

    // Factor 3: Affected files count (0-25 points)
    // More files = broader impact and coordination needs
    const filesCount = factors.affectedFilesCount;
    if (filesCount === 0) {
      score += 5; // Unknown scope
    } else if (filesCount <= 2) {
      score += 5;
    } else if (filesCount <= 5) {
      score += 12;
    } else if (filesCount <= 10) {
      score += 20;
    } else {
      score += 25;
    }

    // Factor 4: Already has subtasks (0-15 points)
    // If it already has subtasks, it was deemed complex before
    if (factors.hasSubtasks) {
      score += 15;
    }

    // Factor 5: Task type consideration (0-10 points)
    if (task.type === 'implementation') {
      score += 10; // Implementation often more complex than review/docs
    } else if (task.type === 'research') {
      score += 8;
    } else if (task.type === 'bug_fix') {
      score += 5;
    }

    // Determine complexity level
    let complexity: ComplexityLevel;
    if (score <= this.COMPLEXITY_THRESHOLDS.LOW_MAX) {
      complexity = 'low';
    } else if (score <= this.COMPLEXITY_THRESHOLDS.MEDIUM_MAX) {
      complexity = 'medium';
    } else if (score <= this.COMPLEXITY_THRESHOLDS.HIGH_MAX) {
      complexity = 'high';
    } else {
      complexity = 'very_high';
    }

    // Determine recommendation
    let recommendation: 'can_execute' | 'should_split' | 'must_split';
    let reasoning: string;

    if (score < this.SPLIT_RECOMMENDATIONS.SHOULD_SPLIT_SCORE) {
      recommendation = 'can_execute';
      reasoning = `Task complexity is ${complexity} (score: ${score}). Can be executed directly.`;
    } else if (score < this.SPLIT_RECOMMENDATIONS.MUST_SPLIT_SCORE) {
      recommendation = 'should_split';
      reasoning = `Task complexity is ${complexity} (score: ${score}). Splitting into subtasks recommended for better quality and parallel execution.`;
    } else {
      recommendation = 'must_split';
      reasoning = `Task complexity is ${complexity} (score: ${score}). Too complex for single execution - must be broken down into subtasks.`;
    }

    this.logger.log(
      `Heuristic analysis for task ${task.id}: ${complexity} (${score}) → ${recommendation}`,
    );

    return {
      complexity,
      score,
      factors,
      recommendation,
      reasoning,
    };
  }

  /**
   * Enhance heuristic analysis with AI-powered deep analysis
   */
  private async enhanceWithAIAnalysis(
    task: Task,
    heuristicAnalysis: TaskComplexityAnalysis,
    organizationId: string,
    hollonId?: string,
  ): Promise<TaskComplexityAnalysis> {
    this.logger.log(`Enhancing analysis with AI for task ${task.id}`);

    const prompt = `Analyze the complexity of this task and provide a detailed assessment:

Title: ${task.title}
Description: ${task.description}
Type: ${task.type}
Acceptance Criteria: ${task.acceptanceCriteria?.join('\n') || 'None specified'}
Affected Files: ${task.affectedFiles?.join(', ') || 'Not specified'}

Heuristic Analysis (baseline):
- Complexity: ${heuristicAnalysis.complexity}
- Score: ${heuristicAnalysis.score}/100
- Recommendation: ${heuristicAnalysis.recommendation}

Please analyze:
1. Is the heuristic complexity assessment accurate?
2. Are there hidden complexities not captured by heuristics?
3. What is your recommended complexity score (0-100)?
4. Should this task be split? (can_execute / should_split / must_split)
5. Brief reasoning for your assessment.

Respond in JSON format:
{
  "adjustedScore": <number 0-100>,
  "recommendation": "<can_execute|should_split|must_split>",
  "reasoning": "<brief explanation>",
  "estimatedLinesOfCode": <number|null>
}`;

    try {
      const response = await this.brainProvider.executeWithTracking(
        {
          prompt,
          systemPrompt: 'You are a technical task complexity analyzer. Provide accurate, actionable assessments.',
        },
        {
          organizationId,
          hollonId,
          taskId: task.id,
        },
      );

      const aiResult = JSON.parse(response.output);

      // Merge AI analysis with heuristic analysis
      const enhancedScore = Math.round(
        (heuristicAnalysis.score + aiResult.adjustedScore) / 2,
      );

      let enhancedComplexity: ComplexityLevel;
      if (enhancedScore <= this.COMPLEXITY_THRESHOLDS.LOW_MAX) {
        enhancedComplexity = 'low';
      } else if (enhancedScore <= this.COMPLEXITY_THRESHOLDS.MEDIUM_MAX) {
        enhancedComplexity = 'medium';
      } else if (enhancedScore <= this.COMPLEXITY_THRESHOLDS.HIGH_MAX) {
        enhancedComplexity = 'high';
      } else {
        enhancedComplexity = 'very_high';
      }

      this.logger.log(
        `AI-enhanced analysis: ${heuristicAnalysis.score} → ${enhancedScore} (${enhancedComplexity})`,
      );

      return {
        complexity: enhancedComplexity,
        score: enhancedScore,
        factors: {
          ...heuristicAnalysis.factors,
          estimatedLinesOfCode: aiResult.estimatedLinesOfCode,
        },
        recommendation: aiResult.recommendation,
        reasoning: `${aiResult.reasoning} (AI-enhanced from heuristic score ${heuristicAnalysis.score})`,
      };
    } catch (error) {
      this.logger.error(`AI enhancement failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Suggest subtask breakdown for a complex task
   * Can use AI for intelligent suggestions or provide basic splitting
   */
  async suggestSubtasks(
    taskId: string,
    options: TaskAnalysisOptions = {},
  ): Promise<SubtaskSuggestion> {
    this.logger.log(`Generating subtask suggestions for task ${taskId}`);

    const task = await this.taskRepo.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Check if AI should be used
    if (options.useAI && options.organizationId) {
      try {
        return await this.generateAISubtaskSuggestions(
          task,
          options.organizationId,
          options.hollonId,
        );
      } catch (error) {
        this.logger.warn(
          `AI subtask generation failed, using basic splitting: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Fallback to basic rule-based splitting
    return this.generateBasicSubtaskSuggestions(task);
  }

  /**
   * Generate AI-powered subtask suggestions
   */
  private async generateAISubtaskSuggestions(
    task: Task,
    organizationId: string,
    hollonId?: string,
  ): Promise<SubtaskSuggestion> {
    this.logger.log(`Using AI to generate subtask suggestions for ${task.id}`);

    const prompt = `Break down this task into logical subtasks:

Title: ${task.title}
Description: ${task.description}
Type: ${task.type}
Acceptance Criteria: ${task.acceptanceCriteria?.join('\n') || 'None specified'}
Affected Files: ${task.affectedFiles?.join(', ') || 'Not specified'}

Generate 2-6 subtasks that:
1. Are independently executable when possible
2. Have clear boundaries and deliverables
3. Follow logical dependencies (if any)
4. Together complete the parent task

Respond in JSON format:
{
  "subtasks": [
    {
      "title": "<subtask title>",
      "description": "<detailed description>",
      "type": "<implementation|review|research|bug_fix|documentation>",
      "acceptanceCriteria": ["<criterion 1>", "<criterion 2>"],
      "affectedFiles": ["<file1>", "<file2>"] or [],
      "priority": "<P1|P2|P3|P4>"
    }
  ],
  "strategy": "<sequential|parallel|mixed>",
  "reasoning": "<why this breakdown makes sense>"
}`;

    const response = await this.brainProvider.executeWithTracking(
      {
        prompt,
        systemPrompt: 'You are a task breakdown specialist. Create clear, actionable subtasks.',
      },
      {
        organizationId,
        hollonId,
        taskId: task.id,
      },
    );

    const aiResult = JSON.parse(response.output);

    const subtaskDefinitions: SubtaskDefinition[] = aiResult.subtasks.map(
      (st: any) => ({
        title: st.title,
        description: st.description,
        type: st.type,
        acceptanceCriteria: st.acceptanceCriteria,
        affectedFiles: st.affectedFiles,
        priority: st.priority,
      }),
    );

    this.logger.log(
      `AI generated ${subtaskDefinitions.length} subtask suggestions`,
    );

    return {
      subtaskDefinitions,
      strategy: aiResult.strategy,
      reasoning: aiResult.reasoning,
      usedAI: true,
    };
  }

  /**
   * Generate basic rule-based subtask suggestions
   * Fallback when AI is not available or fails
   */
  private generateBasicSubtaskSuggestions(task: Task): SubtaskSuggestion {
    this.logger.log(`Using basic rules to generate subtask suggestions for ${task.id}`);

    const subtaskDefinitions: SubtaskDefinition[] = [];

    // Strategy 1: If multiple acceptance criteria, split by criteria
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 1) {
      task.acceptanceCriteria.forEach((criterion, index) => {
        subtaskDefinitions.push({
          title: `${task.title} - Part ${index + 1}`,
          description: `Implement: ${criterion}`,
          type: task.type,
          acceptanceCriteria: [criterion],
          priority: task.priority,
        });
      });

      return {
        subtaskDefinitions,
        strategy: 'sequential',
        reasoning: 'Split by acceptance criteria - each subtask addresses one criterion',
        usedAI: false,
      };
    }

    // Strategy 2: If multiple files, group by file clusters
    if (task.affectedFiles && task.affectedFiles.length > 3) {
      const fileGroups = this.groupFilesByDirectory(task.affectedFiles);

      Object.entries(fileGroups).forEach(([directory, files]) => {
        subtaskDefinitions.push({
          title: `${task.title} - ${directory}`,
          description: `Handle changes in ${directory}: ${task.description}`,
          type: task.type,
          affectedFiles: files,
          priority: task.priority,
        });
      });

      return {
        subtaskDefinitions,
        strategy: 'parallel',
        reasoning: 'Split by file directories - subtasks can be executed in parallel',
        usedAI: false,
      };
    }

    // Strategy 3: Generic 3-phase split for complex tasks
    subtaskDefinitions.push(
      {
        title: `${task.title} - Phase 1: Setup & Research`,
        description: `Research and prepare for: ${task.description}`,
        type: 'research',
        priority: task.priority,
      },
      {
        title: `${task.title} - Phase 2: Implementation`,
        description: `Core implementation of: ${task.description}`,
        type: task.type,
        affectedFiles: task.affectedFiles,
        priority: task.priority,
      },
      {
        title: `${task.title} - Phase 3: Testing & Documentation`,
        description: `Test and document: ${task.description}`,
        type: 'documentation',
        priority: task.priority,
      },
    );

    return {
      subtaskDefinitions,
      strategy: 'sequential',
      reasoning: 'Generic 3-phase breakdown: research → implementation → testing',
      usedAI: false,
    };
  }

  /**
   * Group files by directory for parallel execution
   */
  private groupFilesByDirectory(files: string[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {};

    files.forEach((file) => {
      const parts = file.split('/');
      const directory = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';

      if (!groups[directory]) {
        groups[directory] = [];
      }
      groups[directory].push(file);
    });

    return groups;
  }

  /**
   * Check if a task should be analyzed before execution
   * Returns true if task is complex enough to warrant analysis
   */
  shouldAnalyzeBeforeExecution(task: Task): boolean {
    // Quick heuristic check without full analysis
    const descriptionLong = task.description.length > 500;
    const manyCriteria = (task.acceptanceCriteria?.length || 0) > 5;
    const manyFiles = (task.affectedFiles?.length || 0) > 5;
    const hasSubtasks = (task.subtasks?.length || 0) > 0;

    return descriptionLong || manyCriteria || manyFiles || hasSubtasks;
  }
}
