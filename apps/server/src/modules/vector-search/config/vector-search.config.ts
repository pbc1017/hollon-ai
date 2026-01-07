import { ConfigService } from '@nestjs/config';

/**
 * Enum defining supported vector similarity metrics
 */
export enum VectorSimilarityMetric {
  /** Cosine similarity (range: -1 to 1, typically 0 to 1 for normalized vectors) */
  COSINE = 'cosine',
  /** Euclidean distance (L2 distance) */
  EUCLIDEAN = 'euclidean',
  /** Dot product similarity */
  DOT_PRODUCT = 'dot_product',
  /** Inner product similarity */
  INNER_PRODUCT = 'inner_product',
}

/**
 * Enum defining supported embedding providers
 */
export enum EmbeddingProvider {
  /** OpenAI embedding models */
  OPENAI = 'openai',
  /** Anthropic (future support) */
  ANTHROPIC = 'anthropic',
  /** Local embedding models */
  LOCAL = 'local',
}

/**
 * Interface for vector search configuration options
 */
export interface VectorSearchConfig {
  /** Whether vector search is enabled */
  enabled: boolean;

  /** Embedding configuration */
  embedding: {
    /** Provider for generating embeddings */
    provider: EmbeddingProvider;
    /** Model name/identifier for embeddings */
    model: string;
    /** Dimension of the embedding vectors */
    dimensions: number;
    /** API key for the embedding provider (if applicable) */
    apiKey?: string;
    /** Batch size for embedding generation */
    batchSize: number;
    /** Maximum retry attempts for failed embedding requests */
    maxRetries: number;
    /** Timeout for embedding requests in milliseconds */
    timeoutMs: number;
  };

  /** Search configuration */
  search: {
    /** Default similarity metric for vector search */
    defaultMetric: VectorSimilarityMetric;
    /** Default minimum similarity threshold (0.0 to 1.0) */
    defaultMinSimilarity: number;
    /** Default maximum number of results to return */
    defaultLimit: number;
    /** Maximum allowed limit for search results */
    maxLimit: number;
    /** Whether to include similarity scores in results by default */
    includeScoresByDefault: boolean;
  };

  /** Index configuration */
  index: {
    /** Name/identifier for the vector index */
    name: string;
    /** Whether to create index if it doesn't exist */
    autoCreate: boolean;
    /** Number of lists for IVF (Inverted File) index (pgvector specific) */
    lists: number;
    /** Number of probes for search (pgvector specific) */
    probes: number;
  };

  /** Performance and caching */
  performance: {
    /** Enable caching for embeddings */
    enableCache: boolean;
    /** Cache TTL in seconds */
    cacheTtlSeconds: number;
    /** Connection pool size for vector operations */
    poolSize: number;
  };
}

/**
 * Factory function to create vector search configuration from environment variables
 * Integrates with NestJS ConfigService for type-safe configuration access
 *
 * @param configService - NestJS ConfigService instance
 * @returns VectorSearchConfig object with all settings
 */
