import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('brain_provider_configs')
@Index(['organizationId', 'providerId'])
export class BrainProviderConfig extends BaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'provider_id', length: 50 })
  providerId: string; // 'claude_code', 'anthropic_api', etc.

  @Column({ name: 'display_name', length: 255 })
  displayName: string;

  @Column({ type: 'jsonb' })
  config: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    [key: string]: unknown;
  };

  @Column({
    name: 'cost_per_input_token_cents',
    type: 'decimal',
    precision: 10,
    scale: 6,
  })
  costPerInputTokenCents: number;

  @Column({
    name: 'cost_per_output_token_cents',
    type: 'decimal',
    precision: 10,
    scale: 6,
  })
  costPerOutputTokenCents: number;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'timeout_seconds', default: 300 })
  timeoutSeconds: number;

  @Column({ name: 'max_retries', default: 3 })
  maxRetries: number;
}
