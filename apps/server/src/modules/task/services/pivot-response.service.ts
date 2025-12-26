import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Task, TaskStatus, TaskPriority } from '../entities/task.entity';
import { Project } from '../../project/entities/project.entity';
import {
  PivotAnalysisResult,
  PivotContext,
  TaskRecreationPlan,
  AssetAnalysis,
  ImpactAssessment,
  PivotOptions,
} from '../interfaces/pivot-response.interface';

@Injectable()
export class PivotResponseService {
  private readonly logger = new Logger(PivotResponseService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  /**
   * 전략적 Pivot에 대한 영향 분석 및 대응
   */
  async analyzePivot(
    projectId: string,
    pivotContext: PivotContext,
    options?: PivotOptions,
  ): Promise<PivotAnalysisResult> {
    this.logger.log(
      `Analyzing pivot impact for project ${projectId}: ${pivotContext.oldDirection} → ${pivotContext.newDirection}`,
    );

    // 1. 영향받는 Task 조회
    const affectedTasks = await this.findAffectedTasks(projectId, pivotContext);

    if (affectedTasks.length === 0) {
      return this.createEmptyResult();
    }

    // 2. 각 Task의 영향 평가
    const impactAssessments = await Promise.all(
      affectedTasks.map((task) => this.assessTaskImpact(task, pivotContext)),
    );

    // 3. Asset 분류 (재사용/보관/폐기)
    const assetAnalyses = impactAssessments.map((assessment) =>
      this.classifyAssets(assessment, pivotContext),
    );

    // 4. Task 재생성 계획 수립
    const recreationPlan = this.createRecreationPlan(
      assetAnalyses,
      pivotContext,
    );

    // 5. 영향받는 프로젝트 분석 (다른 프로젝트에 의존성이 있는 경우)
    const affectedProjects = await this.analyzeProjectImpact(
      projectId,
      affectedTasks,
    );

    // 6. 총 영향 점수 계산
    const totalImpactScore = this.calculateTotalImpact(impactAssessments);

    // 7. 전환 소요 시간 추정
    const estimatedTransitionTime = this.estimateTransitionTime(
      impactAssessments,
      recreationPlan,
    );

    // 8. 실제 변경 적용 (dry-run이 아닌 경우)
    if (!options?.dryRun) {
      await this.applyPivotChanges(assetAnalyses, recreationPlan, options);
    }

    // 9. 경고 및 추천 생성
    const warnings = this.generateWarnings(impactAssessments, totalImpactScore);
    const recommendations = this.generateRecommendations(
      impactAssessments,
      assetAnalyses,
      pivotContext,
    );

    this.logger.log(
      `Pivot analysis completed: ${affectedTasks.length} tasks affected, ` +
        `impact score: ${totalImpactScore.toFixed(1)}, ` +
        `transition time: ${estimatedTransitionTime}h`,
    );

    return {
      affectedTasks: impactAssessments.map((assessment, idx) => ({
        task: assessment.task,
        impactLevel: assessment.impactLevel,
        assetClassification: assetAnalyses[idx].classification,
        recommendation: this.getRecommendationText(assessment),
        estimatedEffort: assessment.adaptationCost * 0.1, // Convert to hours
      })),
      affectedProjects,
      recreationPlan,
      totalImpactScore,
      estimatedTransitionTime,
      warnings,
      recommendations,
    };
  }

  /**
   * 영향받는 Task 찾기
   */
  private async findAffectedTasks(
    projectId: string,
    pivotContext: PivotContext,
  ): Promise<Task[]> {
    // 완료되지 않은 모든 Task 조회
    const tasks = await this.taskRepo.find({
      where: {
        projectId,
        status: In([
          TaskStatus.PENDING,
          TaskStatus.READY,
          TaskStatus.IN_PROGRESS,
          TaskStatus.IN_REVIEW,
          TaskStatus.BLOCKED,
        ]),
      },
      order: { createdAt: 'ASC' },
    });

    // affectedAreas가 지정된 경우 필터링
    if (pivotContext.affectedAreas && pivotContext.affectedAreas.length > 0) {
      return tasks.filter((task) =>
        this.isTaskInAffectedArea(task, pivotContext.affectedAreas!),
      );
    }

    return tasks;
  }

  /**
   * Task가 영향받는 영역에 포함되는지 확인
   */
  private isTaskInAffectedArea(task: Task, affectedAreas: string[]): boolean {
    const taskText = `${task.title} ${task.description}`.toLowerCase();

    return affectedAreas.some((area) => taskText.includes(area.toLowerCase()));
  }

  /**
   * Task의 영향 평가
   */
  private async assessTaskImpact(
    task: Task,
    pivotContext: PivotContext,
  ): Promise<ImpactAssessment> {
    // 1. Alignment Score 계산 (새로운 방향과 얼마나 일치하는가)
    const alignmentScore = this.calculateAlignmentScore(task, pivotContext);

    // 2. Adaptation Cost 계산 (적응하는데 얼마나 들까)
    const adaptationCost = this.calculateAdaptationCost(
      task,
      pivotContext,
      alignmentScore,
    );

    // 3. Impact Level 결정
    const impactLevel = this.determineImpactLevel(
      alignmentScore,
      adaptationCost,
      task,
    );

    // 4. 추천 액션 결정
    const recommendation = this.determineRecommendation(
      alignmentScore,
      adaptationCost,
      task,
    );

    return {
      task,
      alignmentScore,
      adaptationCost,
      impactLevel,
      recommendation,
    };
  }

  /**
   * 새로운 방향과의 일치도 계산
   */
  private calculateAlignmentScore(
    task: Task,
    pivotContext: PivotContext,
  ): number {
    let score = 50; // Base score

    const taskText = `${task.title} ${task.description}`.toLowerCase();
    const newDirection = pivotContext.newDirection.toLowerCase();
    const oldDirection = pivotContext.oldDirection.toLowerCase();

    // 새로운 방향의 키워드 포함 여부
    const newKeywords = newDirection.split(' ');
    const matchCount = newKeywords.filter((keyword) =>
      taskText.includes(keyword),
    ).length;

    score += Math.min(30, matchCount * 10);

    // 이전 방향의 키워드 포함 여부 (감점)
    const oldKeywords = oldDirection.split(' ');
    const oldMatchCount = oldKeywords.filter((keyword) =>
      taskText.includes(keyword),
    ).length;

    score -= Math.min(30, oldMatchCount * 10);

    // 진행 상태 고려 (완료에 가까울수록 유지하려는 경향)
    if (task.status === TaskStatus.IN_REVIEW) {
      score += 15;
    } else if (task.status === TaskStatus.IN_PROGRESS) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 적응 비용 계산
   */
  private calculateAdaptationCost(
    task: Task,
    _pivotContext: PivotContext,
    alignmentScore: number,
  ): number {
    let cost = 50; // Base cost

    // Alignment가 낮을수록 비용 증가
    cost += (100 - alignmentScore) * 0.3;

    // 진행 상태에 따른 비용 (더 진행될수록 변경 비용 증가)
    switch (task.status) {
      case TaskStatus.IN_REVIEW:
        cost += 30;
        break;
      case TaskStatus.IN_PROGRESS:
        cost += 20;
        break;
      case TaskStatus.READY:
        cost += 10;
        break;
      case TaskStatus.PENDING:
        cost += 0;
        break;
    }

    // Complexity에 따른 비용
    if (task.estimatedComplexity === 'high') {
      cost += 20;
    } else if (task.estimatedComplexity === 'medium') {
      cost += 10;
    }

    return Math.max(0, Math.min(100, cost));
  }

  /**
   * Impact Level 결정
   */
  private determineImpactLevel(
    alignmentScore: number,
    adaptationCost: number,
    _task: Task,
  ): 'low' | 'medium' | 'high' | 'critical' {
    const combinedScore = (100 - alignmentScore + adaptationCost) / 2;

    if (combinedScore >= 75) return 'critical';
    if (combinedScore >= 60) return 'high';
    if (combinedScore >= 40) return 'medium';
    return 'low';
  }

  /**
   * 추천 액션 결정
   */
  private determineRecommendation(
    alignmentScore: number,
    adaptationCost: number,
    task: Task,
  ): 'continue' | 'adapt' | 'defer' | 'cancel' {
    // High alignment, low cost -> Continue
    if (alignmentScore >= 70 && adaptationCost < 30) {
      return 'continue';
    }

    // Medium alignment, medium cost -> Adapt
    if (alignmentScore >= 40 && adaptationCost < 60) {
      return 'adapt';
    }

    // Low alignment, high cost -> Cancel (unless already in progress)
    if (alignmentScore < 40 && adaptationCost >= 60) {
      if (
        task.status === TaskStatus.IN_PROGRESS ||
        task.status === TaskStatus.IN_REVIEW
      ) {
        return 'defer'; // Don't cancel in-progress work immediately
      }
      return 'cancel';
    }

    // Default -> Defer for review
    return 'defer';
  }

  /**
   * Asset 분류
   */
  private classifyAssets(
    assessment: ImpactAssessment,
    _pivotContext: PivotContext,
  ): AssetAnalysis {
    const { task, recommendation, alignmentScore } = assessment;

    let classification: 'reuse' | 'archive' | 'discard';
    const reusableAssets: string[] = [];
    const obsoleteAssets: string[] = [];

    if (recommendation === 'continue' || recommendation === 'adapt') {
      classification = 'reuse';
      reusableAssets.push('Task requirements', 'Existing implementation');

      if (alignmentScore >= 50) {
        reusableAssets.push('Test cases', 'Documentation');
      }
    } else if (recommendation === 'defer') {
      classification = 'archive';
      reusableAssets.push('Requirements documentation');
      obsoleteAssets.push('Current implementation approach');
    } else {
      // cancel
      classification = 'discard';
      obsoleteAssets.push('All task assets');

      // 완료된 작업이 있다면 일부는 보관
      if (
        task.status === TaskStatus.IN_PROGRESS ||
        task.status === TaskStatus.IN_REVIEW
      ) {
        reusableAssets.push('Learning and insights from progress');
      }
    }

    const reasoning = this.generateAssetReasoning(
      classification,
      recommendation,
      alignmentScore,
    );

    return {
      task,
      reusableAssets,
      obsoleteAssets,
      classification,
      reasoning,
    };
  }

  /**
   * Asset 분류 이유 생성
   */
  private generateAssetReasoning(
    classification: string,
    recommendation: string,
    alignmentScore: number,
  ): string {
    if (classification === 'reuse') {
      return `Task aligns well with new direction (score: ${alignmentScore.toFixed(0)}). ${recommendation === 'continue' ? 'Continue as-is' : 'Adapt and reuse assets'}.`;
    } else if (classification === 'archive') {
      return `Task has moderate alignment (score: ${alignmentScore.toFixed(0)}). Archive for potential future use.`;
    } else {
      return `Task does not align with new direction (score: ${alignmentScore.toFixed(0)}). Discard and recreate if needed.`;
    }
  }

  /**
   * Task 재생성 계획 수립
   */
  private createRecreationPlan(
    assetAnalyses: AssetAnalysis[],
    pivotContext: PivotContext,
  ): TaskRecreationPlan[] {
    const recreationPlan: TaskRecreationPlan[] = [];

    // Cancel된 Task 중 재생성이 필요한 것들
    const cancelledTasks = assetAnalyses.filter(
      (analysis) => analysis.classification === 'discard',
    );

    for (const analysis of cancelledTasks) {
      const originalTask = analysis.task;

      // Critical priority이거나 진행 중이던 Task는 재생성
      if (
        originalTask.priority === TaskPriority.P1_CRITICAL ||
        originalTask.status === TaskStatus.IN_PROGRESS
      ) {
        recreationPlan.push({
          title: `${originalTask.title} (Revised for ${pivotContext.newDirection})`,
          description: this.generateRevisedDescription(
            originalTask,
            pivotContext,
          ),
          priority: originalTask.priority,
          projectId: originalTask.projectId,
          organizationId: originalTask.organizationId,
          reason: `Recreation due to pivot: ${pivotContext.oldDirection} → ${pivotContext.newDirection}`,
          replacesTaskId: originalTask.id,
          reuseAssets: analysis.reusableAssets,
        });
      }
    }

    return recreationPlan;
  }

  /**
   * 수정된 Description 생성
   */
  private generateRevisedDescription(
    originalTask: Task,
    pivotContext: PivotContext,
  ): string {
    return `**Revised Task** (Post-Pivot)

**Original Context**: ${pivotContext.oldDirection}
**New Direction**: ${pivotContext.newDirection}

**Original Requirements**:
${originalTask.description}

**Revision Notes**:
- This task has been recreated to align with the new strategic direction
- Review and update requirements based on: ${pivotContext.newDirection}
- Reuse applicable assets from original task (ID: ${originalTask.id})

**Action Required**:
1. Review original task and extract reusable components
2. Align implementation approach with new direction
3. Update acceptance criteria accordingly
`;
  }

  /**
   * 프로젝트 영향 분석
   */
  private async analyzeProjectImpact(
    projectId: string,
    _affectedTasks: Task[],
  ): Promise<
    Array<{
      project: Project;
      impactLevel: 'low' | 'medium' | 'high' | 'critical';
      recommendation: string;
    }>
  > {
    // 현재는 단일 프로젝트만 분석
    // TODO: 프로젝트 간 의존성이 있는 경우 추가 분석
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });

    if (!project) {
      return [];
    }

    return [
      {
        project,
        impactLevel: 'high',
        recommendation: 'Review project goals and timeline after pivot',
      },
    ];
  }

