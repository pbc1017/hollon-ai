import { Injectable, Logger } from '@nestjs/common';
import { Task } from '../../task/entities/task.entity';

/**
 * Represents a structured knowledge entry extracted from task completion data
 */
export interface ExtractedKnowledge {
  title: string;
  content: string;
  tags: string[];
  skills: string[];
  metadata: {
    taskId?: string;
    taskType?: string;
    taskPriority?: string;
    complexity?: number;
    filesChanged?: string[];
    pullRequestUrl?: string;
    testsPassed?: boolean;
    [key: string]: unknown;
  };
  createdAt: Date;
}

/**
 * Input data for knowledge extraction
 */
export interface TaskCompletionData {
  task: Task;
  outcome?: {
    output?: string;
    pullRequestUrl?: string;
    filesChanged?: string[];
    testsPassed?: boolean;
    reviewComments?: string[];
    [key: string]: unknown;
  };
  metadata?: {
    [key: string]: unknown;
  };
}

/**
 * Service for extracting structured knowledge from task completion data
 *
 * Parses task descriptions, outcomes, code changes, and metadata to generate
 * structured knowledge entries that can be stored and reused.
 */
@Injectable()
export class KnowledgeExtractionService {
  private readonly logger = new Logger(KnowledgeExtractionService.name);

  /**
   * Extract knowledge from task completion data
   *
   * @param data Task completion data including task entity, outcome, and metadata
   * @returns Structured knowledge entry
   */
  extractKnowledge(data: TaskCompletionData): ExtractedKnowledge {
    this.logger.debug(`Extracting knowledge from task: ${data.task.id}`);

    const title = this.generateTitle(data);
    const content = this.generateContent(data);
    const tags = this.extractTags(data);
    const skills = this.extractSkills(data);
    const metadata = this.buildMetadata(data);

    const knowledge: ExtractedKnowledge = {
      title,
      content,
      tags,
      skills,
      metadata,
      createdAt: new Date(),
    };

    this.logger.log(
      `✅ Knowledge extracted: "${title}" with ${tags.length} tags and ${skills.length} skills`,
    );

    return knowledge;
  }

  /**
   * Extract knowledge from multiple task completion records
   *
   * @param dataList Array of task completion data
   * @returns Array of structured knowledge entries
   */
  extractBulkKnowledge(dataList: TaskCompletionData[]): ExtractedKnowledge[] {
    this.logger.debug(`Extracting knowledge from ${dataList.length} tasks`);
    return dataList.map((data) => this.extractKnowledge(data));
  }

  /**
   * Validate if task data contains sufficient information for knowledge extraction
   *
   * @param data Task completion data
   * @returns True if data is valid for extraction
   */
  canExtractKnowledge(data: TaskCompletionData): boolean {
    if (!data.task) {
      return false;
    }

    // Need at least title and some content (description, outcome, or metadata)
    const hasTitle = !!data.task.title;
    const hasContent = !!(
      data.task.description ||
      data.outcome?.output ||
      data.outcome?.pullRequestUrl ||
      data.metadata
    );

    return hasTitle && hasContent;
  }

  /**
   * Generate a concise title for the knowledge entry
   */
  private generateTitle(data: TaskCompletionData): string {
    const task = data.task;

    // Use task title as base, possibly with type prefix
    const typePrefix = task.type ? `[${task.type}]` : '';
    const title = `${typePrefix} ${task.title}`.trim();

    // Limit title length
    const maxLength = 100;
    return title.length > maxLength
      ? title.substring(0, maxLength - 3) + '...'
      : title;
  }

  /**
   * Generate detailed content combining task info and completion data
   */
  private generateContent(data: TaskCompletionData): string {
    const sections: string[] = [];
    const task = data.task;

    // Task description
    if (task.description) {
      sections.push('## Task Description');
      sections.push(task.description);
      sections.push('');
    }

    // Acceptance criteria
    if (task.acceptanceCriteria) {
      sections.push('## Acceptance Criteria');
      sections.push(task.acceptanceCriteria);
      sections.push('');
    }

    // Completion outcome
    if (data.outcome) {
      sections.push('## Completion Outcome');

      if (data.outcome.output) {
        sections.push('### Output');
        sections.push(data.outcome.output);
        sections.push('');
      }

      if (data.outcome.filesChanged && data.outcome.filesChanged.length > 0) {
        sections.push('### Files Changed');
        sections.push(
          data.outcome.filesChanged.map((f) => `- ${f}`).join('\n'),
        );
        sections.push('');
      }

      if (data.outcome.pullRequestUrl) {
        sections.push('### Pull Request');
        sections.push(data.outcome.pullRequestUrl);
        sections.push('');
      }

      if (
        data.outcome.reviewComments &&
        data.outcome.reviewComments.length > 0
      ) {
        sections.push('### Review Comments');
        sections.push(
          data.outcome.reviewComments.map((c) => `- ${c}`).join('\n'),
        );
        sections.push('');
      }

      if (data.outcome.testsPassed !== undefined) {
        sections.push(
          `### Tests: ${data.outcome.testsPassed ? '✅ Passed' : '❌ Failed'}`,
        );
        sections.push('');
      }
    }

    // Additional metadata
    if (data.metadata && Object.keys(data.metadata).length > 0) {
      sections.push('## Additional Information');
      sections.push('```json');
      sections.push(JSON.stringify(data.metadata, null, 2));
      sections.push('```');
      sections.push('');
    }

    return sections.join('\n').trim();
  }

