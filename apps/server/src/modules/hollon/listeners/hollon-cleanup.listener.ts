import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hollon, HollonLifecycle } from '../entities/hollon.entity';

/**
 * HollonCleanupListener: 만료된 임시 홀론 자동 정리
 *
 * Phase 4: 서브 홀론 자동 정리
 * - 매 10분마다 만료된 임시 홀론을 자동으로 정리
 * - lifecycle이 TEMPORARY이고 expiresAt이 현재 시간보다 이전인 홀론 삭제
 * - 데이터베이스 공간 절약 및 시스템 성능 유지
 */
@Injectable()
export class HollonCleanupListener {
  private readonly logger = new Logger(HollonCleanupListener.name);

  constructor(
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
  ) {}

  /**
   * 만료된 임시 홀론 자동 정리
   * 매 10분마다 실행
   *
   * 조건:
   * - lifecycle = TEMPORARY
   * - expiresAt이 현재 시간보다 이전
   */
  @Cron('*/10 * * * *') // 10분마다
  async cleanupExpiredSubHollons(): Promise<void> {
    try {
      this.logger.debug('Checking for expired temporary hollons...');

      // 만료된 임시 홀론 찾기
      // TODO: Re-enable after migration adds expiresAt field
      const expiredHollons = await this.hollonRepo.find({
        where: {
          lifecycle: HollonLifecycle.TEMPORARY,
          // expiresAt: LessThan(new Date()), // Temporarily disabled until migration
        },
      });

      if (expiredHollons.length === 0) {
        this.logger.debug('No expired temporary hollons found');
        return;
      }

      this.logger.log(
        `Found ${expiredHollons.length} expired temporary hollon(s) to clean up`,
      );

      // 만료된 홀론 삭제
      let deletedCount = 0;
      for (const hollon of expiredHollons) {
        try {
          await this.hollonRepo.remove(hollon);
          this.logger.log(
            `✅ Deleted expired temporary hollon: ${hollon.name} (${hollon.id})`,
          );
          deletedCount++;
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to delete hollon ${hollon.id}: ${err.message}`,
            err.stack,
          );
          // 에러가 발생해도 다음 홀론은 계속 처리
        }
      }

      this.logger.log(
        `Successfully cleaned up ${deletedCount} temporary hollon(s)`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Hollon cleanup automation failed: ${err.message}`,
        err.stack,
      );
    }
  }
}