  /**
   * 총 영향 점수 계산
   */
  private calculateTotalImpact(assessments: ImpactAssessment[]): number {
    if (assessments.length === 0) return 0;

    const totalScore = assessments.reduce((sum, assessment) => {
      const impactScore =
        (100 - assessment.alignmentScore + assessment.adaptationCost) / 2;
      return sum + impactScore;
    }, 0);

    return totalScore / assessments.length;
  }

  /**
   * 전환 소요 시간 추정
   */
  private estimateTransitionTime(
    assessments: ImpactAssessment[],
    recreationPlan: TaskRecreationPlan[],
  ): number {
    let totalHours = 0;

    // 적응 비용 기반 시간 추정
    for (const assessment of assessments) {
      if (assessment.recommendation === 'adapt') {
        totalHours += assessment.adaptationCost * 0.2; // 20% of cost as hours
      } else if (assessment.recommendation === 'cancel') {
        totalHours += 2; // 2 hours to archive/cleanup
      }
    }

    // 재생성 Task 시간 추정
    totalHours += recreationPlan.length * 4; // 4 hours per new task

    return Math.ceil(totalHours);
  }

  /**
   * Pivot 변경 적용
   */
  private async applyPivotChanges(
    assetAnalyses: AssetAnalysis[],
    recreationPlan: TaskRecreationPlan[],
    options?: PivotOptions,
  ): Promise<void> {
    // 1. Discard된 Task 처리
    if (options?.autoArchiveTasks) {
      const discardedTasks = assetAnalyses.filter(
        (a) => a.classification === 'discard',
      );

      for (const analysis of discardedTasks) {
        // 완료된 작업은 보존
        if (
          options.preserveCompletedWork &&
          (analysis.task.status === TaskStatus.IN_REVIEW ||
            analysis.task.status === TaskStatus.COMPLETED)
        ) {
          continue;
        }

        await this.taskRepo.update(analysis.task.id, {
          status: TaskStatus.CANCELLED,
        });

        this.logger.log(
          `Cancelled task ${analysis.task.id}: ${analysis.task.title}`,
        );
      }
    }

    // 2. Replacement Task 생성
    if (options?.autoCreateReplacements) {
      for (const plan of recreationPlan) {
        const newTask = this.taskRepo.create({
          title: plan.title,
          description: plan.description,
          priority: plan.priority as TaskPriority,
          projectId: plan.projectId,
          organizationId: plan.organizationId,
          status: TaskStatus.PENDING,
        });

        await this.taskRepo.save(newTask);

        this.logger.log(
          `Created replacement task: ${plan.title} (replaces ${plan.replacesTaskId})`,
        );
      }
    }
  }

