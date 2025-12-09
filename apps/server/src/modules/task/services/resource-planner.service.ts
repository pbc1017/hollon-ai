import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Task, TaskStatus } from '../entities/task.entity';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import {
  ResourcePlanningResult,
  HollonWorkload,
  TaskAssignmentRecommendation,
} from '../interfaces/resource-planning.interface';

@Injectable()
export class ResourcePlannerService {
  private readonly logger = new Logger(ResourcePlannerService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
  ) {}

  /**
   * 프로젝트의 모든 unassigned Task에 대해 최적 Hollon 할당
   */
  async assignProject(projectId: string): Promise<ResourcePlanningResult> {
    this.logger.log(`Planning resource assignment for project ${projectId}`);

    // 1. Unassigned tasks 조회
    const tasks = await this.taskRepo.find({
      where: {
        projectId,
        assignedHollonId: In([null]) as any,
        status: In([TaskStatus.PENDING, TaskStatus.READY]),
      },
    });

    if (tasks.length === 0) {
      return this.createEmptyResult();
    }

    // 2. 조직의 available hollons 조회
    const firstTask = tasks[0];
    const availableHollons = await this.hollonRepo.find({
      where: {
        organizationId: firstTask.organizationId,
        status: In([HollonStatus.IDLE, HollonStatus.WORKING]),
      },
    });

    if (availableHollons.length === 0) {
      this.logger.warn(
        `No available hollons found for organization ${firstTask.organizationId}`,
      );
      return {
        assignments: [],
        workloads: [],
        assignedTasks: 0,
        unassignedTasks: tasks.length,
        averageMatchScore: 0,
        warnings: ['No available hollons in organization'],
      };
    }

    // 3. 각 Task에 대해 최적 Hollon 찾기
    const assignments: Array<{
      task: Task;
      hollon: Hollon;
      matchScore: number;
    }> = [];

    for (const task of tasks) {
      const recommendation = await this.recommendHollon(task, availableHollons);

      if (recommendation.recommendedHollon) {
        assignments.push({
          task,
          hollon: recommendation.recommendedHollon,
          matchScore: recommendation.matchScore,
        });

        // Task 할당
        await this.taskRepo.update(task.id, {
          assignedHollonId: recommendation.recommendedHollon.id,
          status: TaskStatus.READY,
        });
      }
    }

    // 4. Workload 계산
    const workloads = await this.calculateWorkloads(
      availableHollons,
      projectId,
    );

    // 5. 평균 매칭 점수
    const averageMatchScore =
      assignments.length > 0
        ? assignments.reduce((sum, a) => sum + a.matchScore, 0) /
          assignments.length
        : 0;

    // 6. 경고 생성
    const warnings = this.generateWarnings(workloads, assignments, tasks);

    this.logger.log(
      `Resource planning completed: ${assignments.length}/${tasks.length} tasks assigned, ` +
        `avg match score: ${averageMatchScore.toFixed(1)}`,
    );

    return {
      assignments,
      workloads,
      assignedTasks: assignments.length,
      unassignedTasks: tasks.length - assignments.length,
      averageMatchScore,
      warnings,
    };
  }

  /**
   * 단일 Task에 대한 Hollon 추천
   */
  async recommendHollon(
    task: Task,
    availableHollons?: Hollon[],
  ): Promise<TaskAssignmentRecommendation> {
    // Available hollons 조회 (제공되지 않은 경우)
    if (!availableHollons) {
      availableHollons = await this.hollonRepo.find({
        where: {
          organizationId: task.organizationId,
          status: In([HollonStatus.IDLE, HollonStatus.WORKING]),
        },
      });
    }

    if (availableHollons.length === 0) {
      return {
        task,
        recommendedHollon: null,
        matchScore: 0,
        reasoning: 'No available hollons',
        alternatives: [],
      };
    }

    // 각 Hollon에 대한 매칭 점수 계산
    const scores = await Promise.all(
      availableHollons.map(async (hollon) => ({
        hollon,
        score: await this.calculateMatchScore(task, hollon),
      })),
    );

    // 점수 순 정렬
    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    const alternatives = scores.slice(1, 4).map((s) => ({
      hollon: s.hollon,
      score: s.score,
      reason: this.getMatchReason(s.score),
    }));

    return {
      task,
      recommendedHollon: best.hollon,
      matchScore: best.score,
      reasoning: this.getMatchReason(best.score),
      alternatives,
    };
  }

