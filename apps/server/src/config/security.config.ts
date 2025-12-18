import helmet from 'helmet';

/**
 * Security middleware configuration using Helmet
 * Adds various HTTP headers for security
 */
export const helmetConfig = helmet({
  // Content Security Policy - moderate defaults for API
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Swagger UI
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },

  // HTTP Strict Transport Security - force HTTPS
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  // X-Frame-Options - prevent clickjacking
  frameguard: {
    action: 'deny',
  },

  // X-Content-Type-Options - prevent MIME type sniffing
  noSniff: true,

  // X-XSS-Protection - basic XSS protection
  xssFilter: true,

  // Referrer-Policy - control referrer information
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  // Hide X-Powered-By header
  hidePoweredBy: true,

  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false,
  },

  // Download options for IE8+
  ieNoOpen: true,

  // Permissions Policy (formerly Feature Policy)
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none',
  },
});
