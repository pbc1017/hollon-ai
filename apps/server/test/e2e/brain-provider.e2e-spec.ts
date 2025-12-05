import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { ClaudeCodeProvider } from '../../src/modules/brain-provider/providers/claude-code.provider';
import { DataSource } from 'typeorm';
import { Organization } from '../../src/modules/organization/entities/organization.entity';
import { BrainProviderConfig } from '../../src/modules/brain-provider/entities/brain-provider-config.entity';

describe('Brain Provider E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let claudeProvider: ClaudeCodeProvider;
  let testOrganization: Organization;
  let testConfig: BrainProviderConfig;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    claudeProvider = moduleFixture.get<ClaudeCodeProvider>(ClaudeCodeProvider);

    // Clean database
    await dataSource.query('TRUNCATE brain_provider_configs, organizations RESTART IDENTITY CASCADE');

    // Create test organization
    const orgRepo = dataSource.getRepository(Organization);
    testOrganization = await orgRepo.save({
      name: 'Test Org',
      description: 'Test organization for brain provider',
      settings: {
        costLimitDailyCents: 10000,
        costLimitMonthlyCents: 100000,
        maxHollonsPerTeam: 10,
        defaultTaskPriority: 'medium',
      },
    });

    // Create test brain provider config
    const configRepo = dataSource.getRepository(BrainProviderConfig);
    testConfig = await configRepo.save({
      organizationId: testOrganization.id,
      providerId: 'claude_code',
      displayName: 'Claude Code Test',
      config: {
        command: 'claude',
        args: ['--dangerously-skip-permissions'],
      },
      timeoutSeconds: 120,
      costPerInputTokenCents: 0.0003,
      costPerOutputTokenCents: 0.0015,
      enabled: true,
      maxRetries: 3,
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testConfig) {
      await dataSource.getRepository(BrainProviderConfig).delete(testConfig.id);
    }
    if (testOrganization) {
      await dataSource.getRepository(Organization).delete(testOrganization.id);
    }
    await app.close();
  });

  describe('ClaudeCodeProvider', () => {
    it('should execute simple prompt and return result', async () => {
      const result = await claudeProvider.execute({
        prompt: 'Return the exact string "Hello, Hollon!"',
        systemPrompt: 'You are a helpful assistant. Follow instructions exactly.',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, Hollon');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.cost.totalCostCents).toBeGreaterThan(0);
    }, 60000); // 60 second timeout for Claude API call

    it('should handle simple calculation', async () => {
      const result = await claudeProvider.execute({
        prompt: 'Calculate 15 + 27 and return only the number.',
        systemPrompt: 'You are a calculator. Return only the numeric result.',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('42');
    }, 60000);

    it('should estimate cost correctly', async () => {
      const result = await claudeProvider.execute({
        prompt: 'Short prompt to test cost estimation',
      });

      expect(result.cost.totalCostCents).toBeGreaterThan(0);
      expect(result.cost.inputTokens).toBeGreaterThan(0);
      expect(result.cost.outputTokens).toBeGreaterThan(0);
    }, 60000);

    it('should respect timeout', async () => {
      const startTime = Date.now();

      try {
        await claudeProvider.execute({
          prompt: 'This is a test prompt',
          options: { timeoutMs: 100 }, // Very short timeout
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Should timeout quickly
        expect(duration).toBeLessThan(10000); // Should not wait full 60s
        expect(error.message).toMatch(/timeout|timed out/i);
      }
    }, 15000);

    it('should pass system prompt correctly', async () => {
      const result = await claudeProvider.execute({
        prompt: 'What is your role?',
        systemPrompt: 'You are a TypeScript expert specializing in NestJS.',
      });

      expect(result.success).toBe(true);
      expect(result.output.toLowerCase()).toMatch(/typescript|nestjs/);
    }, 60000);
  });

  describe('Health Check', () => {
    it('should verify Claude Code CLI is available', async () => {
      const isHealthy = await claudeProvider.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });
});
