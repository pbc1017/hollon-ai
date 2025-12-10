import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import { Task, TaskStatus, TaskType } from '../../task/entities/task.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { HollonOrchestratorService } from './hollon-orchestrator.service';
import { OrganizationSettings } from '../../organization/interfaces/organization-settings.interface';
import { TeamTaskDistributionService } from './team-task-distribution.service';

/**
 * HollonExecutionService
 *
 * Phase 3.7: 완전 자율 실행 인프라
 *
 * 역할:
 * - 매 10초마다 IDLE + assignedTask 있는 Hollon 감지
 * - HollonOrchestratorService.runCycle() 자동 호출
 * - 동시 실행 제한 (Organization.maxConcurrentHolons)
 * - Emergency Stop 지원
 *
 * 안전장치:
 * - 중복 실행 방지 (executingHollons Set)
 * - 동시 실행 제한 (checkConcurrencyLimit)
 * - Emergency Stop 체크 (autonomousExecutionEnabled)
 */
@Injectable()
export class HollonExecutionService {
  private readonly logger = new Logger(HollonExecutionService.name);
  private executingHollons = new Set<string>(); // 중복 실행 방지

  constructor(
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    private readonly orchestrator: HollonOrchestratorService,
    private readonly teamDistribution: TeamTaskDistributionService,
  ) {}

