import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Task, TaskStatus, TaskPriority } from '../entities/task.entity';
import { DependencyAnalyzerService } from './dependency-analyzer.service';
import {
  PriorityRebalancingResult,
  PriorityScore,
  RebalancingOptions,
} from '../interfaces/priority-rebalancing.interface';

@Injectable()
export class PriorityRebalancerService {
  private readonly logger = new Logger(PriorityRebalancerService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly dependencyAnalyzer: DependencyAnalyzerService,
  ) {}

  /**
   * 프로젝트의 모든 Task 우선순위 재조정
   */
  async rebalanceProject(
    projectId: string,
    options?: RebalancingOptions,
  ): Promise<PriorityRebalancingResult> {
    this.logger.log(`Rebalancing priorities for project ${projectId}`);

    // 1. 프로젝트의 모든 Task 조회
    const whereClause: any = { projectId };
    if (!options?.includeCompleted) {
      whereClause.status = In([
        TaskStatus.PENDING,
        TaskStatus.READY,
        TaskStatus.IN_PROGRESS,
        TaskStatus.IN_REVIEW,
      ]);
    }

    const tasks = await this.taskRepo.find({
      where: whereClause,
      order: { createdAt: 'ASC' },
    });

    if (tasks.length === 0) {
      return this.createEmptyResult();
    }

    // 2. 의존성 분석 수행
    const depAnalysis = await this.dependencyAnalyzer.analyzeProject(projectId);

    // 3. 각 Task의 우선순위 점수 계산
    const priorityScores = await Promise.all(
      tasks.map((task) =>
        this.calculatePriorityScore(task, tasks, depAnalysis),
      ),
    );

    // 4. 병목 지점 감지
    const bottlenecks = this.detectBottlenecks(
      depAnalysis.graph,
      tasks,
      depAnalysis.criticalPath,
    );

    // 5. 우선순위 재조정
    const rebalancedTasks = this.applyRebalancing(
      tasks,
      priorityScores,
      options,
    );

    // 6. 실제 DB 업데이트 (dry-run이 아닌 경우)
    if (!options?.dryRun) {
      await this.applyPriorityChanges(rebalancedTasks);
    }

    // 7. 평균 점수 변화 계산
    const averageScoreChange =
      rebalancedTasks.length > 0
        ? rebalancedTasks.reduce((sum, r) => sum + Math.abs(r.score), 0) /
          rebalancedTasks.length
        : 0;

    // 8. 경고 생성
    const warnings = this.generateWarnings(bottlenecks, rebalancedTasks);

    this.logger.log(
      `Priority rebalancing completed: ${rebalancedTasks.length} tasks rebalanced, ` +
        `${bottlenecks.length} bottlenecks detected`,
    );

    return {
      rebalancedTasks,
      bottlenecks,
      totalRebalanced: rebalancedTasks.length,
      averageScoreChange,
      warnings,
    };
  }

  /**
   * Task의 우선순위 점수 계산 (0-100)
   */
  private async calculatePriorityScore(
    task: Task,
    _allTasks: Task[],
    depAnalysis: any,
  ): Promise<PriorityScore> {
    const factors = {
      dependencyWeight: 0,
      criticalPathWeight: 0,
      progressWeight: 0,
      deadlineWeight: 0,
      businessValueWeight: 0,
    };

    // 1. 의존성 가중치 (얼마나 많은 Task가 이 Task에 의존하는가)
    const node = depAnalysis.graph.nodes.get(task.id);
    if (node) {
      const dependentCount = node.dependents.length;
      factors.dependencyWeight = Math.min(100, dependentCount * 20);
    }

    // 2. Critical Path 가중치
    const isOnCriticalPath = depAnalysis.criticalPath.tasks.some(
      (t: Task) => t.id === task.id,
    );
    factors.criticalPathWeight = isOnCriticalPath ? 100 : 0;

    // 3. 진행 상태 가중치
    factors.progressWeight = this.calculateProgressWeight(task);

    // 4. 마감일 가중치
    factors.deadlineWeight = this.calculateDeadlineWeight(task);

    // 5. 비즈니스 가치 가중치
    factors.businessValueWeight = this.calculateBusinessValueWeight(task);

    // 종합 점수 계산 (가중 평균)
    const score =
      factors.dependencyWeight * 0.25 +
      factors.criticalPathWeight * 0.3 +
      factors.progressWeight * 0.15 +
      factors.deadlineWeight * 0.15 +
      factors.businessValueWeight * 0.15;

    // 점수에 따른 우선순위 제안
    const suggestedPriority = this.scoreToPriority(score);

    // 이유 설명
    const reasoning = this.generateReasoning(factors, isOnCriticalPath);

    return {
      taskId: task.id,
      score,
      factors,
      suggestedPriority,
      reasoning,
    };
  }

