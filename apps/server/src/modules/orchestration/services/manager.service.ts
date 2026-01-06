import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Task, TaskStatus, TaskType } from '../../task/entities/task.entity';
import { Team } from '../../team/entities/team.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { BrainProviderService } from '../../brain-provider/brain-provider.service';

/**
 * Phase 3.8 Phase 2: Manager Service
 *
 * Extended Manager capabilities:
 * 1. Team Task Progress Monitoring
 * 2. Blocked Subtask Detection and Resolution
 * 3. Task Redistribution for Workload Balancing
 * 4. Automatic Recovery Mechanisms
 */

interface TeamTaskStats {
  total: number;
  completed: number;
  inProgress: number;
  ready: number;
  pending: number;
  blocked: number;
  failed: number;
  progress: number; // 0-100
}

interface WorkloadInfo {
  hollonId: string;
  hollonName: string;
  taskCount: number;
  completionRate: number; // 0-100
}

interface RedistributionPlan {
  reassignments: Array<{
    taskId: string;
    taskTitle: string;
    from: string; // Hollon name
    to: string; // Hollon name
    reason: string;
  }>;
  reasoning: string;
}

@Injectable()
export class ManagerService {
  private readonly logger = new Logger(ManagerService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    private readonly brainProvider: BrainProviderService,
  ) {}

  /**
   * Cron: Monitor all team tasks every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async monitorAllTeams(): Promise<void> {
    try {
      this.logger.log('Starting team task monitoring...');

      const teams = await this.teamRepo.find({
        relations: ['manager', 'hollons', 'assignedTasks'],
      });

      for (const team of teams) {
        if (!team.manager) {
          this.logger.warn(`Team ${team.name} has no manager, skipping`);
          continue;
        }

        const teamTasks = team.assignedTasks?.filter(
          (t) =>
            t.type === TaskType.TEAM_EPIC && t.status !== TaskStatus.COMPLETED,
        );

        if (!teamTasks || teamTasks.length === 0) {
          this.logger.debug(`Team ${team.name} has no active team tasks`);
          continue;
        }

        for (const teamTask of teamTasks) {
          await this.monitorTeamTask(teamTask.id, team);
        }
      }

      this.logger.log('Team task monitoring completed');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in monitorAllTeams: ${err.message}`, err.stack);
    }
  }

  /**
   * Monitor a specific team task and take action if needed
   */
  async monitorTeamTask(teamTaskId: string, team?: Team): Promise<void> {
    const teamTask = await this.taskRepo.findOne({
      where: { id: teamTaskId },
      relations: [
        'assignedTeam',
        'assignedTeam.manager',
        'assignedTeam.hollons',
      ],
    });

    if (!teamTask || !teamTask.assignedTeam) {
      this.logger.warn(
        `Team task ${teamTaskId} not found or not assigned to team`,
      );
      return;
    }

    const teamEntity = team || teamTask.assignedTeam;

    // Get subtasks
    const subtasks = await this.taskRepo.find({
      where: { parentTaskId: teamTaskId },
      relations: ['assignedHollon'],
    });

    if (subtasks.length === 0) {
      this.logger.debug(
        `Team task ${teamTaskId} has no subtasks yet (may not be distributed)`,
      );
      return;
    }

    // Calculate statistics
    const stats = this.calculateTeamTaskStats(subtasks);

    this.logger.log(
      `Team "${teamEntity.name}" Task "${teamTask.title}": ` +
        `${stats.completed}/${stats.total} completed (${stats.progress.toFixed(1)}%), ` +
        `${stats.blocked} blocked, ${stats.failed} failed`,
    );

    // Detect anomalies
    if (stats.blocked >= 2) {
      this.logger.warn(
        `Team task ${teamTaskId} has ${stats.blocked} blocked subtasks, initiating recovery`,
      );
      await this.handleBlockedSubtasks(teamTask, teamEntity, subtasks);
    }

    if (stats.failed >= 3) {
      this.logger.warn(
        `Team task ${teamTaskId} has ${stats.failed} failed subtasks, initiating recovery`,
      );
      await this.handleFailedSubtasks(teamTask, teamEntity, subtasks);
    }

    // Update team task progress (not implemented yet, placeholder)
    // await this.updateTeamTaskProgress(teamTaskId, stats.progress);
  }

