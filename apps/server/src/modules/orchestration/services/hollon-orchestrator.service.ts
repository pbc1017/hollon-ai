import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Hollon,
  HollonStatus,
  HollonLifecycle,
} from '../../hollon/entities/hollon.entity';
import {
  Document,
  DocumentType,
} from '../../document/entities/document.entity';
import { BrainProviderService } from '../../brain-provider/brain-provider.service';
import { PromptComposerService } from './prompt-composer.service';
import { TaskPoolService } from './task-pool.service';
import { Task, TaskType, TaskStatus } from '../../task/entities/task.entity';
import { QualityGateService } from './quality-gate.service';
import { Organization } from '../../organization/entities/organization.entity';
import { EscalationService, EscalationLevel } from './escalation.service';
import { HollonService } from '../../hollon/hollon.service';
import { SubtaskCreationService } from './subtask-creation.service';
import { Role } from '../../role/entities/role.entity';

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
    @Inject(forwardRef(() => HollonService))
    private readonly hollonService: HollonService,
    @Inject(forwardRef(() => SubtaskCreationService))
    private readonly subtaskService: SubtaskCreationService,
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
   * Phase 3.7: Handle complex task by creating Sub-Hollons (Planner/Analyzer/Coder pattern)
   *
   * Creates specialized temporary Sub-Hollons to handle complex tasks through delegation:
   * 1. Planner → Analyzes requirements and creates implementation plan
   * 2. Analyzer → Designs architecture and identifies dependencies
   * 3. Coder → Implements the solution with tests
   *
   * Returns true if task was successfully delegated to Sub-Hollons
   */
  private async handleComplexTask(
    task: Task,
    parentHollon: Hollon,
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Handling complex task ${task.id}: ${task.title} with Sub-Hollon delegation`,
      );

      // 1. Find or create specialized roles (Planner, Analyzer, Coder)
      const plannerRole = await this.findOrCreateRole(
        'Planner',
        parentHollon.organizationId,
      );
      const analyzerRole = await this.findOrCreateRole(
        'Analyzer',
        parentHollon.organizationId,
      );
      const coderRole = await this.findOrCreateRole(
        'Coder',
        parentHollon.organizationId,
      );

      // 2. Create temporary Sub-Hollons
      const plannerHollon = await this.hollonService.createTemporary({
        name: `Planner-${task.id.substring(0, 8)}`,
        organizationId: parentHollon.organizationId,
        teamId: parentHollon.teamId || undefined,
        roleId: plannerRole.id,
        brainProviderId: parentHollon.brainProviderId || 'claude_code',
        createdBy: parentHollon.id,
      });

      const analyzerHollon = await this.hollonService.createTemporary({
        name: `Analyzer-${task.id.substring(0, 8)}`,
        organizationId: parentHollon.organizationId,
        teamId: parentHollon.teamId || undefined,
        roleId: analyzerRole.id,
        brainProviderId: parentHollon.brainProviderId || 'claude_code',
        createdBy: parentHollon.id,
      });

      const coderHollon = await this.hollonService.createTemporary({
        name: `Coder-${task.id.substring(0, 8)}`,
        organizationId: parentHollon.organizationId,
        teamId: parentHollon.teamId || undefined,
        roleId: coderRole.id,
        brainProviderId: parentHollon.brainProviderId || 'claude_code',
        createdBy: parentHollon.id,
      });

      this.logger.log(
        `Created 3 Sub-Hollons for task ${task.id}: Planner, Analyzer, Coder`,
      );

      // 3. Create subtasks for each phase
      const subtaskResult = await this.subtaskService.createSubtasks(task.id, [
        {
          title: `[Research] ${task.title}`,
          description:
            'Analyze requirements and create detailed implementation plan',
          type: TaskType.RESEARCH,
          priority: task.priority as string,
          affectedFiles: task.affectedFiles,
        },
        {
          title: `[Implementation] Phase 1 - ${task.title}`,
          description: 'Design architecture and implement core functionality',
          type: TaskType.IMPLEMENTATION,
          priority: task.priority as string,
          affectedFiles: task.affectedFiles,
        },
        {
          title: `[Review] ${task.title}`,
          description: 'Review implementation and create tests',
          type: TaskType.REVIEW,
          priority: task.priority as string,
          affectedFiles: task.affectedFiles,
        },
      ]);

      if (!subtaskResult.success || subtaskResult.createdSubtasks.length < 3) {
        throw new Error(
          `Failed to create subtasks: ${subtaskResult.errors?.join(', ')}`,
        );
      }

      this.logger.log(
        `Created ${subtaskResult.createdSubtasks.length} subtasks for task ${task.id}`,
      );

      // 4. Assign subtasks to Sub-Hollons
      const [planningTask, analysisTask, implementationTask] =
        subtaskResult.createdSubtasks;

      // Update tasks to assign them to the Sub-Hollons
      await this.hollonRepo.manager.update(
        Task,
        { id: planningTask.id },
        { assignedHollonId: plannerHollon.id, status: TaskStatus.READY },
      );
      await this.hollonRepo.manager.update(
        Task,
        { id: analysisTask.id },
        { assignedHollonId: analyzerHollon.id, status: TaskStatus.READY },
      );
      await this.hollonRepo.manager.update(
        Task,
        { id: implementationTask.id },
        { assignedHollonId: coderHollon.id, status: TaskStatus.READY },
      );

      this.logger.log(
        `Assigned subtasks to Sub-Hollons. Duration: ${Date.now() - startTime}ms`,
      );

      // Sub-Hollons will be automatically executed by HollonExecutionService
      // Temporary Hollons will be cleaned up by SubtaskCreationService after all subtasks complete

      return true; // Task delegated successfully
    } catch (error) {
      this.logger.error(
        `Error delegating complex task ${task.id}: ${error}. Falling back to direct execution.`,
      );

      // Cleanup any created Sub-Hollons
      try {
        const tempHollons = await this.hollonRepo.find({
          where: {
            createdByHollonId: parentHollon.id,
            lifecycle: HollonLifecycle.TEMPORARY,
          },
        });

        for (const hollon of tempHollons) {
          await this.hollonRepo.remove(hollon);
        }
      } catch (cleanupError) {
        this.logger.error(`Failed to cleanup Sub-Hollons: ${cleanupError}`);
      }

      return false; // Fall back to direct execution
    }
  }

  /**
   * Find or create a specialized role (Planner, Analyzer, Coder)
   *
   * These roles are used for Sub-Hollon delegation of complex tasks
   */
  private async findOrCreateRole(
    roleName: string,
    organizationId: string,
  ): Promise<Role> {
    // Try to find existing role by name and organization
    let role = await this.hollonRepo.manager.findOne(Role, {
      where: { name: roleName, organizationId },
    });

    if (!role) {
      const roleConfigs: Record<
        string,
        { systemPrompt: string; capabilities: string[] }
      > = {
        Planner: {
          systemPrompt:
            'You are a planning specialist. Analyze requirements and create detailed implementation plans.',
          capabilities: [
            'planning',
            'requirements-analysis',
            'architecture-design',
          ],
        },
        Analyzer: {
          systemPrompt:
            'You are an architecture analyst. Design system architecture and identify dependencies.',
          capabilities: [
            'architecture',
            'design-patterns',
            'dependency-analysis',
          ],
        },
        Coder: {
          systemPrompt:
            'You are an implementation specialist. Write clean, tested code following the plan.',
          capabilities: ['typescript', 'nestjs', 'testing', 'implementation'],
        },
      };

      const config = roleConfigs[roleName];
      if (!config) {
        throw new Error(`Unknown specialized role: ${roleName}`);
      }

      // Create role directly via repository
      role = this.hollonRepo.manager.create(Role, {
        name: roleName,
        organizationId,
        systemPrompt: config.systemPrompt,
        capabilities: config.capabilities,
      });

      role = await this.hollonRepo.manager.save(Role, role);

      this.logger.log(`Created specialized role: ${roleName}`);
    }

    return role;
  }
}
