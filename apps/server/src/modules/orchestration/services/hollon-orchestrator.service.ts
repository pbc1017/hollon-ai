import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import {
  Document,
  DocumentType,
} from '../../document/entities/document.entity';
import { BrainProviderService } from '../../brain-provider/brain-provider.service';
import { PromptComposerService } from './prompt-composer.service';
import { TaskPoolService } from './task-pool.service';
import { Task } from '../../task/entities/task.entity';
import { QualityGateService } from './quality-gate.service';
import { Organization } from '../../organization/entities/organization.entity';
import { EscalationService, EscalationLevel } from './escalation.service';

export interface ExecutionCycleResult {
  success: boolean;
  taskId?: string;
  taskTitle?: string;
  duration: number;
  output?: string;
  error?: string;
  noTaskAvailable?: boolean;
}

/**
 * HollonOrchestratorService
 *
 * Main execution cycle orchestrator:
 * 1. Pull next task from task pool
 * 2. Compose prompt using 6-layer composition
 * 3. Execute brain provider (Claude Code)
 * 4. Create result document
 * 5. Update task status
 * 6. Handle errors and state transitions
 */
@Injectable()
export class HollonOrchestratorService {
  private readonly logger = new Logger(HollonOrchestratorService.name);

  constructor(
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
    private readonly brainProvider: BrainProviderService,
    private readonly promptComposer: PromptComposerService,
    private readonly taskPool: TaskPoolService,
    private readonly qualityGate: QualityGateService,
    private readonly escalationService: EscalationService,
  ) {}

