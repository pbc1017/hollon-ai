import { ConfigService } from '@nestjs/config';
import { ClaudeCodeProvider } from '../providers/claude-code.provider';
import { ProcessManagerService } from '../services/process-manager.service';
import { CostCalculatorService } from '../services/cost-calculator.service';
import { ResponseParserService } from '../services/response-parser.service';
import { BrainProviderConfigService } from '../services/brain-provider-config.service';
import { BrainTimeoutError } from '../exceptions/brain-timeout.error';
import { BrainExecutionError } from '../exceptions/brain-execution.error';

describe('ClaudeCodeProvider', () => {
  let provider: ClaudeCodeProvider;
  let mockProcessManager: jest.Mocked<ProcessManagerService>;
  let mockCostCalculator: jest.Mocked<CostCalculatorService>;
  let mockResponseParser: jest.Mocked<ResponseParserService>;
  let mockConfigService: jest.Mocked<BrainProviderConfigService>;
  let mockConfigLib: jest.Mocked<ConfigService>;

  beforeEach(() => {
    // Create mocks
    mockProcessManager = {
      spawn: jest.fn(),
    } as any;

    mockCostCalculator = {
      estimateCost: jest.fn(),
      calculateFromActual: jest.fn(),
    } as any;

    mockResponseParser = {
      parse: jest.fn(),
    } as any;

    mockConfigService = {
      getDefaultConfig: jest.fn(),
      getConfig: jest.fn(),
      validateConfig: jest.fn(),
    } as any;

    mockConfigLib = {
      get: jest.fn(),
    } as any;

    provider = new ClaudeCodeProvider(
      mockProcessManager,
      mockCostCalculator,
      mockResponseParser,
      mockConfigService,
      mockConfigLib,
    );
  });

  describe('execute', () => {
    it('should execute successfully', async () => {
      // Arrange
      mockConfigService.getDefaultConfig.mockResolvedValue({
        providerId: 'claude_code',
        timeoutSeconds: 300,
        costPerInputTokenCents: 300,
        costPerOutputTokenCents: 1500,
      } as any);

      mockConfigLib.get.mockReturnValue('claude');

      mockProcessManager.spawn.mockResolvedValue({
        stdout: 'Hello from Claude!',
        stderr: '',
        exitCode: 0,
        duration: 1500,
      });

      mockResponseParser.parse.mockReturnValue({
        output: 'Hello from Claude!',
        hasError: false,
      });

      mockCostCalculator.estimateCost.mockReturnValue({
        inputTokens: 10,
        outputTokens: 5,
        totalCostCents: 0.001,
      });

      // Act
      const result = await provider.execute({
        prompt: 'Say hello',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello from Claude!');
      expect(result.duration).toBe(1500);
      expect(result.cost).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalCostCents: 0.001,
      });

      expect(mockProcessManager.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'claude',
          args: expect.arrayContaining(['--print', '--output-format', 'text']),
          input: 'Say hello',
        }),
      );
    });

    it('should include system prompt in command args', async () => {
      mockConfigService.getDefaultConfig.mockResolvedValue({
        timeoutSeconds: 300,
        costPerInputTokenCents: 300,
        costPerOutputTokenCents: 1500,
      } as any);

      mockConfigLib.get.mockReturnValue('claude');

      mockProcessManager.spawn.mockResolvedValue({
        stdout: 'Response',
        stderr: '',
        exitCode: 0,
        duration: 1000,
      });

      mockResponseParser.parse.mockReturnValue({
        output: 'Response',
        hasError: false,
      });

      mockCostCalculator.estimateCost.mockReturnValue({
        inputTokens: 20,
        outputTokens: 10,
        totalCostCents: 0.002,
      });

      await provider.execute({
        prompt: 'Test',
        systemPrompt: 'You are a helpful assistant',
      });

      expect(mockProcessManager.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.arrayContaining([
            '--system-prompt',
            'You are a helpful assistant',
          ]),
        }),
      );
    });

    it('should throw timeout error', async () => {
      mockConfigService.getDefaultConfig.mockResolvedValue({
        timeoutSeconds: 1,
        costPerInputTokenCents: 300,
        costPerOutputTokenCents: 1500,
      } as any);

      mockConfigLib.get.mockReturnValue('claude');

      mockCostCalculator.estimateCost.mockReturnValue({
        inputTokens: 10,
        outputTokens: 5,
        totalCostCents: 0.001,
      });

      mockProcessManager.spawn.mockRejectedValue(
        new BrainTimeoutError(1000, 1500),
      );

      await expect(
        provider.execute({ prompt: 'test' }),
      ).rejects.toThrow(BrainTimeoutError);
    });

    it('should throw error on non-zero exit code', async () => {
      mockConfigService.getDefaultConfig.mockResolvedValue({
        timeoutSeconds: 300,
        costPerInputTokenCents: 300,
        costPerOutputTokenCents: 1500,
      } as any);

      mockConfigLib.get.mockReturnValue('claude');

      mockCostCalculator.estimateCost.mockReturnValue({
        inputTokens: 10,
        outputTokens: 5,
        totalCostCents: 0.001,
      });

      mockProcessManager.spawn.mockResolvedValue({
        stdout: '',
        stderr: 'Command not found',
        exitCode: 127,
        duration: 100,
      });

      await expect(
        provider.execute({ prompt: 'test' }),
      ).rejects.toThrow(BrainExecutionError);
    });

    it('should throw error when response parser detects error', async () => {
      mockConfigService.getDefaultConfig.mockResolvedValue({
        timeoutSeconds: 300,
        costPerInputTokenCents: 300,
        costPerOutputTokenCents: 1500,
      } as any);

      mockConfigLib.get.mockReturnValue('claude');

      mockCostCalculator.estimateCost.mockReturnValue({
        inputTokens: 10,
        outputTokens: 5,
        totalCostCents: 0.001,
      });

      mockProcessManager.spawn.mockResolvedValue({
        stdout: 'Error: Something went wrong',
        stderr: '',
        exitCode: 0,
        duration: 500,
      });

      mockResponseParser.parse.mockReturnValue({
        output: 'Error: Something went wrong',
        hasError: true,
        errorMessage: 'Error: Something went wrong',
      });

      await expect(
        provider.execute({ prompt: 'test' }),
      ).rejects.toThrow(BrainExecutionError);
    });

    it('should use custom timeout from options', async () => {
      mockConfigService.getDefaultConfig.mockResolvedValue({
        timeoutSeconds: 300,
        costPerInputTokenCents: 300,
        costPerOutputTokenCents: 1500,
      } as any);

      mockConfigLib.get.mockReturnValue('claude');

      mockProcessManager.spawn.mockResolvedValue({
        stdout: 'Response',
        stderr: '',
        exitCode: 0,
        duration: 2000,
      });

      mockResponseParser.parse.mockReturnValue({
        output: 'Response',
        hasError: false,
      });

      mockCostCalculator.estimateCost.mockReturnValue({
        inputTokens: 10,
        outputTokens: 5,
        totalCostCents: 0.001,
      });

      await provider.execute({
        prompt: 'test',
        options: { timeoutMs: 60000 },
      });

      expect(mockProcessManager.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 60000,
        }),
      );
    });

    it('should use working directory from context', async () => {
      mockConfigService.getDefaultConfig.mockResolvedValue({
        timeoutSeconds: 300,
        costPerInputTokenCents: 300,
        costPerOutputTokenCents: 1500,
      } as any);

      mockConfigLib.get.mockReturnValue('claude');

      mockProcessManager.spawn.mockResolvedValue({
        stdout: 'Response',
        stderr: '',
        exitCode: 0,
        duration: 1000,
      });

      mockResponseParser.parse.mockReturnValue({
        output: 'Response',
        hasError: false,
      });

      mockCostCalculator.estimateCost.mockReturnValue({
        inputTokens: 10,
        outputTokens: 5,
        totalCostCents: 0.001,
      });

      await provider.execute({
        prompt: 'test',
        context: {
          workingDirectory: '/path/to/project',
        },
      });

      expect(mockProcessManager.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: '/path/to/project',
        }),
      );
    });
  });

  describe('healthCheck', () => {
    it('should return true when CLI is available', async () => {
      mockConfigLib.get.mockReturnValue('claude');

      mockProcessManager.spawn.mockResolvedValue({
        stdout: 'Claude Code version 1.0.0',
        stderr: '',
        exitCode: 0,
        duration: 100,
      });

      const result = await provider.healthCheck();

      expect(result).toBe(true);
      expect(mockProcessManager.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'claude',
          args: ['--version'],
          timeoutMs: 5000,
        }),
      );
    });

    it('should return false when CLI is not available', async () => {
      mockConfigLib.get.mockReturnValue('claude');

      mockProcessManager.spawn.mockRejectedValue(
        new Error('Command not found'),
      );

      const result = await provider.healthCheck();

      expect(result).toBe(false);
    });
  });
});