  /**
   * 추천 텍스트 생성
   */
  private getRecommendationText(assessment: ImpactAssessment): string {
    switch (assessment.recommendation) {
      case 'continue':
        return 'Continue as planned - aligns well with new direction';
      case 'adapt':
        return 'Adapt task to align with new direction';
      case 'defer':
        return 'Defer for review - may need significant changes';
      case 'cancel':
        return 'Cancel and recreate if still needed';
      default:
        return 'Review required';
    }
  }

  /**
   * 경고 생성
   */
  private generateWarnings(
    assessments: ImpactAssessment[],
    totalImpactScore: number,
  ): string[] {
    const warnings: string[] = [];

    // Critical impact tasks
    const criticalTasks = assessments.filter(
      (a) => a.impactLevel === 'critical',
    );
    if (criticalTasks.length > 0) {
      warnings.push(
        `${criticalTasks.length} task(s) have critical impact - immediate attention required`,
      );
    }

    // High overall impact
    if (totalImpactScore >= 70) {
      warnings.push(
        'Overall pivot impact is high - expect significant disruption',
      );
    }

    // In-progress tasks affected
    const inProgressAffected = assessments.filter(
      (a) =>
        a.task.status === TaskStatus.IN_PROGRESS &&
        a.recommendation === 'cancel',
    );
    if (inProgressAffected.length > 0) {
      warnings.push(
        `${inProgressAffected.length} in-progress task(s) recommended for cancellation - review carefully`,
      );
    }

    return warnings;
  }

