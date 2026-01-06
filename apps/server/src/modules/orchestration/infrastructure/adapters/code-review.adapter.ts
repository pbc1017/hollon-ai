import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICodeReviewPort, PRData } from '../../domain/ports/code-review.port';
import { ICodeReviewService } from '../../../collaboration/domain/code-review-service.interface';
import { TaskPullRequest } from '../../../collaboration/entities/task-pull-request.entity';

/**
 * CodeReview Adapter
 *
 * ICodeReviewPort의 구현체
 * Orchestration Context가 Collaboration Context에 접근하기 위한 Adapter
 */
@Injectable()
export class CodeReviewAdapter implements ICodeReviewPort {
  private readonly logger = new Logger(CodeReviewAdapter.name);

  constructor(
    @Inject('ICodeReviewService')
    private readonly codeReviewService: ICodeReviewService,
  ) {}

  async createPullRequest(data: PRData): Promise<TaskPullRequest> {
    this.logger.log(`Creating PR for task ${data.taskId} via adapter`);

    return this.codeReviewService.createPR({
      taskId: data.taskId,
      prNumber: data.prNumber,
      prUrl: data.prUrl,
      repository: data.repository,
      branchName: data.branchName,
      authorHollonId: data.authorHollonId,
    });
  }

  async requestReview(prId: string, reviewerId?: string): Promise<void> {
    this.logger.log(
      `Requesting review for PR ${prId}${reviewerId ? ` from reviewer ${reviewerId}` : ''}`,
    );

    // ICodeReviewService.requestReview는 자동으로 리뷰어를 선택
    // reviewerId가 제공되면 향후 확장 가능
    await this.codeReviewService.requestReview(prId);
  }

  async findPullRequest(prId: string): Promise<TaskPullRequest | null> {
    return this.codeReviewService.findPullRequest(prId);
  }

  async findPullRequestByNumber(
    prNumber: number,
    repository: string,
  ): Promise<TaskPullRequest | null> {
    return this.codeReviewService.findPullRequestByNumber(prNumber, repository);
  }

  async findPullRequestsByTaskId(taskId: string): Promise<TaskPullRequest[]> {
    return this.codeReviewService.findPullRequestsByTaskId(taskId);
  }
}
