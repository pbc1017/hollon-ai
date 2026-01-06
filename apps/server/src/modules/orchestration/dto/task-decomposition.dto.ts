/**
 * Phase 3.7: Dynamic Sub-Hollon Delegation DTOs
 *
 * These DTOs define the structure for Brain Provider's task decomposition responses.
 */

/**
 * Specification for a single subtask in the decomposition
 */
export interface SubtaskSpec {
  /** Title of the subtask */
  title: string;

  /** Detailed description of what needs to be done */
  description: string;

  /** Task type (research, implementation, review, etc.) */
  type: string;

  /** Role ID from available roles for this subtask */
  roleId: string;

  /**
   * Dependencies: array of subtask TITLES (not IDs)
   * that must be completed before this subtask can start
   */
  dependencies: string[];

  /** Estimated hours to complete (optional) */
  estimatedHours?: number;

  /** Priority level (P1, P2, P3, P4) */
  priority?: string;

  /** Files that will be affected by this subtask (optional) */
  affectedFiles?: string[];
}

/**
 * Result of Brain Provider's task decomposition
 */
export interface TaskDecompositionResult {
  /** Array of subtask specifications */
  subtasks: SubtaskSpec[];

  /** Brain's reasoning for this decomposition strategy (optional) */
  reasoning?: string;

  /** Estimated total time for all subtasks (optional) */
  totalEstimatedHours?: number;
}

/**
 * Input for task decomposition request
 */
export interface TaskDecompositionRequest {
  /** The complex task to decompose */
  taskId: string;
  title: string;
  description: string;
  type: string;
  complexity?: string;
  storyPoints?: number;
  requiredSkills?: string[];
  affectedFiles?: string[];

  /** Available roles that can be used for temporary hollons */
  availableRoles: Array<{
    id: string;
    name: string;
    capabilities: string[];
    systemPrompt?: string;
  }>;
}
