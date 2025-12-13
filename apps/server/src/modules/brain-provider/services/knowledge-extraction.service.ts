import { Injectable, Logger } from '@nestjs/common';
import { OpenAIProvider } from '../providers/openai.provider';
import { BrainRequest } from '../interfaces/brain-provider.interface';

export interface KnowledgeExtractionRequest {
  content: string;
  context?: {
    fileType?: string;
    fileName?: string;
    projectContext?: string;
  };
  extractionType: 'code' | 'documentation' | 'conversation' | 'task_result';
}

export interface ExtractedKnowledge {
  summary: string;
  keyPoints: string[];
  tags: string[];
  skills: string[];
  codePatterns?: {
    pattern: string;
    description: string;
    example?: string;
  }[];
  bestPractices?: string[];
  lessonsLearned?: string[];
  relatedConcepts?: string[];
}

/**
 * Knowledge Extraction Service using LLM
 * Extracts structured knowledge from various sources (code, docs, conversations, task results)
 */
@Injectable()
export class KnowledgeExtractionService {
  private readonly logger = new Logger(KnowledgeExtractionService.name);

  constructor(private readonly openaiProvider: OpenAIProvider) {}

  /**
   * Extract knowledge from content using LLM
   */
  async extractKnowledge(
    request: KnowledgeExtractionRequest,
  ): Promise<ExtractedKnowledge> {
    this.logger.log(
      `Extracting knowledge: type=${request.extractionType}, ` +
        `contentLength=${request.content.length}`,
    );

    const prompt = this.buildExtractionPrompt(request);
    const systemPrompt = this.buildSystemPrompt(request.extractionType);

    try {
      const brainRequest: BrainRequest = {
        prompt,
        systemPrompt,
        options: {
          timeoutMs: 60000, // 1 minute timeout
          maxTokens: 2000, // Limit response size
        },
      };

      const response = await this.openaiProvider.execute(brainRequest);

      // Parse the JSON response
      const extracted = this.parseExtractedKnowledge(response.output);

      this.logger.log(
        `Knowledge extracted: ${extracted.keyPoints.length} key points, ` +
          `${extracted.tags.length} tags, ${extracted.skills.length} skills`,
      );

      return extracted;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Knowledge extraction failed: ${errorMessage}`);
      throw new Error(`Failed to extract knowledge: ${errorMessage}`);
    }
  }

  /**
   * Extract knowledge from code files
   */
  async extractFromCode(
    code: string,
    fileName?: string,
    projectContext?: string,
  ): Promise<ExtractedKnowledge> {
    return this.extractKnowledge({
      content: code,
      context: {
        fileType: 'code',
        fileName,
        projectContext,
      },
      extractionType: 'code',
    });
  }

  /**
   * Extract knowledge from task completion results
   */
  async extractFromTaskResult(
    taskDescription: string,
    implementation: string,
    testResults?: string,
  ): Promise<ExtractedKnowledge> {
    const content = `
# Task Description
${taskDescription}

# Implementation
${implementation}

${testResults ? `# Test Results\n${testResults}` : ''}
    `.trim();

    return this.extractKnowledge({
      content,
      extractionType: 'task_result',
    });
  }

  /**
   * Build system prompt based on extraction type
   */
  private buildSystemPrompt(extractionType: string): string {
    const basePrompt = `You are an expert knowledge extraction assistant. Your task is to analyze content and extract structured, actionable knowledge.`;

    const typeSpecific: Record<string, string> = {
      code: `Focus on:
- Code patterns and architectural decisions
- Best practices demonstrated
- Technologies and frameworks used
- Common pitfalls avoided
- Reusable solutions`,

      documentation: `Focus on:
- Key concepts and definitions
- Important procedures and workflows
- Technical requirements
- Integration points
- Configuration details`,

      conversation: `Focus on:
- Decisions made and rationale
- Problems solved
- Lessons learned
- Action items and follow-ups`,

      task_result: `Focus on:
- Problem-solving approaches
- Technical solutions implemented
- Skills and technologies used
- Challenges encountered and overcome
- Reusable patterns and best practices`,
    };

    return `${basePrompt}\n\n${typeSpecific[extractionType] || typeSpecific.task_result}

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "summary": "Brief 1-2 sentence summary",
  "keyPoints": ["point 1", "point 2", ...],
  "tags": ["tag1", "tag2", ...],
  "skills": ["skill1", "skill2", ...],
  "codePatterns": [
    {
      "pattern": "Pattern name",
      "description": "What it does",
      "example": "Code example (optional)"
    }
  ],
  "bestPractices": ["practice 1", "practice 2", ...],
  "lessonsLearned": ["lesson 1", "lesson 2", ...],
  "relatedConcepts": ["concept1", "concept2", ...]
}

All fields should be populated even if some are empty arrays. Keep responses concise and actionable.`;
  }

  /**
   * Build extraction prompt
   */
  private buildExtractionPrompt(request: KnowledgeExtractionRequest): string {
    const sections: string[] = [];

    sections.push('# Content to Analyze\n');

    if (request.context?.fileName) {
      sections.push(`**File:** ${request.context.fileName}\n`);
    }

    if (request.context?.projectContext) {
      sections.push(`**Project Context:** ${request.context.projectContext}\n`);
    }

    sections.push('```');
    sections.push(request.content);
    sections.push('```\n');

    sections.push(
      'Extract and structure the knowledge from the above content. ' +
        'Provide a comprehensive analysis in valid JSON format.',
    );

    return sections.join('\n');
  }

  /**
   * Parse extracted knowledge from LLM response
   */
  private parseExtractedKnowledge(response: string): ExtractedKnowledge {
    try {
      // Try to extract JSON from response (handle markdown code blocks)
      let jsonStr = response.trim();

      // Remove markdown code block if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      const knowledge: ExtractedKnowledge = {
        summary: parsed.summary || 'No summary provided',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        codePatterns: Array.isArray(parsed.codePatterns)
          ? parsed.codePatterns
          : undefined,
        bestPractices: Array.isArray(parsed.bestPractices)
          ? parsed.bestPractices
          : undefined,
        lessonsLearned: Array.isArray(parsed.lessonsLearned)
          ? parsed.lessonsLearned
          : undefined,
        relatedConcepts: Array.isArray(parsed.relatedConcepts)
          ? parsed.relatedConcepts
          : undefined,
      };

      return knowledge;
    } catch (error) {
      this.logger.error(
        `Failed to parse knowledge extraction response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.logger.debug(`Response was: ${response}`);

      // Return a fallback structure
      return {
        summary: 'Failed to parse knowledge extraction',
        keyPoints: [],
        tags: [],
        skills: [],
      };
    }
  }

  /**
   * Batch extract knowledge from multiple items
   */
  async extractBatch(
    requests: KnowledgeExtractionRequest[],
  ): Promise<ExtractedKnowledge[]> {
    this.logger.log(`Batch extracting knowledge from ${requests.length} items`);

    const results = await Promise.all(
      requests.map((req) =>
        this.extractKnowledge(req).catch((error) => {
          this.logger.warn(
            `Failed to extract knowledge for item: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          return {
            summary: 'Extraction failed',
            keyPoints: [],
            tags: [],
            skills: [],
          };
        }),
      ),
    );

    return results;
  }
}
