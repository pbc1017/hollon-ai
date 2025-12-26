import { Controller, Post, Get, Body } from '@nestjs/common';
import { BrainProviderService } from './brain-provider.service';
import { ExecuteBrainDto } from './dto/execute-brain.dto';

@Controller('brain-provider')
export class BrainProviderController {
  constructor(private readonly brainProviderService: BrainProviderService) {}

  /**
   * Execute brain provider (for testing)
   */
  @Post('execute')
  async execute(@Body() dto: ExecuteBrainDto) {
    const result = await this.brainProviderService.executeWithTracking(
      {
        prompt: dto.prompt,
        systemPrompt: dto.systemPrompt,
        context: {
          hollonId: dto.hollonId,
          taskId: dto.taskId,
          workingDirectory: dto.workingDirectory,
        },
        options: {
          timeoutMs: dto.timeoutMs,
        },
      },
      {
        organizationId: dto.organizationId,
        hollonId: dto.hollonId,
        taskId: dto.taskId,
      },
    );

    return {
      success: result.success,
      output: result.output,
      duration: result.duration,
      cost: result.cost,
    };
  }

  /**
   * Health check
   */
  @Get('health')
  async health() {
    return this.brainProviderService.healthCheck();
  }
}
