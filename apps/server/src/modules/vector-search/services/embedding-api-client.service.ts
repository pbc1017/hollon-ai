import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Rate limiter implementation using token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async acquire(tokens = 1): Promise<void> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return;
    }

    // Wait until enough tokens are available
    const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    this.tokens = 0;
  }
}

/**
 * Interface for embedding API request
 */
interface EmbeddingRequest {
  input: string | string[];
  model: string;
  dimensions?: number;
}

/**
 * Interface for embedding API response
 */
interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Interface for retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * EmbeddingApiClientService
 *
 * Robust API client for embedding model providers (OpenAI, Cohere, local models).
 * Implements retry logic with exponential backoff and rate limiting.
 *
 * Key features:
 * - Multiple provider support (OpenAI, Cohere, custom endpoints)
 * - Exponential backoff retry logic for transient failures
 * - Token bucket rate limiting to prevent API throttling
 * - Proper error handling and timeout management
 * - Request/response logging for debugging
 */
@Injectable()
export class EmbeddingApiClientService {
  private readonly logger = new Logger(EmbeddingApiClientService.name);
  private readonly rateLimiters: Map<string, RateLimiter> = new Map();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generate embeddings for text using the configured provider
   *
   * @param text - Single text string to embed
   * @param provider - Provider name (openai, cohere, local)
   * @param model - Model identifier
   * @param apiKey - API key for authentication
   * @param dimensions - Optional dimension override
   * @param timeoutMs - Request timeout in milliseconds
   * @returns Embedding vector as array of numbers
   */
  async generateEmbedding(
    text: string,
    provider: string,
    model: string,
    apiKey: string,
    dimensions?: number,
    timeoutMs = 30000,
  ): Promise<number[]> {
    const result = await this.generateEmbeddings(
      [text],
      provider,
      model,
      apiKey,
      dimensions,
      timeoutMs,
    );
    return result[0];
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   *
   * @param texts - Array of text strings to embed
   * @param provider - Provider name (openai, cohere, local)
   * @param model - Model identifier
   * @param apiKey - API key for authentication
   * @param dimensions - Optional dimension override
   * @param timeoutMs - Request timeout in milliseconds
   * @returns Array of embedding vectors
   */
  async generateEmbeddings(
    texts: string[],
    provider: string,
    model: string,
    apiKey: string,
    dimensions?: number,
    timeoutMs = 30000,
  ): Promise<number[][]> {
    this.logger.debug(
      `Generating embeddings for ${texts.length} text(s) using ${provider}/${model}`,
    );

    // Get or create rate limiter for this provider
    const rateLimiter = this.getRateLimiter(provider);

    // Acquire rate limit token
    await rateLimiter.acquire(texts.length);

    // Build request based on provider
    const { url, body, headers } = this.buildRequest(
      texts,
      provider,
      model,
      apiKey,
      dimensions,
    );

    // Execute request with retry logic
    const retryConfig = this.getRetryConfig();
    const response = await this.executeWithRetry(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
      retryConfig,
      timeoutMs,
    );

    // Parse and return embeddings
    return this.parseEmbeddingResponse(response, provider);
  }

  /**
   * Build API request based on provider
   *
   * @private
   */
  private buildRequest(
    texts: string[],
    provider: string,
    model: string,
    apiKey: string,
    dimensions?: number,
  ): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  } {
    switch (provider.toLowerCase()) {
      case 'openai':
        return this.buildOpenAIRequest(texts, model, apiKey, dimensions);
      case 'cohere':
        return this.buildCohereRequest(texts, model, apiKey);
      case 'local':
        return this.buildLocalRequest(texts, model);
      default:
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }
  }

  /**
   * Build OpenAI API request
   *
   * @private
   */
  private buildOpenAIRequest(
    texts: string[],
    model: string,
    apiKey: string,
    dimensions?: number,
  ): {
    url: string;
    headers: Record<string, string>;
    body: EmbeddingRequest;
  } {
    const body: EmbeddingRequest = {
      input: texts.length === 1 ? texts[0] : texts,
      model,
    };

    // Add dimensions for models that support it (text-embedding-3-small, text-embedding-3-large)
    if (dimensions && model.includes('text-embedding-3')) {
      body.dimensions = dimensions;
    }

    return {
      url: 'https://api.openai.com/v1/embeddings',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    };
  }