  /**
   * Task-Hollon 매칭 점수 계산 (0-100)
   */
  private async calculateMatchScore(
    task: Task,
    hollon: Hollon,
  ): Promise<number> {
    let score = 50; // Base score

    // 1. Skill 매칭 (최대 30점)
    const skillScore = this.calculateSkillScore(task, hollon);
    score += skillScore * 0.3;

    // 2. Workload 밸런싱 (최대 20점)
    const workloadScore = await this.calculateWorkloadScore(hollon);
    score += workloadScore * 0.2;

    // 3. Status 점수 (최대 10점)
    const statusScore = this.calculateStatusScore(hollon);
    score += statusScore * 0.1;

    // 4. 같은 프로젝트 경험 (최대 10점)
    const projectExperienceScore = await this.calculateProjectExperienceScore(
      task,
      hollon,
    );
    score += projectExperienceScore * 0.1;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Skill 매칭 점수 (0-100)
   */
  private calculateSkillScore(_task: Task, _hollon: Hollon): number {
    // TODO: Task의 requiredSkills와 Hollon의 skills 비교
    // 현재는 기본 점수 반환
    return 70;
  }

  /**
   * Workload 점수 (workload가 낮을수록 높은 점수)
   */
  private async calculateWorkloadScore(hollon: Hollon): Promise<number> {
    const assignedTasks = await this.taskRepo.count({
      where: {
        assignedHollonId: hollon.id,
        status: In([
          TaskStatus.READY,
          TaskStatus.IN_PROGRESS,
          TaskStatus.IN_REVIEW,
        ]),
      },
    });

    // 0개 = 100점, 10개 이상 = 0점
    return Math.max(0, 100 - assignedTasks * 10);
  }

  /**
   * Status 점수
   */
  private calculateStatusScore(hollon: Hollon): number {
    switch (hollon.status) {
      case HollonStatus.IDLE:
        return 100;
      case HollonStatus.WORKING:
        return 50;
      case HollonStatus.PAUSED:
        return 20;
      default:
        return 0;
    }
  }

  /**
   * 프로젝트 경험 점수
   */
  private async calculateProjectExperienceScore(
    task: Task,
    hollon: Hollon,
  ): Promise<number> {
    const previousTasks = await this.taskRepo.count({
      where: {
        projectId: task.projectId,
        assignedHollonId: hollon.id,
        status: TaskStatus.COMPLETED,
      },
    });

    // 0개 = 50점, 5개 이상 = 100점
    return Math.min(100, 50 + previousTasks * 10);
  }

  /**
   * Hollon별 workload 계산
   */
  private async calculateWorkloads(
    hollons: Hollon[],
    projectId: string,
  ): Promise<HollonWorkload[]> {
    const workloads: HollonWorkload[] = [];

    for (const hollon of hollons) {
      const assignedTasks = await this.taskRepo.find({
        where: {
          projectId,
          assignedHollonId: hollon.id,
          status: In([
            TaskStatus.READY,
            TaskStatus.IN_PROGRESS,
            TaskStatus.IN_REVIEW,
          ]),
        },
      });

      const totalTasks = assignedTasks.length;
      const utilizationScore = Math.min(100, totalTasks * 10);

      let availability: 'available' | 'busy' | 'overloaded' = 'available';
      if (totalTasks >= 10) {
        availability = 'overloaded';
      } else if (totalTasks >= 5) {
        availability = 'busy';
      }

      workloads.push({
        hollon,
        assignedTasks,
        totalTasks,
        utilizationScore,
        skills: [], // TODO: Hollon skills
        availability,
      });
    }

    return workloads;
  }

  /**
   * 매칭 이유 설명
   */
  private getMatchReason(score: number): string {
    if (score >= 90) {
      return 'Excellent match: Skills highly aligned, low workload';
    } else if (score >= 75) {
      return 'Good match: Skills aligned, reasonable workload';
    } else if (score >= 60) {
      return 'Fair match: Some skills match, manageable workload';
    } else if (score >= 40) {
      return 'Acceptable match: Basic requirements met';
    } else {
      return 'Poor match: Limited skill alignment or heavy workload';
    }
  }

  /**
   * 경고 생성
   */
  private generateWarnings(
    workloads: HollonWorkload[],
    assignments: Array<{ task: Task; hollon: Hollon; matchScore: number }>,
    allTasks: Task[],
  ): string[] {
    const warnings: string[] = [];

    // Overloaded hollons
    const overloaded = workloads.filter((w) => w.availability === 'overloaded');
    if (overloaded.length > 0) {
      warnings.push(
        `${overloaded.length} hollon(s) are overloaded (10+ tasks)`,
      );
    }

    // Low match scores
    const lowMatches = assignments.filter((a) => a.matchScore < 60);
    if (lowMatches.length > 0) {
      warnings.push(`${lowMatches.length} task(s) have low match scores (<60)`);
    }

    // Unassigned tasks
    if (assignments.length < allTasks.length) {
      warnings.push(
        `${allTasks.length - assignments.length} task(s) could not be assigned`,
      );
    }

    // Unbalanced workload
    if (workloads.length > 1) {
      const maxWorkload = Math.max(...workloads.map((w) => w.totalTasks));
      const minWorkload = Math.min(...workloads.map((w) => w.totalTasks));
      if (maxWorkload - minWorkload > 5) {
        warnings.push(
          'Workload is unbalanced across hollons (consider rebalancing)',
        );
      }
    }

    return warnings;
  }

  /**
   * 빈 결과 생성
   */
  private createEmptyResult(): ResourcePlanningResult {
    return {
      assignments: [],
      workloads: [],
      assignedTasks: 0,
      unassignedTasks: 0,
      averageMatchScore: 0,
      warnings: ['No tasks to assign'],
    };
  }

  /**
   * Workload 재조정
   */
  async rebalanceWorkload(projectId: string): Promise<ResourcePlanningResult> {
    this.logger.log(`Rebalancing workload for project ${projectId}`);

    // 1. 모든 할당 해제
    await this.taskRepo.update(
      { projectId, status: In([TaskStatus.READY, TaskStatus.PENDING]) },
      { assignedHollonId: null },
    );

    // 2. 재할당
    return this.assignProject(projectId);
  }
}
