import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClaudeCodeProvider } from './providers/claude-code.provider';
import {
  CostRecord,
  CostRecordType,
} from '../cost-tracking/entities/cost-record.entity';
import {
  BrainRequest,
  BrainResponse,
} from './interfaces/brain-provider.interface';

@Injectable()
export class BrainProviderService {
  private readonly logger = new Logger(BrainProviderService.name);

  constructor(
    private readonly claudeProvider: ClaudeCodeProvider,
    @InjectRepository(CostRecord)
    private readonly costRecordRepo: Repository<CostRecord>,
  ) {}

  /**
   * Execute brain provider with automatic cost tracking
   */
  async executeWithTracking(
    request: BrainRequest,
    context: {
      organizationId: string;
      hollonId?: string;
      taskId?: string;
    },
  ): Promise<BrainResponse> {
    this.logger.log(
      `Executing brain with tracking: org=${context.organizationId}, ` +
        `hollon=${context.hollonId}, task=${context.taskId}`,
    );

    try {
      // Execute brain provider
      const result = await this.claudeProvider.execute(request);

      // Track cost in database
      await this.costRecordRepo.save({
        organizationId: context.organizationId,
        hollonId: context.hollonId,
        taskId: context.taskId,
        type: CostRecordType.BRAIN_EXECUTION,
        providerId: 'claude_code',
        modelUsed: 'claude-sonnet-4-5',
        inputTokens: result.cost.inputTokens,
        outputTokens: result.cost.outputTokens,
        costCents: result.cost.totalCostCents,
        executionTimeMs: result.duration,
        metadata: JSON.stringify({
          prompt_length: request.prompt.length,
          system_prompt_length: request.systemPrompt?.length || 0,
          working_directory: request.context?.workingDirectory,
          has_metadata: !!result.metadata,
        }),
      });

      this.logger.log(
        `Cost tracked: $${result.cost.totalCostCents.toFixed(4)}, ` +
          `tokens=${result.cost.inputTokens}+${result.cost.outputTokens}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Brain execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Check health of brain provider
   */
  async healthCheck(): Promise<{ status: string; available: boolean }> {
    const available = await this.claudeProvider.healthCheck();
    return {
      status: available ? 'ok' : 'error',
      available,
    };
  }
}
