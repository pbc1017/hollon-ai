import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      maxRequestsPerMinute: 5,
      maxRetries: 2,
      retryDelayMs: 100,
    });
  });

  afterEach(() => {
    rateLimiter.reset();
  });

  describe('waitForSlot', () => {
    it('should allow requests under the limit', async () => {
      const start = Date.now();
      await rateLimiter.waitForSlot();
      await rateLimiter.waitForSlot();
      await rateLimiter.waitForSlot();
      const duration = Date.now() - start;

      // Should complete quickly (no waiting)
      expect(duration).toBeLessThan(100);
    });

    it('should wait when rate limit is reached', async () => {
      // Fill up the rate limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.waitForSlot();
      }

      const start = Date.now();
      await rateLimiter.waitForSlot(); // This should wait
      const duration = Date.now() - start;

      // Should have waited at least some time
      expect(duration).toBeGreaterThan(0);
    }, 65000); // Increase timeout for this test

    it('should track request count correctly', async () => {
      await rateLimiter.waitForSlot();
      await rateLimiter.waitForSlot();

      const status = rateLimiter.getStatus();
      expect(status.requestsInLastMinute).toBe(2);
      expect(status.remainingSlots).toBe(3);
      expect(status.isLimited).toBe(false);
    });

    it('should show limited status when at capacity', async () => {
      for (let i = 0; i < 5; i++) {
        await rateLimiter.waitForSlot();
      }

      const status = rateLimiter.getStatus();
      expect(status.requestsInLastMinute).toBe(5);
      expect(status.remainingSlots).toBe(0);
      expect(status.isLimited).toBe(true);
    });
  });

  describe('executeWithRetry', () => {
    it('should execute function successfully on first try', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await rateLimiter.executeWithRetry(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on rate limit error', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce('success');

      const result = await rateLimiter.executeWithRetry(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on timeout error', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Request timed out'))
        .mockResolvedValueOnce('success');

      const result = await rateLimiter.executeWithRetry(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(rateLimiter.executeWithRetry(mockFn)).rejects.toThrow(
        'Rate limit exceeded',
      );

      // Should try: initial + 2 retries = 3 times
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Invalid request'));

      await expect(rateLimiter.executeWithRetry(mockFn)).rejects.toThrow(
        'Invalid request',
      );

      // Should only try once (no retries)
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('429 Too Many Requests'))
        .mockRejectedValueOnce(new Error('429 Too Many Requests'))
        .mockResolvedValueOnce('success');

      const start = Date.now();
      await rateLimiter.executeWithRetry(mockFn);
      const duration = Date.now() - start;

      // With retryDelayMs=100, exponential backoff should give us:
      // First retry: 100ms, Second retry: 200ms
      // Total minimum: 300ms (plus execution time)
      expect(duration).toBeGreaterThan(250);
    });
  });

  describe('getStatus', () => {
    it('should return correct status for empty limiter', () => {
      const status = rateLimiter.getStatus();

      expect(status.requestsInLastMinute).toBe(0);
      expect(status.remainingSlots).toBe(5);
      expect(status.isLimited).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all requests', async () => {
      await rateLimiter.waitForSlot();
      await rateLimiter.waitForSlot();

      rateLimiter.reset();

      const status = rateLimiter.getStatus();
      expect(status.requestsInLastMinute).toBe(0);
      expect(status.remainingSlots).toBe(5);
    });
  });
});
