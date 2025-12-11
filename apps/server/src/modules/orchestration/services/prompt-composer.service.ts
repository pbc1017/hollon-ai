import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OrganizationContext,
  TeamContext,
  RoleContext,
  HollonContext,
  MemoryContext,
  TaskContext,
  ComposedPrompt,
} from '../interfaces/prompt-context.interface';
import { Organization } from '../../organization/entities/organization.entity';
import { Team } from '../../team/entities/team.entity';
import { Role } from '../../role/entities/role.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { Document } from '../../document/entities/document.entity';

/**
 * PromptComposerService
 *
 * 6-layer prompt composition system:
 * 1. Organization Context - company-wide settings and culture
 * 2. Team Context - team structure and goals
 * 3. Role Context - role-specific expertise and guidelines
 * 4. Hollon Context - individual hollon personality and preferences
 * 5. Memory Context - relevant documents and past experiences
 * 6. Task Context - specific task requirements
 */
@Injectable()
export class PromptComposerService {
  private readonly logger = new Logger(PromptComposerService.name);

  // Approximate token limits (characters * 0.25 for rough estimation)
  private readonly MAX_MEMORY_CHARS = 8000; // ~2000 tokens for memories

  constructor(
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
  ) {}

  /**
   * Compose complete prompt for hollon execution
   * Phase 3.10: Detects IN_REVIEW mode and delegates to review prompt
   */
  async composePrompt(
    hollonId: string,
    taskId: string,
  ): Promise<ComposedPrompt> {
    this.logger.log(`Composing prompt: hollon=${hollonId}, task=${taskId}`);

    // Load task first to check if it's in review mode
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['project', 'subtasks'],
    });

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Phase 3.10: Detect review mode
    if (task.status === 'in_review') {
      this.logger.log(`Task ${taskId} is IN_REVIEW - using review mode prompt`);
      const hollon = await this.hollonRepo.findOne({
        where: { id: hollonId },
        relations: ['organization', 'team', 'role'],
      });
      if (!hollon) {
        throw new Error(`Hollon not found: ${hollonId}`);
      }
      return this.composeReviewModePrompt(hollon, task);
    }

    // Normal mode: load hollon
    const hollon = await this.hollonRepo.findOne({
      where: { id: hollonId },
      relations: ['organization', 'team', 'role'],
    });

    if (!hollon) {
      throw new Error(`Hollon not found: ${hollonId}`);
    }

    // Extract contexts
    const orgContext = this.extractOrganizationContext(hollon.organization);
    const teamContext = this.extractTeamContext(hollon.team);
    const roleContext = this.extractRoleContext(hollon.role);
    const hollonContext = this.extractHollonContext(hollon);
    const taskContext = this.extractTaskContext(task);

    // Fetch relevant memories
    const memoryContext = await this.fetchRelevantMemories(
      task.projectId,
      hollonId,
      task.title + ' ' + task.description,
    );

    // Compose layers
    const layers = {
      organization: this.composeOrganizationLayer(orgContext),
      team: this.composeTeamLayer(teamContext),
      role: this.composeRoleLayer(roleContext),
      hollon: this.composeHollonLayer(hollonContext),
      memories: this.composeMemoryLayer(memoryContext),
      task: this.composeTaskLayer(taskContext),
    };

    // Combine into system and user prompts
    const systemPrompt = [
      layers.organization,
      layers.team,
      layers.role,
      layers.hollon,
      layers.memories,
    ]
      .filter((layer) => layer.trim().length > 0)
      .join('\n\n---\n\n');

    const userPrompt = layers.task;

    const totalChars = systemPrompt.length + userPrompt.length;
    const totalTokens = Math.ceil(totalChars * 0.25); // Rough estimation

    this.logger.log(
      `Prompt composed: ${totalTokens} tokens (approx), ` +
        `system=${systemPrompt.length} chars, user=${userPrompt.length} chars`,
    );

    return {
      systemPrompt,
      userPrompt,
      totalTokens,
      layers,
    };
  }

  private extractOrganizationContext(org: Organization): OrganizationContext {
    return {
      name: org.name,
      description: org.description ?? undefined,
      settings: org.settings as OrganizationContext['settings'],
    };
  }

  private extractTeamContext(team: Team): TeamContext {
    return {
      name: team.name,
      description: team.description,
    };
  }

  private extractRoleContext(role: Role): RoleContext {
    return {
      name: role.name,
      description: role.description,
      systemPrompt: role.systemPrompt,
      capabilities: role.capabilities,
    };
  }

  private extractHollonContext(hollon: Hollon): HollonContext {
    return {
      name: hollon.name,
      systemPrompt: hollon.systemPrompt,
      maxConcurrentTasks: hollon.maxConcurrentTasks,
    };
  }

  private extractTaskContext(task: Task): TaskContext {
    return {
      title: task.title,
      description: task.description,
      acceptanceCriteria: task.acceptanceCriteria,
      affectedFiles: task.affectedFiles,
      dependencies: [], // TODO: Load from task dependencies
      // Retry context for self-correction
      errorMessage: task.errorMessage ?? undefined,
      retryCount: task.retryCount,
    };
  }

  /**
   * Fetch relevant documents/memories for the task
   * Uses simple keyword matching for now (can be upgraded to vector search later)
   */
  private async fetchRelevantMemories(
    projectId: string,
    hollonId: string,
    searchText: string,
  ): Promise<MemoryContext> {
    // Extract keywords (simple approach: split and filter)
    const keywords = searchText
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 10); // Top 10 keywords

    if (keywords.length === 0) {
      return { documents: [] };
    }

    // Build ILIKE query for keyword matching
    const queryBuilder = this.documentRepo
      .createQueryBuilder('doc')
      .where('doc.project_id = :projectId', { projectId })
      .andWhere('(doc.hollon_id = :hollonId OR doc.hollon_id IS NULL)', {
        hollonId,
      })
      .orderBy('doc.created_at', 'DESC')
      .limit(10);

    // Add keyword filters (OR conditions)
    const orConditions = keywords.map((_keyword, index) => {
      return `(LOWER(doc.title) LIKE :keyword${index} OR LOWER(doc.content) LIKE :keyword${index})`;
    });

    if (orConditions.length > 0) {
      queryBuilder.andWhere(`(${orConditions.join(' OR ')})`);

      // Bind parameters
      keywords.forEach((keyword, index) => {
        queryBuilder.setParameter(`keyword${index}`, `%${keyword}%`);
      });
    }

    const documents = await queryBuilder.getMany();

    // Trim content if too long
    let totalChars = 0;
    const trimmedDocs = [];

    for (const doc of documents) {
      if (totalChars >= this.MAX_MEMORY_CHARS) {
        break;
      }

      const remainingChars = this.MAX_MEMORY_CHARS - totalChars;
      const content =
        doc.content.length > remainingChars
          ? doc.content.substring(0, remainingChars) + '...'
          : doc.content;

      trimmedDocs.push({
        title: doc.title,
        content,
        type: doc.type,
      });

      totalChars += content.length;
    }

    this.logger.log(
      `Fetched ${trimmedDocs.length} relevant documents (${totalChars} chars)`,
    );

    return { documents: trimmedDocs };
  }

  private composeOrganizationLayer(context: OrganizationContext): string {
    return `# Organization: ${context.name}

${context.description || ''}

Organization Settings:
- Daily Cost Limit: $${(context.settings.costLimitDailyCents / 100).toFixed(2)}
- Monthly Cost Limit: $${(context.settings.costLimitMonthlyCents / 100).toFixed(2)}
- Max Hollons Per Team: ${context.settings.maxHollonsPerTeam}
- Default Task Priority: ${context.settings.defaultTaskPriority}

You are part of ${context.name}. Keep the organization's cost limits and policies in mind.`;
  }

  private composeTeamLayer(context: TeamContext): string {
    return `# Team: ${context.name}

${context.description || ''}

You are a member of the "${context.name}" team. Collaborate effectively with your teammates.`;
  }

  private composeRoleLayer(context: RoleContext): string {
    return `# Your Role: ${context.name}

${context.description}

## Role-Specific Guidelines:
${context.systemPrompt}

## Your Capabilities:
${context.capabilities.map((cap) => `- ${cap}`).join('\n')}`;
  }

  private composeHollonLayer(context: HollonContext): string {
    if (!context.systemPrompt) {
      return `# Identity: ${context.name}

You are ${context.name}. You can handle up to ${context.maxConcurrentTasks} concurrent task(s).`;
    }

    return `# Identity: ${context.name}

${context.systemPrompt}

Max Concurrent Tasks: ${context.maxConcurrentTasks}`;
  }

  private composeMemoryLayer(context: MemoryContext): string {
    if (context.documents.length === 0) {
      return '';
    }

    const docsText = context.documents
      .map((doc, index) => {
        return `### Document ${index + 1}: ${doc.title} (${doc.type})

${doc.content}`;
      })
      .join('\n\n');

    return `# Relevant Context & Memories

The following documents may be relevant to your current task:

${docsText}`;
  }

  private composeTaskLayer(context: TaskContext): string {
    let taskPrompt = `# Your Task: ${context.title}

${context.description}`;

    if (context.acceptanceCriteria && context.acceptanceCriteria.length > 0) {
      taskPrompt += `\n\n## Acceptance Criteria:\n${context.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}`;
    }

    if (context.affectedFiles && context.affectedFiles.length > 0) {
      taskPrompt += `\n\n## Affected Files:\n${context.affectedFiles.map((f) => `- ${f}`).join('\n')}`;
    }

    if (context.dependencies && context.dependencies.length > 0) {
      taskPrompt += `\n\n## Dependencies:\nThis task depends on:\n${context.dependencies.map((d) => `- ${d.title} (${d.id})`).join('\n')}`;
    }

    // Include error context for retry attempts (self-correction)
    if (context.retryCount && context.retryCount > 0 && context.errorMessage) {
      taskPrompt += `\n\n## IMPORTANT: Previous Attempt Failed (Retry #${context.retryCount})

Your previous attempt to complete this task failed with the following error:

\`\`\`
${context.errorMessage}
\`\`\`

**Please carefully analyze this error and fix it in your implementation.**

Common issues to check:
- TypeScript type errors: Ensure all types are correctly defined and compatible
- Import errors: Verify all imports are correct and files exist
- Nullable types: Use \`| null\` or \`| undefined\` appropriately
- API contracts: Ensure method signatures match their usage

Before submitting, verify your code compiles without errors by mentally checking types.`;
    }

    return taskPrompt;
  }

  /**
   * Phase 3.10: Compose Review Mode Prompt
   *
   * LLM sees subtask results and decides next action:
   * 1. Complete - all subtasks satisfactory
   * 2. Rework - specific subtasks need improvements
   * 3. Add Tasks - additional work needed
   * 4. Redirect - change approach entirely
   */
  private async composeReviewModePrompt(
    hollon: Hollon,
    parentTask: Task,
  ): Promise<ComposedPrompt> {
    // Build system prompt (same 6-layer structure)
    const layers: string[] = [];

    if (hollon.organization) {
      const orgContext = this.extractOrganizationContext(hollon.organization);
      layers.push(this.composeOrganizationLayer(orgContext));
    }

    if (hollon.team) {
      const teamContext = this.extractTeamContext(hollon.team);
      layers.push(this.composeTeamLayer(teamContext));
    }

    if (hollon.role) {
      const roleContext = this.extractRoleContext(hollon.role);
      layers.push(this.composeRoleLayer(roleContext));
    }

    const hollonContext = this.extractHollonContext(hollon);
    layers.push(this.composeHollonLayer(hollonContext));

    const systemPrompt = layers
      .filter((layer) => layer.trim().length > 0)
      .join('\n\n---\n\n');

    // Load subtask results summary
    const subtaskSummary = await this.loadSubtaskSummary(parentTask);

    // Build review mode user prompt
    const userPrompt = `# 🔍 SUBTASK REVIEW MODE

You delegated "${parentTask.title}" to ${parentTask.subtasks.length} sub-tasks, and **all are now completed**.

## Original Task
**Title**: ${parentTask.title}
**Description**: ${parentTask.description}
${parentTask.acceptanceCriteria ? `**Acceptance Criteria**:\n${parentTask.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}` : ''}

## Subtask Results Summary

${subtaskSummary}

## 🎯 Your Decision

Carefully review the subtask results above and decide what to do next. You have 4 options:

### Option 1: Complete ✅
If all subtask results are satisfactory and meet the acceptance criteria, complete the parent task.

**Response format**:
\`\`\`json
{
  "action": "complete",
  "reasoning": "All subtasks completed successfully. [explain why]"
}
\`\`\`

### Option 2: Rework 🔄
If specific subtasks need improvements, request rework.

**Response format**:
\`\`\`json
{
  "action": "rework",
  "subtaskIds": ["<subtask-id-1>", "<subtask-id-2>"],
  "reasoning": "Subtask A needs improvement because [reason]",
  "reworkInstructions": "Please revise the implementation to [specific request]"
}
\`\`\`

### Option 3: Add Tasks ➕
If additional work is needed (e.g., integration tests, documentation), create new subtasks.

**Response format**:
\`\`\`json
{
  "action": "add_tasks",
  "newSubtasks": [
    {
      "title": "Integration tests",
      "description": "Add end-to-end tests for the feature",
      "type": "implementation",
      "roleId": "<role-id>",
      "dependencies": ["<subtask-id>"]
    }
  ],
  "reasoning": "Integration tests are needed because [reason]"
}
\`\`\`

### Option 4: Redirect 🔀
If the approach was wrong, cancel existing subtasks and create a new plan.

**Response format**:
\`\`\`json
{
  "action": "redirect",
  "cancelSubtaskIds": ["<subtask-id-1>", "<subtask-id-2>"],
  "newDirection": "New approach: [describe new strategy]",
  "reasoning": "The original approach failed because [reason]"
}
\`\`\`

**Current review count**: ${parentTask.reviewCount + 1}/3
${parentTask.reviewCount >= 2 ? '⚠️ This is the final review - must make a decision!' : ''}

Please analyze the subtask results and respond with ONE of the 4 options above.`;

    const totalTokens = Math.ceil(
      (systemPrompt.length + userPrompt.length) * 0.25,
    );

    this.logger.log(
      `Review mode prompt composed: ${totalTokens} tokens (approx)`,
    );

    return {
      systemPrompt,
      userPrompt,
      totalTokens,
      layers: {
        organization: hollon.organization
          ? this.composeOrganizationLayer(
              this.extractOrganizationContext(hollon.organization),
            )
          : '',
        team: hollon.team
          ? this.composeTeamLayer(this.extractTeamContext(hollon.team))
          : '',
        role: hollon.role
          ? this.composeRoleLayer(this.extractRoleContext(hollon.role))
          : '',
        hollon: this.composeHollonLayer(this.extractHollonContext(hollon)),
        memories: '', // Not used in review mode
        task: userPrompt,
      },
    };
  }

  /**
   * Phase 3.10: Load subtask results summary
   *
   * Fetches completed subtasks and their result documents to show LLM
   */
  private async loadSubtaskSummary(parentTask: Task): Promise<string> {
    const subtasks = parentTask.subtasks;

    if (!subtasks || subtasks.length === 0) {
      return 'No subtasks found.';
    }

    const summaries: string[] = [];

    for (const [index, subtask] of subtasks.entries()) {
      // Find result document for this subtask
      // Note: Using TASK_CONTEXT as TASK_RESULT doesn't exist in DocumentType enum
      const resultDoc = await this.documentRepo.findOne({
        where: {
          taskId: subtask.id,
        },
        order: { createdAt: 'DESC' },
      });

      const statusEmoji: Record<TaskStatus, string> = {
        [TaskStatus.PENDING]: '⏳',
        [TaskStatus.READY]: '🟢',
        [TaskStatus.IN_PROGRESS]: '🔄',
        [TaskStatus.READY_FOR_REVIEW]: '📝',
        [TaskStatus.IN_REVIEW]: '🔍',
        [TaskStatus.BLOCKED]: '⏸️',
        [TaskStatus.COMPLETED]: '✅',
        [TaskStatus.FAILED]: '❌',
        [TaskStatus.CANCELLED]: '🚫',
      };

      const emoji = statusEmoji[subtask.status] || '⚪';

      let summary = `
### ${index + 1}. ${emoji} ${subtask.title}
- **Status**: ${subtask.status}
- **Type**: ${subtask.type}`;

      if (subtask.description) {
        summary += `\n- **Description**: ${subtask.description}`;
      }

      if (resultDoc) {
        const resultPreview = resultDoc.content.slice(0, 500); // Max 500 chars
        summary += `\n- **Result**:\n\`\`\`\n${resultPreview}\n${resultDoc.content.length > 500 ? '... (truncated)' : ''}\n\`\`\``;
      }

      if (subtask.errorMessage) {
        summary += `\n- **Error**: ${subtask.errorMessage}`;
      }

      summaries.push(summary);
    }

    return summaries.join('\n');
  }

  /**
   * Phase 3.7: Compose Task Decomposition Prompt for Dynamic Sub-Hollon Delegation
   *
   * This prompt asks the Brain Provider (Claude) to decompose a complex task
   * into optimal subtasks with dependencies, dynamically selecting appropriate roles.
   */
  async composeTaskDecompositionPrompt(
    task: Task,
    availableRoles: Role[],
  ): Promise<string> {
    return `You are a task decomposition expert for a Hollon autonomous agent system.

**Complex Task to Decompose:**
- **Title**: ${task.title}
- **Description**: ${task.description}
- **Type**: ${task.type}
- **Complexity**: ${task.estimatedComplexity || 'unspecified'}
- **Story Points**: ${task.storyPoints || 'unspecified'}
- **Required Skills**: ${task.requiredSkills?.join(', ') || 'none specified'}
- **Affected Files**: ${task.affectedFiles?.join(', ') || 'none specified'}

**Available Roles for Temporary Sub-Hollons:**
${availableRoles
  .map(
    (role) =>
      `- **${role.name}** (ID: ${role.id})
  Capabilities: ${role.capabilities?.join(', ') || 'general'}
  System Prompt: ${role.systemPrompt?.substring(0, 100) || 'Standard agent'}...`,
  )
  .join('\n\n')}

**Your Task:**
Decompose this complex task into optimal subtasks following these principles:

1. **Minimize Dependencies**: Enable maximum parallelization
   - Only create sequential dependencies when absolutely necessary
   - Group parallel-executable tasks with same dependency

2. **Appropriate Role Assignment**: Select the best role for each subtask
   - Match role capabilities to subtask requirements
   - Distribute workload evenly across roles

3. **Independent Execution**: Each subtask should be self-contained
   - Clear, actionable description
   - Specific deliverables
   - Roughly equal story points (aim for 3-5 points per subtask)

4. **Dependency Strategy**:
   - Research/Planning first (no dependencies)
   - Design/Architecture second (depends on research)
   - Implementation tasks in parallel (depend on design)
   - Testing/Review last (depends on implementation)

**Output Requirements:**
Return ONLY valid JSON in this exact format (no markdown, no explanations outside JSON):

\`\`\`json
{
  "subtasks": [
    {
      "title": "Research authentication requirements and security standards",
      "description": "Analyze OAuth 2.0, JWT, and 2FA implementation patterns. Research security best practices and compliance requirements.",
      "type": "research",
      "roleId": "ROLE_ID_HERE",
      "dependencies": [],
      "estimatedHours": 4,
      "priority": "P1",
      "affectedFiles": []
    },
    {
      "title": "Design authentication architecture",
      "description": "Create system design for auth service, define API contracts, database schema, and integration points.",
      "type": "implementation",
      "roleId": "ROLE_ID_HERE",
      "dependencies": ["Research authentication requirements and security standards"],
      "estimatedHours": 6,
      "priority": "P1",
      "affectedFiles": ["src/auth/auth.service.ts"]
    },
    {
      "title": "Implement JWT authentication",
      "description": "Build JWT token generation, validation, and refresh logic.",
      "type": "implementation",
      "roleId": "ROLE_ID_HERE",
      "dependencies": ["Design authentication architecture"],
      "estimatedHours": 8,
      "priority": "P1",
      "affectedFiles": ["src/auth/jwt.strategy.ts"]
    },
    {
      "title": "Implement OAuth integration",
      "description": "Build OAuth 2.0 provider integration (Google, GitHub).",
      "type": "implementation",
      "roleId": "ROLE_ID_HERE",
      "dependencies": ["Design authentication architecture"],
      "estimatedHours": 8,
      "priority": "P1",
      "affectedFiles": ["src/auth/oauth.controller.ts"]
    },
    {
      "title": "Review and test authentication system",
      "description": "Write integration tests, security audit, and documentation.",
      "type": "review",
      "roleId": "ROLE_ID_HERE",
      "dependencies": ["Implement JWT authentication", "Implement OAuth integration"],
      "estimatedHours": 6,
      "priority": "P1",
      "affectedFiles": []
    }
  ],
  "reasoning": "Split into research phase first to establish requirements. Architecture design follows research. JWT and OAuth can be implemented in parallel after design is complete. Final review depends on all implementations.",
  "totalEstimatedHours": 32
}
\`\`\`

**CRITICAL REQUIREMENTS:**
- Use dependency TITLES exactly as they appear in the "title" field (NOT IDs)
- Ensure JSON is valid and parseable (no trailing commas, proper quotes)
- Use roleId values from the Available Roles list above
- Aim for 3-8 subtasks total (balance granularity with overhead)
- Return ONLY the JSON object, nothing else

Now decompose the task:`;
  }
}
