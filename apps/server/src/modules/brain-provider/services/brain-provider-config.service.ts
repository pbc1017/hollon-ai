import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrainProviderConfig } from '../entities/brain-provider-config.entity';

@Injectable()
export class BrainProviderConfigService {
  constructor(
    @InjectRepository(BrainProviderConfig)
    private readonly configRepo: Repository<BrainProviderConfig>,
  ) {}

  /**
   * Get configuration for a specific organization
   */
  async getConfig(organizationId: string): Promise<BrainProviderConfig> {
    const config = await this.configRepo.findOne({
      where: {
        organizationId,
        providerId: 'claude_code',
        enabled: true,
      },
    });

    if (!config) {
      throw new NotFoundException(
        `No enabled Claude Code config for organization ${organizationId}`,
      );
    }

    await this.validateConfig(config);
    return config;
  }

  /**
   * Get default configuration (first enabled config)
   */
  async getDefaultConfig(): Promise<BrainProviderConfig> {
    const config = await this.configRepo.findOne({
      where: {
        providerId: 'claude_code',
        enabled: true,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    if (!config) {
      throw new NotFoundException('No default Claude Code config found');
    }

    await this.validateConfig(config);
    return config;
  }

  /**
   * Validate configuration values
   */
  async validateConfig(config: BrainProviderConfig): Promise<void> {
    if (config.timeoutSeconds < 5 || config.timeoutSeconds > 1200) {
      throw new BadRequestException('Timeout must be between 5-1200 seconds');
    }

    if (
      config.costPerInputTokenCents <= 0 ||
      config.costPerOutputTokenCents <= 0
    ) {
      throw new BadRequestException('Cost rates must be positive');
    }
  }
}
