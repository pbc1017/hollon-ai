import * as os from 'os';
import { Injectable, Logger, Inject } from '@nestjs/common';
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
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from '../../task/entities/task.entity';
import { EscalationService, EscalationLevel } from './escalation.service';
import { IHollonService } from '../../hollon/domain/hollon-service.interface';
import { SubtaskCreationService } from './subtask-creation.service'; // Phase 3.10: Re-added for review cycle
import { TaskExecutionService } from './task-execution.service'; // Phase 3.12/4: Worktree isolation
import { ICodeReviewPort } from '../domain/ports/code-review.port'; // ✅ DDD: Port 사용
import { TaskPullRequest } from '../../collaboration/entities/task-pull-request.entity'; // Phase 3.16
import { Role } from '../../role/entities/role.entity';
import { ComposedPrompt } from '../interfaces/prompt-context.interface';
import { TaskDecompositionResult } from '../dto/task-decomposition.dto';

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
 * Phase 3.10: Review decision interface for type safety
 */
interface ReviewDecision {
  action: 'complete' | 'rework' | 'add_tasks' | 'redirect';
  reasoning: string;
  subtaskIds?: string[];
  reworkInstructions?: string;
  newSubtasks?: unknown[];
  cancelSubtaskIds?: string[];
  newDirection?: string;
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
 *
 * ✅ DDD: HollonService, CodeReviewService 직접 의존성 제거, Port 사용
 */

@Injectable()
export class HollonOrchestratorService {
  private readonly logger = new Logger(HollonOrchestratorService.name);

