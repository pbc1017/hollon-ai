import { Task } from '../entities/task.entity';

export interface UncertaintyDetectionResult {
  uncertainTasks: Array<{
    task: Task;
    uncertaintyLevel: 'low' | 'medium' | 'high' | 'critical';
    uncertaintyFactors: string[];
    recommendedAction: 'spike' | 'research' | 'prototype' | 'expert_consult';
    confidence: number; // 0-100
  }>;
  spikesGenerated: SpikeTask[];
  totalUncertain: number;
  averageUncertaintyLevel: number;
  recommendations: string[];
}

export interface SpikeTask {
  title: string;
  description: string;
  parentTaskId: string;
  timeboxHours: number;
  acceptanceCriteria: string[];
  deliverables: string[];
  uncertaintyAddressed: string;
}

export interface UncertaintyAnalysis {
  task: Task;
  uncertaintyLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    lackOfRequirements: boolean;
    technicalUnknowns: boolean;
    dependencyUncertainty: boolean;
    scopeAmbiguity: boolean;
    riskFactors: string[];
  };
  confidence: number;
  reasoning: string;
  suggestedSpike?: SpikeTask;
}

export interface DecisionOptions {
  autoGenerateSpikes?: boolean; // Automatically create spike tasks
  maxSpikeHours?: number; // Maximum hours for a spike task
  includePrototypes?: boolean; // Generate prototype tasks
  expertConsultThreshold?: number; // Uncertainty level requiring expert
}
