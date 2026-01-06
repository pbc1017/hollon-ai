import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CollaborationService } from './services/collaboration.service';
import { CodeReviewService } from './services/code-review.service';
import { CollaborationRequestDto } from './dto/collaboration-request.dto';
import { CreatePullRequestDto } from './dto/create-pull-request.dto';
import { ReviewSubmissionDto } from './dto/review-submission.dto';
import { CollaborationSession } from './entities/collaboration-session.entity';
import { TaskPullRequest } from './entities/task-pull-request.entity';

@Controller('collaboration')
export class CollaborationController {
  constructor(
    private readonly collaborationService: CollaborationService,
    private readonly codeReviewService: CodeReviewService,
  ) {}

  /**
   * 협업 요청
   * POST /collaboration/request
   */
  @Post('request')
  async requestCollaboration(
    @Query('requesterHollonId', ParseUUIDPipe) requesterHollonId: string,
    @Body() dto: CollaborationRequestDto,
  ): Promise<CollaborationSession> {
    return this.collaborationService.requestCollaboration(
      requesterHollonId,
      dto,
    );
  }

  /**
   * 협업 요청 수락
   * PUT /collaboration/sessions/:id/accept
   */
  @Put('sessions/:id/accept')
  async acceptCollaboration(
    @Param('id', ParseUUIDPipe) sessionId: string,
  ): Promise<CollaborationSession> {
    return this.collaborationService.acceptCollaboration(sessionId);
  }

  /**
   * 협업 요청 거절
   * PUT /collaboration/sessions/:id/reject
   */
  @Put('sessions/:id/reject')
  async rejectCollaboration(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body('reason') reason?: string,
  ): Promise<CollaborationSession> {
    return this.collaborationService.rejectCollaboration(sessionId, reason);
  }

  /**
   * 협업 세션 시작
   * PUT /collaboration/sessions/:id/start
   */
  @Put('sessions/:id/start')
  async startSession(
    @Param('id', ParseUUIDPipe) sessionId: string,
  ): Promise<CollaborationSession> {
    return this.collaborationService.startSession(sessionId);
  }

  /**
   * 협업 세션 완료
   * PUT /collaboration/sessions/:id/complete
   */
  @Put('sessions/:id/complete')
  async completeSession(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body('outcome') outcome?: string,
  ): Promise<CollaborationSession> {
    return this.collaborationService.completeSession(sessionId, outcome);
  }

  /**
   * 홀론의 활성 협업 세션 조회
   * GET /collaboration/sessions/active?hollonId=xxx
   */
  @Get('sessions/active')
  async getActiveSessions(
    @Query('hollonId', ParseUUIDPipe) hollonId: string,
  ): Promise<CollaborationSession[]> {
    return this.collaborationService.getActiveSessions(hollonId);
  }

  /**
   * 협업 세션 조회
   * GET /collaboration/sessions/:id
   */
  @Get('sessions/:id')
  async getSession(
    @Param('id', ParseUUIDPipe) sessionId: string,
  ): Promise<CollaborationSession> {
    return this.collaborationService.getSession(sessionId);
  }

  /**
   * PR 생성
   * POST /collaboration/pull-requests
   */
  @Post('pull-requests')
  async createPullRequest(
    @Body() dto: CreatePullRequestDto,
  ): Promise<TaskPullRequest> {
    return this.codeReviewService.createPullRequest(dto);
  }

  /**
   * 리뷰 요청
   * PUT /collaboration/pull-requests/:id/request-review
   */
  @Put('pull-requests/:id/request-review')
  async requestReview(
    @Param('id', ParseUUIDPipe) prId: string,
  ): Promise<TaskPullRequest> {
    return this.codeReviewService.requestReview(prId);
  }

  /**
   * 리뷰 제출
   * PUT /collaboration/pull-requests/:id/review
   */
  @Put('pull-requests/:id/review')
  async submitReview(
    @Param('id', ParseUUIDPipe) prId: string,
    @Query('reviewerHollonId', ParseUUIDPipe) reviewerHollonId: string,
    @Body() review: ReviewSubmissionDto,
  ): Promise<TaskPullRequest> {
    return this.codeReviewService.submitReview(prId, reviewerHollonId, review);
  }

  /**
   * PR 머지
   * PUT /collaboration/pull-requests/:id/merge
   */
  @Put('pull-requests/:id/merge')
  async mergePullRequest(
    @Param('id', ParseUUIDPipe) prId: string,
  ): Promise<void> {
    return this.codeReviewService.mergePullRequest(prId);
  }

  /**
   * Task의 PR 목록 조회
   * GET /collaboration/pull-requests?taskId=xxx
   */
  @Get('pull-requests')
  async getPullRequestsForTask(
    @Query('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<TaskPullRequest[]> {
    return this.codeReviewService.getPullRequestsForTask(taskId);
  }

  /**
   * PR 상세 조회
   * GET /collaboration/pull-requests/:id
   */
  @Get('pull-requests/:id')
  async getPullRequest(
    @Param('id', ParseUUIDPipe) prId: string,
  ): Promise<TaskPullRequest> {
    return this.codeReviewService.getPullRequest(prId);
  }
}
