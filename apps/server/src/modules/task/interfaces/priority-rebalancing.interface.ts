import { Task, TaskPriority } from '../entities/task.entity';

export interface PriorityRebalancingResult {
  rebalancedTasks: Array<{
    task: Task;
    oldPriority: TaskPriority;
    newPriority: TaskPriority;
    reason: string;
    score: number;
  }>;
  bottlenecks: Array<{
    task: Task;
    blockedTasks: Task[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendation: string;
  }>;
  totalRebalanced: number;
  averageScoreChange: number;
  warnings: string[];
}

export interface PriorityScore {
  taskId: string;
  score: number; // 0-100
  factors: {
    dependencyWeight: number; // How many tasks depend on this
    criticalPathWeight: number; // Is it on critical path
    progressWeight: number; // Current progress status
    deadlineWeight: number; // Deadline proximity
    businessValueWeight: number; // Business priority
  };
  suggestedPriority: TaskPriority;
  reasoning: string;
}

export interface BottleneckDetection {
  task: Task;
  blockedTasks: Task[];
  blockedCount: number;
  estimatedImpact: number; // Hours of work blocked
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
}

export interface RebalancingOptions {
  includeCompleted?: boolean;
  minScoreChange?: number; // Minimum score change to trigger rebalancing
  respectManualPriority?: boolean; // Don't change manually set priorities
  dryRun?: boolean; // Return what would change without applying
}
