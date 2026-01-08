import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

import { Task, TaskStatus, TaskType } from '../task/entities/task.entity';
import { Hollon } from '../hollon/entities/hollon.entity';
import { Team } from '../team/entities/team.entity';
import { Role } from '../role/entities/role.entity';
import { BrainProviderService } from '../brain-provider/brain-provider.service';
import {
  TaskPullRequest,
  PullRequestStatus,
} from '../collaboration/entities/task-pull-request.entity';

const execAsync = promisify(exec);

export interface PlanningResult {
  success: boolean;
  planPath?: string;
  prUrl?: string;
  error?: string;
}

@Injectable()
export class PlanningService {
  private readonly logger = new Logger(PlanningService.name);

  /**
   * Sanitize team name for use in file paths and shell commands
   * Removes special characters that cause shell escaping issues
   */
  private sanitizeTeamName(name: string): string {
    return name
      .toLowerCase()
      .replace(/&/g, 'and') // Replace & with 'and'
      .replace(/[^a-z0-9-]/g, '-') // Replace other special chars with hyphen
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, ''); // Trim leading/trailing hyphens
  }

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(TaskPullRequest)
    private readonly prRepo: Repository<TaskPullRequest>,
    private readonly brainProviderService: BrainProviderService,
  ) {}

  /**
   * Create a planning task for a parent task (team_epic or implementation)
   */
  async createPlanningTask(parentTask: Task): Promise<Task> {
    this.logger.log(
      `Creating planning task for: ${parentTask.title} (${parentTask.id})`,
    );

    // Find the PlanningSpecialist role
    const planningRole = await this.roleRepo.findOne({
      where: {
        organizationId: parentTask.organizationId,
        name: 'PlanningSpecialist',
      },
    });

    if (!planningRole) {
      throw new Error('PlanningSpecialist role not found');
    }

    // Determine the team name for the plan path
    let teamName = 'general';
    if (parentTask.assignedTeamId) {
      const team = await this.teamRepo.findOne({
        where: { id: parentTask.assignedTeamId },
      });
      if (team) {
        teamName = this.sanitizeTeamName(team.name);
      }
    }

    // Create the planning task
    const planningTask = this.taskRepo.create({
      organizationId: parentTask.organizationId,
      projectId: parentTask.projectId,
      title: `[Plan] ${parentTask.title}`,
      description: `Create implementation plan for: ${parentTask.title}\n\nOriginal Description:\n${parentTask.description}`,
      type: TaskType.PLANNING,
      status: TaskStatus.PENDING,
      priority: parentTask.priority,
      parentTaskId: parentTask.id,
      depth: parentTask.depth + 1,
      assignedTeamId: parentTask.assignedTeamId,
      requiredSkills: ['planning', 'analysis'],
      acceptanceCriteria: [
        'Plan document created in docs/teams/ folder',
        'Technical approach documented',
        'Subtasks/decomposition defined',
        'PR created for review',
      ],
      metadata: {
        planningFor: parentTask.id,
        teamName,
        planDocumentPath: `docs/teams/${teamName}/plans/${parentTask.id.substring(0, 8)}-plan.md`,
      },
    });

    const savedTask = await this.taskRepo.save(planningTask);

    // Update parent task with planning task reference
    await this.taskRepo.update(parentTask.id, {
      planningTaskId: savedTask.id,
      needsPlanning: true,
    });

    this.logger.log(`Planning task created: ${savedTask.id}`);
    return savedTask;
  }

  /**
   * Execute planning for a task using Brain Provider
   */
  async executePlanning(planningTask: Task): Promise<PlanningResult> {
    this.logger.log(`Executing planning for task: ${planningTask.id}`);

    try {
      // Get the parent task
      const parentTask = await this.taskRepo.findOne({
        where: { id: planningTask.parentTaskId! },
        relations: ['assignedTeam', 'assignedHollon'],
      });

      if (!parentTask) {
        throw new Error('Parent task not found');
      }

      // Determine team and get manager's worktree path
      let worktreePath: string;
      let assignedHollon: Hollon | null = null;

      if (parentTask.assignedTeam?.managerHollonId) {
        assignedHollon = await this.hollonRepo.findOne({
          where: { id: parentTask.assignedTeam.managerHollonId },
        });
      } else if (parentTask.assignedHollonId) {
        assignedHollon = await this.hollonRepo.findOne({
          where: { id: parentTask.assignedHollonId },
        });
      }

      if (!assignedHollon) {
        throw new Error('No assigned hollon found for planning');
      }

      // Create worktree for planning
      const gitRoot = (
        await execAsync('git rev-parse --show-toplevel')
      ).stdout.trim();
      const hollonShortId = assignedHollon.id.substring(0, 8);
      const taskShortId = planningTask.id.substring(0, 8);

      worktreePath = path.join(
        gitRoot,
        '.git-worktrees',
        `hollon-${hollonShortId}`,
        `plan-${taskShortId}`,
      );

      // Setup worktree
      await this.setupWorktree(worktreePath, planningTask);

      // Build planning prompt
      const prompt = this.buildPlanningPrompt(parentTask, planningTask);

      // Execute Brain Provider
      const result = await this.brainProviderService.executeWithTracking(
        {
          prompt,
          context: {
            hollonId: assignedHollon.id,
            taskId: planningTask.id,
            workingDirectory: worktreePath,
          },
          options: {
            timeoutMs: 600000, // 10 minutes
          },
        },
        {
          organizationId: planningTask.organizationId,
          hollonId: assignedHollon.id,
          taskId: planningTask.id,
        },
      );

      if (!result.success) {
        throw new Error(result.output || 'Brain Provider execution failed');
      }

      // Get the plan document path
      const teamName =
        (planningTask.metadata as { teamName?: string })?.teamName || 'general';
      const planPath = `docs/teams/${teamName}/plans/${parentTask.id.substring(0, 8)}-plan.md`;

      // Create PR for the plan
      const prUrl = await this.createPlanningPR(
        planningTask,
        parentTask,
        worktreePath,
        planPath,
      );

      // Update planning task
      await this.taskRepo.update(planningTask.id, {
        status: TaskStatus.IN_REVIEW,
        planDocumentPath: planPath,
        workingDirectory: worktreePath,
      });

      // Update parent task
      await this.taskRepo.update(parentTask.id, {
        planDocumentPath: planPath,
        metadata: {
          ...(parentTask.metadata || {}),
          planningStatus: 'pending_review',
          planPrUrl: prUrl,
        },
      });

      return {
        success: true,
        planPath,
        prUrl,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Planning execution failed: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Build the prompt for planning
   */
  private buildPlanningPrompt(parentTask: Task, planningTask: Task): string {
    const teamName =
      (planningTask.metadata as { teamName?: string })?.teamName || 'general';
    const planPath = `docs/teams/${teamName}/plans/${parentTask.id.substring(0, 8)}-plan.md`;

    return `# Planning Task

You are a PlanningSpecialist. Your job is to create a detailed implementation plan.

## Task to Plan

**Title**: ${parentTask.title}
**Type**: ${parentTask.type}
**Description**:
${parentTask.description}

## Your Mission

1. **Analyze** the task requirements
2. **Explore** the existing codebase to understand:
   - Current architecture and patterns
   - Files that need to be created or modified
   - Dependencies and integrations required
3. **Create** a detailed plan document at: \`${planPath}\`

## Plan Document Structure

Create the plan file with this structure:

\`\`\`markdown
# Plan: ${parentTask.title}

## Task Information
- **Task ID**: ${parentTask.id}
- **Type**: ${parentTask.type}
- **Created**: ${new Date().toISOString()}

## Objective
[Summarize what this task aims to achieve]

## Analysis

### Codebase Impact
- **Files to create**: [list files]
- **Files to modify**: [list files]
- **Dependencies affected**: [list dependencies]

### Technical Approach
[Describe the implementation approach in detail]

### Risks and Mitigations
| Risk | Mitigation |
|------|------------|
| ... | ... |

## Decomposition

### Subtasks
[For team_epics, list implementation tasks]
[For implementation tasks, list sub-steps if needed]

1. **[Subtask Title]**
   - Assignee recommendation: [Role/skill needed]
   - Description: ...
   - Acceptance Criteria: ...

### Dependencies
[Describe task dependencies]

## Success Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

---
*Generated by: PlanningSpecialist*
*Date: ${new Date().toISOString()}*
*Status: PENDING_REVIEW*
\`\`\`

## Important Instructions

1. Create the plan document at: \`${planPath}\`
2. Ensure the parent directories exist (create \`docs/teams/${teamName}/plans/\` if needed)
3. Commit the file with message: \`docs: Add implementation plan for ${parentTask.title.substring(0, 50)}\`
4. DO NOT create actual implementation code - only the plan document

Begin by exploring the codebase to understand the context, then create the plan document.
`;
  }

  /**
   * Setup worktree for planning task
   */
  private async setupWorktree(
    worktreePath: string,
    planningTask: Task,
  ): Promise<void> {
    const gitRoot = (
      await execAsync('git rev-parse --show-toplevel')
    ).stdout.trim();

    // Check if worktree already exists
    try {
      await fs.access(worktreePath);
      this.logger.log(`Worktree already exists at: ${worktreePath}`);
      return;
    } catch {
      // Worktree doesn't exist, create it
    }

    // Create parent directory
    const parentDir = path.dirname(worktreePath);
    await fs.mkdir(parentDir, { recursive: true });

    // Create branch name
    const branchName = `feature/plan-${planningTask.id.substring(0, 8)}`;

    // Create worktree
    try {
      await execAsync(
        `git worktree add -b "${branchName}" "${worktreePath}" main`,
        { cwd: gitRoot },
      );
      this.logger.log(`Created worktree at: ${worktreePath}`);
    } catch {
      // Branch might already exist
      await execAsync(`git worktree add "${worktreePath}" "${branchName}"`, {
        cwd: gitRoot,
      });
    }
  }

  /**
   * Create PR for the planning document
   */
  private async createPlanningPR(
    planningTask: Task,
    parentTask: Task,
    worktreePath: string,
    planPath: string,
  ): Promise<string> {
    try {
      // Push the branch
      const branchName = `feature/plan-${planningTask.id.substring(0, 8)}`;
      await execAsync(`git push -u origin ${branchName}`, {
        cwd: worktreePath,
      });

      // Create PR body content
      const prTitle = `[Plan] ${parentTask.title.substring(0, 80)}`;
      const prBody = `## Planning PR

This PR contains the implementation plan for: **${parentTask.title}**

### Plan Location
\`${planPath}\`

### Parent Task
- **ID**: ${parentTask.id}
- **Type**: ${parentTask.type}

### Review Checklist
- [ ] Technical approach is sound
- [ ] Subtask decomposition is appropriate
- [ ] Dependencies are correctly identified
- [ ] Risk mitigations are adequate

### Actions
- **Approve**: Plan will be executed, subtasks will be created
- **Request Changes**: Plan will be revised based on your feedback

---
*Auto-generated by Hollon Planning System*`;

      // Write PR body to a temporary file to avoid shell escaping issues
      const prBodyFile = path.join(worktreePath, '.pr-body.md');
      await fs.writeFile(prBodyFile, prBody, 'utf-8');

      try {
        // Use --body-file to avoid shell escaping issues with Korean/special characters
        const { stdout } = await execAsync(
          `gh pr create --title "${prTitle.replace(/"/g, '\\"')}" --body-file "${prBodyFile}" --base main`,
          { cwd: worktreePath },
        );

        const prUrl = stdout.trim();
        this.logger.log(`Created planning PR: ${prUrl}`);

        // Extract PR number
        const prNumber = parseInt(prUrl.split('/').pop() || '0', 10);

        // Save PR record
        const prRecord = this.prRepo.create({
          taskId: planningTask.id,
          prNumber,
          prUrl,
          branchName,
          status: PullRequestStatus.DRAFT,
        });
        await this.prRepo.save(prRecord);

        return prUrl;
      } finally {
        // Clean up temporary file
        await fs.unlink(prBodyFile).catch(() => {});
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to create planning PR: ${err.message}`);
      throw error;
    }
  }

  /**
   * Handle planning PR review status
   */
  async handlePlanningPRReview(planningTask: Task): Promise<void> {
    const pr = await this.prRepo.findOne({
      where: { taskId: planningTask.id },
    });

    if (!pr) {
      this.logger.warn(`No PR found for planning task: ${planningTask.id}`);
      return;
    }

    try {
      // Check PR status
      const { stdout } = await execAsync(
        `gh pr view ${pr.prUrl} --json state,reviewDecision,reviews`,
      );
      const prStatus = JSON.parse(stdout.trim());

      this.logger.log(
        `Planning PR ${pr.prNumber} status: state=${prStatus.state}, reviewDecision=${prStatus.reviewDecision}`,
      );

      if (prStatus.reviewDecision === 'APPROVED') {
        await this.handlePlanApproved(planningTask, pr);
      } else if (prStatus.reviewDecision === 'CHANGES_REQUESTED') {
        await this.handlePlanChangesRequested(planningTask, pr);
      }
      // If no decision yet, do nothing - wait for review
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to check planning PR status: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Handle plan approval
   */
  private async handlePlanApproved(
    planningTask: Task,
    pr: TaskPullRequest,
  ): Promise<void> {
    this.logger.log(`Plan approved for task: ${planningTask.id}`);

    // Get parent task
    const parentTask = await this.taskRepo.findOne({
      where: { id: planningTask.parentTaskId! },
    });

    if (!parentTask) {
      this.logger.error(`Parent task not found: ${planningTask.parentTaskId}`);
      return;
    }

    // Merge the planning PR
    try {
      await execAsync(`gh pr merge ${pr.prUrl} --merge --delete-branch`);
      this.logger.log(`Planning PR merged: ${pr.prUrl}`);
    } catch (error) {
      this.logger.warn(`Could not merge planning PR: ${error}`);
    }

    // Update planning task to completed
    await this.taskRepo.update(planningTask.id, {
      status: TaskStatus.COMPLETED,
      completedAt: new Date(),
    });

    // Update PR status
    await this.prRepo.update(pr.id, {
      status: PullRequestStatus.MERGED,
    });

    // Update parent task - mark plan as approved, set to READY for decomposition
    await this.taskRepo.update(parentTask.id, {
      needsPlanning: false,
      status: TaskStatus.READY,
      metadata: {
        ...(parentTask.metadata || {}),
        planningStatus: 'approved',
        planApprovedAt: new Date().toISOString(),
      },
    });

    this.logger.log(
      `Parent task ${parentTask.id} ready for decomposition after plan approval`,
    );
  }

  /**
   * Handle changes requested on plan
   */
  private async handlePlanChangesRequested(
    planningTask: Task,
    pr: TaskPullRequest,
  ): Promise<void> {
    this.logger.log(`Changes requested for plan: ${planningTask.id}`);

    // Get PR comments
    const { stdout: commentsJson } = await execAsync(
      `gh pr view ${pr.prUrl} --json reviews`,
    );
    const { reviews } = JSON.parse(commentsJson);

    const comments = reviews
      .filter((r: { state: string }) => r.state === 'CHANGES_REQUESTED')
      .map((r: { body: string }) => r.body);

    // Update parent task metadata with comments
    const parentTask = await this.taskRepo.findOne({
      where: { id: planningTask.parentTaskId! },
    });

    if (parentTask) {
      await this.taskRepo.update(parentTask.id, {
        metadata: {
          ...(parentTask.metadata || {}),
          planningStatus: 'changes_requested',
          planReviewComments: comments,
        },
      });
    }

    // Set planning task back to ready for revision
    await this.taskRepo.update(planningTask.id, {
      status: TaskStatus.READY,
      metadata: {
        ...(planningTask.metadata || {}),
        revisionComments: comments,
        revisionCount:
          ((planningTask.metadata as { revisionCount?: number })
            ?.revisionCount || 0) + 1,
      },
    });

    this.logger.log(`Planning task ${planningTask.id} set for revision`);
  }

  /**
   * Find tasks that need planning
   */
  async findTasksNeedingPlanning(limit = 5): Promise<Task[]> {
    return this.taskRepo
      .createQueryBuilder('task')
      .where('task.needsPlanning = :needsPlanning', { needsPlanning: true })
      .andWhere('task.planningTaskId IS NULL')
      .andWhere('task.status IN (:...statuses)', {
        statuses: [TaskStatus.PENDING, TaskStatus.READY],
      })
      .leftJoinAndSelect('task.assignedTeam', 'team')
      .take(limit)
      .getMany();
  }

  /**
   * Find planning tasks pending review
   */
  async findPlanningTasksPendingReview(limit = 10): Promise<Task[]> {
    return this.taskRepo
      .createQueryBuilder('task')
      .where('task.type = :type', { type: TaskType.PLANNING })
      .andWhere('task.status = :status', { status: TaskStatus.IN_REVIEW })
      .leftJoinAndSelect('task.parentTask', 'parentTask')
      .take(limit)
      .getMany();
  }
}
