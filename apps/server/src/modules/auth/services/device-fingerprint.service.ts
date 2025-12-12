import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';

export interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  platform?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  device?: string;
  ipAddress: string;
}

@Injectable()
export class DeviceFingerprintService {
  /**
   * Generate a device fingerprint from request headers
   */
  generateFingerprint(req: Request): DeviceInfo {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const acceptLanguage = req.headers['accept-language'] || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const ipAddress = this.getClientIp(req);

    // Create a hash from various request properties
    const fingerprintData = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
    const fingerprint = crypto
      .createHash('sha256')
      .update(fingerprintData)
      .digest('hex');

    // Parse user agent for detailed device info
    const deviceDetails = this.parseUserAgent(userAgent);

    return {
      fingerprint,
      userAgent,
      ipAddress,
      ...deviceDetails,
    };
  }

  /**
   * Extract client IP address from request
   */
  private getClientIp(req: Request): string {
    // Check various headers for the real IP (useful behind proxies/load balancers)
    const xForwardedFor = req.headers['x-forwarded-for'];
    const xRealIp = req.headers['x-real-ip'];
    const cfConnectingIp = req.headers['cf-connecting-ip']; // Cloudflare

    if (xForwardedFor) {
      const ips = Array.isArray(xForwardedFor)
        ? xForwardedFor[0]
        : xForwardedFor.split(',')[0];
      return ips.trim();
    }

    if (xRealIp) {
      return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    }

    if (cfConnectingIp) {
      return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
    }

    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  /**
   * Parse user agent string to extract device information
   */
  private parseUserAgent(userAgent: string): {
    platform?: string;
    browser?: string;
    browserVersion?: string;
    os?: string;
    device?: string;
  } {
    const result: {
      platform?: string;
      browser?: string;
      browserVersion?: string;
      os?: string;
      device?: string;
    } = {};

    // Detect platform
    if (userAgent.includes('Mobile')) {
      result.platform = 'mobile';
    } else if (userAgent.includes('Tablet')) {
      result.platform = 'tablet';
    } else {
      result.platform = 'desktop';
    }

    // Detect browser
    if (userAgent.includes('Chrome')) {
      result.browser = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+\.\d+)/);
      result.browserVersion = match ? match[1] : undefined;
    } else if (userAgent.includes('Firefox')) {
      result.browser = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
      result.browserVersion = match ? match[1] : undefined;
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      result.browser = 'Safari';
      const match = userAgent.match(/Version\/(\d+\.\d+)/);
      result.browserVersion = match ? match[1] : undefined;
    } else if (userAgent.includes('Edge')) {
      result.browser = 'Edge';
      const match = userAgent.match(/Edge\/(\d+\.\d+)/);
      result.browserVersion = match ? match[1] : undefined;
    }

    // Detect OS
    if (userAgent.includes('Windows')) {
      result.os = 'Windows';
    } else if (userAgent.includes('Mac OS')) {
      result.os = 'macOS';
    } else if (userAgent.includes('Linux')) {
      result.os = 'Linux';
    } else if (userAgent.includes('Android')) {
      result.os = 'Android';
    } else if (
      userAgent.includes('iOS') ||
      userAgent.includes('iPhone') ||
      userAgent.includes('iPad')
    ) {
      result.os = 'iOS';
    }

    // Detect device
    if (userAgent.includes('iPhone')) {
      result.device = 'iPhone';
    } else if (userAgent.includes('iPad')) {
      result.device = 'iPad';
    } else if (userAgent.includes('Android')) {
      result.device = 'Android Device';
    }

    return result;
  }

  /**
   * Compare two device fingerprints for similarity
   */
  compareFingerprints(fp1: string, fp2: string): boolean {
    return fp1 === fp2;
  }

  /**
   * Check if IP address has changed significantly (different network)
   */
  hasIpChanged(oldIp: string, newIp: string): boolean {
    // Simple check - in production, you might want to check if they're in the same subnet
    return oldIp !== newIp;
  }
}
