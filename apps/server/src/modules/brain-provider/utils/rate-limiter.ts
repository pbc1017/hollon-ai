import { Logger } from '@nestjs/common';

export interface RateLimiterConfig {
  maxRequestsPerMinute: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface RequestRecord {
  timestamp: number;
  count: number;
}

/**
 * Rate limiter for API calls with sliding window algorithm
 * Prevents exceeding API rate limits and implements exponential backoff
 */
export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);
  private requests: RequestRecord[] = [];
  private readonly maxRequestsPerMinute: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(config: RateLimiterConfig) {
    this.maxRequestsPerMinute = config.maxRequestsPerMinute;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
  }

  /**
   * Wait if necessary to respect rate limits before making a request
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove requests older than 1 minute
    this.requests = this.requests.filter((r) => r.timestamp > oneMinuteAgo);

    // Count recent requests
    const recentRequestCount = this.requests.reduce(
      (sum, r) => sum + r.count,
      0,
    );

    if (recentRequestCount >= this.maxRequestsPerMinute) {
      // Calculate wait time until the oldest request expires
      const oldestRequest = this.requests[0];
      const waitMs = oldestRequest.timestamp + 60000 - now;

      if (waitMs > 0) {
        this.logger.warn(
          `Rate limit reached (${recentRequestCount}/${this.maxRequestsPerMinute}), waiting ${waitMs}ms`,
        );
        await this.sleep(waitMs);
        // Recursive call to check again after waiting
        return this.waitForSlot();
      }
    }

    // Record this request
    this.requests.push({ timestamp: now, count: 1 });
  }

  /**
   * Execute a function with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context?: string,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.waitForSlot();
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const isRateLimitError = this.isRateLimitError(error);
        const isTimeout = this.isTimeoutError(error);

        if (attempt < this.maxRetries && (isRateLimitError || isTimeout)) {
          const delayMs = this.calculateBackoffDelay(attempt);
          this.logger.warn(
            `${context ? `[${context}] ` : ''}Attempt ${attempt + 1}/${this.maxRetries + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying in ${delayMs}ms...`,
          );
          await this.sleep(delayMs);
        } else if (attempt === this.maxRetries) {
          this.logger.error(
            `${context ? `[${context}] ` : ''}Max retries (${this.maxRetries}) reached`,
          );
          break;
        } else {
          // Non-retryable error
          throw error;
        }
      }
    }

    throw lastError || new Error('Unknown error in executeWithRetry');
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    return this.retryDelayMs * Math.pow(2, attempt);
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('too many requests')
      );
    }
    return false;
  }

  /**
   * Check if error is a timeout error
   */
  private isTimeoutError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('timed out') ||
        message.includes('econnaborted')
      );
    }
    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    requestsInLastMinute: number;
    remainingSlots: number;
    isLimited: boolean;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requests = this.requests.filter((r) => r.timestamp > oneMinuteAgo);

    const requestsInLastMinute = this.requests.reduce(
      (sum, r) => sum + r.count,
      0,
    );
    const remainingSlots = Math.max(
      0,
      this.maxRequestsPerMinute - requestsInLastMinute,
    );
    const isLimited = requestsInLastMinute >= this.maxRequestsPerMinute;

    return { requestsInLastMinute, remainingSlots, isLimited };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
  }
}
