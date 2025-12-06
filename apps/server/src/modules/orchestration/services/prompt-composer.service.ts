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
import { Task } from '../../task/entities/task.entity';
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
   */
  async composePrompt(
    hollonId: string,
    taskId: string,
  ): Promise<ComposedPrompt> {
    this.logger.log(`Composing prompt: hollon=${hollonId}, task=${taskId}`);

    // Load all required entities
    const [hollon, task] = await Promise.all([
      this.hollonRepo.findOne({
        where: { id: hollonId },
        relations: ['organization', 'team', 'role'],
      }),
      this.taskRepo.findOne({
        where: { id: taskId },
        relations: ['project'],
      }),
    ]);

    if (!hollon) {
      throw new Error(`Hollon not found: ${hollonId}`);
    }
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
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
      description: org.description,
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

    return taskPrompt;
  }
}
