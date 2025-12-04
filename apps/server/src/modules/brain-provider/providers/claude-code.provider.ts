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

  constructor(
    private readonly processManager: ProcessManagerService,
    private readonly costCalculator: CostCalculatorService,
    private readonly responseParser: ResponseParserService,
    private readonly configService: BrainProviderConfigService,
    private readonly configLib: ConfigService,
  ) {}

  async execute(request: BrainRequest): Promise<BrainResponse> {
    const startTime = Date.now();

    // Get configuration
    const config = await this.configService.getDefaultConfig();
    const claudePath = this.configLib.get<string>(
      'brain.claudeCodePath',
      'claude',
    );
    const timeoutMs =
      request.options?.timeoutMs || config.timeoutSeconds * 1000;

    // Build command arguments
    const args = ['--print', '--output-format', 'text'];
    if (request.systemPrompt) {
      args.push('--system-prompt', request.systemPrompt);
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
      `Executing Claude Code: timeout=${timeoutMs}ms, ` +
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
        throw new BrainExecutionError(
          `Claude Code exited with code ${processResult.exitCode}`,
          processResult.stderr,
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
        `Claude Code execution completed: duration=${duration}ms, ` +
          `output_length=${parsed.output.length}`,
      );

      return {
        success: true,
        output: parsed.output,
        duration: processResult.duration,
        cost: estimatedCost,
        metadata: parsed.metadata,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Claude Code execution failed: ${error instanceof Error ? error.message : 'Unknown error'}, duration=${duration}ms`,
      );
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
