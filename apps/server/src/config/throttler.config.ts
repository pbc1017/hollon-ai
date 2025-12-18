import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Rate limiting configuration
 * Prevents abuse by limiting number of requests per time window
 */
export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      // Global rate limit: 100 requests per minute
      name: 'default',
      ttl: 60000, // Time window in milliseconds (1 minute)
      limit: 100, // Maximum number of requests in the time window
    },
    {
      // Stricter limit for sensitive endpoints: 10 requests per minute
      name: 'strict',
      ttl: 60000, // 1 minute
      limit: 10,
    },
  ],
  // Skip rate limiting in test environment
  skipIf: () => process.env.NODE_ENV === 'test',
};
