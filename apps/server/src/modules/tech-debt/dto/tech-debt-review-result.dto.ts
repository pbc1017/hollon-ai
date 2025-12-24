import { TechDebt } from '../entities/tech-debt.entity';

export interface TechDebtReviewResult {
  taskId: string;
  detectedDebts: TechDebt[];
  totalCount: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
  shouldBlock: boolean;
  blockReason?: string;
}

export interface TechDebtReviewOptions {
  checkCodeQuality?: boolean;
  checkArchitecture?: boolean;
  checkDocumentation?: boolean;
  checkTesting?: boolean;
  checkPerformance?: boolean;
  checkSecurity?: boolean;
  severityThreshold?: 'low' | 'medium' | 'high' | 'critical';
  autoCreateDebts?: boolean;
}

export interface TechDebtAnalysisResult {
  fileAnalysis: {
    file: string;
    issues: {
      type: string;
      severity: string;
      message: string;
      line?: number;
    }[];
  }[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };
}