export const vectorSearchConfig = (
  configService: ConfigService,
): VectorSearchConfig => {
  const isProduction = configService.get('nodeEnv') === 'production';
  const isTest = configService.get('nodeEnv') === 'test';

  // Get embedding provider and set defaults based on provider
  const embeddingProvider =
    (configService.get<string>(
      'vectorSearch.embedding.provider',
    ) as EmbeddingProvider) || EmbeddingProvider.OPENAI;

  // Provider-specific defaults
  const providerDefaults = {
    [EmbeddingProvider.OPENAI]: {
      model: 'text-embedding-3-small',
      dimensions: 1536,
    },
    [EmbeddingProvider.ANTHROPIC]: {
      model: 'claude-3-embedding',
      dimensions: 1024,
    },
    [EmbeddingProvider.LOCAL]: {
      model: 'local-embedding-model',
      dimensions: 768,
    },
  };

  const defaults = providerDefaults[embeddingProvider];

  return {
    enabled: configService.get<boolean>('vectorSearch.enabled', !isTest),

    embedding: {
      provider: embeddingProvider,
      model: configService.get<string>(
        'vectorSearch.embedding.model',
        defaults.model,
      ),
      dimensions: configService.get<number>(
        'vectorSearch.embedding.dimensions',
        defaults.dimensions,
      ),
      apiKey:
        embeddingProvider === EmbeddingProvider.OPENAI
          ? configService.get<string>('brain.openaiApiKey')
          : configService.get<string>('vectorSearch.embedding.apiKey'),
      batchSize: configService.get<number>(
        'vectorSearch.embedding.batchSize',
        100,
      ),
      maxRetries: configService.get<number>(
        'vectorSearch.embedding.maxRetries',
        3,
      ),
      timeoutMs: configService.get<number>(
        'vectorSearch.embedding.timeoutMs',
        30000,
      ),
    },

    search: {
      defaultMetric:
        (configService.get<string>(
          'vectorSearch.search.defaultMetric',
        ) as VectorSimilarityMetric) || VectorSimilarityMetric.COSINE,
      defaultMinSimilarity: configService.get<number>(
        'vectorSearch.search.defaultMinSimilarity',
        0.7,
      ),
      defaultLimit: configService.get<number>(
        'vectorSearch.search.defaultLimit',
        10,
      ),
      maxLimit: configService.get<number>('vectorSearch.search.maxLimit', 100),
      includeScoresByDefault: configService.get<boolean>(
        'vectorSearch.search.includeScoresByDefault',
        true,
      ),
    },

    index: {
      name: configService.get<string>(
        'vectorSearch.index.name',
        'vector_embeddings',
      ),
      autoCreate: configService.get<boolean>(
        'vectorSearch.index.autoCreate',
        !isProduction,
      ),
      lists: configService.get<number>('vectorSearch.index.lists', 100),
      probes: configService.get<number>('vectorSearch.index.probes', 10),
    },

    performance: {
      enableCache: configService.get<boolean>(
        'vectorSearch.performance.enableCache',
        isProduction,
      ),
      cacheTtlSeconds: configService.get<number>(
        'vectorSearch.performance.cacheTtlSeconds',
        3600,
      ),
      poolSize: configService.get<number>(
        'vectorSearch.performance.poolSize',
        10,
      ),
    },
  };
};

/**
 * Helper function to validate vector search configuration
 * Throws an error if configuration is invalid
 *
 * @param config - VectorSearchConfig to validate
 * @throws Error if configuration is invalid
 */
export const validateVectorSearchConfig = (
  config: VectorSearchConfig,
): void => {
  if (config.enabled) {
    // Validate embedding configuration
    if (config.embedding.dimensions <= 0) {
      throw new Error(
        'Vector search embedding dimensions must be greater than 0',
      );
    }

    if (
      config.embedding.provider === EmbeddingProvider.OPENAI &&
      !config.embedding.apiKey
    ) {
      throw new Error(
        'OpenAI API key is required when using OpenAI as embedding provider',
      );
    }

    // Validate search configuration
    if (
      config.search.defaultMinSimilarity < 0 ||
      config.search.defaultMinSimilarity > 1
    ) {
      throw new Error(
        'Vector search defaultMinSimilarity must be between 0 and 1',
      );
    }

    if (config.search.defaultLimit <= 0) {
      throw new Error('Vector search defaultLimit must be greater than 0');
    }

    if (config.search.maxLimit < config.search.defaultLimit) {
      throw new Error(
        'Vector search maxLimit must be greater than or equal to defaultLimit',
      );
    }

    // Validate index configuration
    if (config.index.lists <= 0) {
      throw new Error('Vector search index lists must be greater than 0');
    }

    if (config.index.probes <= 0) {
      throw new Error('Vector search index probes must be greater than 0');
    }

    // Validate performance configuration
    if (config.performance.cacheTtlSeconds < 0) {
      throw new Error('Vector search cacheTtlSeconds must be non-negative');
    }

    if (config.performance.poolSize <= 0) {
      throw new Error('Vector search poolSize must be greater than 0');
    }
  }
};
