import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus, TaskPriority } from '../entities/task.entity';
import {
  UncertaintyDetectionResult,
  UncertaintyAnalysis,
  SpikeTask,
  DecisionOptions,
} from '../interfaces/uncertainty-decision.interface';

@Injectable()
export class UncertaintyDecisionService {
  private readonly logger = new Logger(UncertaintyDecisionService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  /**
   * 프로젝트의 모든 Task에서 불확실성 감지
   */
  async detectUncertainty(
    projectId: string,
    options?: DecisionOptions,
  ): Promise<UncertaintyDetectionResult> {
    this.logger.log(`Detecting uncertainty in project ${projectId}`);

    // 1. 프로젝트의 모든 활성 Task 조회
    const tasks = await this.taskRepo.find({
      where: {
        projectId,
        status: TaskStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
    });

    if (tasks.length === 0) {
      return this.createEmptyResult();
    }

    // 2. 각 Task의 불확실성 분석
    const analyses = await Promise.all(
      tasks.map((task) => this.analyzeTaskUncertainty(task)),
    );

    // 3. 불확실한 Task 필터링 (medium 이상)
    const uncertainTasks = analyses
      .filter((a) => a.uncertaintyLevel !== 'low')
      .map((a) => ({
        task: a.task,
        uncertaintyLevel: a.uncertaintyLevel,
        uncertaintyFactors: this.extractFactors(a.factors),
        recommendedAction: this.determineAction(a),
        confidence: a.confidence,
      }));

    // 4. Spike Task 생성 (옵션이 활성화된 경우)
    const spikesGenerated: SpikeTask[] = [];
    if (options?.autoGenerateSpikes) {
      for (const analysis of analyses) {
        if (
          analysis.uncertaintyLevel === 'high' ||
          analysis.uncertaintyLevel === 'critical'
        ) {
          if (analysis.suggestedSpike) {
            spikesGenerated.push(analysis.suggestedSpike);

            // DB에 Spike Task 생성
            await this.createSpikeTask(
              analysis.task,
              analysis.suggestedSpike,
              options,
            );
          }
        }
      }
    }

    // 5. 평균 불확실성 수준 계산
    const averageUncertaintyLevel = this.calculateAverageUncertainty(analyses);

    // 6. 추천 사항 생성
    const recommendations = this.generateRecommendations(
      uncertainTasks,
      spikesGenerated,
      options,
    );

    this.logger.log(
      `Uncertainty detection completed: ${uncertainTasks.length}/${tasks.length} uncertain tasks, ` +
        `${spikesGenerated.length} spikes generated`,
    );

    return {
      uncertainTasks,
      spikesGenerated,
      totalUncertain: uncertainTasks.length,
      averageUncertaintyLevel,
      recommendations,
    };
  }

  /**
   * 단일 Task의 불확실성 분석
   */
  async analyzeTaskUncertainty(task: Task): Promise<UncertaintyAnalysis> {
    const factors = {
      lackOfRequirements: false,
      technicalUnknowns: false,
      dependencyUncertainty: false,
      scopeAmbiguity: false,
      riskFactors: [] as string[],
    };

    // 1. 요구사항 부족 감지
    if (this.hasLackOfRequirements(task)) {
      factors.lackOfRequirements = true;
      factors.riskFactors.push('Requirements are incomplete or unclear');
    }

    // 2. 기술적 불확실성 감지
    if (this.hasTechnicalUnknowns(task)) {
      factors.technicalUnknowns = true;
      factors.riskFactors.push('Technical approach is uncertain');
    }

    // 3. 의존성 불확실성 감지
    if (await this.hasDependencyUncertainty(task)) {
      factors.dependencyUncertainty = true;
      factors.riskFactors.push('Dependencies are unclear or unstable');
    }

    // 4. 범위 모호성 감지
    if (this.hasScopeAmbiguity(task)) {
      factors.scopeAmbiguity = true;
      factors.riskFactors.push('Scope is not well-defined');
    }

    // 5. 불확실성 수준 계산
    const uncertaintyLevel = this.calculateUncertaintyLevel(factors);

    // 6. 신뢰도 계산
    const confidence = this.calculateConfidence(task, factors);

    // 7. 이유 설명
    const reasoning = this.generateReasoning(factors, uncertaintyLevel);

    // 8. Spike Task 제안 (high/critical인 경우)
    let suggestedSpike: SpikeTask | undefined;
    if (uncertaintyLevel === 'high' || uncertaintyLevel === 'critical') {
      suggestedSpike = this.generateSpikeTask(task, factors);
    }

    return {
      task,
      uncertaintyLevel,
      factors,
      confidence,
      reasoning,
      suggestedSpike,
    };
  }

  /**
   * 요구사항 부족 감지
   */
  private hasLackOfRequirements(task: Task): boolean {
    // 짧은 description 또는 acceptance criteria 부족
    if (!task.description || task.description.length < 50) {
      return true;
    }

    // "TBD", "TODO", "unclear" 등의 키워드 포함
    const uncertaintyKeywords = [
      'TBD',
      'TODO',
      'unclear',
      'not sure',
      'investigate',
      'figure out',
      '?',
    ];
    const lowerDesc = task.description.toLowerCase();
    return uncertaintyKeywords.some((keyword) =>
      lowerDesc.includes(keyword.toLowerCase()),
    );
  }

  /**
   * 기술적 불확실성 감지
   */
  private hasTechnicalUnknowns(task: Task): boolean {
    if (!task.description) return false;

    const technicalKeywords = [
      'research',
      'explore',
      'evaluate',
      'prototype',
      'proof of concept',
      'poc',
      'spike',
      'feasibility',
      'new technology',
      'unknown',
    ];

    const lowerDesc = task.description.toLowerCase();
    return technicalKeywords.some((keyword) => lowerDesc.includes(keyword));
  }

  /**
   * 의존성 불확실성 감지
   */
  private async hasDependencyUncertainty(task: Task): Promise<boolean> {
    if (!task.description) return false;

    // Dependencies 섹션에서 외부 의존성 확인
    const depMatch = task.description.match(
      /\*\*Dependencies:\*\*\n((?:- .+\n?)+)/,
    );
    if (!depMatch) return false;

    const dependencies = depMatch[1].toLowerCase();

    // 외부 시스템, API, 타팀 의존성 키워드
    const externalKeywords = [
      'external',
      'third-party',
      'api',
      'integration',
      'other team',
      'pending',
      'waiting',
    ];

    return externalKeywords.some((keyword) => dependencies.includes(keyword));
  }

  /**
   * 범위 모호성 감지
   */
  private hasScopeAmbiguity(task: Task): boolean {
    // Title이 모호한 경우
    if (!task.title || task.title.length < 10) {
      return true;
    }

    // "and", "or", "various", "multiple" 등 범위가 넓은 키워드
    const ambiguousKeywords = [
      'various',
      'multiple',
      'several',
      'many',
      'improve',
      'optimize',
      'refactor',
      'update',
    ];

    const lowerTitle = task.title.toLowerCase();
    return ambiguousKeywords.some((keyword) => lowerTitle.includes(keyword));
  }

  /**
   * 불확실성 수준 계산
   */
  private calculateUncertaintyLevel(
    factors: UncertaintyAnalysis['factors'],
  ): 'low' | 'medium' | 'high' | 'critical' {
    const riskCount = factors.riskFactors.length;

    if (riskCount === 0) return 'low';
    if (riskCount === 1) return 'medium';
    if (riskCount === 2) return 'high';
    return 'critical';
  }

  /**
   * 신뢰도 계산
   */
  private calculateConfidence(
    task: Task,
    factors: UncertaintyAnalysis['factors'],
  ): number {
    let confidence = 100;

    // Description 품질
    if (!task.description || task.description.length < 100) {
      confidence -= 20;
    }

    // Risk 요인 개수
    confidence -= factors.riskFactors.length * 15;

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * 이유 설명 생성
   */
  private generateReasoning(
    factors: UncertaintyAnalysis['factors'],
    level: string,
  ): string {
    if (factors.riskFactors.length === 0) {
      return 'Task is well-defined with clear requirements and approach';
    }

    return `${level.toUpperCase()} uncertainty: ${factors.riskFactors.join('; ')}`;
  }

  /**
   * Spike Task 생성
   */
  private generateSpikeTask(
    parentTask: Task,
    factors: UncertaintyAnalysis['factors'],
  ): SpikeTask {
    const uncertaintyType = this.determineUncertaintyType(factors);
    const timeboxHours = this.calculateSpikeHours(factors);

    return {
      title: `[SPIKE] ${uncertaintyType} for: ${parentTask.title}`,
      description: this.generateSpikeDescription(parentTask, factors),
      parentTaskId: parentTask.id,
      timeboxHours,
      acceptanceCriteria: this.generateSpikeAcceptanceCriteria(factors),
      deliverables: this.generateSpikeDeliverables(uncertaintyType),
      uncertaintyAddressed: factors.riskFactors.join(', '),
    };
  }

  /**
   * 불확실성 타입 결정
   */
  private determineUncertaintyType(
    factors: UncertaintyAnalysis['factors'],
  ): string {
    if (factors.technicalUnknowns) return 'Technical Research';
    if (factors.lackOfRequirements) return 'Requirements Analysis';
    if (factors.dependencyUncertainty) return 'Dependency Investigation';
    if (factors.scopeAmbiguity) return 'Scope Definition';
    return 'General Research';
  }

  /**
   * Spike 시간 계산
   */
  private calculateSpikeHours(factors: UncertaintyAnalysis['factors']): number {
    const baseHours = 4; // 최소 4시간
    const riskCount = factors.riskFactors.length;

    // 위험 요인당 2시간 추가, 최대 16시간
    return Math.min(16, baseHours + riskCount * 2);
  }

  /**
   * Spike Description 생성
   */
  private generateSpikeDescription(
    parentTask: Task,
    factors: UncertaintyAnalysis['factors'],
  ): string {
    return `**Purpose**: Time-boxed investigation to reduce uncertainty before implementing "${parentTask.title}"

**Uncertainty Factors**:
${factors.riskFactors.map((f) => `- ${f}`).join('\n')}

**Goal**: Gather enough information to confidently estimate and implement the parent task.

**Time-box**: ${this.calculateSpikeHours(factors)} hours maximum

**Approach**:
- Research and document findings
- Create proof of concept if needed
- Identify risks and mitigation strategies
- Provide clear go/no-go recommendation

**Parent Task**: ${parentTask.title} (ID: ${parentTask.id})
`;
  }

  /**
   * Spike Acceptance Criteria 생성
   */
  private generateSpikeAcceptanceCriteria(
    factors: UncertaintyAnalysis['factors'],
  ): string[] {
    const criteria: string[] = [
      'All identified uncertainties are investigated and documented',
      'Technical approach is validated (or alternatives identified)',
      'Risks and mitigation strategies are documented',
      'Clear recommendation is provided (proceed/pivot/abort)',
    ];

    if (factors.lackOfRequirements) {
      criteria.push('Requirements are clarified and documented');
    }

    if (factors.technicalUnknowns) {
      criteria.push('Proof of concept demonstrates feasibility');
    }

    if (factors.dependencyUncertainty) {
      criteria.push('External dependencies are verified and documented');
    }

    return criteria;
  }

  /**
   * Spike Deliverables 생성
   */
  private generateSpikeDeliverables(uncertaintyType: string): string[] {
    const baseDeliverables = [
      'Investigation summary document',
      'Recommendation with justification',
      'Updated task estimates (if proceeding)',
    ];

    if (uncertaintyType === 'Technical Research') {
      baseDeliverables.push('Proof of concept code (if applicable)');
      baseDeliverables.push('Technical approach documentation');
    }

    if (uncertaintyType === 'Requirements Analysis') {
      baseDeliverables.push('Clarified requirements document');
      baseDeliverables.push('User stories or acceptance criteria');
    }

    return baseDeliverables;
  }

  /**
   * DB에 Spike Task 생성
   */
  private async createSpikeTask(
    parentTask: Task,
    spike: SpikeTask,
    _options?: DecisionOptions,
  ): Promise<Task> {
    const spikeTask = this.taskRepo.create({
      title: spike.title,
      description: spike.description,
      projectId: parentTask.projectId,
      organizationId: parentTask.organizationId,
      priority: TaskPriority.P2_HIGH, // Spike는 높은 우선순위
      status: TaskStatus.PENDING,
      parentTaskId: spike.parentTaskId,
    });

    const created = await this.taskRepo.save(spikeTask);

    this.logger.log(
      `Created spike task "${spike.title}" for parent task ${parentTask.id}`,
    );

    return created;
  }

  /**
   * 불확실성 요인 추출
   */
  private extractFactors(factors: UncertaintyAnalysis['factors']): string[] {
    const result: string[] = [];

    if (factors.lackOfRequirements) result.push('Incomplete requirements');
    if (factors.technicalUnknowns) result.push('Technical unknowns');
    if (factors.dependencyUncertainty) result.push('Unclear dependencies');
    if (factors.scopeAmbiguity) result.push('Ambiguous scope');

    return result;
  }

  /**
   * 추천 액션 결정
   */
  private determineAction(
    analysis: UncertaintyAnalysis,
  ): 'spike' | 'research' | 'prototype' | 'expert_consult' {
    if (
      analysis.uncertaintyLevel === 'critical' &&
      analysis.factors.technicalUnknowns
    ) {
      return 'expert_consult';
    }

    if (analysis.factors.technicalUnknowns) {
      return 'prototype';
    }

    if (
      analysis.factors.lackOfRequirements ||
      analysis.factors.scopeAmbiguity
    ) {
      return 'research';
    }

    return 'spike';
  }

  /**
   * 평균 불확실성 계산
   */
  private calculateAverageUncertainty(analyses: UncertaintyAnalysis[]): number {
    if (analyses.length === 0) return 0;

    const levelScores = {
      low: 25,
      medium: 50,
      high: 75,
      critical: 100,
    };

    const totalScore = analyses.reduce(
      (sum, a) => sum + levelScores[a.uncertaintyLevel],
      0,
    );

    return totalScore / analyses.length;
  }

  /**
   * 추천 사항 생성
   */
  private generateRecommendations(
    uncertainTasks: Array<any>,
    spikesGenerated: SpikeTask[],
    _options?: DecisionOptions,
  ): string[] {
    const recommendations: string[] = [];

    const criticalCount = uncertainTasks.filter(
      (t) => t.uncertaintyLevel === 'critical',
    ).length;
    if (criticalCount > 0) {
      recommendations.push(
        `${criticalCount} task(s) have critical uncertainty - consider expert consultation`,
      );
    }

    const highCount = uncertainTasks.filter(
      (t) => t.uncertaintyLevel === 'high',
    ).length;
    if (highCount > 0) {
      recommendations.push(
        `${highCount} task(s) require spike tasks before implementation`,
      );
    }

    if (spikesGenerated.length > 0) {
      recommendations.push(
        `${spikesGenerated.length} spike task(s) generated - prioritize these to reduce uncertainty`,
      );
    }

    const totalUncertain = uncertainTasks.length;
    if (totalUncertain > 5) {
      recommendations.push(
        'High number of uncertain tasks - consider breaking down or clarifying requirements',
      );
    }

    return recommendations;
  }

  /**
   * 빈 결과 생성
   */
  private createEmptyResult(): UncertaintyDetectionResult {
    return {
      uncertainTasks: [],
      spikesGenerated: [],
      totalUncertain: 0,
      averageUncertaintyLevel: 0,
      recommendations: ['No pending tasks found to analyze'],
    };
  }
}
