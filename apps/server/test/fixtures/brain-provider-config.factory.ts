import { Repository, DeepPartial } from 'typeorm';
import { BrainProviderConfig } from '../../src/modules/brain-provider/entities/brain-provider-config.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test Data Factory for BrainProviderConfig entity
 * Provides methods to create test BrainProvider configurations
 */
export class BrainProviderConfigFactory {
  /**
   * Create BrainProviderConfig data (not persisted)
   * @param overrides - Partial config data to override defaults
   */
  static create(
    overrides?: Partial<BrainProviderConfig>,
  ): DeepPartial<BrainProviderConfig> {
    return {
      providerId: 'claude_code',
      displayName: 'Claude Code (Test)',
      config: {
        apiKey: 'test-api-key',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 8192,
        temperature: 0.7,
      },
      costPerInputTokenCents: 0.003,
      costPerOutputTokenCents: 0.015,
      enabled: true,
      timeoutSeconds: 300,
      maxRetries: 3,
      ...overrides,
    };
  }

  /**
   * Create and persist BrainProviderConfig to database
   * @param repo - TypeORM repository for BrainProviderConfig
   * @param organizationId - Organization ID to associate config with
   * @param overrides - Partial config data to override defaults
   */
  static async createPersisted(
    repo: Repository<BrainProviderConfig>,
    organizationId: string,
    overrides?: Partial<BrainProviderConfig>,
  ): Promise<BrainProviderConfig> {
    const config = this.create({
      organizationId,
      ...overrides,
    });
    return repo.save(config);
  }

  /**
   * Create mock configuration for testing (no API key validation)
   */
  static createMock(organizationId: string): DeepPartial<BrainProviderConfig> {
    return this.create({
      organizationId,
      config: {
        apiKey: 'mock-test-key-' + uuidv4().slice(0, 8),
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 8192,
        temperature: 0,
      },
    });
  }
}
