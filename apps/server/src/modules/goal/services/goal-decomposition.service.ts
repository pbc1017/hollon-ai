import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from '../entities/goal.entity';
import { Project, ProjectStatus } from '../../project/entities/project.entity';
import {
  Task,
  TaskPriority,
  TaskStatus,
} from '../../task/entities/task.entity';
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

@Injectable()
export class GoalDecompositionService {
  private readonly logger = new Logger(GoalDecompositionService.name);

  constructor(
    private readonly goalService: GoalService,
    private readonly brainProviderService: BrainProviderService,
    @InjectRepository(Goal)
    private readonly goalRepo: Repository<Goal>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
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
          workingDirectory: '/app',
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
        model: options?.preferredModel || 'claude-3-5-sonnet-20241022',
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
   */
  private async createWorkItems(
    goal: Goal,
    decomposition: ProjectDecomposition[],
    options?: DecompositionOptionsDto,
  ): Promise<DecompositionResult> {
    const createdProjects: Project[] = [];
    const createdTasks: Task[] = [];
    const taskTitleToId = new Map<string, string>();

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

      // Tasks 생성 (의존성 없이 먼저 생성)
      for (const taskDef of projectDef.tasks) {
        const task = this.taskRepo.create({
          organizationId: goal.organizationId,
          projectId: savedProject.id,
          title: taskDef.title,
          description: this.formatTaskDescription(taskDef),
          priority: this.mapPriority(taskDef.priority),
          status: TaskStatus.PENDING,
        });

        const savedTask = await this.taskRepo.save(task);
        createdTasks.push(savedTask);
        taskTitleToId.set(taskDef.title, savedTask.id);
      }
    }

    // TODO: Task 의존성 설정 (DependencyAnalyzer 구현 후)
    // 현재는 의존성 정보를 task description에 포함

    return {
      projects: createdProjects,
      tasks: createdTasks,
      tasksCreated: createdTasks.length,
      projectsCreated: createdProjects.length,
      strategy: options?.strategy || DecompositionStrategy.TASK_BASED,
      metadata: {
        model: options?.preferredModel || 'claude-3-5-sonnet-20241022',
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