  /**
   * 매 30분마다 Stuck Task 감지 및 처리
   * Phase 3.7: 2시간 이상 IN_PROGRESS 상태인 Task를 BLOCKED로 변경
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async detectStuckTasks(): Promise<void> {
    try {
      this.logger.debug('Checking for stuck tasks...');

      const STUCK_THRESHOLD_HOURS = 2;
      const thresholdTime = new Date(
        Date.now() - STUCK_THRESHOLD_HOURS * 60 * 60 * 1000,
      );

      // Find tasks that have been IN_PROGRESS for more than 2 hours
      const stuckTasks = await this.hollonRepo.manager
        .getRepository(Task)
        .createQueryBuilder('task')
        .where('task.status = :status', { status: TaskStatus.IN_PROGRESS })
        .andWhere('task.started_at < :threshold', { threshold: thresholdTime })
        .getMany();

      if (stuckTasks.length === 0) {
        this.logger.debug('No stuck tasks found');
        return;
      }

      this.logger.warn(
        `Found ${stuckTasks.length} stuck tasks (IN_PROGRESS > ${STUCK_THRESHOLD_HOURS}h)`,
      );

      for (const task of stuckTasks) {
        const duration = Date.now() - task.startedAt!.getTime();
        const hours = (duration / (1000 * 60 * 60)).toFixed(1);

        await this.hollonRepo.manager.getRepository(Task).update(
          { id: task.id },
          {
            status: TaskStatus.BLOCKED,
            blockedReason: `Task stuck in IN_PROGRESS for ${hours} hours. Possible infinite loop or hang.`,
          },
        );

        this.logger.warn(
          `Marked task ${task.id} (${task.title}) as BLOCKED after ${hours}h`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in detectStuckTasks: ${err.message}`, err.stack);
    }
  }

  /**
   * 매 30분마다 진행 상황 모니터링 (Progress Monitoring)
   * Phase 3.7: 자율 실행 상태를 주기적으로 로깅
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async monitorProgress(): Promise<void> {
    try {
      this.logger.debug('Monitoring autonomous execution progress...');

      const orgs = await this.orgRepo.find();

      for (const org of orgs) {
        // Get task statistics
        const taskStats = await this.hollonRepo.manager
          .getRepository(Task)
          .createQueryBuilder('task')
          .select('task.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .where(
            'task.project_id IN (SELECT id FROM projects WHERE organization_id = :orgId)',
            { orgId: org.id },
          )
          .groupBy('task.status')
          .getRawMany();

        // Get hollon statistics
        const hollonStats = await this.hollonRepo
          .createQueryBuilder('hollon')
          .select('hollon.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .where('hollon.organizationId = :orgId', { orgId: org.id })
          .groupBy('hollon.status')
          .getRawMany();

        // Convert to readable format
        const taskCounts = taskStats.reduce(
          (acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
          },
          {} as Record<string, number>,
        );

        const hollonCounts = hollonStats.reduce(
          (acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
          },
          {} as Record<string, number>,
        );

        // Calculate totals
        const totalTasks = Object.values(taskCounts).reduce(
          (sum, count) => (sum as number) + (count as number),
          0,
        );
        const totalHollons = Object.values(hollonCounts).reduce(
          (sum, count) => (sum as number) + (count as number),
          0,
        );

        // Log progress report
        this.logger.log(
          `[Progress Report] Organization: ${org.name} | ` +
            `Tasks: ${totalTasks} total (` +
            `completed: ${taskCounts['completed'] || 0}, ` +
            `in_progress: ${taskCounts['in_progress'] || 0}, ` +
            `ready: ${taskCounts['ready'] || 0}, ` +
            `pending: ${taskCounts['pending'] || 0}, ` +
            `blocked: ${taskCounts['blocked'] || 0}, ` +
            `failed: ${taskCounts['failed'] || 0}` +
            `) | Hollons: ${totalHollons} total (` +
            `idle: ${hollonCounts['idle'] || 0}, ` +
            `working: ${hollonCounts['working'] || 0}, ` +
            `paused: ${hollonCounts['paused'] || 0}, ` +
            `blocked: ${hollonCounts['blocked'] || 0}` +
            `)`,
        );

        // Check autonomous execution status
        const settings = (org.settings || {}) as OrganizationSettings;
        const isEnabled = settings.autonomousExecutionEnabled !== false;

        if (!isEnabled) {
          this.logger.warn(
            `[Progress Report] Organization ${org.name}: Autonomous execution is DISABLED - ${settings.emergencyStopReason || 'Unknown reason'}`,
          );
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in monitorProgress: ${err.message}`, err.stack);
    }
  }

  /**
   * Phase 3.8: Team Task Distribution
   * 매 30초마다 미분배된 Team Tasks를 감지하여 Manager가 분배
   */
  @Cron('*/30 * * * * *') // Every 30 seconds
  async distributeTeamTasks(): Promise<void> {
    try {
      this.logger.debug('Checking for undistributed team tasks...');

      // Find PENDING Team Tasks (TEAM_EPIC) that haven't been distributed yet
      const teamTasks = await this.hollonRepo.manager.getRepository(Task).find({
        where: {
          type: TaskType.TEAM_EPIC,
          status: TaskStatus.PENDING,
        },
        relations: ['assignedTeam', 'assignedTeam.manager'],
      });

      if (teamTasks.length === 0) {
        this.logger.debug('No undistributed team tasks found');
        return;
      }

      this.logger.log(
        `Found ${teamTasks.length} undistributed team task(s), initiating distribution...`,
      );

      for (const teamTask of teamTasks) {
        try {
          if (!teamTask.assignedTeam) {
            this.logger.warn(
              `Team task ${teamTask.id} has no assigned team, skipping`,
            );
            continue;
          }

          if (!teamTask.assignedTeam.manager) {
            this.logger.warn(
              `Team ${teamTask.assignedTeam.name} has no manager, skipping task ${teamTask.id}`,
            );
            continue;
          }

          this.logger.log(
            `Distributing team task "${teamTask.title}" (${teamTask.id}) via manager "${teamTask.assignedTeam.manager.name}"`,
          );

          // Distribute via TeamTaskDistributionService
          const subtasks = await this.teamDistribution.distributeToTeam(
            teamTask.id,
          );

          this.logger.log(
            `Successfully distributed team task ${teamTask.id} into ${subtasks.length} subtasks`,
          );
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to distribute team task ${teamTask.id}: ${err.message}`,
            err.stack,
          );

          // Mark task as FAILED if distribution fails
          await this.hollonRepo.manager.getRepository(Task).update(
            { id: teamTask.id },
            {
              status: TaskStatus.FAILED,
              errorMessage: `Distribution failed: ${err.message}`,
            },
          );
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error in distributeTeamTasks: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * 매 10초마다 할당된 Task가 있는 IDLE Hollon 실행
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async executeAssignedHollons(): Promise<void> {
    try {
      this.logger.debug('Checking for hollons with assigned tasks...');

      // 1. Organization별로 체크 (동시 실행 제한 적용)
      const orgs = await this.orgRepo.find();

      for (const org of orgs) {
        // Emergency Stop 체크
        const settings = (org.settings || {}) as OrganizationSettings;

        // Default: enabled (없으면 true)
        const isEnabled = settings.autonomousExecutionEnabled !== false;

        if (!isEnabled) {
          this.logger.warn(
            `Autonomous execution disabled for org ${org.name}: ${settings.emergencyStopReason || 'Unknown reason'}`,
          );
          continue;
        }

        // 동시 실행 제한 체크
        const canExecute = await this.checkConcurrencyLimit(org.id);
        if (!canExecute) {
          continue;
        }

        // 2. IDLE + assignedTask 있는 Hollon 조회
        const hollons = await this.hollonRepo
          .createQueryBuilder('hollon')
          .leftJoinAndSelect('hollon.assignedTasks', 'task')
          .where('hollon.organizationId = :orgId', { orgId: org.id })
          .andWhere('hollon.status = :status', { status: HollonStatus.IDLE })
          .andWhere('task.status IN (:...statuses)', {
            statuses: [TaskStatus.READY, TaskStatus.PENDING],
          })
          .getMany();

        if (hollons.length === 0) {
          continue;
        }

        this.logger.log(
          `Found ${hollons.length} hollons ready to execute tasks in org ${org.name}`,
        );

        // 3. 각 Hollon에 대해 runCycle() 실행
        for (const hollon of hollons) {
          // 중복 실행 방지
          if (this.executingHollons.has(hollon.id)) {
            this.logger.debug(`Hollon ${hollon.name} is already executing`);
            continue;
          }

          this.executingHollons.add(hollon.id);

          // 비동기로 실행 (블로킹 방지)
          this.executeHollonCycle(hollon.id)
            .catch((error) => {
              const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
              this.logger.error(
                `Failed to execute cycle for hollon ${hollon.name}: ${errorMessage}`,
              );
            })
            .finally(() => {
              this.executingHollons.delete(hollon.id);
            });
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error in executeAssignedHollons: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * 동시 실행 제한 체크
   */
  private async checkConcurrencyLimit(orgId: string): Promise<boolean> {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) return false;

    const activeCount = await this.hollonRepo.count({
      where: {
        organizationId: orgId,
        status: In([HollonStatus.WORKING, HollonStatus.BLOCKED]),
      },
    });

    const settings = (org.settings || {}) as OrganizationSettings;
    const maxConcurrent = settings.maxConcurrentHolons || 10;

    if (activeCount >= maxConcurrent) {
      this.logger.warn(
        `Organization ${org.name} at max concurrency: ${activeCount}/${maxConcurrent}`,
      );
      return false;
    }

    return true;
  }

  /**
   * Hollon 실행 사이클
   */
  private async executeHollonCycle(hollonId: string): Promise<void> {
    this.logger.log(`Starting execution cycle for hollon: ${hollonId}`);

    try {
      const result = await this.orchestrator.runCycle(hollonId);

      if (result.success) {
        this.logger.log(
          `Execution cycle completed for ${hollonId}: ` +
            `task=${result.taskId}, duration=${result.duration}ms`,
        );
      } else {
        this.logger.warn(
          `Execution cycle failed for ${hollonId}: ${result.error || 'Unknown error'}`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Exception in executeHollonCycle for ${hollonId}: ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * 현재 실행 중인 Hollon 목록 조회 (디버깅용)
   */
  getExecutingHollons(): string[] {
    return Array.from(this.executingHollons);
  }

  /**
   * 특정 Hollon이 실행 중인지 확인
   */
  isHollonExecuting(hollonId: string): boolean {
    return this.executingHollons.has(hollonId);
  }
}
