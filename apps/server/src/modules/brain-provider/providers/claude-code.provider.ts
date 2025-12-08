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
    // Note: --print 옵션 제거 - 실제 파일 수정이 가능하도록
    const args = [
      '-p', // prompt를 stdin으로 받음
      '--output-format',
      'text',
      '--dangerously-skip-permissions',
    ];
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

    // Enhanced debug logging for ENOENT diagnosis
    this.logger.debug(`[CLAUDE DEBUG] claudePath: "${claudePath}"`);
    this.logger.debug(
      `[CLAUDE DEBUG] workingDirectory: "${request.context?.workingDirectory || 'not set'}"`,
    );
    this.logger.debug(`[CLAUDE DEBUG] args: ${JSON.stringify(args)}`);
    this.logger.debug(
      `[CLAUDE DEBUG] request.context: ${JSON.stringify(request.context)}`,
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Log detailed error information for debugging
      if (error instanceof BrainExecutionError) {
        this.logger.error(
          `Claude Code execution failed: ${errorMessage}, ` +
            `exitCode=${error.exitCode}, duration=${duration}ms`,
        );
      } else {
        this.logger.error(
          `Claude Code execution failed: ${errorMessage}, duration=${duration}ms`,
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
