export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',

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
      const baseSchema = process.env.DB_SCHEMA || 'hollon';
      const rawWorkerId = process.env.JEST_WORKER_ID;

      // In test environment with Jest parallel workers
      if (process.env.NODE_ENV === 'test' && rawWorkerId) {
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
    timeoutMs: parseInt(process.env.BRAIN_TIMEOUT_MS || '300000', 10),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
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
    level: process.env.LOG_LEVEL || 'debug',
    format: process.env.LOG_FORMAT || 'pretty',
  },

  security: {
    jwtSecret: process.env.JWT_SECRET,
    encryptionKey: process.env.ENCRYPTION_KEY,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
});
