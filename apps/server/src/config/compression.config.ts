import compression from 'compression';
import { Request, Response } from 'express';
import type { Handler } from 'express';

/**
 * Compression middleware configuration
 * Compresses HTTP responses to reduce bandwidth usage
 */
export const compressionConfig: Handler = compression({
  // Only compress responses larger than 1kb
  threshold: 1024,

  // Compression level (0-9, where 6 is default)
  // Higher = better compression but more CPU usage
  level: 6,

  // Filter function to determine if response should be compressed
  filter: (req: Request, res: Response) => {
    // Don't compress if the client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Use compression for all other responses
    return compression.filter(req, res);
  },
});
