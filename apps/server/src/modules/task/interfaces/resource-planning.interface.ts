import { Task } from '../entities/task.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';

export interface HollonWorkload {
  hollon: Hollon;
  assignedTasks: Task[];
  totalTasks: number;
  utilizationScore: number; // 0-100
  skills: string[];
  availability: 'available' | 'busy' | 'overloaded';
}

export interface TaskAssignmentRecommendation {
  task: Task;
  recommendedHollon: Hollon | null;
  matchScore: number; // 0-100
  reasoning: string;
  alternatives: Array<{
    hollon: Hollon;
    score: number;
    reason: string;
  }>;
}

export interface ResourcePlanningResult {
  assignments: Array<{
    task: Task;
    hollon: Hollon;
    matchScore: number;
  }>;
  workloads: HollonWorkload[];
  assignedTasks: number;
  unassignedTasks: number;
  averageMatchScore: number;
  warnings: string[];
}

export interface SkillRequirement {
  skill: string;
  required: boolean; // true = must have, false = nice to have
  proficiencyLevel?: number; // 1-5
}