  constructor(
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly brainProvider: BrainProviderService,
    private readonly promptComposer: PromptComposerService,
    private readonly taskPool: TaskPoolService,
    private readonly escalationService: EscalationService,
    @Inject('IHollonService')
    private readonly hollonService: IHollonService,
    private readonly subtaskService: SubtaskCreationService, // Phase 3.10: Re-added
    private readonly taskExecutionService: TaskExecutionService, // Phase 3.12/4: Worktree isolation
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>, // Phase 3.16
    @Inject('ICodeReviewPort')
    private readonly codeReviewPort: ICodeReviewPort, // ✅ DDD: Port 사용
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>, // Phase 3.16
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
        relations: ['organization', 'team', 'role'],
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

      // 2.3. Phase 3.10: Check if task is in review mode
      if (task.status === TaskStatus.IN_REVIEW) {
        this.logger.log(`Task ${task.id} is IN_REVIEW - entering review mode`);
        const reviewResult = await this.handleReviewMode(task, hollon);
        await this.updateHollonStatus(hollonId, HollonStatus.IDLE);
        return reviewResult;
      }

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

      // 3. Phase 3.12/4: Execute task with worktree isolation, CI checks, and PR creation
      this.logger.log(
        `Executing task ${task.id} with worktree isolation and CI checks`,
      );

      const executionResult = await this.taskExecutionService.executeTask(
        task.id,
        hollonId,
      );

      this.logger.log(
        `Task execution completed: PR created at ${executionResult.prUrl}`,
      );

      // Note: TaskExecutionService already:
      // - Creates worktree for complete isolation
      // - Creates branch for the hollon
      // - Executes brain provider in the worktree
      // - Creates PR with changes
      // - Waits for CI checks to pass
      // - Requests code review
      // - Sets task to READY_FOR_REVIEW
      //
      // The task will be picked up by a reviewer hollon later

      // 7. Update hollon status back to IDLE
      await this.updateHollonStatus(hollonId, HollonStatus.IDLE);

      const duration = Date.now() - startTime;
      this.logger.log(
        `Execution cycle completed for ${hollonId}: ` +
          `task=${task.id}, duration=${duration}ms, PR=${executionResult.prUrl}`,
      );

      return {
        success: true,
        taskId: task.id,
        taskTitle: task.title,
        duration,
        output: `Task executed with worktree isolation. PR: ${executionResult.prUrl}`,
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

      // Phase 1: Check if hollon is temporary and delete it on failure
      // Fetch hollon to check lifecycle
      const hollonForCleanup = await this.hollonRepo.findOne({
        where: { id: hollonId },
      });

      if (hollonForCleanup?.lifecycle === HollonLifecycle.TEMPORARY) {
        this.logger.log(
          `Deleting temporary hollon ${hollonForCleanup.name} (${hollonId.slice(0, 8)}) after task failure`,
        );

        try {
          await this.hollonService.deleteTemporary(hollonId);
          this.logger.log(
            `Successfully deleted temporary hollon ${hollonForCleanup.name} - team slot freed`,
          );
        } catch (deleteError) {
          this.logger.error(
            `Failed to delete temporary hollon ${hollonId}: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`,
          );
          // Continue execution even if deletion fails
        }
      } else if (hollonForCleanup) {
        // Set permanent hollon to IDLE (not ERROR) to allow it to pick up new tasks
        // ERROR state is reserved for unrecoverable situations
        await this.updateHollonStatus(hollonId, HollonStatus.IDLE);
      }

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
   * @deprecated No longer used - TaskExecutionService handles result storage via PR and code review
   */
  // @ts-expect-error - Kept for reference, not used in new flow
  private async saveResultDocument(
    task: Task,
    hollon: Hollon,
    output: string,
    composedPrompt: ComposedPrompt,
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
    // Criteria 0: Team Epic tasks always require decomposition (Phase 3.8+)
    if (task.type === 'team_epic') {
      return true;
    }

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
   * Phase 3.7: Handle complex task by DYNAMIC Sub-Hollon delegation
   *
   * Asks Brain Provider (Claude) to decompose the task into optimal subtasks
   * with dynamic role assignment and dependency management.
   *
   * Flow:
   * 1. Query available roles for temporary hollons
   * 2. Ask Brain Provider to decompose task → JSON response
   * 3. Parse subtask specs (with dependencies)
   * 4. Create temporary Sub-Hollons dynamically
   * 5. Create subtasks with dependency relationships
   * 6. Set BLOCKED status for dependent tasks, READY for independent tasks
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
        `[Dynamic Delegation] Handling complex task ${task.id}: ${task.title}`,
      );

      // 1. Query roles available for temporary hollon creation
      const availableRoles = await this.hollonRepo.manager
        .getRepository(Role)
        .find({
          where: {
            organizationId: parentHollon.organizationId,
            availableForTemporaryHollon: true,
          },
        });

      if (availableRoles.length === 0) {
        this.logger.warn(
          'No roles available for temporary hollons - falling back to direct execution',
        );
        return false; // Fallback to parent hollon executing directly
      }

      this.logger.log(
        `Found ${availableRoles.length} available roles: ${availableRoles.map((r) => r.name).join(', ')}`,
      );

      // 2. Ask Brain Provider to decompose task
      const decompositionPrompt =
        await this.promptComposer.composeTaskDecompositionPrompt(
          task,
          availableRoles,
        );

      const brainResult = await this.brainProvider.executeWithTracking(
        {
          prompt: decompositionPrompt,
          systemPrompt:
            'You are a task decomposition expert. Return ONLY valid JSON with no markdown formatting.',
          context: {
            // Phase 4.1 Fix #10: Use temp directory for decomposition
            // to prevent file modifications. Decomposition should only return JSON.
            workingDirectory: os.tmpdir(),
          },
          options: {
            // Phase 4.1 Fix #10: Disable file system tools for decomposition
            disallowedTools: ['Write', 'Edit', 'Bash', 'MultiEdit'],
          },
        },
        {
          organizationId: parentHollon.organizationId,
          hollonId: parentHollon.id,
          taskId: task.id,
        },
      );

      if (!brainResult.success) {
        throw new Error(
          `Brain decomposition failed: ${brainResult.output || 'Unknown error'}`,
        );
      }

      // 3. Parse JSON response
      const decomposition = this.parseDecompositionResult(brainResult.output);

      if (!decomposition.subtasks || decomposition.subtasks.length === 0) {
        throw new Error('Brain returned empty subtask list');
      }

      this.logger.log(
        `Brain decomposed into ${decomposition.subtasks.length} subtasks`,
      );
      if (decomposition.reasoning) {
        this.logger.log(`Reasoning: ${decomposition.reasoning}`);
      }

      // 4. Create Sub-Hollons and subtasks dynamically
      const subtaskMap = new Map<string, Task>(); // title → Task entity

      for (const subtaskSpec of decomposition.subtasks) {
        // 4.1 Find role
        let role = availableRoles.find((r) => r.id === subtaskSpec.roleId);
        if (!role) {
          // Fix #21-B: Fallback to parent hollon's role instead of skipping
          this.logger.warn(
            `Role ${subtaskSpec.roleId} not found - using parent hollon's role as fallback for subtask "${subtaskSpec.title}"`,
          );

          // Use parent hollon's role as fallback
          role = await this.roleRepo.findOne({
            where: { id: parentHollon.roleId },
          });

          if (!role) {
            // Last resort: try to find any available role
            role = availableRoles[0];
            this.logger.warn(
              `Parent role also not found - using first available role ${role?.name} for subtask "${subtaskSpec.title}"`,
            );
          }

          if (!role) {
            // Absolutely no roles available - skip this subtask
            this.logger.error(
              `No roles available at all - skipping subtask "${subtaskSpec.title}"`,
            );
            continue;
          }
        }

        // 4.2 Create temporary Sub-Hollon
        // ✅ DDD: createTemporaryHollon 사용 (Port 인터페이스)
        const subHollon = await this.hollonService.createTemporaryHollon({
          name: `${role.name}-${task.id.substring(0, 8)}`,
          organizationId: parentHollon.organizationId,
          teamId: parentHollon.teamId || undefined,
          roleId: role.id,
          brainProviderId: parentHollon.brainProviderId || 'claude_code',
          createdBy: parentHollon.id,
        });

        // 4.3 Resolve dependencies (by title lookup)
        const dependencyTasks = subtaskSpec.dependencies
          .map((depTitle) => subtaskMap.get(depTitle))
          .filter((t) => t != null) as Task[];

        // 4.4 Determine initial status
        const hasUnresolvedDeps = dependencyTasks.length > 0;
        const initialStatus = hasUnresolvedDeps
          ? TaskStatus.BLOCKED
          : TaskStatus.READY;

        // 4.5 Create subtask entity
        const subtask = new Task();
        subtask.organizationId = parentHollon.organizationId;
        subtask.projectId = task.projectId;
        subtask.parentTaskId = task.id;
        subtask.assignedHollonId = subHollon.id;
        subtask.title = subtaskSpec.title;
        subtask.description = subtaskSpec.description;
        subtask.type = subtaskSpec.type as TaskType;
        subtask.priority =
          (subtaskSpec.priority as TaskPriority) || task.priority;
        subtask.status = initialStatus;
        subtask.depth = (task.depth || 0) + 1;
        subtask.creatorHollonId = parentHollon.id;
        subtask.affectedFiles = subtaskSpec.affectedFiles || [];
        subtask.estimatedComplexity = 'low'; // Subtasks are granular

        // Save without dependencies first
        const savedSubtask = await this.hollonRepo.manager.save(subtask);

        // 4.6 Set dependencies (many-to-many)
        if (dependencyTasks.length > 0) {
          savedSubtask.dependencies = dependencyTasks;
          await this.hollonRepo.manager.save(Task, savedSubtask);
        }

        // 4.7 Store in map for future dependency resolution
        subtaskMap.set(subtaskSpec.title, savedSubtask);

        this.logger.log(
          `Created subtask "${savedSubtask.title}" → ${role.name} (${subHollon.id.substring(0, 8)}) [${initialStatus}] deps: ${dependencyTasks.length}`,
        );
      }

      const totalCreated = subtaskMap.size;
      this.logger.log(
        `Successfully delegated task ${task.id} to ${totalCreated} Sub-Hollons. Duration: ${Date.now() - startTime}ms`,
      );

      // SSOT: Update parent task status to IN_PROGRESS
      // This prevents the parent hollon from pulling the same task again
      await this.hollonRepo.manager.getRepository(Task).update(task.id, {
        status: TaskStatus.IN_PROGRESS,
      });
      this.logger.log(
        `Parent task ${task.id} status updated: READY → IN_PROGRESS`,
      );

      // Sub-Hollons will be automatically executed by HollonExecutionService
      // BLOCKED tasks will auto-unblock when dependencies complete
      // Temporary Hollons will be cleaned up after all subtasks complete

      return true; // Task delegated successfully
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Phase 1.5: Check if error is due to hollon limit
      if (errorMessage.includes('maximum hollon limit')) {
        this.logger.log(
          `Task ${task.id} waiting for hollon slot - setting status to WAITING_FOR_HOLLON`,
        );

        // Set task to WAITING_FOR_HOLLON status
        await this.hollonRepo.manager.getRepository(Task).update(task.id, {
          status: TaskStatus.WAITING_FOR_HOLLON,
        });

        // Cleanup any partially created Sub-Hollons
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

          if (tempHollons.length > 0) {
            this.logger.log(
              `Cleaned up ${tempHollons.length} partially created temporary hollons`,
            );
          }
        } catch (cleanupError) {
          this.logger.error(`Failed to cleanup Sub-Hollons: ${cleanupError}`);
        }

        return true; // Task is now waiting, not falling back to direct execution
      }

      // Other errors: fall back to direct execution
      this.logger.error(
        `Error delegating complex task ${task.id}: ${errorMessage}. Falling back to direct execution.`,
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
   * Parse Brain Provider's decomposition result (JSON)
   *
   * Extracts JSON from response (handles markdown code blocks)
   * and validates structure.
   */
  private parseDecompositionResult(output: string): TaskDecompositionResult {
    try {
      // Remove markdown code blocks if present
      let jsonStr = output.trim();

      // Try to extract JSON from markdown
      const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Also try to find standalone JSON object
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch && !jsonMatch) {
        jsonStr = objectMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      // Validate structure
      if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) {
        throw new Error('Invalid decomposition: missing subtasks array');
      }

      return parsed;
    } catch (error) {
      this.logger.error(`Failed to parse decomposition JSON: ${error}`);
      this.logger.error(`Raw output: ${output.substring(0, 500)}...`);
      throw new Error(`JSON parsing failed: ${error}`);
    }
  }

  /**
   * Find or create a specialized role (Planner, Analyzer, Coder)
   *
   * These roles are used for Sub-Hollon delegation of complex tasks
   */
  // @ts-expect-error - Reserved for future use

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

  /**
   * Phase 3.10: Handle review mode
   *
   * LLM reviews subtask results and decides next action:
   * - complete: All done, mark task as completed
   * - rework: Send specific subtasks back for improvements
   * - add_tasks: Create additional subtasks
   * - redirect: Cancel and re-delegate with new approach
   */
  private async handleReviewMode(
    task: Task,
    hollon: Hollon,
  ): Promise<ExecutionCycleResult> {
    const startTime = Date.now();

    try {
      // 1. Compose review prompt (PromptComposer handles this automatically)
      const composedPrompt = await this.promptComposer.composePrompt(
        hollon.id,
        task.id,
      );

      this.logger.log(
        `Review mode prompt composed: ${composedPrompt.totalTokens} tokens`,
      );

      // 2. Execute LLM
      const brainResult = await this.brainProvider.executeWithTracking(
        {
          prompt: composedPrompt.userPrompt,
          systemPrompt: composedPrompt.systemPrompt,
          context: {
            // Phase 4.1 Fix #10: Use temp directory for review mode
            // to prevent file modifications. Review should only return JSON decision.
            workingDirectory: os.tmpdir(),
          },
          options: {
            // Phase 4.1 Fix #10: Disable file system tools for review mode
            disallowedTools: ['Write', 'Edit', 'Bash', 'MultiEdit'],
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
          `Review mode brain execution failed: ${brainResult.output}`,
        );
      }

      // 3. Parse LLM decision
      const decision = this.parseLLMReviewDecision(brainResult.output);

      this.logger.log(
        `LLM review decision: ${decision.action} - ${decision.reasoning}`,
      );

      // 4. Execute decision
      switch (decision.action) {
        case 'complete':
          await this.subtaskService.completeParentTaskByLLM(task.id);
          return {
            success: true,
            taskId: task.id,
            taskTitle: task.title,
            duration: Date.now() - startTime,
            output: `✅ Task completed after review: ${decision.reasoning}`,
          };

        case 'rework':
          await this.requestRework(task, decision);
          return {
            success: true,
            taskId: task.id,
            taskTitle: task.title,
            duration: Date.now() - startTime,
            output: `🔄 Rework requested: ${decision.reasoning}`,
          };

        case 'add_tasks':
          await this.addFollowUpTasks(task, decision);
          return {
            success: true,
            taskId: task.id,
            taskTitle: task.title,
            duration: Date.now() - startTime,
            output: `➕ Added ${decision.newSubtasks?.length || 0} follow-up tasks: ${decision.reasoning}`,
          };

        case 'redirect':
          await this.redirectTask(task, decision);
          return {
            success: true,
            taskId: task.id,
            taskTitle: task.title,
            duration: Date.now() - startTime,
            output: `🔀 Task redirected: ${decision.reasoning}`,
          };

        default:
          throw new Error(`Unknown review action: ${decision.action}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Review mode failed for task ${task.id}: ${errorMessage}`,
      );
      return {
        success: false,
        taskId: task.id,
        taskTitle: task.title,
        duration: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Phase 3.10: Parse LLM review decision from JSON output
   */
  private parseLLMReviewDecision(output: string): ReviewDecision {
    try {
      // Extract JSON block from markdown
      const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('No JSON block found in LLM output');
      }

      const decision = JSON.parse(jsonMatch[1]);

      if (!decision.action || !decision.reasoning) {
        throw new Error('Missing required fields: action, reasoning');
      }

      return decision;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to parse LLM review decision: ${errorMessage}`);
      this.logger.error(`LLM output: ${output}`);
      throw new Error(`Invalid LLM review decision format: ${errorMessage}`);
    }
  }

  /**
   * Phase 3.10: Request rework for specific subtasks
   */
  private async requestRework(
    task: Task,
    decision: ReviewDecision,
  ): Promise<void> {
    const { subtaskIds, reworkInstructions } = decision;

    if (!subtaskIds || subtaskIds.length === 0) {
      throw new Error('subtaskIds is required for rework action');
    }

    const taskRepo = this.hollonRepo.manager.getRepository(Task);

    for (const subtaskId of subtaskIds) {
      await taskRepo.update(subtaskId, {
        status: TaskStatus.READY,
        description: reworkInstructions, // Update with rework instructions
        retryCount: () => 'retry_count + 1',
      });

      this.logger.log(
        `Subtask ${subtaskId} marked for rework: ${reworkInstructions}`,
      );
    }

    // Parent task stays IN_PROGRESS (waiting for reworked subtasks)
    await taskRepo.update(task.id, {
      status: TaskStatus.IN_PROGRESS,
    });
  }

  /**
   * Phase 3.10: Add follow-up subtasks
   */
  private async addFollowUpTasks(
    task: Task,
    decision: ReviewDecision,
  ): Promise<void> {
    const { newSubtasks } = decision;

    if (!newSubtasks || newSubtasks.length === 0) {
      throw new Error('newSubtasks is required for add_tasks action');
    }

    await this.subtaskService.createSubtasks(task.id, newSubtasks as any[]);

    // Parent task stays IN_PROGRESS (waiting for new subtasks)
    const taskRepo = this.hollonRepo.manager.getRepository(Task);
    await taskRepo.update(task.id, {
      status: TaskStatus.IN_PROGRESS,
    });

    this.logger.log(
      `Added ${newSubtasks.length} follow-up subtasks to task ${task.id}`,
    );
  }

  /**
   * Phase 3.10: Redirect task with new approach
   */
  private async redirectTask(
    task: Task,
    decision: ReviewDecision,
  ): Promise<void> {
    const { cancelSubtaskIds, newDirection } = decision;

    if (!cancelSubtaskIds || cancelSubtaskIds.length === 0) {
      throw new Error('cancelSubtaskIds is required for redirect action');
    }

    const taskRepo = this.hollonRepo.manager.getRepository(Task);

    // Cancel existing subtasks
    for (const subtaskId of cancelSubtaskIds) {
      await taskRepo.update(subtaskId, {
        status: TaskStatus.CANCELLED,
      });
    }

    // Re-delegate with new approach (using handleComplexTask)
    const hollon = await this.hollonRepo.findOne({
      where: { id: task.assignedHollonId! },
      relations: ['organization', 'team', 'role'],
    });

    if (hollon) {
      // Update task description with new direction
      await taskRepo.update(task.id, {
        description: `${task.description}\n\n**New Direction**: ${newDirection}`,
        status: TaskStatus.READY, // Reset to READY for re-delegation
      });

      await this.handleComplexTask(task, hollon);
    }

    this.logger.log(
      `Task ${task.id} redirected: cancelled ${cancelSubtaskIds.length} subtasks, new direction: ${newDirection}`,
    );
  }

  /**
   * Phase 3.16: Manager Review Cycle
   * Manager hollon checks for READY_FOR_REVIEW subtasks and orchestrates review
   * Called periodically by GoalAutomationListener
   */
  async handleManagerReviewCycle(managerHollon: Hollon): Promise<void> {
    this.logger.debug(
      `Manager ${managerHollon.name} checking for subtasks to review`,
    );

    // 1. Find subtasks with status=READY_FOR_REVIEW where reviewerHollonId=managerHollon.id
    const subtasksToReview = await this.taskRepo
      .createQueryBuilder('task')
      .where('task.status = :status', { status: TaskStatus.READY_FOR_REVIEW })
      .andWhere('task.reviewerHollonId = :reviewerId', {
        reviewerId: managerHollon.id,
      })
      .leftJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('project.organization', 'organization')
      .getMany();

    if (subtasksToReview.length === 0) {
      this.logger.debug(
        `No subtasks to review for manager ${managerHollon.name}`,
      );
      return;
    }

    this.logger.log(
      `Manager ${managerHollon.name} found ${subtasksToReview.length} subtasks to review`,
    );

    // 2. For each subtask, handle review based on task type
    for (const subtask of subtasksToReview) {
      try {
        // ✅ Phase 4: team_epic tasks don't have PRs - they review child task results
        if (subtask.type === 'team_epic') {
          this.logger.log(
            `Manager ${managerHollon.name} reviewing team_epic task ${subtask.id} (checking child results)`,
          );

          // team_epic: No PR, no temporary hollon - manager reviews directly
          // Just transition to IN_REVIEW, then autoReviewTasks will trigger handleReviewMode
          await this.taskRepo.update(subtask.id, {
            status: TaskStatus.IN_REVIEW,
          });

          this.logger.log(
            `Team epic task ${subtask.id} transitioned to IN_REVIEW for manager review`,
          );
          continue;
        }

        // ✅ Phase 4: Check if implementation task has completed subtasks
        // If yes, review subtask results instead of PR
        const childTasks = await this.taskRepo.find({
          where: { parentTaskId: subtask.id },
        });

        const hasCompletedSubtasks =
          childTasks.length > 0 &&
          childTasks.every((child) => child.status === TaskStatus.COMPLETED);

        if (hasCompletedSubtasks) {
          this.logger.log(
            `Manager ${managerHollon.name} reviewing implementation task ${subtask.id} with ${childTasks.length} completed subtasks (no PR yet)`,
          );

          // Implementation with subtasks: Review subtask results like team_epic
          await this.taskRepo.update(subtask.id, {
            status: TaskStatus.IN_REVIEW,
          });

          this.logger.log(
            `Implementation task ${subtask.id} with subtasks transitioned to IN_REVIEW for manager review`,
          );
          continue;
        }

        // ✅ Implementation tasks without subtasks: Find PR and create reviewer hollon
        const prs = await this.codeReviewPort.findPullRequestsByTaskId(
          subtask.id,
        );
        const pr = prs[0]; // Get the first (most recent) PR

        if (!pr) {
          this.logger.warn(
            `No PR found for task ${subtask.id} (and no subtasks), skipping review`,
          );
          continue;
        }

        // Create temporary review hollon (reuse Phase 3.7 pattern)
        const reviewerHollon = await this.createTemporaryReviewHollon(
          managerHollon,
          subtask,
        );

        this.logger.log(
          `Manager ${managerHollon.name} created reviewer ${reviewerHollon.name} for task ${subtask.id}`,
        );

        // ✅ DDD: Request code review (Port 사용)
        await this.codeReviewPort.requestReview(pr.id, reviewerHollon.id);

        // Update task status to IN_REVIEW
        await this.taskRepo.update(subtask.id, {
          status: TaskStatus.IN_REVIEW,
        });

        this.logger.log(
          `Review requested by ${reviewerHollon.name} for PR #${pr.prNumber}`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to initiate review for task ${subtask.id}: ${errorMessage}`,
        );
        // Continue with next subtask
      }
    }
  }

  /**
   * Phase 3.16: Create temporary review hollon for code review
   * Reuses Phase 3.7 temporary hollon creation pattern
   */
  private async createTemporaryReviewHollon(
    managerHollon: Hollon,
    subtask: Task,
  ): Promise<Hollon> {
    // Get Code Reviewer role
    const reviewerRole = await this.roleRepo.findOne({
      where: { name: 'Code Reviewer' },
    });

    if (!reviewerRole) {
      throw new Error('Code Reviewer role not found');
    }

    // Create temporary reviewer hollon using existing DTO fields
    const reviewerHollon = await this.hollonService.create({
      name: `Reviewer-${subtask.id.slice(0, 8)}`,
      organizationId: subtask.organizationId,
      roleId: reviewerRole.id,
      teamId: managerHollon.teamId || undefined, // Convert null to undefined
      lifecycle: HollonLifecycle.TEMPORARY, // Use lifecycle to mark as temporary
    });

    this.logger.log(
      `Created temporary reviewer hollon ${reviewerHollon.name} for task ${subtask.id}`,
    );

    return reviewerHollon;
  }

  /**
   * Phase 3.16: Handle review result from temporary review hollon
   * Called when review is completed (approved or changes requested)
   * Manager makes strategic decision based on review outcome
   */
  async handleReviewResult(
    managerHollon: Hollon,
    pr: TaskPullRequest,
  ): Promise<void> {
    this.logger.log(
      `Manager ${managerHollon.name} handling review result for PR #${pr.prNumber}`,
    );

    const task = await this.taskRepo.findOne({
      where: { id: pr.taskId },
      relations: ['project', 'project.organization', 'assignedHollon'],
    });

    if (!task) {
      throw new Error(`Task ${pr.taskId} not found`);
    }

    // Check PR status (approved or changes_requested)
    if (!pr.status) {
      this.logger.warn(`PR #${pr.prNumber} has no status yet`);
      return;
    }

    if (pr.status === 'approved') {
      // Review approved: merge PR and complete task
      this.logger.log(
        `Review approved for task ${task.id}, proceeding to merge`,
      );

      try {
        // Phase 4: Merge PR using gh CLI
        if (process.env.NODE_ENV === 'test') {
          this.logger.debug('Skipping PR merge in test environment');
        } else {
          // Phase 4: PR merge is manual - just log for now
          this.logger.log(
            `Review approved for PR ${pr.prUrl}. Manual merge required.`,
          );

          // Note: Automatic merge is disabled for safety
          // To enable: uncomment the gh pr merge command below
          //
          // const workingDir = task.workingDirectory || task.project.workingDirectory;
          // await execAsync(`gh pr merge ${pr.prUrl} --squash --delete-branch`, { cwd: workingDir });
        }

        // Mark task as completed
        await this.taskRepo.update(task.id, {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
        });

        this.logger.log(`Task ${task.id} completed after successful review`);

        // Check if all subtasks are done, then ask LLM about parent task
        await this.checkParentTaskCompletion(task);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to merge PR: ${errorMessage}`);
        throw error;
      }
    } else if (pr.status === 'changes_requested') {
      // Changes requested: assign back to worker hollon for rework
      this.logger.log(
        `Changes requested for task ${task.id}, assigning back to worker`,
      );

      if (!task.assignedHollon) {
        this.logger.warn(
          `Task ${task.id} has no assigned hollon, cannot rework`,
        );
        return;
      }

      // Update task with review feedback
      await this.taskRepo.update(task.id, {
        status: TaskStatus.READY, // Reset to READY for rework
        description: `${task.description}\n\n**Review Feedback**:\n${pr.reviewComments || 'See PR comments for details'}`,
      });

      this.logger.log(
        `Task ${task.id} reset to READY for rework by ${task.assignedHollon.name}`,
      );

      // Worker will pick up the task in next cycle
    }

    // Cleanup temporary reviewer hollon (Phase 3.16)
    if (pr.reviewerHollonId) {
      await this.cleanupTemporaryReviewHollon(pr.reviewerHollonId);
    }
  }

  /**
   * Phase 3.16: Check if all subtasks are done, then decide on parent task
   * Uses LLM to decide: complete parent or add more tasks
   */
  private async checkParentTaskCompletion(subtask: Task): Promise<void> {
    if (!subtask.parentTaskId) {
      return; // This is a root task
    }

    const parentTask = await this.taskRepo.findOne({
      where: { id: subtask.parentTaskId },
      relations: [
        'subtasks',
        'project',
        'project.organization',
        'assignedHollon',
      ],
    });

    if (!parentTask) {
      return;
    }

    // Check if all subtasks are completed
    const allSubtasksCompleted = parentTask.subtasks.every(
      (st) => st.status === TaskStatus.COMPLETED,
    );

    if (!allSubtasksCompleted) {
      this.logger.debug(
        `Parent task ${parentTask.id} still has incomplete subtasks`,
      );
      return;
    }

    this.logger.log(
      `All subtasks completed for parent task ${parentTask.id}, asking LLM for decision`,
    );

    // Ask LLM: should we complete parent or add more tasks?
    const prompt = this.buildParentCompletionPrompt(parentTask);

    try {
      const result = await this.brainProvider.executeWithTracking(
        {
          prompt,
          context: {
            // Phase 4.1 Fix #10: Use temp directory for parent completion check
            // to prevent file modifications on main repo. This is an analysis-only
            // call that should only return JSON decision, not modify code.
            workingDirectory: os.tmpdir(),
            taskId: parentTask.id,
          },
          options: {
            // Phase 4.1 Fix #10: Disable file system tools for analysis-only calls
            disallowedTools: ['Write', 'Edit', 'Bash', 'MultiEdit'],
          },
        },
        {
          organizationId: parentTask.project.organizationId,
          hollonId: parentTask.assignedHollonId || 'system',
          taskId: parentTask.id,
        },
      );

      const decision = this.parseParentCompletionDecision(result.output);

      if (decision.action === 'complete') {
        // Complete parent task
        await this.taskRepo.update(parentTask.id, {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
        });

        this.logger.log(`Parent task ${parentTask.id} marked as completed`);

        // Recursively check grandparent
        await this.checkParentTaskCompletion(parentTask);
      } else if (decision.action === 'add_tasks') {
        // Add more subtasks
        this.logger.log(
          `Parent task ${parentTask.id} needs more subtasks: ${decision.reason}`,
        );

        // Trigger subtask creation (Phase 3.9)
        if (parentTask.assignedHollon) {
          await this.handleComplexTask(parentTask, parentTask.assignedHollon);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to get parent completion decision: ${errorMessage}`,
      );
      // Don't throw - parent task can be manually reviewed
    }
  }

  /**
   * Build prompt for parent task completion decision
   */
  private buildParentCompletionPrompt(parentTask: Task): string {
    return `# Parent Task Completion Decision

You are a manager reviewing whether a parent task is fully complete after all its subtasks have been completed.

## Parent Task
**Title**: ${parentTask.title}
**Description**: ${parentTask.description || 'No description'}

## Acceptance Criteria
${parentTask.acceptanceCriteria || 'No acceptance criteria specified'}

## Completed Subtasks
${parentTask.subtasks
  .map(
    (st, idx) => `${idx + 1}. ${st.title}
   Status: ${st.status}
   ${st.description ? `Description: ${st.description}` : ''}`,
  )
  .join('\n\n')}

## Your Decision
Based on the parent task's acceptance criteria and the completed subtasks, decide:

1. **complete**: All acceptance criteria are met, parent task is done
2. **add_tasks**: More work is needed to meet acceptance criteria

Respond in JSON format:
\`\`\`json
{
  "action": "complete" | "add_tasks",
  "reason": "Brief explanation of your decision"
}
\`\`\`

If you choose "add_tasks", the system will generate additional subtasks.
If you choose "complete", the parent task will be marked as done.
`;
  }

  /**
   * Parse LLM decision for parent task completion
   */
  private parseParentCompletionDecision(output: string): {
    action: 'complete' | 'add_tasks';
    reason: string;
  } {
    try {
      // Extract JSON from output
      const jsonMatch = output.match(/```json\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        const decision = JSON.parse(jsonMatch[1]);
        return {
          action: decision.action,
          reason: decision.reason || 'No reason provided',
        };
      }

      // Fallback: try to parse entire output as JSON
      const decision = JSON.parse(output);
      return {
        action: decision.action,
        reason: decision.reason || 'No reason provided',
      };
    } catch {
      // Default to complete if parsing fails
      this.logger.warn(
        `Failed to parse parent completion decision, defaulting to complete`,
      );
      return {
        action: 'complete',
        reason: 'Decision parsing failed, assuming complete',
      };
    }
  }

  /**
   * Phase 3.7: Cleanup temporary review hollon after review is done
   */
  private async cleanupTemporaryReviewHollon(
    reviewerHollonId: string,
  ): Promise<void> {
    try {
      // ✅ DDD: findById 사용 (Port 인터페이스)
      const reviewerHollon =
        await this.hollonService.findById(reviewerHollonId);

      // Check if hollon is temporary by lifecycle or name pattern
      if (
        reviewerHollon?.lifecycle === HollonLifecycle.TEMPORARY ||
        reviewerHollon?.name.startsWith('Reviewer-')
      ) {
        // ✅ DDD: releaseTemporaryHollon 사용 (Port 인터페이스)
        await this.hollonService.releaseTemporaryHollon(reviewerHollonId);
        this.logger.log(
          `Cleaned up temporary reviewer hollon ${reviewerHollonId}`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to cleanup temporary reviewer hollon: ${errorMessage}`,
      );
      // Don't throw - cleanup failures shouldn't block the flow
    }
  }
}