  /**
   * Extract tags from task and outcome data
   */
  private extractTags(data: TaskCompletionData): string[] {
    const tags = new Set<string>();
    const task = data.task;

    // Task tags
    if (task.tags) {
      task.tags.forEach((tag) => tags.add(tag.toLowerCase()));
    }

    // Task type as tag
    if (task.type) {
      tags.add(task.type.toLowerCase());
    }

    // Task priority as tag
    if (task.priority) {
      tags.add(`priority-${task.priority.toLowerCase()}`);
    }

    // Task status as tag
    if (task.status) {
      tags.add(`status-${task.status.toLowerCase()}`);
    }

    // Test outcome as tag
    if (data.outcome?.testsPassed === true) {
      tags.add('tests-passed');
    } else if (data.outcome?.testsPassed === false) {
      tags.add('tests-failed');
    }

    // File type tags from changed files
    if (data.outcome?.filesChanged) {
      data.outcome.filesChanged.forEach((file) => {
        const ext = this.getFileExtension(file);
        if (ext) {
          tags.add(`filetype-${ext}`);
        }
      });
    }

    return Array.from(tags);
  }

  /**
   * Extract required skills from task data
   */
  private extractSkills(data: TaskCompletionData): string[] {
    const skills = new Set<string>();
    const task = data.task;

    // Task required skills
    if (task.requiredSkills) {
      task.requiredSkills.forEach((skill) => skills.add(skill.toLowerCase()));
    }

    // Infer skills from file types
    if (data.outcome?.filesChanged) {
      data.outcome.filesChanged.forEach((file) => {
        const inferredSkills = this.inferSkillsFromFile(file);
        inferredSkills.forEach((skill) => skills.add(skill));
      });
    }

    return Array.from(skills);
  }

  /**
   * Build metadata object from task and outcome
   */
  private buildMetadata(
    data: TaskCompletionData,
  ): ExtractedKnowledge['metadata'] {
    const task = data.task;
    const metadata: ExtractedKnowledge['metadata'] = {
      taskId: task.id,
      taskType: task.type,
      taskPriority: task.priority,
    };

    if (task.estimatedComplexity !== undefined) {
      metadata.complexity = task.estimatedComplexity;
    }

    if (data.outcome) {
      if (data.outcome.filesChanged) {
        metadata.filesChanged = data.outcome.filesChanged;
      }
      if (data.outcome.pullRequestUrl) {
        metadata.pullRequestUrl = data.outcome.pullRequestUrl;
      }
      if (data.outcome.testsPassed !== undefined) {
        metadata.testsPassed = data.outcome.testsPassed;
      }

      // Include any additional outcome fields
      Object.keys(data.outcome).forEach((key) => {
        if (
          ![
            'output',
            'filesChanged',
            'pullRequestUrl',
            'testsPassed',
            'reviewComments',
          ].includes(key)
        ) {
          metadata[key] = data.outcome![key];
        }
      });
    }

    // Include custom metadata
    if (data.metadata) {
      Object.assign(metadata, data.metadata);
    }

    return metadata;
  }

  /**
   * Get file extension from file path
   */
  private getFileExtension(filePath: string): string | null {
    const match = filePath.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Infer programming skills from file path
   */
  private inferSkillsFromFile(filePath: string): string[] {
    const ext = this.getFileExtension(filePath);
    if (!ext) return [];

    const skillMap: Record<string, string[]> = {
      ts: ['typescript', 'javascript'],
      tsx: ['typescript', 'react', 'javascript'],
      js: ['javascript'],
      jsx: ['react', 'javascript'],
      py: ['python'],
      java: ['java'],
      go: ['golang'],
      rs: ['rust'],
      rb: ['ruby'],
      php: ['php'],
      swift: ['swift'],
      kt: ['kotlin'],
      cs: ['csharp'],
      cpp: ['cpp'],
      c: ['c'],
      html: ['html', 'frontend'],
      css: ['css', 'frontend'],
      scss: ['scss', 'css', 'frontend'],
      sql: ['sql', 'database'],
      graphql: ['graphql'],
      yaml: ['devops', 'configuration'],
      yml: ['devops', 'configuration'],
      json: ['configuration'],
      md: ['documentation'],
      dockerfile: ['docker', 'devops'],
    };

    return skillMap[ext] || [];
  }
}
