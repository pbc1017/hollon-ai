import { Injectable, Logger } from '@nestjs/common';

/**
 * Phase 3.5: PR diff 캐싱 서비스
 *
 * 같은 PR을 여러 번 리뷰할 때 diff를 매번 가져오지 않고 캐싱
 * - 메모리 기반 LRU 캐시 (Phase 3.5)
 * - Phase 4에서 Redis로 확장 가능
 */
@Injectable()
export class PRDiffCacheService {
  private readonly logger = new Logger(PRDiffCacheService.name);
  private readonly cache = new Map<string, CachedDiff>();
  private readonly maxCacheSize = 100; // 최대 100개 PR diff 캐싱
  private readonly cacheTTL = 1000 * 60 * 30; // 30분 TTL

  /**
   * Diff 조회 (캐시 우선)
   */
  async getDiff(prUrl: string): Promise<string | null> {
    const cached = this.cache.get(prUrl);

    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp < this.cacheTTL) {
        this.logger.debug(`Cache HIT: ${prUrl}`);
        cached.hits++;
        return cached.diff;
      } else {
        this.logger.debug(`Cache EXPIRED: ${prUrl}`);
        this.cache.delete(prUrl);
      }
    }

    this.logger.debug(`Cache MISS: ${prUrl}`);
    return null;
  }

  /**
   * Diff 저장
   */
  async setDiff(prUrl: string, diff: string): Promise<void> {
    // LRU: 캐시가 가득 차면 가장 오래된 항목 제거
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.findOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.logger.debug(`Cache EVICT: ${oldestKey}`);
      }
    }

    this.cache.set(prUrl, {
      diff,
      timestamp: Date.now(),
      hits: 0,
    });

    this.logger.debug(
      `Cache SET: ${prUrl} (size: ${this.cache.size}/${this.maxCacheSize})`,
    );
  }

  /**
   * 캐시 무효화 (PR 업데이트 시)
   */
  async invalidate(prUrl: string): Promise<void> {
    this.cache.delete(prUrl);
    this.logger.debug(`Cache INVALIDATE: ${prUrl}`);
  }

  /**
   * 캐시 통계
   */
  getStats(): CacheStats {
    let totalHits = 0;
    let totalSize = 0;

    for (const cached of this.cache.values()) {
      totalHits += cached.hits;
      totalSize += cached.diff.length;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      totalHits,
      averageHits: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      totalSizeBytes: totalSize,
      hitRate: 0, // 별도 tracking 필요
    };
  }

  /**
   * 가장 오래된 캐시 키 찾기 (LRU)
   */
  private findOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * 전체 캐시 삭제 (테스트용)
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.log('Cache CLEARED');
  }
}

interface CachedDiff {
  diff: string;
  timestamp: number;
  hits: number;
}

interface CacheStats {
  size: number;
  maxSize: number;
  totalHits: number;
  averageHits: number;
  totalSizeBytes: number;
  hitRate: number;
}
