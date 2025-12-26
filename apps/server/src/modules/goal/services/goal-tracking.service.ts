import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { differenceInDays } from 'date-fns';
import { Goal, GoalStatus } from '../entities/goal.entity';
import { GoalService } from '../goal.service';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { Project } from '../../project/entities/project.entity';

export interface GoalRiskAnalysis {
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  progressGap?: number;
  remainingDays?: number;
  expectedProgress?: number;
  actualProgress?: number;
  reason?: string;
  recommendation: string;
}

@Injectable()
export class GoalTrackingService {
  private readonly logger = new Logger(GoalTrackingService.name);

  constructor(
    private readonly goalService: GoalService,
    @InjectRepository(Goal)
    private readonly goalRepo: Repository<Goal>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  /**
   * Goal 진행도 자동 업데이트 (Cron)
   * 매시간 실행
   */
  @Cron('0 * * * *') // 매시간
  async updateAllGoalProgress(): Promise<void> {
    this.logger.log('Starting automatic goal progress update...');

    try {
      const activeGoals = await this.goalRepo.find({
        where: { status: In([GoalStatus.ACTIVE, GoalStatus.PAUSED]) },
      });

      this.logger.log(`Found ${activeGoals.length} active goals to update`);

      for (const goal of activeGoals) {
        try {
          await this.updateGoalProgress(goal.id);
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to update goal ${goal.id}: ${err.message}`,
            err.stack,
          );
        }
      }

      this.logger.log('Completed automatic goal progress update');
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to update all goal progress: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * 특정 Goal의 진행도 업데이트
   */
  async updateGoalProgress(goalId: string): Promise<number> {
    const goal = await this.goalService.findOne(goalId);

    // 1. 하위 Goal이 있는 경우: 하위 Goal들의 평균 진행도
    const childGoals = await this.goalService.getChildGoals(goalId);
    if (childGoals.length > 0) {
      const totalProgress = childGoals.reduce(
        (sum, child) => sum + child.progressPercent,
        0,
      );
      const avgProgress = totalProgress / childGoals.length;

      await this.goalRepo.update(goalId, {
        progressPercent: avgProgress,
      });

      return avgProgress;
    }

    // 2. 연결된 Project들이 있는 경우: Project들의 Task 진행도 기반
    const projects = await this.projectRepo.find({
      where: { goalId },
    });

    if (projects.length > 0) {
      const projectIds = projects.map((p) => p.id);
      const tasks = await this.taskRepo.find({
        where: { projectId: In(projectIds) },
      });

      if (tasks.length === 0) {
        return goal.progressPercent;
      }

      const completedTasks = tasks.filter(
        (t) => t.status === TaskStatus.COMPLETED,
      );
      const progressPercent = (completedTasks.length / tasks.length) * 100;

      await this.goalRepo.update(goalId, {
        progressPercent,
        currentValue: completedTasks.length,
      });

      // 100% 달성 시 자동 완료
      if (progressPercent >= 100 && goal.status === GoalStatus.ACTIVE) {
        await this.goalRepo.update(goalId, {
          status: GoalStatus.COMPLETED,
          completedAt: new Date(),
        });
        this.logger.log(
          `Goal ${goalId} automatically completed (100% progress)`,
        );
      }

      return progressPercent;
    }

    // 3. Project도 하위 Goal도 없는 경우: 현재 진행도 유지
    return goal.progressPercent;
  }

  /**
   * 특정 Task 완료 시 관련 Goal 업데이트
   */
  async onTaskCompleted(taskId: string): Promise<void> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['project'],
    });

    if (!task?.project?.goalId) {
      return;
    }

    await this.updateGoalProgress(task.project.goalId);
  }

  /**
   * 목표 달성 위험도 분석
   */
  async analyzeGoalRisk(goalId: string): Promise<GoalRiskAnalysis> {
    const goal = await this.goalService.findOne(goalId);

    if (!goal.targetDate) {
      return {
        riskLevel: 'unknown',
        reason: 'No target date set',
        recommendation: 'Set a target date to enable risk analysis.',
      };
    }

    if (!goal.startDate) {
      return {
        riskLevel: 'unknown',
        reason: 'No start date set',
        recommendation: 'Set a start date to enable risk analysis.',
      };
    }

    const now = new Date();
    const targetDate = new Date(goal.targetDate);
    const startDate = new Date(goal.startDate);

    const totalDays = differenceInDays(targetDate, startDate);
    const elapsedDays = differenceInDays(now, startDate);
    const remainingDays = differenceInDays(targetDate, now);

    // 예상 진행도: 경과 시간 비율
    const expectedProgress =
      totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;
    const actualProgress = goal.progressPercent;
    const progressGap = actualProgress - expectedProgress;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';

    if (remainingDays < 0) {
      riskLevel = 'critical'; // 기한 초과
    } else if (progressGap < -30) {
      riskLevel = 'critical'; // 30% 이상 뒤처짐
    } else if (progressGap < -15) {
      riskLevel = 'high';
    } else if (progressGap < -5) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return {
      riskLevel,
      progressGap,
      remainingDays,
      expectedProgress,
      actualProgress,
      recommendation: this.getRecommendation(riskLevel),
    };
  }

  /**
   * 위험도 기반 권장사항 생성
   */
  private getRecommendation(riskLevel: string): string {
    if (riskLevel === 'critical') {
      return 'Immediate action required. Consider extending deadline or reducing scope.';
    } else if (riskLevel === 'high') {
      return 'Increase priority and allocate more resources.';
    } else if (riskLevel === 'medium') {
      return 'Monitor closely and address blockers.';
    } else {
      return 'On track. Continue current pace.';
    }
  }
}
