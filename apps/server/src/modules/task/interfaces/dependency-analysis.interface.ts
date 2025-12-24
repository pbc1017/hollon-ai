import { Task } from '../entities/task.entity';

export interface TaskNode {
  task: Task;
  dependencies: string[]; // Task IDs
  dependents: string[]; // Task IDs that depend on this task
  depth: number; // Level in dependency tree
}

export interface ExecutionPhase {
  phase: number;
  tasks: Task[];
  canRunInParallel: boolean;
  estimatedDuration?: number;
}

export interface CriticalPath {
  tasks: Task[];
  totalDuration: number;
  bottlenecks: Task[];
}

export interface DependencyGraph {
  nodes: Map<string, TaskNode>;
  edges: Array<{ from: string; to: string }>;
  hasCycles: boolean;
  cycles?: string[][];
}

export interface DependencyAnalysisResult {
  graph: DependencyGraph;
  executionOrder: Task[]; // Topologically sorted tasks
  executionPhases: ExecutionPhase[]; // Tasks grouped by execution phase
  criticalPath: CriticalPath;
  parallelizationScore: number; // 0-100, how much can be parallelized
  warnings: string[];
}
