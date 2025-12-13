import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  IBrainProvider,
  BrainRequest,
  BrainResponse,
} from '../interfaces/brain-provider.interface';
import { RateLimiter } from '../utils/rate-limiter';
import { BrainExecutionError } from '../exceptions/brain-execution.error';

/**
 * OpenAI LLM Provider with rate limiting and timeout handling
 * Supports GPT-4 and GPT-3.5 models for knowledge extraction and general tasks
 */
@Injectable()
export class OpenAIProvider implements IBrainProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly client: OpenAI;
  private readonly rateLimiter: RateLimiter;
  private readonly defaultModel: string;
  private readonly defaultTimeout: number;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey,
      timeout: 120000, // 2 minutes default
      maxRetries: 0, // We handle retries ourselves with exponential backoff
    });

    // Initialize rate limiter (OpenAI: 3 requests/min for free tier, 60/min for paid)
    const maxRequestsPerMinute = this.configService.get<number>(
      'OPENAI_MAX_REQUESTS_PER_MINUTE',
      60,
    );
    this.rateLimiter = new RateLimiter({
      maxRequestsPerMinute,
      maxRetries: 3,
      retryDelayMs: 1000,
    });

    this.defaultModel =
      this.configService.get<string>('OPENAI_MODEL') || 'gpt-4-turbo-preview';
    this.defaultTimeout =
      this.configService.get<number>('OPENAI_TIMEOUT_MS') || 120000;

    this.logger.log(
      `OpenAI Provider initialized: model=${this.defaultModel}, rateLimit=${maxRequestsPerMinute}/min`,
    );
  }

  async execute(request: BrainRequest): Promise<BrainResponse> {
    const startTime = Date.now();
    const model = this.defaultModel;
    const timeoutMs = request.options?.timeoutMs || this.defaultTimeout;

    this.logger.log(
      `Executing OpenAI request: model=${model}, timeout=${timeoutMs}ms`,
    );

    try {
      // Execute with rate limiting and retry logic
      const result = await this.rateLimiter.executeWithRetry(async () => {
        return await this.executeWithTimeout(async () => {
          const messages: OpenAI.ChatCompletionMessageParam[] = [];

          // Add system prompt if provided
          if (request.systemPrompt) {
            messages.push({
              role: 'system',
              content: request.systemPrompt,
            });
          }

          // Add user prompt
          messages.push({
            role: 'user',
            content: request.prompt,
          });

          // Make API call
          const completion = await this.client.chat.completions.create({
            model,
            messages,
            temperature: 0.7,
            max_tokens: request.options?.maxTokens,
          });

          return completion;
        }, timeoutMs);
      }, 'OpenAI API call');

      const duration = Date.now() - startTime;

      // Extract response
      const output = result.choices[0]?.message?.content || '';
      const inputTokens = result.usage?.prompt_tokens || 0;
      const outputTokens = result.usage?.completion_tokens || 0;

      // Calculate cost
      const cost = this.calculateCost(model, inputTokens, outputTokens);

      this.logger.log(
        `OpenAI execution completed: duration=${duration}ms, ` +
          `tokens=${inputTokens}+${outputTokens}, cost=$${cost.toFixed(4)}`,
      );

      return {
        success: true,
        output,
        duration,
        cost: {
          inputTokens,
          outputTokens,
          totalCostCents: cost,
        },
        metadata: {
          model: result.model,
          finishReason: result.choices[0]?.finish_reason,
          id: result.id,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `OpenAI execution failed: ${errorMessage}, duration=${duration}ms`,
      );

      // Wrap in BrainExecutionError for consistent error handling
      if (error instanceof BrainExecutionError) {
        throw error;
      }

      throw new BrainExecutionError(
        `OpenAI API call failed: ${errorMessage}`,
        errorMessage,
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check with minimal token usage
      const result = await this.rateLimiter.executeWithRetry(async () => {
        return await this.executeWithTimeout(
          async () => {
            return await this.client.chat.completions.create({
              model: this.defaultModel,
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 5,
            });
          },
          5000, // 5 second timeout for health check
        );
      }, 'OpenAI health check');

      return result.choices.length > 0;
    } catch (error) {
      this.logger.warn(
        `OpenAI health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Request timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }

  /**
   * Calculate cost based on model and token usage
   * Prices as of 2024 (in cents per 1K tokens)
   */
  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    let inputCostPer1k = 0;
    let outputCostPer1k = 0;

    if (model.startsWith('gpt-4-turbo') || model === 'gpt-4-1106-preview') {
      inputCostPer1k = 1.0; // $0.01 per 1K tokens
      outputCostPer1k = 3.0; // $0.03 per 1K tokens
    } else if (model.startsWith('gpt-4')) {
      inputCostPer1k = 3.0; // $0.03 per 1K tokens
      outputCostPer1k = 6.0; // $0.06 per 1K tokens
    } else if (model.startsWith('gpt-3.5-turbo')) {
      inputCostPer1k = 0.05; // $0.0005 per 1K tokens
      outputCostPer1k = 0.15; // $0.0015 per 1K tokens
    } else {
      // Default to gpt-4-turbo pricing
      inputCostPer1k = 1.0;
      outputCostPer1k = 3.0;
    }

    const inputCost = (inputTokens / 1000) * inputCostPer1k;
    const outputCost = (outputTokens / 1000) * outputCostPer1k;

    return inputCost + outputCost;
  }

  /**
   * Get rate limiter status
   */
  getRateLimitStatus() {
    return this.rateLimiter.getStatus();
  }
}
