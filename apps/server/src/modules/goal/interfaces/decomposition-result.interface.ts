import { Project } from '../../project/entities/project.entity';
import { Task } from '../../task/entities/task.entity';

export interface TaskDecomposition {
  title: string;
  description: string;
  priority: string;
  estimatedHours?: number;
  requiredSkills?: string[];
  dependencies?: string[]; // Task titles that this depends on
  acceptanceCriteria?: string[];
}

export interface ProjectDecomposition {
  name: string;
  description: string;
  tasks: TaskDecomposition[];
}

export interface DecompositionResult {
  projects: Project[];
  tasks: Task[];
  tasksCreated: number;
  projectsCreated: number;
  strategy: string;
  metadata: {
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    processingTime: number;
  };
}

export interface DecompositionContext {
  organizationId: string;
  teamId?: string;
  existingPatterns: string[];
  existingProjects: Array<{ name: string; description: string }>;
  teamSkills?: string[];
  availableHollons?: number;
}
