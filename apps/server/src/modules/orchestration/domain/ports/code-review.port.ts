import { TaskPullRequest } from '../../../collaboration/entities/task-pull-request.entity';

/**
 * CodeReview Port Interface
 *
 * Orchestration Context가 코드 리뷰 기능에 접근하기 위한 Port
 * DDD Port/Adapter 패턴의 Port 역할
 */

export interface PRData {
  taskId: string;
  prNumber: number;
  prUrl: string;
  repository: string;
  branchName?: string;
  authorHollonId?: string;
  title?: string;
  description?: string;
}

export interface ICodeReviewPort {
  /**
   * Pull Request 생성
   */
  createPullRequest(data: PRData): Promise<TaskPullRequest>;

  /**
   * 리뷰 요청 (리뷰어에게)
   */
  requestReview(prId: string, reviewerId?: string): Promise<void>;

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
   * Task의 PR 목록 조회
   */
  findPullRequestsByTaskId(taskId: string): Promise<TaskPullRequest[]>;
}
