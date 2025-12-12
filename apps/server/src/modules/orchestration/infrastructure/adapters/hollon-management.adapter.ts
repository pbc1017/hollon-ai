import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IHollonManagementPort,
  HollonCriteria,
} from '../../domain/ports/hollon-management.port';
import { IHollonService } from '../../../hollon/domain/hollon-service.interface';
import { Hollon, HollonStatus } from '../../../hollon/entities/hollon.entity';

/**
 * HollonManagement Adapter
 *
 * IHollonManagementPort의 구현체
 * Orchestration Context가 Hollon Management Context에 접근하기 위한 Adapter
 */
@Injectable()
export class HollonManagementAdapter implements IHollonManagementPort {
  private readonly logger = new Logger(HollonManagementAdapter.name);

  constructor(
    @Inject('IHollonService')
    private readonly hollonService: IHollonService,
  ) {}

  async assignTaskToHollon(hollonId: string, taskId: string): Promise<void> {
    this.logger.log(
      `Assigning task ${taskId} to hollon ${hollonId} via adapter`,
    );

    // Hollon 상태를 WORKING으로 변경
    // Note: currentTaskId는 Task 엔티티에서 관리됨
    await this.hollonService.updateStatus(hollonId, HollonStatus.WORKING);
  }

  async updateHollonStatus(
    hollonId: string,
    status: HollonStatus,
  ): Promise<void> {
    this.logger.log(`Updating hollon ${hollonId} status to ${status}`);
    await this.hollonService.updateStatus(hollonId, status);
  }

  async findAvailableHollon(criteria: HollonCriteria): Promise<Hollon | null> {
    this.logger.log(`Finding available hollon with criteria`, criteria);

    // IDLE 상태의 Hollon들을 조회
    const idleHollons = criteria.organizationId
      ? await this.hollonService.findIdleHollons(criteria.organizationId)
      : await this.hollonService.findByStatus(HollonStatus.IDLE);

    if (idleHollons.length === 0) {
      this.logger.warn('No idle hollons available');
      return null;
    }

    // criteria에 맞는 최적의 Hollon 선택
    return this.selectBestHollon(idleHollons, criteria);
  }

  async findHollonById(hollonId: string): Promise<Hollon> {
    return this.hollonService.findById(hollonId);
  }

  async findHollonsByStatus(status: HollonStatus): Promise<Hollon[]> {
    return this.hollonService.findByStatus(status);
  }

  /**
   * criteria에 따라 최적의 Hollon 선택
   */
  private selectBestHollon(
    hollons: Hollon[],
    criteria: HollonCriteria,
  ): Hollon | null {
    if (hollons.length === 0) {
      return null;
    }

    // criteria가 없으면 첫 번째 Hollon 반환
    if (!criteria.role && !criteria.skills && !criteria.teamId) {
      return hollons[0];
    }

    // 점수 기반 선택
    const scoredHollons = hollons.map((hollon) => ({
      hollon,
      score: this.scoreHollon(hollon, criteria),
    }));

    // 점수가 가장 높은 Hollon 선택
    scoredHollons.sort((a, b) => b.score - a.score);

    const best = scoredHollons[0];
    if (best.score === 0) {
      this.logger.warn('No hollon matches the criteria, returning first idle');
      return hollons[0];
    }

    this.logger.log(
      `Selected hollon ${best.hollon.id} with score ${best.score}`,
    );
    return best.hollon;
  }

  /**
   * Hollon 점수 계산
   */
  private scoreHollon(hollon: Hollon, criteria: HollonCriteria): number {
    let score = 0;

    // Role 일치 시 가장 높은 점수
    if (criteria.role && hollon.role?.name === criteria.role) {
      score += 100;
    }

    // Team 일치
    if (criteria.teamId && hollon.teamId === criteria.teamId) {
      score += 50;
    }

    // Skills는 향후 확장 가능 (현재는 role 기반으로만 판단)
    // TODO: Hollon에 skills 필드가 추가되면 여기서 매칭

    // 통계 기반 점수
    if (hollon.successRate) {
      score += hollon.successRate * 10; // 최대 10점
    }

    if (hollon.tasksCompleted > 0) {
      score += Math.min(hollon.tasksCompleted / 10, 10); // 최대 10점
    }

    return score;
  }
}
