import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus, TaskType } from '../../task/entities/task.entity';
import { Team } from '../../team/entities/team.entity';
import { BrainProviderService } from '../../brain-provider/brain-provider.service';
import { SubtaskCreationService } from './subtask-creation.service';

/**
 * Phase 3.8: Team Task Distribution Service
 *
 * Manages hierarchical task distribution:
 * - Team Tasks (Level 0) → Hollon Tasks (Level 1) via Manager
 * - Manager uses Brain Provider to create distribution plan
 * - Creates subtasks and assigns to team members
 */

interface DistributionPlan {
  subtasks: SubtaskPlan[];
  reasoning: string;
}

interface SubtaskPlan {
  title: string;
  description: string;
  assignedTo: string; // Hollon name
  type: TaskType;
  priority: string;
  estimatedComplexity: 'low' | 'medium' | 'high';
  dependencies: string[]; // Subtask titles this depends on
}

@Injectable()
export class TeamTaskDistributionService {
  private readonly logger = new Logger(TeamTaskDistributionService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly brainProvider: BrainProviderService,
    private readonly subtaskService: SubtaskCreationService,
  ) {}

  /**
   * Distribute team task to team members via Manager
   */
  async distributeToTeam(teamTaskId: string): Promise<Task[]> {
    const teamTask = await this.taskRepo.findOne({
      where: { id: teamTaskId },
      relations: [
        'assignedTeam',
        'assignedTeam.manager',
        'assignedTeam.hollons',
      ],
    });

    if (!teamTask) {
      throw new NotFoundException(`Team task ${teamTaskId} not found`);
    }

    if (!teamTask.assignedTeam) {
      throw new NotFoundException(
        `Team task ${teamTaskId} is not assigned to a team`,
      );
    }

    const team = teamTask.assignedTeam;

    if (!team.manager) {
      throw new NotFoundException(
        `Team ${team.name} does not have a manager hollon`,
      );
    }

    this.logger.log(
      `Distributing team task "${teamTask.title}" (${teamTask.id}) to team "${team.name}" via manager "${team.manager.name}"`,
    );

    // 1. Create distribution plan via Manager's Brain Provider
    const plan = await this.createDistributionPlan(teamTask, team);

    // 2. Validate plan
    await this.validatePlan(plan, team);

    // 3. Create subtasks
    const subtasks = await this.createSubtasksFromPlan(teamTask, plan, team);

    // 4. Update team task status
    await this.taskRepo.update(teamTask.id, {
      status: TaskStatus.IN_PROGRESS,
    });

    this.logger.log(
      `Successfully distributed team task ${teamTask.id} into ${subtasks.length} subtasks`,
    );

    return subtasks;
  }

  /**
   * Manager creates distribution plan using Brain Provider
   */
  private async createDistributionPlan(
    teamTask: Task,
    team: Team,
  ): Promise<DistributionPlan> {
    const manager = team.manager!;

    // Build context about team members
    const teamMembers = team.hollons || [];
    const memberInfo = await Promise.all(
      teamMembers.map(async (hollon) => {
        const currentTasks = await this.taskRepo.count({
          where: {
            assignedHollonId: hollon.id,
            status: TaskStatus.IN_PROGRESS,
          },
        });

        return {
          name: hollon.name,
          role: hollon.role?.name || 'Unknown',
          capabilities: hollon.role?.capabilities || [],
          currentWorkload: currentTasks,
        };
      }),
    );

    // Build prompt for Manager
    const prompt = this.buildDistributionPrompt(teamTask, memberInfo);

    this.logger.debug(
      `Asking manager ${manager.name} to create distribution plan`,
    );

    // Call Manager's Brain Provider
    const response = await this.brainProvider.executeWithTracking(
      {
        prompt,
        systemPrompt:
          'You are a team manager responsible for distributing tasks. Provide structured JSON output only.',
        context: {
          hollonId: manager.id,
          taskId: teamTask.id,
        },
      },
      {
        organizationId: team.organizationId,
        hollonId: manager.id,
      },
    );

    // Parse response into DistributionPlan
    const plan = this.parseDistributionPlan(response.output);

    return plan;
  }

  /**
   * Build prompt for Manager to create distribution plan
   */
  private buildDistributionPrompt(
    teamTask: Task,
    memberInfo: Array<{
      name: string;
      role: string;
      capabilities: string[];
      currentWorkload: number;
    }>,
  ): string {
    return `You are a Manager responsible for distributing tasks to your team members.

**Team Task to Distribute:**
Title: ${teamTask.title}
Description: ${teamTask.description}
Type: ${teamTask.type}
Priority: ${teamTask.priority}
${teamTask.acceptanceCriteria ? `Acceptance Criteria:\n${teamTask.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}` : ''}

**Your Team Members:**
${memberInfo
  .map(
    (m) => `
- ${m.name}
  Role: ${m.role}
  Skills: ${m.capabilities.join(', ')}
  Current workload: ${m.currentWorkload} active tasks
`,
  )
  .join('\n')}

**Your Task:**
Break down this team task into 3-7 subtasks and assign each to the most suitable team member.

**Consider:**
1. Each member's skills and capabilities
2. Current workload balance
3. **CRITICAL: Dependencies between subtasks** - Ensure proper execution order!
   - Example: "DTO 작성" MUST complete before "Repository 구현"
   - Example: "Repository 구현" MUST complete before "Service 구현"
   - Example: "Service 구현" MUST complete before "Controller 구현"
4. Opportunities for parallel execution (only for truly independent tasks)

**Response Format (JSON):**
{
  "subtasks": [
    {
      "title": "Subtask title",
      "description": "Detailed description",
      "assignedTo": "Member name",
      "type": "implementation|review|research|bug_fix|documentation",
      "priority": "P1|P2|P3|P4",
      "estimatedComplexity": "low|medium|high",
      "dependencies": ["Other subtask title if any"]
    }
  ],
  "reasoning": "Brief explanation of your distribution strategy"
}

**Important:**
- Assign each subtask to exactly one team member from the list above
- Ensure workload is balanced
- **MANDATORY: Set "dependencies" array for all tasks that depend on others**
  - Use exact subtask titles in the dependencies array
  - Don't create circular dependencies
  - Default to sequential execution if unsure - parallel execution is an optimization
- Put dependent tasks in logical order (foundation → implementation → integration → testing)
- Match skills to task requirements`;
  }

