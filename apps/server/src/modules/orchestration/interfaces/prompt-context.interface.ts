/**
 * Context layers for prompt composition
 */

export interface OrganizationContext {
  name: string;
  description?: string;
  settings: {
    costLimitDailyCents: number;
    costLimitMonthlyCents: number;
    maxHollonsPerTeam: number;
    defaultTaskPriority: string;
  };
}

export interface TeamContext {
  name: string;
  description?: string;
  memberCount?: number;
}

export interface RoleContext {
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: string[];
}

export interface HollonContext {
  name: string;
  systemPrompt?: string;
  maxConcurrentTasks: number;
}

export interface MemoryContext {
  documents: Array<{
    title: string;
    content: string;
    type: string;
    relevance?: number;
  }>;
}

export interface TaskContext {
  title: string;
  description: string;
  acceptanceCriteria?: string[];
  affectedFiles?: string[];
  dependencies?: Array<{
    id: string;
    title: string;
  }>;
}

/**
 * Complete prompt composition result
 */
export interface ComposedPrompt {
  systemPrompt: string;
  userPrompt: string;
  totalTokens: number;
  layers: {
    organization: string;
    team: string;
    role: string;
    hollon: string;
    memories: string;
    task: string;
  };
}
