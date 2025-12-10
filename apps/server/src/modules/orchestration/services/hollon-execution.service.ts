import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import { TaskStatus } from '../../task/entities/task.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { HollonOrchestratorService } from './hollon-orchestrator.service';

interface OrganizationSettings {
  maxConcurrentHolons?: number;
  autonomousExecutionEnabled?: boolean;
  emergencyStopReason?: string;
}

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
  ) {}

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