  /**
   * Calculate statistics for subtasks of a team task
   */
  private calculateTeamTaskStats(subtasks: Task[]): TeamTaskStats {
    const stats: TeamTaskStats = {
      total: subtasks.length,
      completed: 0,
      inProgress: 0,
      ready: 0,
      pending: 0,
      blocked: 0,
      failed: 0,
      progress: 0,
    };

    subtasks.forEach((task) => {
      switch (task.status) {
        case TaskStatus.COMPLETED:
          stats.completed++;
          break;
        case TaskStatus.IN_PROGRESS:
          stats.inProgress++;
          break;
        case TaskStatus.READY:
          stats.ready++;
          break;
        case TaskStatus.PENDING:
          stats.pending++;
          break;
        case TaskStatus.BLOCKED:
          stats.blocked++;
          break;
        case TaskStatus.FAILED:
          stats.failed++;
          break;
      }
    });

    stats.progress =
      stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

    return stats;
  }

  /**
   * Handle blocked subtasks by asking Manager for resolution
   */
  async handleBlockedSubtasks(
    teamTask: Task,
    team: Team,
    subtasks: Task[],
  ): Promise<void> {
    const manager = team.manager!;
    const blockedTasks = subtasks.filter(
      (t) => t.status === TaskStatus.BLOCKED,
    );

    if (blockedTasks.length === 0) return;

    const teamMembers = team.hollons || [];
    const workloads = await this.calculateWorkloads(teamMembers);

    // Build prompt for Manager
    const prompt = `You are the manager of team "${team.name}". Your team task "${teamTask.title}" has ${blockedTasks.length} blocked subtasks.

**Blocked Subtasks:**
${blockedTasks
  .map(
    (t) => `
- "${t.title}"
  Assigned to: ${t.assignedHollon?.name || 'Unassigned'}
  Blocked reason: ${t.blockedReason || 'Unknown'}
`,
  )
  .join('\n')}

**Team Members Availability:**
${teamMembers
  .map((m) => {
    const workload = workloads.find((w) => w.hollonId === m.id);
    return `
- ${m.name}
  Active tasks: ${workload?.taskCount || 0}
  Completion rate: ${workload?.completionRate.toFixed(1) || 0}%
`;
  })
  .join('\n')}

**What should we do?**

Options:
1. Reassign to less busy members
2. Break down into smaller tasks
3. Request collaboration between members
4. Escalate to human for review

**Response Format (JSON):**
{
  "action": "reassign" | "breakdown" | "collaborate" | "escalate",
  "details": "Explanation of chosen action",
  "reassignments": [ // Only if action is "reassign"
    {
      "taskId": "task-id",
      "from": "current assignee name",
      "to": "new assignee name",
      "reason": "why this reassignment"
    }
  ]
}`;

    // Fix #12: Add disallowedTools for analysis-only Brain Provider calls
    const response = await this.brainProvider.executeWithTracking(
      {
        prompt,
        systemPrompt:
          'You are a team manager responsible for resolving blockers. Provide structured JSON output only.',
        context: {
          hollonId: manager.id,
          taskId: teamTask.id,
        },
        options: {
          disallowedTools: ['Write', 'Edit', 'Bash', 'MultiEdit'],
        },
      },
      {
        organizationId: team.organizationId,
        hollonId: manager.id,
      },
    );

    // Parse and execute decision
    try {
      const decision = this.parseManagerDecision(response.output);

      this.logger.log(
        `Manager decision for blocked tasks: ${decision.action} - ${decision.details}`,
      );

      if (decision.action === 'reassign' && decision.reassignments) {
        await this.executeReassignments(teamTask, decision.reassignments);
      } else if (decision.action === 'escalate') {
        this.logger.warn(
          `Manager escalated blocked tasks to human: ${decision.details}`,
        );
        // TODO: Implement human escalation
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to parse manager decision: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Handle failed subtasks
   */
  async handleFailedSubtasks(
    teamTask: Task,
    _team: Team,
    subtasks: Task[],
  ): Promise<void> {
    const failedTasks = subtasks.filter((t) => t.status === TaskStatus.FAILED);

    if (failedTasks.length === 0) return;

    this.logger.warn(
      `Team task "${teamTask.title}" has ${failedTasks.length} failed subtasks, attempting redistribution`,
    );

    // For now, simple retry: reset failed tasks to READY
    for (const task of failedTasks) {
      await this.taskRepo.update(task.id, {
        status: TaskStatus.READY,
        retryCount: (task.retryCount || 0) + 1,
        errorMessage: null,
      });

      this.logger.log(
        `Reset failed task "${task.title}" to READY for retry (attempt ${(task.retryCount || 0) + 1})`,
      );
    }
  }

  /**
   * Redistribute subtasks for workload balancing
   */
  async redistributeSubtasks(
    teamTaskId: string,
    reason: string,
  ): Promise<void> {
    const teamTask = await this.taskRepo.findOne({
      where: { id: teamTaskId },
      relations: [
        'assignedTeam',
        'assignedTeam.manager',
        'assignedTeam.hollons',
      ],
    });

    if (!teamTask || !teamTask.assignedTeam) {
      throw new Error(
        `Team task ${teamTaskId} not found or not assigned to team`,
      );
    }

    const team = teamTask.assignedTeam;
    const manager = team.manager!;

    const subtasks = await this.taskRepo.find({
      where: { parentTaskId: teamTaskId },
      relations: ['assignedHollon'],
    });

    const teamMembers = team.hollons || [];
    const workloads = await this.calculateWorkloads(teamMembers);

    // Build prompt for redistribution
    const prompt = `You are the manager of team "${team.name}". You need to redistribute subtasks for the team task "${teamTask.title}".

**Reason for redistribution:** ${reason}

**Current Subtask Assignments:**
${subtasks
  .map(
    (t) => `
- "${t.title}"
  Status: ${t.status}
  Assigned to: ${t.assignedHollon?.name || 'Unassigned'}
`,
  )
  .join('\n')}

**Team Member Workloads:**
${workloads
  .map(
    (w) => `
- ${w.hollonName}
  Active tasks: ${w.taskCount}
  Completion rate: ${w.completionRate.toFixed(1)}%
`,
  )
  .join('\n')}

**Your Task:**
Suggest task reassignments to:
1. Balance workload across team members
2. Resolve any blockers
3. Match skills better
4. Improve overall team efficiency

**Response Format (JSON):**
{
  "reassignments": [
    {
      "taskId": "task-id",
      "taskTitle": "task title",
      "from": "current assignee name",
      "to": "new assignee name",
      "reason": "why this reassignment makes sense"
    }
  ],
  "reasoning": "Overall strategy explanation"
}`;

    // Fix #12: Add disallowedTools for analysis-only Brain Provider calls
    const response = await this.brainProvider.executeWithTracking(
      {
        prompt,
        systemPrompt:
          'You are a team manager responsible for task redistribution. Provide structured JSON output only.',
        context: {
          hollonId: manager.id,
          taskId: teamTaskId,
        },
        options: {
          disallowedTools: ['Write', 'Edit', 'Bash', 'MultiEdit'],
        },
      },
      {
        organizationId: team.organizationId,
        hollonId: manager.id,
      },
    );

    // Parse and execute redistribution plan
    try {
      const plan = this.parseRedistributionPlan(response.output);

      this.logger.log(
        `Manager redistribution plan: ${plan.reassignments.length} reassignments - ${plan.reasoning}`,
      );

      if (plan.reassignments.length > 0) {
        await this.executeReassignments(teamTask, plan.reassignments);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to parse redistribution plan: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Calculate workloads for team members
   */
  private async calculateWorkloads(
    teamMembers: Hollon[],
  ): Promise<WorkloadInfo[]> {
    const workloads: WorkloadInfo[] = [];

    for (const hollon of teamMembers) {
      const tasks = await this.taskRepo.find({
        where: { assignedHollonId: hollon.id },
      });

      const activeTasks = tasks.filter(
        (t) =>
          t.status !== TaskStatus.COMPLETED &&
          t.status !== TaskStatus.CANCELLED,
      );

      const completedTasks = tasks.filter(
        (t) => t.status === TaskStatus.COMPLETED,
      );

      const completionRate =
        tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;

      workloads.push({
        hollonId: hollon.id,
        hollonName: hollon.name,
        taskCount: activeTasks.length,
        completionRate,
      });
    }

    return workloads;
  }

  /**
   * Execute task reassignments
   */
  private async executeReassignments(
    teamTask: Task,
    reassignments: Array<{
      taskId?: string;
      taskTitle?: string;
      from: string;
      to: string;
      reason: string;
    }>,
  ): Promise<void> {
    const team = await this.teamRepo.findOne({
      where: { id: teamTask.assignedTeamId! },
      relations: ['hollons'],
    });

    if (!team) {
      throw new Error(`Team not found for task ${teamTask.id}`);
    }

    const teamMembers = team.hollons || [];
    const hollonMap = new Map<string, string>();
    for (const hollon of teamMembers) {
      hollonMap.set(hollon.name, hollon.id);
    }

    const subtasks = await this.taskRepo.find({
      where: { parentTaskId: teamTask.id },
      relations: ['assignedHollon'],
    });

    const taskMap = new Map<string, Task>();
    for (const task of subtasks) {
      taskMap.set(task.id, task);
      taskMap.set(task.title, task);
    }

    for (const reassignment of reassignments) {
      const task = reassignment.taskId
        ? taskMap.get(reassignment.taskId)
        : reassignment.taskTitle
          ? taskMap.get(reassignment.taskTitle)
          : null;

      if (!task) {
        this.logger.warn(
          `Task not found for reassignment: ${reassignment.taskId || reassignment.taskTitle}`,
        );
        continue;
      }

      const newHollonId = hollonMap.get(reassignment.to);

      if (!newHollonId) {
        this.logger.warn(
          `Hollon "${reassignment.to}" not found in team ${team.name}`,
        );
        continue;
      }

      // Phase 4 Fix: Clear assignedTeamId to satisfy XOR constraint
      // Non-team_epic tasks can have either assignedTeamId OR assignedHollonId, not both
      await this.taskRepo.update(task.id, {
        assignedHollonId: newHollonId,
        assignedTeamId: null, // XOR: hollon is assigned, clear team
        status: TaskStatus.READY, // Reset to READY for new assignee
      });

      this.logger.log(
        `Reassigned task "${task.title}" from ${reassignment.from} to ${reassignment.to}: ${reassignment.reason}`,
      );
    }
  }

  /**
   * Parse manager decision from LLM response
   */
  private parseManagerDecision(response: string): {
    action: string;
    details: string;
    reassignments?: Array<{
      taskId: string;
      from: string;
      to: string;
      reason: string;
    }>;
  } {
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n/, '').replace(/\n```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n/, '').replace(/\n```$/, '');
    }

    return JSON.parse(jsonStr);
  }

  /**
   * Parse redistribution plan from LLM response
   */
  private parseRedistributionPlan(response: string): RedistributionPlan {
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n/, '').replace(/\n```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n/, '').replace(/\n```$/, '');
    }

    return JSON.parse(jsonStr);
  }
}