  /**
   * Run one execution cycle for a hollon
   *
   * This is the core autonomous execution loop:
   * - Hollon pulls a task
   * - Executes it using brain provider
   * - Saves results and updates status
   */
  async runCycle(hollonId: string): Promise<ExecutionCycleResult> {
    const startTime = Date.now();
    let currentTask: Task | null = null; // Track current task for error handling

    this.logger.log(`Starting execution cycle for hollon: ${hollonId}`);

    try {
      // 1. Check hollon status and update to WORKING
      const hollon = await this.hollonRepo.findOne({
        where: { id: hollonId },
      });

      if (!hollon) {
        throw new Error(`Hollon not found: ${hollonId}`);
      }

      if (hollon.status === HollonStatus.PAUSED) {
        this.logger.log(`Hollon ${hollonId} is paused, skipping cycle`);
        return {
          success: false,
          duration: Date.now() - startTime,
          error: 'Hollon is paused',
        };
      }

      // Update status to WORKING
      await this.updateHollonStatus(hollonId, HollonStatus.WORKING);

      // 2. Pull next task
      const pullResult = await this.taskPool.pullNextTask(hollonId);

      if (!pullResult.task) {
        this.logger.log(
          `No task available for ${hollonId}: ${pullResult.reason}`,
        );
        await this.updateHollonStatus(hollonId, HollonStatus.IDLE);
        return {
          success: true,
          duration: Date.now() - startTime,
          noTaskAvailable: true,
        };
      }

      const task = pullResult.task;
      currentTask = task; // Store for error handling
      this.logger.log(
        `Hollon ${hollonId} pulled task ${task.id}: ${task.title} (${pullResult.reason})`,
      );

      // 2.5. Phase 3.7: Check task complexity and create Sub-Hollons if needed
      const isComplex = await this.isTaskComplex(task, hollon);
      if (isComplex && hollon.depth === 0) {
        // Only permanent hollons (depth=0) can create sub-hollons
        this.logger.log(
          `Task ${task.id} is complex - considering Sub-Hollon delegation`,
        );
        const delegated = await this.handleComplexTask(task, hollon);
        if (delegated) {
          // Task was delegated to Sub-Hollons
          await this.updateHollonStatus(hollonId, HollonStatus.IDLE);
          return {
            success: true,
            taskId: task.id,
            taskTitle: task.title,
            duration: Date.now() - startTime,
            output: 'Task delegated to Sub-Hollons',
          };
        }
      }

      // 3. Compose prompt
      const composedPrompt = await this.promptComposer.composePrompt(
        hollonId,
        task.id,
      );

      this.logger.log(`Prompt composed: ${composedPrompt.totalTokens} tokens`);

      // 4. Execute brain provider
      const brainResult = await this.brainProvider.executeWithTracking(
        {
          prompt: composedPrompt.userPrompt,
          systemPrompt: composedPrompt.systemPrompt,
          context: {
            workingDirectory: task.project?.workingDirectory,
          },
        },
        {
          organizationId: hollon.organizationId,
          hollonId: hollon.id,
          taskId: task.id,
        },
      );

      if (!brainResult.success) {
        throw new Error(
          `Brain execution failed: ${brainResult.output || 'Unknown error'}`,
        );
      }

      this.logger.log(
        `Brain execution completed: ${brainResult.duration}ms, ` +
          `cost=$${brainResult.cost.totalCostCents.toFixed(4)}`,
      );

      // 4.5. Run quality gate validation
      const organization = await this.organizationRepo.findOne({
        where: { id: hollon.organizationId },
      });

      const costLimitDailyCents = organization?.settings
        ?.costLimitDailyCents as number | undefined;

      const validationResult = await this.qualityGate.validateResult({
        task,
        brainResult,
        organizationId: hollon.organizationId,
        costLimitDailyCents,
      });

      if (!validationResult.passed) {
        this.logger.warn(
          `Quality gate failed for task ${task.id}: ${validationResult.reason}`,
        );

        // If quality gate suggests retry, throw error to trigger retry logic
        if (validationResult.shouldRetry) {
          throw new Error(
            `Quality gate validation failed: ${validationResult.reason}`,
          );
        } else {
          // If no retry suggested, mark task as failed
          await this.taskPool.failTask(
            task.id,
            `Quality gate failed: ${validationResult.reason}`,
          );

          return {
            success: false,
            duration: Date.now() - startTime,
            error: `Quality gate failed: ${validationResult.reason}`,
          };
        }
      }

      this.logger.log(`Quality gate passed for task ${task.id}`);

      // 5. Save result as document
      await this.saveResultDocument(
        task,
        hollon,
        brainResult.output,
        composedPrompt,
      );

      // 6. Complete task
      await this.taskPool.completeTask(task.id);

      // 7. Update hollon status back to IDLE
      await this.updateHollonStatus(hollonId, HollonStatus.IDLE);

      const duration = Date.now() - startTime;
      this.logger.log(
        `Execution cycle completed for ${hollonId}: ` +
          `task=${task.id}, duration=${duration}ms`,
      );

      return {
        success: true,
        taskId: task.id,
        taskTitle: task.title,
        duration,
        output: brainResult.output,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Execution cycle failed for ${hollonId}: ${errorMessage}`,
      );

      // If we have a current task, handle the failure with escalation
      if (currentTask) {
        // Mark task as failed
        await this.taskPool.failTask(currentTask.id, errorMessage);

        // Trigger escalation for automatic retry
        try {
          await this.escalationService.escalate({
            taskId: currentTask.id,
            hollonId: hollonId,
            reason: errorMessage,
            level: EscalationLevel.SELF_RESOLVE,
          });
          this.logger.log(
            `Escalation triggered for task ${currentTask.id} at SELF_RESOLVE level`,
          );
        } catch (escalationError) {
          this.logger.error(
            `Escalation failed for task ${currentTask.id}: ${escalationError}`,
          );
        }
      }

      // Set hollon to IDLE (not ERROR) to allow it to pick up new tasks
      // ERROR state is reserved for unrecoverable situations
      await this.updateHollonStatus(hollonId, HollonStatus.IDLE);

      return {
        success: false,
        taskId: currentTask?.id,
        taskTitle: currentTask?.title,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Update hollon status
   */
  private async updateHollonStatus(
    hollonId: string,
    status: HollonStatus,
  ): Promise<void> {
    await this.hollonRepo.update({ id: hollonId }, { status });
    this.logger.debug(`Hollon ${hollonId} status updated to ${status}`);
  }

  /**
   * Save execution result as document for future reference
   */
  private async saveResultDocument(
    task: Task,
    hollon: Hollon,
    output: string,
    composedPrompt: any,
  ): Promise<void> {
    const document = this.documentRepo.create({
      title: `Result: ${task.title}`,
      content: `# Task: ${task.title}

## Description
${task.description}

## Executed By
Hollon: ${hollon.name}

## Result
${output}

---

## Prompt Used (for debugging)
### System Prompt
${composedPrompt.systemPrompt.substring(0, 500)}...

### User Prompt
${composedPrompt.userPrompt.substring(0, 500)}...
`,
      type: DocumentType.TASK_CONTEXT,
      organizationId: hollon.organizationId,
      projectId: task.projectId,
      hollonId: hollon.id,
      taskId: task.id,
      tags: ['result', 'execution', hollon.name],
      metadata: {
        taskId: task.id,
        hollonId: hollon.id,
        completedAt: new Date().toISOString(),
        promptTokens: composedPrompt.totalTokens,
      },
    });

    await this.documentRepo.save(document);

    this.logger.log(
      `Result document saved: ${document.id} for task ${task.id}`,
    );
  }

  /**
   * Get hollon current status and activity
   */
  async getHollonActivity(hollonId: string): Promise<{
    status: HollonStatus;
    currentTask?: {
      id: string;
      title: string;
      startedAt: Date;
    };
    recentTasks: Array<{
      id: string;
      title: string;
      completedAt: Date;
    }>;
  }> {
    const hollon = await this.hollonRepo.findOne({
      where: { id: hollonId },
      relations: ['assignedTasks'],
    });

    if (!hollon) {
      throw new Error(`Hollon not found: ${hollonId}`);
    }

    // Get current task (if any)
    const currentTask = hollon.assignedTasks?.find(
      (task) => task.status === 'in_progress',
    );

    // Get recent completed tasks
    const recentTasks = hollon.assignedTasks
      ?.filter((task) => task.status === 'completed' && task.completedAt)
      .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())
      .slice(0, 5)
      .map((task) => ({
        id: task.id,
        title: task.title,
        completedAt: task.completedAt!,
      }));

    return {
      status: hollon.status,
      currentTask: currentTask
        ? {
            id: currentTask.id,
            title: currentTask.title,
            startedAt: currentTask.startedAt!,
          }
        : undefined,
      recentTasks: recentTasks || [],
    };
  }

  /**
   * Phase 3.7: Check if task is complex enough to warrant Sub-Hollon delegation
   *
   * Complexity criteria:
   * - estimatedComplexity === 'high'
   * - Dependencies > 3
   * - Required skills > 2
   * - Story points > 8
   */
  private async isTaskComplex(task: Task, _hollon: Hollon): Promise<boolean> {
    // Criteria 1: Explicit high complexity
    if (task.estimatedComplexity === 'high') {
      return true;
    }

    // Criteria 2: Many dependencies (load if not already loaded)
    const taskWithDeps = await this.hollonRepo.manager.findOne(Task, {
      where: { id: task.id },
      relations: ['dependencies'],
    });

    if (taskWithDeps && taskWithDeps.dependencies?.length > 3) {
      return true;
    }

    // Criteria 3: Multiple required skills
    if (task.requiredSkills && task.requiredSkills.length > 2) {
      return true;
    }

    // Criteria 4: High story points
    if (task.storyPoints && task.storyPoints > 8) {
      return true;
    }

    return false;
  }

  /**
   * Phase 3.7: Handle complex task by creating Sub-Hollons
   *
   * Note: For Phase 3.7, we detect complex tasks but delegate to existing
   * subtask creation mechanism. Full Sub-Hollon specialization (Planner/Analyzer/Coder)
   * will be implemented in a future phase.
   *
   * Returns true if task was successfully delegated
   */
  private async handleComplexTask(
    task: Task,
    _parentHollon: Hollon,
  ): Promise<boolean> {
    try {
      this.logger.log(
        `Complex task detected: ${task.id}. Task will use enhanced analysis.`,
      );

      // Phase 3.7: For now, we log complex tasks and fall back to direct execution
      // In a future phase, we will:
      // 1. Create specialized Sub-Hollons (Planner, Analyzer, Coder)
      // 2. Decompose the task using Brain Provider
      // 3. Create subtasks with SubtaskCreationService
      // 4. Assign subtasks to Sub-Hollons

      // For now, execute directly but with enhanced logging
      this.logger.log(
        `Task ${task.id} marked as complex. Executing with enhanced context.`,
      );

      return false; // Execute directly for now
    } catch (error) {
      this.logger.error(
        `Error handling complex task ${task.id}: ${error}. Falling back to direct execution.`,
      );
      return false;
    }
  }
}