  /**
   * 추천 사항 생성
   */
  private generateRecommendations(
    assessments: ImpactAssessment[],
    _assetAnalyses: AssetAnalysis[],
    _pivotContext: PivotContext,
  ): string[] {
    const recommendations: string[] = [];

    const adaptCount = assessments.filter(
      (a) => a.recommendation === 'adapt',
    ).length;
    if (adaptCount > 0) {
      recommendations.push(
        `${adaptCount} task(s) need adaptation - prioritize updating these to align with new direction`,
      );
    }

    const deferCount = assessments.filter(
      (a) => a.recommendation === 'defer',
    ).length;
    if (deferCount > 0) {
      recommendations.push(
        `${deferCount} task(s) deferred - schedule review session to decide on these`,
      );
    }

    const cancelCount = assessments.filter(
      (a) => a.recommendation === 'cancel',
    ).length;
    if (cancelCount > 0) {
      recommendations.push(
        `${cancelCount} task(s) recommended for cancellation - ensure stakeholders are informed`,
      );
    }

    recommendations.push(
      'Consider holding team sync to communicate pivot rationale and answer questions',
    );

    return recommendations;
  }

  /**
   * 빈 결과 생성
   */
  private createEmptyResult(): PivotAnalysisResult {
    return {
      affectedTasks: [],
      affectedProjects: [],
      recreationPlan: [],
      totalImpactScore: 0,
      estimatedTransitionTime: 0,
      warnings: ['No tasks found to analyze'],
      recommendations: [],
    };
  }
}