  /**
   * Build Cohere API request
   *
   * @private
   */
  private buildCohereRequest(
    texts: string[],
    model: string,
    apiKey: string,
  ): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  } {
    return {
      url: 'https://api.cohere.ai/v1/embed',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: {
        texts,
        model,
        input_type: 'search_document', // For semantic search use case
        truncate: 'END',
      },
    };
  }

  /**
   * Build request for local embedding model
   *
   * @private
   */
  private buildLocalRequest(
    texts: string[],
    model: string,
  ): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  } {
    // Get local endpoint from config or use default
    const localEndpoint =
      this.configService.get<string>('vectorSearch.embedding.localEndpoint') ||
      'http://localhost:8000/embeddings';

    return {
      url: localEndpoint,
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        texts,
        model,
      },
    };
  }

  /**
   * Execute HTTP request with retry logic and exponential backoff
   *
   * @private
   */
  private async executeWithRetry(
    url: string,
    options: RequestInit,
    retryConfig: RetryConfig,
    timeoutMs: number,
  ): Promise<EmbeddingResponse> {
    let lastError: Error | null = null;
    let delay = retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Execute request
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle HTTP errors
        if (!response.ok) {
          const errorBody = await response.text();
          const error = new Error(
            `HTTP ${response.status}: ${errorBody.substring(0, 200)}`,
          );

          // Check if error is retryable
          if (this.isRetryableError(response.status)) {
            lastError = error;
            this.logger.warn(
              `Attempt ${attempt + 1}/${retryConfig.maxRetries + 1} failed (retryable): ${error.message}`,
            );

            if (attempt < retryConfig.maxRetries) {
              await this.sleep(delay);
              delay = Math.min(
                delay * retryConfig.backoffMultiplier,
                retryConfig.maxDelayMs,
              );
              continue;
            }
          } else {
            // Non-retryable error, throw immediately
            throw error;
          }
        }

        // Success - parse and return response
        const data = await response.json();
        return data as EmbeddingResponse;
      } catch (error) {
        lastError = error as Error;

        // Handle timeout and network errors
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            this.logger.warn(
              `Attempt ${attempt + 1}/${retryConfig.maxRetries + 1} timed out after ${timeoutMs}ms`,
            );
          } else {
            this.logger.warn(
              `Attempt ${attempt + 1}/${retryConfig.maxRetries + 1} failed: ${error.message}`,
            );
          }
        }

        // Retry if we have attempts left
        if (attempt < retryConfig.maxRetries) {
          await this.sleep(delay);
          delay = Math.min(
            delay * retryConfig.backoffMultiplier,
            retryConfig.maxDelayMs,
          );
        }
      }
    }

    // All retries exhausted
    throw new Error(
      `Embedding API request failed after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Check if HTTP status code indicates a retryable error
   *
   * @private
   */
  private isRetryableError(statusCode: number): boolean {
    // Retry on:
    // - 429 Too Many Requests (rate limit)
    // - 500 Internal Server Error
    // - 502 Bad Gateway
    // - 503 Service Unavailable
    // - 504 Gateway Timeout
    return [429, 500, 502, 503, 504].includes(statusCode);
  }

  /**
   * Parse embedding response based on provider format
   *
   * @private
   */
  private parseEmbeddingResponse(
    response: EmbeddingResponse | any,
    provider: string,
  ): number[][] {
    switch (provider.toLowerCase()) {
      case 'openai':
        return this.parseOpenAIResponse(response);
      case 'cohere':
        return this.parseCohereResponse(response);
      case 'local':
        return this.parseLocalResponse(response);
      default:
        throw new Error(`Unsupported embedding provider: ${provider}`);
    }
  }

  /**
   * Parse OpenAI embedding response
   *
   * @private
   */
  private parseOpenAIResponse(response: EmbeddingResponse): number[][] {
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid OpenAI embedding response format');
    }

    // Sort by index to ensure correct order
    const sorted = response.data.sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  }

  /**
   * Parse Cohere embedding response
   *
   * @private
   */
  private parseCohereResponse(response: {
    embeddings: number[][];
  }): number[][] {
    if (!response.embeddings || !Array.isArray(response.embeddings)) {
      throw new Error('Invalid Cohere embedding response format');
    }

    return response.embeddings;
  }

  /**
   * Parse local model embedding response
   *
   * @private
   */
  private parseLocalResponse(response: { embeddings: number[][] }): number[][] {
    if (!response.embeddings || !Array.isArray(response.embeddings)) {
      throw new Error('Invalid local embedding response format');
    }

    return response.embeddings;
  }

  /**
   * Get or create rate limiter for provider
   *
   * @private
   */
  private getRateLimiter(provider: string): RateLimiter {
    const key = provider.toLowerCase();

    if (!this.rateLimiters.has(key)) {
      // Get rate limit configuration from config or use defaults
      const maxTokens = this.getRateLimitMaxTokens(provider);
      const refillRate = this.getRateLimitRefillRate(provider);

      this.rateLimiters.set(key, new RateLimiter(maxTokens, refillRate));
      this.logger.debug(
        `Created rate limiter for ${provider}: ${maxTokens} tokens, ${refillRate} tokens/sec`,
      );
    }

    return this.rateLimiters.get(key)!;
  }

  /**
   * Get max tokens for rate limiter based on provider
   *
   * @private
   */
  private getRateLimitMaxTokens(provider: string): number {
    const configKey = `vectorSearch.rateLimit.${provider}.maxTokens`;
    const defaultTokens = provider === 'openai' ? 3000 : 1000;
    return this.configService.get<number>(configKey, defaultTokens);
  }

  /**
   * Get refill rate for rate limiter based on provider
   *
   * @private
   */
  private getRateLimitRefillRate(provider: string): number {
    const configKey = `vectorSearch.rateLimit.${provider}.tokensPerSecond`;
    const defaultRate = provider === 'openai' ? 3000 : 100;
    return this.configService.get<number>(configKey, defaultRate);
  }

  /**
   * Get retry configuration from config service
   *
   * @private
   */
  private getRetryConfig(): RetryConfig {
    return {
      maxRetries: this.configService.get<number>(
        'vectorSearch.embedding.maxRetries',
        3,
      ),
      initialDelayMs: this.configService.get<number>(
        'vectorSearch.embedding.initialRetryDelayMs',
        1000,
      ),
      maxDelayMs: this.configService.get<number>(
        'vectorSearch.embedding.maxRetryDelayMs',
        10000,
      ),
      backoffMultiplier: this.configService.get<number>(
        'vectorSearch.embedding.retryBackoffMultiplier',
        2,
      ),
    };
  }

  /**
   * Sleep helper for retry delays
   *
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
