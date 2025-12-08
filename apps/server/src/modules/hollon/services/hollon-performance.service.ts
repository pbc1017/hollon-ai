import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Hollon, HollonStatus } from '../entities/hollon.entity';
import { Task, TaskStatus } from '../../task/entities/task.entity';

export interface HollonPerformanceMetrics {
  hollonId: string;
  hollonName: string;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  averageTaskDurationHours: number;
  successRate: number;
  currentStatus: HollonStatus;
  tasksInProgress: number;
  tasksBlocked: number;
  lastActiveAt: Date | null;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface TeamPerformanceMetrics {
  teamId: string | null;
  teamName: string | null;
  totalHollons: number;
  activeHollons: number;
  idleHollons: number;
  blockedHollons: number;
  totalTasksCompleted: number;
  averageSuccessRate: number;
  averageTaskDuration: number;
}

export interface PerformanceTrend {
  date: string;
  tasksCompleted: number;
  tasksFailed: number;
  averageDuration: number;
  successRate: number;
}

@Injectable()
export class HollonPerformanceService {
  private readonly logger = new Logger(HollonPerformanceService.name);

  constructor(
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  /**
   * 특정 홀론의 성능 지표 조회
   */
  async getHollonPerformance(
    hollonId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<HollonPerformanceMetrics> {
    const hollon = await this.hollonRepo.findOne({
      where: { id: hollonId },
      relations: ['team'],
    });

    if (!hollon) {
      throw new Error(`Hollon ${hollonId} not found`);
    }

    const period = this.getDateRange(startDate, endDate);

    // 완료된 태스크 조회
    const completedTasks = await this.taskRepo.find({
      where: {
        assignedHollonId: hollonId,
        status: TaskStatus.COMPLETED,
        completedAt: Between(period.startDate, period.endDate),
      },
    });

    // 실패한 태스크 조회
    const failedTasks = await this.taskRepo.find({
      where: {
        assignedHollonId: hollonId,
        status: TaskStatus.FAILED,
        completedAt: Between(period.startDate, period.endDate),
      },
    });

    // 진행 중인 태스크 카운트
    const inProgressCount = await this.taskRepo.count({
      where: {
        assignedHollonId: hollonId,
        status: TaskStatus.IN_PROGRESS,
      },
    });

    // 차단된 태스크 카운트
    const blockedCount = await this.taskRepo.count({
      where: {
        assignedHollonId: hollonId,
        status: TaskStatus.BLOCKED,
      },
    });

    // 평균 태스크 소요 시간 계산 (시간 단위)
    const avgDuration = this.calculateAverageDuration(completedTasks);

    // 성공률 계산
    const totalTasks = completedTasks.length + failedTasks.length;
    const successRate = totalTasks > 0 ? completedTasks.length / totalTasks : 0;

    // 홀론 엔티티의 통계 업데이트
    await this.updateHollonStats(hollon.id, {
      tasksCompleted: completedTasks.length,
      averageTaskDuration: avgDuration,
      successRate,
    });

    return {
      hollonId: hollon.id,
      hollonName: hollon.name,
      totalTasksCompleted: completedTasks.length,
      totalTasksFailed: failedTasks.length,
      averageTaskDurationHours: avgDuration,
      successRate,
      currentStatus: hollon.status,
      tasksInProgress: inProgressCount,
      tasksBlocked: blockedCount,
      lastActiveAt: hollon.lastActiveAt,
      period,
    };
  }

  /**
   * 조직 내 모든 홀론의 성능 지표 조회
   */
  async getOrganizationPerformance(
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<HollonPerformanceMetrics[]> {
    const hollons = await this.hollonRepo.find({
      where: { organizationId },
      relations: ['team'],
    });

    const metrics: HollonPerformanceMetrics[] = [];

    for (const hollon of hollons) {
      try {
        const hollonMetrics = await this.getHollonPerformance(
          hollon.id,
          startDate,
          endDate,
        );
        metrics.push(hollonMetrics);
      } catch (error) {
        this.logger.error(
          `Failed to get performance for hollon ${hollon.id}`,
          error,
        );
      }
    }

    return metrics.sort(
      (a, b) => b.totalTasksCompleted - a.totalTasksCompleted,
    );
  }

  /**
   * 팀별 성능 지표 조회
   */
  async getTeamPerformance(
    organizationId: string,
    teamId?: string,
  ): Promise<TeamPerformanceMetrics[]> {
    let hollons: Hollon[];

    if (teamId) {
      hollons = await this.hollonRepo.find({
        where: { organizationId, teamId },
        relations: ['team'],
      });
    } else {
      hollons = await this.hollonRepo.find({
        where: { organizationId },
        relations: ['team'],
      });
    }

    // 팀별로 그룹화
    const teamMap = new Map<string, Hollon[]>();
    for (const hollon of hollons) {
      const key = hollon.teamId || 'no-team';
      if (!teamMap.has(key)) {
        teamMap.set(key, []);
      }
      teamMap.get(key)!.push(hollon);
    }

    const teamMetrics: TeamPerformanceMetrics[] = [];

    for (const [teamKey, teamHollons] of teamMap) {
      const teamId = teamKey === 'no-team' ? null : teamKey;
      const teamName =
        teamHollons[0]?.team?.name || (teamId ? 'Unknown Team' : null);

      // 팀 내 모든 홀론의 완료된 태스크 조회
      const hollonIds = teamHollons.map((h) => h.id);
      const completedTasks = await this.taskRepo
        .createQueryBuilder('task')
        .where('task.assigned_hollon_id IN (:...hollonIds)', { hollonIds })
        .andWhere('task.status = :status', { status: TaskStatus.COMPLETED })
        .getCount();

      // 상태별 홀론 카운트
      const statusCounts = {
        active: 0,
        idle: 0,
        blocked: 0,
      };

      for (const hollon of teamHollons) {
        if (hollon.status === HollonStatus.WORKING) {
          statusCounts.active++;
        } else if (hollon.status === HollonStatus.IDLE) {
          statusCounts.idle++;
        } else if (hollon.status === HollonStatus.BLOCKED) {
          statusCounts.blocked++;
        }
      }

      // 평균 성공률 및 평균 소요 시간
      const avgSuccessRate =
        teamHollons.reduce((sum, h) => sum + (h.successRate || 0), 0) /
        teamHollons.length;
      const avgDuration =
        teamHollons.reduce((sum, h) => sum + (h.averageTaskDuration || 0), 0) /
        teamHollons.length;

      teamMetrics.push({
        teamId,
        teamName,
        totalHollons: teamHollons.length,
        activeHollons: statusCounts.active,
        idleHollons: statusCounts.idle,
        blockedHollons: statusCounts.blocked,
        totalTasksCompleted: completedTasks,
        averageSuccessRate: avgSuccessRate,
        averageTaskDuration: avgDuration,
      });
    }

    return teamMetrics.sort(
      (a, b) => b.totalTasksCompleted - a.totalTasksCompleted,
    );
  }

  /**
   * 성능 추세 분석 (일별)
   */
  async getPerformanceTrend(
    hollonId: string,
    days: number = 30,
  ): Promise<PerformanceTrend[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const tasks = await this.taskRepo.find({
      where: {
        assignedHollonId: hollonId,
        completedAt: Between(startDate, endDate),
      },
      order: {
        completedAt: 'ASC',
      },
    });

    // 일별로 그룹화
    const trendMap = new Map<string, any[]>();

    for (const task of tasks) {
      if (!task.completedAt) continue;

      const dateKey = task.completedAt.toISOString().split('T')[0];
      if (!trendMap.has(dateKey)) {
        trendMap.set(dateKey, []);
      }
      trendMap.get(dateKey)!.push(task);
    }

    const trends: PerformanceTrend[] = [];

    for (const [date, dayTasks] of trendMap) {
      const completed = dayTasks.filter(
        (t) => t.status === TaskStatus.COMPLETED,
      ).length;
      const failed = dayTasks.filter(
        (t) => t.status === TaskStatus.FAILED,
      ).length;
      const avgDuration = this.calculateAverageDuration(dayTasks);
      const total = completed + failed;
      const successRate = total > 0 ? completed / total : 0;

      trends.push({
        date,
        tasksCompleted: completed,
        tasksFailed: failed,
        averageDuration: avgDuration,
        successRate,
      });
    }

    return trends.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 홀론 통계 업데이트 (누적)
   */
  private async updateHollonStats(
    hollonId: string,
    stats: {
      tasksCompleted: number;
      averageTaskDuration: number;
      successRate: number;
    },
  ): Promise<void> {
    await this.hollonRepo.update(hollonId, {
      tasksCompleted: stats.tasksCompleted,
      averageTaskDuration: stats.averageTaskDuration,
      successRate: stats.successRate,
    });
  }

  /**
   * 평균 태스크 소요 시간 계산 (시간 단위)
   */
  private calculateAverageDuration(tasks: Task[]): number {
    const completedTasks = tasks.filter((t) => t.startedAt && t.completedAt);

    if (completedTasks.length === 0) {
      return 0;
    }

    const totalDuration = completedTasks.reduce((sum, task) => {
      const duration =
        new Date(task.completedAt!).getTime() -
        new Date(task.startedAt!).getTime();
      return sum + duration;
    }, 0);

    // 밀리초를 시간으로 변환
    return totalDuration / completedTasks.length / (1000 * 60 * 60);
  }

  /**
   * 날짜 범위 설정
   */
  private getDateRange(
    startDate?: Date,
    endDate?: Date,
  ): { startDate: Date; endDate: Date } {
    const now = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(now.getDate() - 30); // 기본 30일

    return {
      startDate: startDate || defaultStartDate,
      endDate: endDate || now,
    };
  }

  /**
   * 최고 성과 홀론 조회
   */
  async getTopPerformers(
    organizationId: string,
    limit: number = 10,
  ): Promise<HollonPerformanceMetrics[]> {
    const metrics = await this.getOrganizationPerformance(organizationId);
    return metrics
      .sort((a, b) => {
        // 성공률 우선, 같으면 완료된 태스크 수로 정렬
        if (Math.abs(b.successRate - a.successRate) > 0.01) {
          return b.successRate - a.successRate;
        }
        return b.totalTasksCompleted - a.totalTasksCompleted;
      })
      .slice(0, limit);
  }

  /**
   * 성능 개선이 필요한 홀론 조회
   */
  async getUnderPerformers(
    organizationId: string,
    successThreshold: number = 0.7,
  ): Promise<HollonPerformanceMetrics[]> {
    const metrics = await this.getOrganizationPerformance(organizationId);
    return metrics
      .filter(
        (m) => m.successRate < successThreshold && m.totalTasksCompleted > 0,
      )
      .sort((a, b) => a.successRate - b.successRate);
  }
}
