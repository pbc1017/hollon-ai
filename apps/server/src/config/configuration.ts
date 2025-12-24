export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isTest = nodeEnv === 'test';
  const isProd = nodeEnv === 'production';

  return {
    nodeEnv,

    server: {
      port: parseInt(process.env.SERVER_PORT || '3001', 10),
      host: process.env.SERVER_HOST || '0.0.0.0',
    },

    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      name: process.env.DB_NAME || 'hollon',
      user: process.env.DB_USER || 'hollon',
      password: process.env.DB_PASSWORD || '',
      schema: (() => {
        // In test mode, always use hollon_test (ignore DB_SCHEMA from .env)
        const baseSchema = isTest
          ? 'hollon_test'
          : process.env.DB_SCHEMA || 'hollon';
        const rawWorkerId = process.env.JEST_WORKER_ID;

        // In test environment with Jest parallel workers
        if (isTest && rawWorkerId) {
          // If schema already contains worker ID pattern, use as-is
          // This handles CI case where schema is pre-configured like "hollon_test_worker_1"
          if (baseSchema.match(/_worker_\d+$/)) {
            return baseSchema;
          }

          // Otherwise, normalize and append worker ID
          // Handles both "1" (local) and "worker_1" (CI) formats
          const workerId = rawWorkerId.replace(/\D/g, '') || '1';
          return `${baseSchema}_worker_${workerId}`;
        }

        return baseSchema;
      })(),
      url: process.env.DATABASE_URL,
    },

    brain: {
      claudeCodePath: process.env.CLAUDE_CODE_PATH || 'claude',
      timeoutMs: parseInt(process.env.BRAIN_TIMEOUT_MS || '1200000', 10), // 20 minutes (Phase 4 dogfooding needs longer time)
      // Test mode uses mock API keys
      anthropicApiKey: isTest
        ? 'test-key-not-used'
        : process.env.ANTHROPIC_API_KEY,
      openaiApiKey: isTest ? 'test-key-not-used' : process.env.OPENAI_API_KEY,
    },

    cost: {
      dailyLimitCents: parseInt(
        process.env.DEFAULT_DAILY_COST_LIMIT_CENTS || '10000',
        10,
      ),
      monthlyLimitCents: parseInt(
        process.env.DEFAULT_MONTHLY_COST_LIMIT_CENTS || '100000',
        10,
      ),
      alertThresholdPercent: parseInt(
        process.env.COST_ALERT_THRESHOLD_PERCENT || '80',
        10,
      ),
    },

    logging: {
      // Test: error, Prod: info, Dev: LOG_LEVEL env var or debug
      level:
        process.env.LOG_LEVEL || (isTest ? 'error' : isProd ? 'info' : 'debug'),
      format: process.env.LOG_FORMAT || 'pretty',
    },

    security: {
      jwtSecret: process.env.JWT_SECRET,
      encryptionKey: process.env.ENCRYPTION_KEY,
    },

    cors: {
      origin: process.env.CORS_ORIGIN || '*',
    },
  };
};
