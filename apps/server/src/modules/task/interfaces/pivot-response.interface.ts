import { Task } from '../entities/task.entity';
import { Project } from '../../project/entities/project.entity';

export interface PivotAnalysisResult {
  affectedTasks: Array<{
    task: Task;
    impactLevel: 'low' | 'medium' | 'high' | 'critical';
    assetClassification: 'reuse' | 'archive' | 'discard';
    recommendation: string;
    estimatedEffort?: number; // Hours to adapt
  }>;
  affectedProjects: Array<{
    project: Project;
    impactLevel: 'low' | 'medium' | 'high' | 'critical';
    recommendation: string;
  }>;
  recreationPlan: TaskRecreationPlan[];
  totalImpactScore: number; // 0-100
  estimatedTransitionTime: number; // Hours
  warnings: string[];
  recommendations: string[];
}

export interface TaskRecreationPlan {
  title: string;
  description: string;
  priority: string;
  projectId: string;
  organizationId: string;
  reason: string;
  replacesTaskId?: string; // Original task being replaced
  reuseAssets?: string[]; // Assets from original task
}

export interface PivotContext {
  pivotType: 'strategic' | 'tactical' | 'technical';
  oldDirection: string;
  newDirection: string;
  affectedAreas?: string[]; // Features, modules, technologies
  timeline?: {
    effectiveDate: Date;
    transitionPeriod?: number; // Days
  };
}

export interface AssetAnalysis {
  task: Task;
  reusableAssets: string[];
  obsoleteAssets: string[];
  classification: 'reuse' | 'archive' | 'discard';
  reasoning: string;
}

export interface ImpactAssessment {
  task: Task;
  alignmentScore: number; // 0-100, how well task aligns with new direction
  adaptationCost: number; // 0-100, effort to adapt
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: 'continue' | 'adapt' | 'defer' | 'cancel';
}

export interface PivotOptions {
  autoArchiveTasks?: boolean; // Automatically archive discarded tasks
  autoCreateReplacements?: boolean; // Create replacement tasks
  preserveCompletedWork?: boolean; // Don't discard completed tasks
  dryRun?: boolean; // Simulate without making changes
}
