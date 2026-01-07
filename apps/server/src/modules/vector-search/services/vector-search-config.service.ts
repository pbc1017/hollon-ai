import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VectorSearchConfig } from '../entities/vector-search-config.entity';

/**
 * VectorSearchConfigService
 *
 * Manages vector search configuration for organizations.
 * Handles retrieval, validation, and default configuration management.
 */
@Injectable()
export class VectorSearchConfigService {
  constructor(
    @InjectRepository(VectorSearchConfig)
    private readonly configRepo: Repository<VectorSearchConfig>,
  ) {}

  /**
   * Get configuration for a specific organization
   *
   * @param organizationId - UUID of the organization
   * @returns Vector search configuration
   * @throws NotFoundException if no enabled config found
   */
  async getConfig(organizationId: string): Promise<VectorSearchConfig> {
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
      throw new NotFoundException('No default vector search config found');
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
   * @param config - Configuration to validate
   * @throws BadRequestException if validation fails
   */
  async validateConfig(config: VectorSearchConfig): Promise<void> {
    // Validate timeout
    if (config.timeoutSeconds < 5 || config.timeoutSeconds > 300) {
      throw new BadRequestException('Timeout must be between 5-300 seconds');
    }

    // Validate dimensions
    const validDimensions = [1536, 3072, 768, 1024, 256]; // Common embedding dimensions
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
        throw new BadRequestException('Default limit cannot exceed max limit');
      }
    }

    // Validate provider-specific config
    if (!config.config.apiKey) {
      throw new BadRequestException('API key is required in config');
    }
  }

  /**
   * Get or create configuration for an organization
   *
   * If no configuration exists, creates a default one using environment variables.
   *
   * @param organizationId - UUID of the organization
   * @returns Vector search configuration
   */
  async getOrCreateConfig(organizationId: string): Promise<VectorSearchConfig> {
    try {
      return await this.getConfig(organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        // Create default config from environment
        return await this.createDefaultConfig(organizationId);
      }
      throw error;
    }
  }

  /**
   * Create default configuration for an organization
   *
   * Uses environment variables and sensible defaults.
   *
   * @param organizationId - UUID of the organization
   * @returns Newly created configuration
   * @private
   */
  private async createDefaultConfig(
    organizationId: string,
  ): Promise<VectorSearchConfig> {
    const config = this.configRepo.create({
      organizationId,
      displayName: 'Default Vector Search Config',
      provider: 'openai',
      embeddingModel: 'text-embedding-3-small',
      dimensions: 1536,
      config: {
        apiKey: process.env.OPENAI_API_KEY,
        apiEndpoint: 'https://api.openai.com/v1',
        batchSize: 100,
      },
      searchConfig: {
        similarityThreshold: 0.7,
        defaultLimit: 10,
        maxLimit: 100,
        distanceMetric: 'cosine',
      },
      costPer1kTokensCents: 0.00002, // $0.0002 per 1K tokens
      timeoutSeconds: 30,
      maxRetries: 3,
      rateLimitConfig: {
        maxRequestsPerMinute: 60,
        maxTokensPerMinute: 1000000,
      },
      enabled: true,
    });

    return await this.configRepo.save(config);
  }
}
