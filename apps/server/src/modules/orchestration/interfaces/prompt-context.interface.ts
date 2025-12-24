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
  // Retry context for self-correction
  errorMessage?: string;
  retryCount?: number;
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

/**
 * Template for composing prompts with variable placeholders
 * Supports dynamic variable substitution and metadata for template management
 */
export interface PromptTemplate {
  /**
   * Unique identifier for the template
   */
  id: string;

  /**
   * Human-readable name for the template
   */
  name: string;

  /**
   * Template content with variable placeholders (e.g., {{variableName}})
   */
  content: string;

  /**
   * Map of variable names to their descriptions and default values
   */
  variables: Record<
    string,
    {
      description: string;
      defaultValue?: string;
      required: boolean;
    }
  >;

  /**
   * Template metadata for categorization and version management
   */
  metadata: {
    /**
     * Template version for tracking changes
     */
    version: string;

    /**
     * Category or purpose of the template (e.g., 'task', 'review', 'decomposition')
     */
    category: string;

    /**
     * Tags for filtering and search
     */
    tags: string[];

    /**
     * When the template was created
     */
    createdAt: Date;

    /**
     * When the template was last updated
     */
    updatedAt: Date;

    /**
     * Optional author or owner information
     */
    author?: string;
  };
}

/**
 * Knowledge context with retrieved items and relevance scoring
 * Used for RAG (Retrieval-Augmented Generation) in prompt composition
 */
export interface KnowledgeContext {
  /**
   * Array of retrieved knowledge items with content and metadata
   */
  retrievedItems: Array<{
    /**
     * Unique identifier for the knowledge item
     */
    id: string;

    /**
     * Content of the knowledge item
     */
    content: string;

    /**
     * Type or category of knowledge (e.g., 'document', 'code', 'conversation')
     */
    type: string;

    /**
     * Relevance score (0-1) indicating how relevant this item is to the query
     */
    relevanceScore: number;

    /**
     * Optional title or summary of the knowledge item
     */
    title?: string;

    /**
     * Optional source information (e.g., file path, URL, document ID)
     */
    source?: string;

    /**
     * Optional timestamp when the knowledge item was created or last updated
     */
    timestamp?: Date;

    /**
     * Optional metadata for additional context
     */
    metadata?: Record<string, unknown>;
  }>;

  /**
   * Query that was used to retrieve these items
   */
  query: string;

  /**
   * Total number of items retrieved before filtering
   */
  totalRetrieved: number;

  /**
   * Minimum relevance score threshold used for filtering
   */
  minRelevanceScore: number;
}

/**
 * Configuration for token budget allocation across prompt layers
 * Ensures prompts stay within model context limits
 */
export interface TokenBudgetConfiguration {
  /**
   * Maximum total tokens allowed for the entire prompt
   */
  maxTotalTokens: number;

  /**
   * Allocation rules for different prompt layers
   */
  layerAllocations: {
    /**
     * Maximum tokens for organization layer
     */
    organization: number;

    /**
     * Maximum tokens for team layer
     */
    team: number;

    /**
     * Maximum tokens for role layer
     */
    role: number;

    /**
     * Maximum tokens for hollon identity layer
     */
    hollon: number;

    /**
     * Maximum tokens for memory/knowledge layer
     */
    memories: number;

    /**
     * Maximum tokens for task layer
     */
    task: number;

    /**
     * Reserved tokens for system instructions and formatting
     */
    systemReserved: number;
  };

  /**
   * Strategy for handling budget overflow
   */
  overflowStrategy: 'truncate' | 'prioritize' | 'error';

  /**
   * Priority order for layers when using 'prioritize' overflow strategy
   * Higher number = higher priority
   */
  layerPriorities?: {
    organization?: number;
    team?: number;
    role?: number;
    hollon?: number;
    memories?: number;
    task?: number;
  };

  /**
   * Whether to enable dynamic reallocation of unused budget from one layer to another
   */
  enableDynamicReallocation: boolean;
}
