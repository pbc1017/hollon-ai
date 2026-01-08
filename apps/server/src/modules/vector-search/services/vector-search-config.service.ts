import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { VectorSearchConfig } from '../entities/vector-search-config.entity';

/**
 * VectorSearchConfigService
 *
 * Manages vector search configuration for organizations and system-wide settings.
 * Handles retrieval, validation, and default configuration management.
 *
 * Features:
 * - Organization-specific configuration management
 * - Configuration validation
 * - Default configuration creation
 * - Integration with NestJS ConfigService
 *
 * Configuration sources (in order of precedence):
 * 1. Organization-specific configuration in database
 * 2. Environment variables via ConfigService
 * 3. Built-in defaults
 *
 * @injectable
 */
@Injectable()
export class VectorSearchConfigService {
  private readonly logger = new Logger(VectorSearchConfigService.name);

  constructor(
    @InjectRepository(VectorSearchConfig)
    private readonly configRepo: Repository<VectorSearchConfig>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get configuration for a specific organization
   *
   * Retrieves the organization's vector search configuration from the database.
   * Validates the configuration before returning.
   *
   * @param organizationId - UUID of the organization
   * @returns Vector search configuration
   * @throws NotFoundException if no enabled config found
   */
  async getConfig(organizationId: string): Promise<VectorSearchConfig> {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    const config = await this.configRepo.findOne({
      where: {
        organizationId,
        enabled: true,
      },
    });

    if (!config) {
      throw new NotFoundException(
        `No enabled vector search config for organization ${organizationId}`,
      );
    }

    await this.validateConfig(config);
    return config;
  }

  /**
   * Get default configuration (first enabled config)
   *
   * Useful for system-wide operations or when organization context is not available.
   * Falls back to creating default config if none exists.
   *
   * @returns Default vector search configuration
   * @throws NotFoundException if no default config found
   */
  async getDefaultConfig(): Promise<VectorSearchConfig> {
    const config = await this.configRepo.findOne({
      where: {
        enabled: true,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    if (!config) {
      this.logger.warn(
        'No default vector search config found in database, using environment defaults',
      );
      // Return a configuration built from environment variables
      return this.buildConfigFromEnvironment();
    }

    await this.validateConfig(config);
    return config;
  }

  /**
   * Validate configuration values
   *
   * Ensures configuration parameters are within acceptable ranges
   * and required fields are properly set.
   *
   * Validation rules:
   * - Timeout between 5-300 seconds
   * - Dimensions must be a valid embedding dimension (1536, 3072, 768, 1024, 256)
   * - Cost rates must be non-negative
   * - Similarity threshold between 0-1
   * - Limits must be positive and consistent
   *
   * @param config - Configuration to validate
   * @throws BadRequestException if validation fails
   */
  async validateConfig(config: VectorSearchConfig): Promise<void> {
    // Validate timeout
    if (config.timeoutSeconds < 5 || config.timeoutSeconds > 300) {
      throw new BadRequestException(
        'Timeout must be between 5-300 seconds',
      );
    }

    // Validate dimensions - common embedding dimensions
    const validDimensions = [1536, 3072, 768, 1024, 256];
    if (!validDimensions.includes(config.dimensions)) {
      throw new BadRequestException(
        `Invalid dimensions: ${config.dimensions}. Must be one of: ${validDimensions.join(', ')}`,
      );
    }

    // Validate cost
    if (config.costPer1kTokensCents < 0) {
      throw new BadRequestException('Cost rates must be non-negative');
    }

    // Validate search config
    if (config.searchConfig) {
      const { similarityThreshold, defaultLimit, maxLimit } =
        config.searchConfig;

      if (
        similarityThreshold !== undefined &&
        (similarityThreshold < 0 || similarityThreshold > 1)
      ) {
        throw new BadRequestException(
          'Similarity threshold must be between 0 and 1',
        );
      }

      if (defaultLimit !== undefined && defaultLimit < 1) {
        throw new BadRequestException('Default limit must be at least 1');
      }

      if (maxLimit !== undefined && maxLimit < 1) {
        throw new BadRequestException('Max limit must be at least 1');
      }

      if (
        defaultLimit !== undefined &&
        maxLimit !== undefined &&
        defaultLimit > maxLimit
      ) {
        throw new BadRequestException(
          'Default limit cannot exceed max limit',
        );
      }
    }

    // Validate provider-specific config
    if (!config.config?.apiKey) {
      throw new BadRequestException('API key is required in config');
    }
  }

  /**
   * Get or create configuration for an organization
   *
   * Attempts to retrieve existing configuration. If not found, creates
   * a default one using environment variables and sensible defaults.
   *
   * This is the recommended method for most use cases as it ensures
   * a configuration is always available.
   *
   * @param organizationId - UUID of the organization
   * @returns Vector search configuration
   */
  async getOrCreateConfig(organizationId: string): Promise<VectorSearchConfig> {
    try {
      return await this.getConfig(organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return await this.createDefaultConfig(organizationId);
      }
      throw error;
    }
  }

  /**
   * Create default configuration for an organization
   *
   * Uses environment variables from ConfigService and sensible defaults.
   * Configuration is saved to the database for future use.
   *
   * Configuration sources:
   * - VECTOR_EMBEDDING_API_KEY or OPENAI_API_KEY
   * - VECTOR_EMBEDDING_MODEL (default: text-embedding-3-small)
   * - VECTOR_EMBEDDING_DIMENSIONS (default: 1536)
   * - VECTOR_SEARCH_DEFAULT_LIMIT (default: 10)
   * - VECTOR_SEARCH_DEFAULT_MIN_SIMILARITY (default: 0.7)
   *
   * @param organizationId - UUID of the organization
   * @returns Newly created configuration
   * @private
   */
  private async createDefaultConfig(
    organizationId: string,
  ): Promise<VectorSearchConfig> {
    const openaiApiKey =
      this.configService.get<string>('brain.openaiApiKey') ||
      process.env.VECTOR_EMBEDDING_API_KEY ||
      process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      this.logger.warn(
        'No API key configured for vector search - using placeholder',
      );
    }

    const config = this.configRepo.create({
      organizationId,
      displayName: 'Default Vector Search Config',
      provider: 'openai',
      embeddingModel:
        this.configService.get<string>(
          'vectorSearch.embedding.model',
        ) || 'text-embedding-3-small',
      dimensions:
        this.configService.get<number>(
          'vectorSearch.embedding.dimensions',
        ) || 1536,
      config: {
        apiKey: openaiApiKey,
        apiEndpoint: 'https://api.openai.com/v1',
        batchSize:
          this.configService.get<number>(
            'vectorSearch.embedding.batchSize',
          ) || 100,
      },
      searchConfig: {
        similarityThreshold:
          this.configService.get<number>(
            'vectorSearch.search.defaultMinSimilarity',
          ) || 0.7,
        defaultLimit:
          this.configService.get<number>(
            'vectorSearch.search.defaultLimit',
          ) || 10,
        maxLimit:
          this.configService.get<number>(
            'vectorSearch.search.maxLimit',
          ) || 100,
        distanceMetric: 'cosine',
      },
      costPer1kTokensCents: 0.00002, // $0.0002 per 1K tokens for text-embedding-3-small
      timeoutSeconds:
        this.configService.get<number>(
          'vectorSearch.embedding.timeoutMs',
        ) || 30000 / 1000,
      maxRetries:
        this.configService.get<number>(
          'vectorSearch.embedding.maxRetries',
        ) || 3,
      rateLimitConfig: {
        maxRequestsPerMinute: 60,
        maxTokensPerMinute: 1000000,
      },
      enabled: true,
    });

    const savedConfig = await this.configRepo.save(config);
    this.logger.log(
      `Created default vector search configuration for organization ${organizationId}`,
    );

    return savedConfig;
  }

  /**
   * Build configuration object from environment variables
   *
   * Used when no database configuration exists. This is a transient
   * configuration not saved to the database.
   *
   * @returns Configuration object
   * @private
   */
  private buildConfigFromEnvironment(): VectorSearchConfig {
    const config = new VectorSearchConfig();

    config.organizationId = 'system';
    config.displayName = 'System Default Vector Search Config';
    config.provider = 'openai';
    config.embeddingModel =
      this.configService.get<string>(
        'vectorSearch.embedding.model',
      ) || 'text-embedding-3-small';
    config.dimensions =
      this.configService.get<number>(
        'vectorSearch.embedding.dimensions',
      ) || 1536;
    config.config = {
      apiKey:
        this.configService.get<string>('brain.openaiApiKey') ||
        process.env.OPENAI_API_KEY,
      apiEndpoint: 'https://api.openai.com/v1',
      batchSize:
        this.configService.get<number>(
          'vectorSearch.embedding.batchSize',
        ) || 100,
    };
    config.searchConfig = {
      similarityThreshold:
        this.configService.get<number>(
          'vectorSearch.search.defaultMinSimilarity',
        ) || 0.7,
      defaultLimit:
        this.configService.get<number>(
          'vectorSearch.search.defaultLimit',
        ) || 10,
      maxLimit:
        this.configService.get<number>(
          'vectorSearch.search.maxLimit',
        ) || 100,
      distanceMetric: 'cosine',
    };
    config.costPer1kTokensCents = 0.00002;
    config.timeoutSeconds = 30;
    config.maxRetries = 3;
    config.rateLimitConfig = {
      maxRequestsPerMinute: 60,
      maxTokensPerMinute: 1000000,
    };
    config.enabled = true;

    return config;
  }

  /**
   * Update configuration for an organization
   *
   * Validates and updates existing configuration.
   *
   * @param organizationId - UUID of the organization
   * @param updates - Partial configuration updates
   * @returns Updated configuration
   * @throws NotFoundException if configuration doesn't exist
   */
  async updateConfig(
    organizationId: string,
    updates: Partial<VectorSearchConfig>,
  ): Promise<VectorSearchConfig> {
    const config = await this.getConfig(organizationId);

    // Update allowed fields
    if (updates.embeddingModel !== undefined) {
      config.embeddingModel = updates.embeddingModel;
    }
    if (updates.dimensions !== undefined) {
      config.dimensions = updates.dimensions;
    }
    if (updates.searchConfig !== undefined) {
      config.searchConfig = { ...config.searchConfig, ...updates.searchConfig };
    }
    if (updates.timeoutSeconds !== undefined) {
      config.timeoutSeconds = updates.timeoutSeconds;
    }
    if (updates.maxRetries !== undefined) {
      config.maxRetries = updates.maxRetries;
    }

    // Validate before saving
    await this.validateConfig(config);

    return await this.configRepo.save(config);
  }
}