  /**
   * Parse Manager's response into DistributionPlan
   */
  private parseDistributionPlan(response: string): DistributionPlan {
    try {
      // Extract JSON from response (might be wrapped in markdown code blocks)
      let jsonStr = response.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n/, '').replace(/\n```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n/, '').replace(/\n```$/, '');
      }

      const plan = JSON.parse(jsonStr) as DistributionPlan;

      // Validate structure
      if (!plan.subtasks || !Array.isArray(plan.subtasks)) {
        throw new Error('Invalid plan structure: missing subtasks array');
      }

      return plan;
    } catch (error) {
      this.logger.error(
        `Failed to parse distribution plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.logger.debug(`Raw response: ${response}`);
      throw new Error('Manager failed to create valid distribution plan');
    }
  }

  /**
   * Validate distribution plan
   */
  private async validatePlan(
    plan: DistributionPlan,
    team: Team,
  ): Promise<void> {
    const memberNames = new Set((team.hollons || []).map((h) => h.name));

    // Check all assignees are valid team members
    for (const subtask of plan.subtasks) {
      if (!memberNames.has(subtask.assignedTo)) {
        throw new Error(
          `Invalid assignee "${subtask.assignedTo}" - not a member of team ${team.name}`,
        );
      }
    }

    // Check for circular dependencies
    const dependencyGraph = new Map<string, string[]>();
    for (const subtask of plan.subtasks) {
      dependencyGraph.set(subtask.title, subtask.dependencies || []);
    }

    if (this.hasCircularDependency(dependencyGraph)) {
      throw new Error('Circular dependency detected in distribution plan');
    }

    this.logger.debug(`Distribution plan validated successfully`);
  }

  /**
   * Check for circular dependencies using DFS
   */
  private hasCircularDependency(graph: Map<string, string[]>): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true; // Circular dependency found
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }

    return false;
  }

  /**
   * Create subtasks from distribution plan
   */
  private async createSubtasksFromPlan(
    teamTask: Task,
    plan: DistributionPlan,
    team: Team,
  ): Promise<Task[]> {
    // Build hollon name to ID map
    const hollonMap = new Map<string, string>();
    for (const hollon of team.hollons || []) {
      hollonMap.set(hollon.name, hollon.id);
    }

    // Create subtasks
    const subtaskData = plan.subtasks.map((sp) => ({
      title: sp.title,
      description: sp.description,
      type: sp.type,
      priority: sp.priority,
      estimatedComplexity: sp.estimatedComplexity,
      // Will assign after creation to handle dependencies
    }));

    const result = await this.subtaskService.createSubtasks(
      teamTask.id,
      subtaskData,
    );

    // Assign subtasks to hollons
    const titleToTaskMap = new Map<string, Task>();
    for (const subtask of result.createdSubtasks) {
      titleToTaskMap.set(subtask.title, subtask);
    }

    // Assign hollons and set up dependencies
    for (const sp of plan.subtasks) {
      const subtask = titleToTaskMap.get(sp.title);
      if (!subtask) continue;

      const hollonId = hollonMap.get(sp.assignedTo);
      if (!hollonId) {
        this.logger.warn(
          `Hollon ${sp.assignedTo} not found, subtask ${sp.title} will remain unassigned`,
        );
        continue;
      }

      // Update subtask with assignment and reviewer
      // Phase 3.16: Set reviewer to parent task's manager
      await this.taskRepo.update(subtask.id, {
        assignedHollonId: hollonId,
        reviewerHollonId: teamTask.assignedHollonId, // Manager reviews subtasks
        status: TaskStatus.READY,
      });

      // Phase 4: Set up task dependencies
      if (sp.dependencies && sp.dependencies.length > 0) {
        const dependencyTasks: Task[] = [];
        for (const depTitle of sp.dependencies) {
          const depTask = titleToTaskMap.get(depTitle);
          if (depTask) {
            dependencyTasks.push(depTask);
            this.logger.debug(
              `Task "${sp.title}" depends on "${depTitle}" (${depTask.id})`,
            );
          } else {
            this.logger.warn(
              `Dependency "${depTitle}" not found for task "${sp.title}"`,
            );
          }
        }

        if (dependencyTasks.length > 0) {
          // Load subtask with dependencies relation
          const subtaskWithDeps = await this.taskRepo.findOne({
            where: { id: subtask.id },
            relations: ['dependencies'],
          });

          if (subtaskWithDeps) {
            subtaskWithDeps.dependencies = dependencyTasks;
            await this.taskRepo.save(subtaskWithDeps);
            this.logger.log(
              `Set ${dependencyTasks.length} dependencies for task "${sp.title}"`,
            );
          }
        }
      }
    }

    // Reload to get updated data
    const createdSubtasks = await this.taskRepo.find({
      where: { parentTaskId: teamTask.id },
      relations: ['assignedHollon', 'dependencies'],
    });

    return createdSubtasks;
  }
}
