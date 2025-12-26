import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskPullRequest } from '../entities/task-pull-request.entity';

/**
 * Phase 3.5: 리뷰 품질 측정 서비스
 *
 * Phase 4 Dogfooding 준비를 위한 리뷰 품질 메트릭 수집:
 * - 리뷰 속도 (시간)
 * - 리뷰 깊이 (코멘트 수, 길이)
 * - 승인율
 * - 재리뷰 요청 빈도
 */
@Injectable()
export class ReviewQualityService {
  // private readonly logger = new Logger(ReviewQualityService.name); // Phase 4에서 사용

  constructor(
    @InjectRepository(TaskPullRequest)
    private readonly prRepo: Repository<TaskPullRequest>,
  ) {}

  /**
   * 리뷰어별 품질 메트릭 계산
   */
  async getReviewerMetrics(reviewerHollonId: string): Promise<ReviewerMetrics> {
    const reviews = await this.prRepo.find({
      where: { reviewerHollonId },
      relations: ['task'],
    });

    if (reviews.length === 0) {
      return this.createEmptyMetrics(reviewerHollonId);
    }

    // 리뷰 속도 계산 (PR 생성 → 리뷰 완료)
    const reviewTimes: number[] = [];
    let approvedCount = 0;
    let changesRequestedCount = 0;
    let totalCommentLength = 0;

    for (const pr of reviews) {
      // 리뷰 완료 시간 계산
      if (pr.approvedAt) {
        const reviewTime = pr.approvedAt.getTime() - pr.createdAt.getTime();
        reviewTimes.push(reviewTime);
      }

      // 승인율 계산
      if (pr.status === 'approved') {
        approvedCount++;
      } else if (pr.status === 'changes_requested') {
        changesRequestedCount++;
      }

      // 코멘트 길이
      if (pr.reviewComments) {
        totalCommentLength += pr.reviewComments.length;
      }
    }

    const avgReviewTimeMs =
      reviewTimes.length > 0
        ? reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length
        : 0;

    return {
      reviewerHollonId,
      totalReviews: reviews.length,
      approvedCount,
      changesRequestedCount,
      approvalRate:
        reviews.length > 0 ? (approvedCount / reviews.length) * 100 : 0,
      averageReviewTimeHours: avgReviewTimeMs / (1000 * 60 * 60),
      averageCommentLength:
        reviews.length > 0 ? totalCommentLength / reviews.length : 0,
      quality: this.calculateQualityScore({
        approvalRate: (approvedCount / reviews.length) * 100,
        avgReviewTimeMs,
        avgCommentLength: totalCommentLength / reviews.length,
      }),
    };
  }

  /**
   * 조직 전체 리뷰 품질 대시보드
   */
  async getOrganizationMetrics(
    organizationId: string,
  ): Promise<OrganizationReviewMetrics> {
    const prs = await this.prRepo
      .createQueryBuilder('pr')
      .leftJoinAndSelect('pr.task', 'task')
      .where('task.organization_id = :orgId', { orgId: organizationId })
      .getMany();

    const totalPRs = prs.length;
    const approvedPRs = prs.filter((pr) => pr.status === 'approved').length;
    const mergedPRs = prs.filter((pr) => pr.status === 'merged').length;

    // 리뷰어별 분포
    const reviewerDistribution = new Map<string, number>();
    for (const pr of prs) {
      if (pr.reviewerHollonId) {
        const count = reviewerDistribution.get(pr.reviewerHollonId) || 0;
        reviewerDistribution.set(pr.reviewerHollonId, count + 1);
      }
    }

    return {
      organizationId,
      totalPRs,
      approvedPRs,
      mergedPRs,
      approvalRate: totalPRs > 0 ? (approvedPRs / totalPRs) * 100 : 0,
      mergeRate: totalPRs > 0 ? (mergedPRs / totalPRs) * 100 : 0,
      activeReviewers: reviewerDistribution.size,
      reviewerDistribution: Object.fromEntries(reviewerDistribution),
    };
  }

  /**
   * 품질 점수 계산 (0-100)
   *
   * 기준:
   * - 빠른 리뷰 (< 2시간): +30점
   * - 적절한 승인율 (60-80%): +30점
   * - 충분한 코멘트 (> 200자): +40점
   */
  private calculateQualityScore(params: {
    approvalRate: number;
    avgReviewTimeMs: number;
    avgCommentLength: number;
  }): number {
    let score = 0;

    // 리뷰 속도 점수 (0-30점)
    const reviewTimeHours = params.avgReviewTimeMs / (1000 * 60 * 60);
    if (reviewTimeHours < 2) {
      score += 30;
    } else if (reviewTimeHours < 4) {
      score += 20;
    } else if (reviewTimeHours < 24) {
      score += 10;
    }

    // 승인율 점수 (0-30점)
    // 너무 높으면 (>90%) 리뷰가 형식적일 수 있고,
    // 너무 낮으면 (<50%) 너무 까다로울 수 있음
    if (params.approvalRate >= 60 && params.approvalRate <= 80) {
      score += 30;
    } else if (params.approvalRate >= 50 && params.approvalRate < 90) {
      score += 20;
    } else {
      score += 10;
    }

    // 코멘트 품질 점수 (0-40점)
    if (params.avgCommentLength > 200) {
      score += 40;
    } else if (params.avgCommentLength > 100) {
      score += 30;
    } else if (params.avgCommentLength > 50) {
      score += 20;
    } else {
      score += 10;
    }

    return score;
  }

  /**
   * 빈 메트릭 생성
   */
  private createEmptyMetrics(reviewerHollonId: string): ReviewerMetrics {
    return {
      reviewerHollonId,
      totalReviews: 0,
      approvedCount: 0,
      changesRequestedCount: 0,
      approvalRate: 0,
      averageReviewTimeHours: 0,
      averageCommentLength: 0,
      quality: 0,
    };
  }
}

export interface ReviewerMetrics {
  reviewerHollonId: string;
  totalReviews: number;
  approvedCount: number;
  changesRequestedCount: number;
  approvalRate: number; // 0-100
  averageReviewTimeHours: number;
  averageCommentLength: number;
  quality: number; // 0-100 품질 점수
}

export interface OrganizationReviewMetrics {
  organizationId: string;
  totalPRs: number;
  approvedPRs: number;
  mergedPRs: number;
  approvalRate: number;
  mergeRate: number;
  activeReviewers: number;
  reviewerDistribution: Record<string, number>;
}
