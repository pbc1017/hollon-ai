import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IBrainProvider,
  BrainRequest,
  BrainResponse,
} from '../interfaces/brain-provider.interface';
import { ProcessManagerService } from '../services/process-manager.service';
import { CostCalculatorService } from '../services/cost-calculator.service';
import { ResponseParserService } from '../services/response-parser.service';
import { BrainProviderConfigService } from '../services/brain-provider-config.service';
import { BrainExecutionError } from '../exceptions/brain-execution.error';

@Injectable()
export class ClaudeCodeProvider implements IBrainProvider {
  private readonly logger = new Logger(ClaudeCodeProvider.name);

  // Model configuration with fallback support
  private readonly PRIMARY_MODEL = 'sonnet';
  private readonly FALLBACK_MODEL = 'haiku';

  constructor(
    private readonly processManager: ProcessManagerService,
    private readonly costCalculator: CostCalculatorService,
    private readonly responseParser: ResponseParserService,
    private readonly configService: BrainProviderConfigService,
    private readonly configLib: ConfigService,
  ) {}

  async execute(request: BrainRequest): Promise<BrainResponse> {
    // Try primary model (Sonnet) first
    try {
      return await this.executeWithModel(request, this.PRIMARY_MODEL);
    } catch (error) {
      // Check if it's a rate limit error
      if (this.isRateLimitError(error)) {
        this.logger.warn(
          `Rate limit hit on ${this.PRIMARY_MODEL}, falling back to ${this.FALLBACK_MODEL}`,
        );
        // Retry with fallback model (Haiku)
        return await this.executeWithModel(request, this.FALLBACK_MODEL);
      }
      throw error;
    }
  }

  /**
   * Check if the error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof BrainExecutionError) {
      const errorText = `${error.message} ${error.stderr || ''}`.toLowerCase();
      return (
        errorText.includes('rate limit') ||
        errorText.includes('rate_limit') ||
        errorText.includes('limit reached') || // Claude CLI rate limit message
        errorText.includes('429') ||
        errorText.includes('overloaded') ||
        errorText.includes('too many requests') ||
        errorText.includes('capacity') ||
        errorText.includes('quota')
      );
    }
    if (error instanceof Error) {
      const errorText = error.message.toLowerCase();
      return (
        errorText.includes('rate limit') ||
        errorText.includes('rate_limit') ||
        errorText.includes('limit reached') || // Claude CLI rate limit message
        errorText.includes('429') ||
        errorText.includes('overloaded') ||
        errorText.includes('too many requests')
      );
    }
    return false;
  }

  /**
   * Execute with a specific model
   */
  private async executeWithModel(
    request: BrainRequest,
    modelName: string,
  ): Promise<BrainResponse> {
    const startTime = Date.now();

    // Get configuration
    const config = await this.configService.getDefaultConfig();
    const claudePath = this.configLib.get<string>(
      'brain.claudeCodePath',
      'claude',
    );
    const timeoutMs =
      request.options?.timeoutMs || config.timeoutSeconds * 1000;

    // Build command arguments with model
    const args = [
      '-p', // prompt를 stdin으로 받음
      '--output-format',
      'text',
      '--dangerously-skip-permissions',
      '--model',
      modelName,
    ];
    if (request.systemPrompt) {
      args.push('--system-prompt', request.systemPrompt);
    }
    // Phase 4.1 Fix #7: Disallow specific tools for decomposition mode
    if (request.options?.disallowedTools?.length) {
      args.push(
        '--disallowed-tools',
        request.options.disallowedTools.join(','),
      );
    }

    // Estimate cost before execution
    const estimatedCost = this.costCalculator.estimateCost(
      request.prompt,
      request.systemPrompt || '',
      {
        costPerInputTokenCents: config.costPerInputTokenCents,
        costPerOutputTokenCents: config.costPerOutputTokenCents,
      },
    );

    this.logger.log(
      `Executing Claude Code with model=${modelName}: timeout=${timeoutMs}ms, ` +
        `estimated_cost=$${estimatedCost.totalCostCents.toFixed(4)}`,
    );

    try {
      // Execute process
      const processResult = await this.processManager.spawn({
        command: claudePath,
        args,
        input: request.prompt,
        cwd: request.context?.workingDirectory,
        timeoutMs,
      });

      // Check exit code
      if (processResult.exitCode !== 0) {
        // Include both stdout and stderr for rate limit detection
        // Rate limit messages appear in stdout, not stderr
        const combinedOutput = `${processResult.stdout || ''}\n${processResult.stderr || ''}`;
        throw new BrainExecutionError(
          `Claude Code exited with code ${processResult.exitCode}`,
          combinedOutput,
          processResult.exitCode,
        );
      }

      // Parse response
      const parsed = this.responseParser.parse(processResult.stdout);
      if (parsed.hasError) {
        throw new BrainExecutionError(
          `Claude Code returned error: ${parsed.errorMessage}`,
        );
      }

      const duration = Date.now() - startTime;

      this.logger.log(
        `Claude Code execution completed (model=${modelName}): duration=${duration}ms, ` +
          `output_length=${parsed.output.length}`,
      );

      return {
        success: true,
        output: parsed.output,
        duration: processResult.duration,
        cost: estimatedCost,
        metadata: { ...parsed.metadata, modelUsed: modelName },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Log detailed error information for debugging
      if (error instanceof BrainExecutionError) {
        this.logger.error(
          `Claude Code execution failed (model=${modelName}): ${errorMessage}, ` +
            `exitCode=${error.exitCode}, duration=${duration}ms`,
        );
      } else {
        this.logger.error(
          `Claude Code execution failed (model=${modelName}): ${errorMessage}, duration=${duration}ms`,
        );
      }

      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    const claudePath = this.configLib.get<string>(
      'brain.claudeCodePath',
      'claude',
    );

    try {
      const result = await this.processManager.spawn({
        command: claudePath,
        args: ['--version'],
        timeoutMs: 5000,
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }
}