  /**
   * 진행 상태 가중치 계산
   */
  private calculateProgressWeight(task: Task): number {
    switch (task.status) {
      case TaskStatus.IN_PROGRESS:
        return 100; // 진행 중인 Task는 최우선
      case TaskStatus.IN_REVIEW:
        return 80; // 리뷰 중인 Task는 높은 우선순위
      case TaskStatus.READY:
        return 60; // 준비된 Task는 중간 우선순위
      case TaskStatus.PENDING:
        return 40; // 대기 중인 Task는 낮은 우선순위
      case TaskStatus.BLOCKED:
        return 20; // 차단된 Task는 매우 낮은 우선순위
      default:
        return 0;
    }
  }

  /**
   * 마감일 가중치 계산
   */
  private calculateDeadlineWeight(task: Task): number {
    if (!task.dueDate) return 50; // 기본값

    const now = new Date();
    const daysUntil =
      (task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntil < 0) return 100; // 이미 지난 마감일
    if (daysUntil < 3) return 90;
    if (daysUntil < 7) return 70;
    if (daysUntil < 14) return 50;
    return 30;
  }

  /**
   * 비즈니스 가치 가중치 계산
   */
  private calculateBusinessValueWeight(task: Task): number {
    // 현재 priority를 비즈니스 가치의 지표로 사용
    switch (task.priority) {
      case TaskPriority.P1_CRITICAL:
        return 100;
      case TaskPriority.P2_HIGH:
        return 75;
      case TaskPriority.P3_MEDIUM:
        return 50;
      case TaskPriority.P4_LOW:
        return 25;
      default:
        return 50;
    }
  }

  /**
   * 점수를 우선순위로 변환
   */
  private scoreToPriority(score: number): TaskPriority {
    if (score >= 80) return TaskPriority.P1_CRITICAL;
    if (score >= 60) return TaskPriority.P2_HIGH;
    if (score >= 40) return TaskPriority.P3_MEDIUM;
    return TaskPriority.P4_LOW;
  }

  /**
   * 이유 설명 생성
   */
  private generateReasoning(
    factors: PriorityScore['factors'],
    isOnCriticalPath: boolean,
  ): string {
    const reasons: string[] = [];

    if (isOnCriticalPath) {
      reasons.push('On critical path');
    }

    if (factors.dependencyWeight >= 60) {
      reasons.push('Blocks multiple tasks');
    }

    if (factors.progressWeight >= 80) {
      reasons.push('Already in progress');
    }

    if (factors.deadlineWeight >= 70) {
      reasons.push('Deadline approaching');
    }

    if (factors.businessValueWeight >= 75) {
      reasons.push('High business value');
    }

    return reasons.length > 0
      ? reasons.join(', ')
      : 'Standard priority based on overall factors';
  }

