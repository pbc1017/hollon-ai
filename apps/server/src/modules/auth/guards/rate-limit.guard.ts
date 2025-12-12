import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes
  private readonly maxAttempts = 10; // 10 attempts per window

  constructor(
    private readonly customWindowMs?: number,
    private readonly customMaxAttempts?: number,
  ) {
    if (customWindowMs) this.windowMs = customWindowMs;
    if (customMaxAttempts) this.maxAttempts = customMaxAttempts;

    // Clean up old entries every 30 minutes
    setInterval(() => this.cleanup(), 30 * 60 * 1000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = this.generateKey(request);

    const now = Date.now();
    const entry = this.rateLimitMap.get(key);

    // No entry or expired window - create new entry
    if (!entry || now > entry.resetTime) {
      this.rateLimitMap.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    // Increment count
    entry.count += 1;

    // Check if limit exceeded
    if (entry.count > this.maxAttempts) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      this.logger.warn(
        `Rate limit exceeded for ${key}. Attempts: ${entry.count}/${this.maxAttempts}`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private generateKey(request: Request): string {
    // Use IP address as the key
    const ip = this.getClientIp(request);
    const route = request.route?.path || request.path;
    return `${ip}:${route}`;
  }

  private getClientIp(request: Request): string {
    const xForwardedFor = request.headers['x-forwarded-for'];
    const xRealIp = request.headers['x-real-ip'];

    if (xForwardedFor) {
      const ips = Array.isArray(xForwardedFor)
        ? xForwardedFor[0]
        : xForwardedFor.split(',')[0];
      return ips.trim();
    }

    if (xRealIp) {
      return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    }

    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.rateLimitMap.forEach((entry, key) => {
      if (now > entry.resetTime) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.rateLimitMap.delete(key));

    if (keysToDelete.length > 0) {
      this.logger.debug(
        `Cleaned up ${keysToDelete.length} expired rate limit entries`,
      );
    }
  }
}

// Factory functions for common rate limit configurations
export const StrictRateLimitGuard = () => new RateLimitGuard(5 * 60 * 1000, 3); // 3 attempts per 5 minutes

export const AuthRateLimitGuard = () => new RateLimitGuard(15 * 60 * 1000, 5); // 5 attempts per 15 minutes

export const StandardRateLimitGuard = () =>
  new RateLimitGuard(15 * 60 * 1000, 10); // 10 attempts per 15 minutes
