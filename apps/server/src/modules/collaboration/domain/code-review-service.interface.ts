import {
  TaskPullRequest,
  PullRequestStatus,
} from '../entities/task-pull-request.entity';
import { CreatePullRequestDto } from '../dto/create-pull-request.dto';
import { ReviewSubmissionDto } from '../dto/review-submission.dto';

/**
 * Code Review Service Interface
 *
 * Collaboration Context의 서비스 계약
 * DDD에서 Service 인터페이스 역할
 */
export interface ICodeReviewService {
  /**
   * Pull Request 생성
   */
  createPR(dto: CreatePullRequestDto): Promise<TaskPullRequest>;

  /**
   * 리뷰 요청 (리뷰어 자동 할당)
   */
  requestReview(prId: string): Promise<TaskPullRequest>;

  /**
   * PR 조회
   */
  findPullRequest(prId: string): Promise<TaskPullRequest | null>;

  /**
   * PR Number로 조회
   */
  findPullRequestByNumber(
    prNumber: number,
    repository: string,
  ): Promise<TaskPullRequest | null>;

  /**
   * 자동화된 리뷰 수행
   */
  performAutomatedReview(
    prId: string,
    reviewerHollonId: string,
  ): Promise<TaskPullRequest>;

  /**
   * 리뷰 제출 (승인/변경요청)
   */
  submitReview(
    prId: string,
    reviewerHollonId: string,
    dto: ReviewSubmissionDto,
  ): Promise<TaskPullRequest>;

  /**
   * PR 상태 업데이트
   */
  updatePRStatus(prId: string, status: PullRequestStatus): Promise<void>;

  /**
   * Task의 PR 조회
   */
  findPullRequestsByTaskId(taskId: string): Promise<TaskPullRequest[]>;
}