  /**
   * 병목 지점 감지
   */
  private detectBottlenecks(
    graph: any,
    tasks: Task[],
    criticalPath: any,
  ): Array<{
    task: Task;
    blockedTasks: Task[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendation: string;
  }> {
    const bottlenecks: Array<{
      task: Task;
      blockedTasks: Task[];
      severity: 'low' | 'medium' | 'high' | 'critical';
      recommendation: string;
    }> = [];

    for (const task of tasks) {
      const node = graph.nodes.get(task.id);
      if (!node) continue;

      // 3개 이상의 Task를 차단하는 경우
      if (node.dependents.length >= 3) {
        const blockedTasks = tasks.filter((t) =>
          node.dependents.includes(t.id),
        );

        let severity: 'low' | 'medium' | 'high' | 'critical';
        if (node.dependents.length >= 10) {
          severity = 'critical';
        } else if (node.dependents.length >= 7) {
          severity = 'high';
        } else if (node.dependents.length >= 5) {
          severity = 'medium';
        } else {
          severity = 'low';
        }

        // Critical path에 있으면 severity 증가
        const isOnCriticalPath = criticalPath.tasks.some(
          (t: Task) => t.id === task.id,
        );
        if (isOnCriticalPath && severity !== 'critical') {
          severity =
            severity === 'high'
              ? 'critical'
              : severity === 'medium'
                ? 'high'
                : 'medium';
        }

        let recommendation: string;
        if (task.status === TaskStatus.BLOCKED) {
          recommendation =
            'URGENT: Unblock this task immediately to prevent cascading delays';
        } else if (task.status === TaskStatus.PENDING) {
          recommendation =
            'Prioritize starting this task to unblock dependents';
        } else if (task.status === TaskStatus.IN_PROGRESS) {
          recommendation =
            'Allocate additional resources to complete this task faster';
        } else {
          recommendation = 'Monitor closely to prevent bottleneck';
        }

        bottlenecks.push({
          task,
          blockedTasks,
          severity,
          recommendation,
        });
      }
    }

    // Severity 순으로 정렬
    bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    return bottlenecks;
  }

  /**
   * 우선순위 재조정 적용
   */
  private applyRebalancing(
    tasks: Task[],
    priorityScores: PriorityScore[],
    options?: RebalancingOptions,
  ): Array<{
    task: Task;
    oldPriority: TaskPriority;
    newPriority: TaskPriority;
    reason: string;
    score: number;
  }> {
    const rebalanced: Array<{
      task: Task;
      oldPriority: TaskPriority;
      newPriority: TaskPriority;
      reason: string;
      score: number;
    }> = [];

    const minScoreChange = options?.minScoreChange ?? 15;

    for (const task of tasks) {
      const scoreData = priorityScores.find((s) => s.taskId === task.id);
      if (!scoreData) continue;

      const oldPriority = task.priority;
      const newPriority = scoreData.suggestedPriority;

      // 우선순위가 변경되어야 하는지 확인
      if (oldPriority !== newPriority) {
        // 최소 점수 변화 확인
        const oldScore = this.priorityToScore(oldPriority);
        const scoreChange = Math.abs(scoreData.score - oldScore);

        if (scoreChange >= minScoreChange) {
          rebalanced.push({
            task,
            oldPriority,
            newPriority,
            reason: scoreData.reasoning,
            score: scoreData.score,
          });
        }
      }
    }

    return rebalanced;
  }

  /**
   * 우선순위를 점수로 변환
   */
  private priorityToScore(priority: TaskPriority): number {
    switch (priority) {
      case TaskPriority.P1_CRITICAL:
        return 90;
      case TaskPriority.P2_HIGH:
        return 70;
      case TaskPriority.P3_MEDIUM:
        return 50;
      case TaskPriority.P4_LOW:
        return 30;
      default:
        return 50;
    }
  }

  /**
   * DB에 우선순위 변경 적용
   */
  private async applyPriorityChanges(
    rebalanced: Array<{
      task: Task;
      oldPriority: TaskPriority;
      newPriority: TaskPriority;
      reason: string;
      score: number;
    }>,
  ): Promise<void> {
    for (const change of rebalanced) {
      await this.taskRepo.update(change.task.id, {
        priority: change.newPriority,
      });

      this.logger.log(
        `Task ${change.task.title}: ${change.oldPriority} → ${change.newPriority} (${change.reason})`,
      );
    }
  }

  /**
   * 경고 생성
   */
  private generateWarnings(
    bottlenecks: Array<{
      task: Task;
      blockedTasks: Task[];
      severity: 'low' | 'medium' | 'high' | 'critical';
      recommendation: string;
    }>,
    rebalanced: Array<any>,
  ): string[] {
    const warnings: string[] = [];

    // Critical bottlenecks
    const criticalBottlenecks = bottlenecks.filter(
      (b) => b.severity === 'critical',
    );
    if (criticalBottlenecks.length > 0) {
      warnings.push(
        `${criticalBottlenecks.length} critical bottleneck(s) detected that require immediate attention`,
      );
    }

    // High severity bottlenecks
    const highBottlenecks = bottlenecks.filter((b) => b.severity === 'high');
    if (highBottlenecks.length > 0) {
      warnings.push(
        `${highBottlenecks.length} high-severity bottleneck(s) may cause delays`,
      );
    }

    // Large priority shifts
    const majorShifts = rebalanced.filter(
      (r) =>
        (r.oldPriority === TaskPriority.P4_LOW &&
          r.newPriority === TaskPriority.P1_CRITICAL) ||
        (r.oldPriority === TaskPriority.P1_CRITICAL &&
          r.newPriority === TaskPriority.P4_LOW),
    );
    if (majorShifts.length > 0) {
      warnings.push(
        `${majorShifts.length} task(s) had major priority shifts (consider reviewing)`,
      );
    }

    return warnings;
  }

  /**
   * 빈 결과 생성
   */
  private createEmptyResult(): PriorityRebalancingResult {
    return {
      rebalancedTasks: [],
      bottlenecks: [],
      totalRebalanced: 0,
      averageScoreChange: 0,
      warnings: ['No tasks found to rebalance'],
    };
  }

  /**
   * 단일 Task의 우선순위 재평가
   */
  async reevaluateTask(taskId: string): Promise<PriorityScore> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const allTasks = await this.taskRepo.find({
      where: { projectId: task.projectId },
    });

    const depAnalysis = await this.dependencyAnalyzer.analyzeProject(
      task.projectId,
    );

    return this.calculatePriorityScore(task, allTasks, depAnalysis);
  }
}
