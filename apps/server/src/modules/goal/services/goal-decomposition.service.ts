import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from '../entities/goal.entity';
import { Project, ProjectStatus } from '../../project/entities/project.entity';
import {
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '../../task/entities/task.entity';
import { Team } from '../../team/entities/team.entity';
import { BrainProviderService } from '../../brain-provider/brain-provider.service';
import { GoalService } from '../goal.service';
import {
  DecompositionResult,
  DecompositionContext,
  ProjectDecomposition,
  TaskDecomposition,
} from '../interfaces/decomposition-result.interface';
import {
  DecompositionOptionsDto,
  DecompositionStrategy,
} from '../dto/decomposition-options.dto';
import { ResourcePlannerService } from '../../task/services/resource-planner.service';

@Injectable()
export class GoalDecompositionService {
  private readonly logger = new Logger(GoalDecompositionService.name);

  constructor(
    private readonly goalService: GoalService,
    private readonly brainProviderService: BrainProviderService,
    private readonly resourcePlanner: ResourcePlannerService,
    @InjectRepository(Goal)
    private readonly goalRepo: Repository<Goal>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
  ) {}

  /**
   * Goal을 Task로 자동 분해
   * Phase 4 Dogfooding의 핵심 기능
   *
   * Input: "Phase 4 목표: 학습 및 성장 시스템 구축"
   * Output: 35개 Task + 의존성 그래프
   */
  async decomposeGoal(
    goalId: string,
    options?: DecompositionOptionsDto,
  ): Promise<DecompositionResult> {
    const startTime = Date.now();
    this.logger.log(`Starting goal decomposition for goal ${goalId}`);

    const goal = await this.goalService.findOne(goalId);

    // 1. 컨텍스트 수집
    const context = await this.gatherContext(goal);

    // 2. LLM 프롬프트 생성 및 실행
    const prompt = this.buildDecompositionPrompt(goal, context, options);
    this.logger.debug(`Decomposition prompt:\n${prompt.substring(0, 500)}...`);

    const llmResponse = await this.brainProviderService.executeWithTracking(
      {
        prompt,
        systemPrompt:
          'You are an expert project manager and software architect. Provide structured JSON output only.',
        context: {
          workingDirectory: process.cwd(),
        },
      },
      {
        organizationId: goal.organizationId,
      },
    );

    this.logger.debug(
      `LLM response received: ${llmResponse.output.substring(0, 200)}...`,
    );

    // 4. LLM 응답 파싱
    const decomposition = this.parseDecompositionResponse(llmResponse.output);

    // 5. Project/Task 생성
    const result = await this.createWorkItems(goal, decomposition, options);

    // 6. Goal 업데이트
    await this.goalRepo.update(goalId, {
      autoDecomposed: true,
      decompositionStrategy:
        options?.strategy || DecompositionStrategy.TASK_BASED,
    });

    const processingTime = Date.now() - startTime;
    this.logger.log(
      `Goal decomposition completed: ${result.projectsCreated} projects, ${result.tasksCreated} tasks (${processingTime}ms)`,
    );

    return {
      ...result,
      metadata: {
        model: options?.preferredModel || 'claude-sonnet-4-5-20250929',
        promptTokens: llmResponse.cost.inputTokens,
        completionTokens: llmResponse.cost.outputTokens,
        processingTime,
      },
    };
  }

  /**
   * 컨텍스트 수집 (기존 패턴, 프로젝트 등)
   */
  private async gatherContext(goal: Goal): Promise<DecompositionContext> {
    // 기존 프로젝트 조회
    const existingProjects = await this.projectRepo.find({
      where: { organizationId: goal.organizationId },
      select: ['name', 'description'],
      take: 10,
      order: { createdAt: 'DESC' },
    });

    return {
      organizationId: goal.organizationId,
      teamId: goal.teamId,
      existingPatterns: [
        'NestJS service pattern with @Injectable()',
        'TypeORM repository pattern',
        'DTO validation with class-validator',
        'REST API with @Controller()',
      ],
      existingProjects: existingProjects.map((p) => ({
        name: p.name,
        description: p.description || '',
      })),
      teamSkills: ['TypeScript', 'NestJS', 'PostgreSQL', 'React'],
      availableHollons: 5,
    };
  }

  /**
   * LLM 프롬프트 생성
   */
  private buildDecompositionPrompt(
    goal: Goal,
    context: DecompositionContext,
    options?: DecompositionOptionsDto,
  ): string {
    const strategy = options?.strategy || DecompositionStrategy.TASK_BASED;

    return `You are an expert project manager and software architect. Your task is to decompose a high-level goal into actionable tasks and projects.

**Goal Information:**
- Title: ${goal.title}
- Description: ${goal.description || 'N/A'}
- Type: ${goal.goalType}
- Priority: ${goal.priority}
- Target Date: ${goal.targetDate || 'N/A'}

**Context:**
- Organization ID: ${context.organizationId}
- Team ID: ${context.teamId || 'N/A'}
- Available Hollons: ${context.availableHollons}
- Team Skills: ${context.teamSkills?.join(', ')}

**Existing Patterns:**
${context.existingPatterns.map((p) => `- ${p}`).join('\n')}

**Recent Projects:**
${context.existingProjects
  .slice(0, 5)
  .map((p) => `- ${p.name}: ${p.description}`)
  .join('\n')}

**Decomposition Strategy:** ${strategy}

**Instructions:**
1. Break down the goal into 1-3 projects (if needed) or direct tasks
2. Each project should contain 10-20 tasks
3. Tasks should be specific, actionable, and testable
4. Estimate hours for each task (realistic estimates)
5. Identify task dependencies (which tasks must be completed before others)
6. Specify required skills for each task
7. Add acceptance criteria for each task

**Output Format (JSON):**
\`\`\`json
{
  "projects": [
    {
      "name": "Project Name",
      "description": "Project description",
      "tasks": [
        {
          "title": "Task title (specific and actionable)",
          "description": "Detailed task description",
          "priority": "P1" | "P2" | "P3" | "P4",
          "estimatedHours": 4,
          "requiredSkills": ["TypeScript", "NestJS"],
          "dependencies": ["Other task title that must complete first"],
          "acceptanceCriteria": [
            "Criteria 1",
            "Criteria 2"
          ]
        }
      ]
    }
  ]
}
\`\`\`

**Important Guidelines:**
- Tasks should follow existing patterns from the codebase
- Prioritize tasks: P1 (Critical), P2 (High), P3 (Medium), P4 (Low)
- Keep task titles clear and under 100 characters
- Ensure task descriptions are detailed enough for autonomous execution
- Dependencies should reference exact task titles
- Total tasks should be between 20-50 (aim for ~35)

Please provide the decomposition in JSON format only, no additional text.`;
  }

  /**
   * LLM 응답 파싱
   */
  private parseDecompositionResponse(response: string): ProjectDecomposition[] {
    try {
      // JSON 블록 추출
      const jsonMatch = response.match(/```json\n([\s\S]+?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : response;

      const parsed = JSON.parse(jsonString);

      if (!parsed.projects || !Array.isArray(parsed.projects)) {
        throw new Error('Invalid decomposition format: missing projects array');
      }

      return parsed.projects;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to parse decomposition response: ${err.message}`,
        err.stack,
      );
      throw new Error(
        `Failed to parse LLM response: ${err.message}. Response: ${response.substring(0, 200)}`,
      );
    }
  }

  /**
   * Project/Task 생성
   * Phase 3.8: Team-level tasks (TEAM_EPIC) assigned to teams
   */
  private async createWorkItems(
    goal: Goal,
    decomposition: ProjectDecomposition[],
    options?: DecompositionOptionsDto,
  ): Promise<DecompositionResult> {
    const createdProjects: Project[] = [];
    const createdTasks: Task[] = [];
    const taskTitleToId = new Map<string, string>();

    // Phase 3.8: Get all teams for team-level assignment
    const teams = await this.teamRepo.find({
      where: { organizationId: goal.organizationId },
      relations: ['manager', 'hollons'],
    });

    for (const projectDef of decomposition) {
      // Project 생성
      const project = this.projectRepo.create({
        organizationId: goal.organizationId,
        goalId: goal.id,
        name: projectDef.name,
        description: projectDef.description,
        status: ProjectStatus.ACTIVE,
      });

      const savedProject = await this.projectRepo.save(project);
      createdProjects.push(savedProject);

      // Phase 3.8: Create Team Tasks (Level 0) if teams exist
      // Otherwise fall back to individual hollon tasks
      if (teams.length > 0 && options?.useTeamDistribution) {
        // Group tasks by team (simple round-robin for now)
        // In production, this would use intelligent team matching
        const tasksPerTeam = Math.ceil(projectDef.tasks.length / teams.length);
        
        for (let i = 0; i < teams.length; i++) {
          const team = teams[i];
          const teamTasks = projectDef.tasks.slice(
            i * tasksPerTeam,
            (i + 1) * tasksPerTeam,
          );

          if (teamTasks.length === 0) continue;

          // Create Team Task (Level 0) - TEAM_EPIC
          const teamTask = this.taskRepo.create({
            organizationId: goal.organizationId,
            projectId: savedProject.id,
            title: `${team.name}: ${projectDef.name} - Batch ${i + 1}`,
            description: this.formatTeamTaskDescription(teamTasks),
            type: TaskType.TEAM_EPIC,
            priority: this.mapPriority('P2'), // Team tasks default to P2
            status: TaskStatus.PENDING,
            assignedTeamId: team.id,
            depth: 0, // Level 0
          });

          const savedTeamTask = await this.taskRepo.save(teamTask);
          createdTasks.push(savedTeamTask);

          this.logger.log(
            `Created Team Task "${savedTeamTask.title}" for team "${team.name}" with ${teamTasks.length} work items`,
          );
        }
      } else {
        // Fallback: Create individual tasks (original behavior)
        for (const taskDef of projectDef.tasks) {
          const task = this.taskRepo.create({
            organizationId: goal.organizationId,
            projectId: savedProject.id,
            title: taskDef.title,
            description: this.formatTaskDescription(taskDef),
            priority: this.mapPriority(taskDef.priority),
            status: TaskStatus.PENDING,
            depth: 0,
          });

          const savedTask = await this.taskRepo.save(task);
          createdTasks.push(savedTask);
          taskTitleToId.set(taskDef.title, savedTask.id);
        }
      }
    }

    // ✅ Phase 3 Week 15-16: autoAssign 통합
    // Goal 분해 직후 ResourcePlannerService로 자동 할당
    if (options?.autoAssign && createdProjects.length > 0 && !options?.useTeamDistribution) {
      this.logger.log(
        `Auto-assigning tasks for ${createdProjects.length} projects`,
      );

      for (const project of createdProjects) {
        try {
          const assignResult = await this.resourcePlanner.assignProject(
            project.id,
          );
          this.logger.log(
            `Project ${project.id}: ${assignResult.assignedCount}/${assignResult.totalTasks} tasks assigned`,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Failed to auto-assign project ${project.id}: ${errorMessage}`,
          );
          // 에러가 발생해도 다른 프로젝트는 계속 처리
        }
      }
    }

    return {
      projects: createdProjects,
      tasks: createdTasks,
      tasksCreated: createdTasks.length,
      projectsCreated: createdProjects.length,
      strategy: options?.strategy || DecompositionStrategy.TASK_BASED,
      metadata: {
        model: options?.preferredModel || 'claude-sonnet-4-5-20250929',
        processingTime: 0, // Will be set by caller
      },
    };
  }

  /**
   * Task description 포맷팅 (acceptance criteria 포함)
   */
  private formatTaskDescription(taskDef: TaskDecomposition): string {
    let description = taskDef.description;

    if (taskDef.dependencies && taskDef.dependencies.length > 0) {
      description += `\n\n**Dependencies:**\n${taskDef.dependencies.map((d) => `- ${d}`).join('\n')}`;
    }

    if (taskDef.acceptanceCriteria && taskDef.acceptanceCriteria.length > 0) {
      description += `\n\n**Acceptance Criteria:**\n${taskDef.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}`;
    }

    return description;
  }

  /**
   * Phase 3.8: Format Team Task description
   * Aggregates multiple task definitions into a team-level work package
   */
  private formatTeamTaskDescription(taskDefs: TaskDecomposition[]): string {
    let description = `This is a Team Task containing ${taskDefs.length} work items.\n\n`;
    description += `The team manager will distribute these items to team members as subtasks.\n\n`;
    description += `**Work Items:**\n`;

    taskDefs.forEach((taskDef, index) => {
      description += `\n${index + 1}. **${taskDef.title}**\n`;
      description += `   ${taskDef.description}\n`;
      description += `   Priority: ${taskDef.priority}\n`;
      
      if (taskDef.requiredSkills && taskDef.requiredSkills.length > 0) {
        description += `   Required Skills: ${taskDef.requiredSkills.join(', ')}\n`;
      }

      if (taskDef.acceptanceCriteria && taskDef.acceptanceCriteria.length > 0) {
        description += `   Acceptance Criteria:\n`;
        taskDef.acceptanceCriteria.forEach((c) => {
          description += `   - ${c}\n`;
        });
      }
    });

    return description;
  }

  /**
   * Priority 매핑
   */
  private mapPriority(priority: string): TaskPriority {
    switch (priority.toUpperCase()) {
      case 'P1':
      case 'CRITICAL':
        return TaskPriority.P1_CRITICAL;
      case 'P2':
      case 'HIGH':
        return TaskPriority.P2_HIGH;
      case 'P3':
      case 'MEDIUM':
        return TaskPriority.P3_MEDIUM;
      case 'P4':
      case 'LOW':
        return TaskPriority.P4_LOW;
      default:
        return TaskPriority.P3_MEDIUM;
    }
  }
}
