import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TaskPullRequest,
  PullRequestStatus,
  ReviewerType,
} from '../entities/task-pull-request.entity';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import { MessageService } from '../../message/message.service';
import {
  MessageType,
  ParticipantType,
} from '../../message/entities/message.entity';
import { CreatePullRequestDto } from '../dto/create-pull-request.dto';
import { ReviewSubmissionDto } from '../dto/review-submission.dto';

@Injectable()
export class CodeReviewService {
  private readonly logger = new Logger(CodeReviewService.name);

  constructor(
    @InjectRepository(TaskPullRequest)
    private readonly prRepo: Repository<TaskPullRequest>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    private readonly messageService: MessageService,
  ) {}

  /**
   * PR 생성 및 Task 연결
   */
  async createPullRequest(dto: CreatePullRequestDto): Promise<TaskPullRequest> {
    this.logger.log(`Creating PR for task ${dto.taskId}: PR #${dto.prNumber}`);

    // Task 존재 확인
    const task = await this.taskRepo.findOne({ where: { id: dto.taskId } });
    if (!task) {
      throw new NotFoundException(`Task ${dto.taskId} not found`);
    }

    // PR 생성
    const pr = await this.prRepo.save({
      taskId: dto.taskId,
      prNumber: dto.prNumber,
      prUrl: dto.prUrl,
      repository: dto.repository,
      branchName: dto.branchName || null,
      authorHollonId: dto.authorHollonId || null,
      status: PullRequestStatus.DRAFT,
    });

    // Task 상태 업데이트 (IN_REVIEW로)
    task.status = TaskStatus.IN_REVIEW;
    await this.taskRepo.save(task);

    this.logger.log(`PR created: ${pr.id}`);
    return pr;
  }

  /**
   * 리뷰 요청 - 리뷰어 자동 할당
   */
  async requestReview(prId: string): Promise<TaskPullRequest> {
    const pr = await this.prRepo.findOne({
      where: { id: prId },
      relations: ['task'],
    });

    if (!pr) {
      throw new NotFoundException(`PR ${prId} not found`);
    }

    this.logger.log(`Requesting review for PR ${prId}`);

    // 리뷰어 선택
    const reviewer = await this.selectReviewer(pr);

    // PR 업데이트
    pr.status = PullRequestStatus.READY_FOR_REVIEW;
    pr.reviewerHollonId = reviewer.hollonId;
    pr.reviewerType = reviewer.type;
    await this.prRepo.save(pr);

    // 리뷰어에게 요청 전송
    await this.messageService.send({
      fromId: pr.authorHollonId || undefined,
      fromType: ParticipantType.HOLLON,
      toId: reviewer.hollonId,
      toType: ParticipantType.HOLLON,
      messageType: MessageType.REVIEW_REQUEST,
      content: this.formatReviewRequest(pr),
      metadata: { prId: pr.id, taskId: pr.taskId },
      requiresResponse: true,
    });

    this.logger.log(
      `Review requested: PR ${prId} -> Reviewer ${reviewer.hollonId} (${reviewer.type})`,
    );
    return pr;
  }

  /**
   * 리뷰 제출
   */
  async submitReview(
    prId: string,
    reviewerHollonId: string,
    review: ReviewSubmissionDto,
  ): Promise<TaskPullRequest> {
    const pr = await this.prRepo.findOne({
      where: { id: prId },
      relations: ['task'],
    });

    if (!pr) {
      throw new NotFoundException(`PR ${prId} not found`);
    }

    if (pr.reviewerHollonId !== reviewerHollonId) {
      throw new Error(
        `Hollon ${reviewerHollonId} is not the assigned reviewer`,
      );
    }

    this.logger.log(`Review submitted for PR ${prId}: ${review.decision}`);

    // PR 업데이트
    pr.status = review.decision;
    pr.reviewComments = review.comments || null;

    if (review.decision === PullRequestStatus.APPROVED) {
      pr.approvedAt = new Date();
    }

    await this.prRepo.save(pr);

    // 작성자에게 리뷰 결과 알림
    if (pr.authorHollonId) {
      await this.messageService.send({
        fromId: reviewerHollonId,
        fromType: ParticipantType.HOLLON,
        toId: pr.authorHollonId,
        toType: ParticipantType.HOLLON,
        messageType: MessageType.RESPONSE,
        content: this.formatReviewResult(pr, review),
        metadata: { prId: pr.id, taskId: pr.taskId },
      });
    }

    return pr;
  }

  /**
   * PR 머지
   */
  async mergePullRequest(prId: string): Promise<void> {
    const pr = await this.prRepo.findOne({
      where: { id: prId },
      relations: ['task'],
    });

    if (!pr) {
      throw new NotFoundException(`PR ${prId} not found`);
    }

    if (pr.status !== PullRequestStatus.APPROVED) {
      throw new Error(`PR ${prId} is not approved yet`);
    }

    this.logger.log(`Merging PR ${prId}`);

    // PR 상태 업데이트
    pr.status = PullRequestStatus.MERGED;
    pr.mergedAt = new Date();
    await this.prRepo.save(pr);

    // Task 상태 완료로 변경
    pr.task.status = TaskStatus.COMPLETED;
    pr.task.completedAt = new Date();
    await this.taskRepo.save(pr.task);

    this.logger.log(`PR merged: ${prId}, Task completed: ${pr.taskId}`);
  }

  /**
   * 리뷰어 선택 로직
   */
  private async selectReviewer(
    pr: TaskPullRequest,
  ): Promise<{ hollonId: string; type: ReviewerType }> {
    // 1. PR 유형 분류
    const prType = await this.classifyPRType(pr);

    // 2. 유형별 전문 리뷰어
    if (prType === 'security') {
      return this.findOrCreateSpecializedReviewer('SecurityReviewer', pr);
    }
    if (prType === 'architecture') {
      return this.findOrCreateSpecializedReviewer('ArchitectureReviewer', pr);
    }
    if (prType === 'performance') {
      return this.findOrCreateSpecializedReviewer('PerformanceReviewer', pr);
    }

    // 3. 일반 PR: 같은 팀의 가용한 홀론
    const teammate = await this.findAvailableTeammate(pr);
    if (teammate) {
      return { hollonId: teammate.id, type: ReviewerType.TEAM_MEMBER };
    }

    // 4. Fallback: 일반 CodeReviewer
    return this.findOrCreateSpecializedReviewer('CodeReviewer', pr);
  }

  /**
   * PR 유형 분류
   */
  private async classifyPRType(
    pr: TaskPullRequest,
  ): Promise<'security' | 'architecture' | 'performance' | 'general'> {
    // 간단한 키워드 기반 분류 (실제로는 더 정교한 분석 필요)
    const task = pr.task;
    const lowerTitle = task.title.toLowerCase();
    const lowerDesc = task.description.toLowerCase();

    if (
      lowerTitle.includes('security') ||
      lowerTitle.includes('auth') ||
      lowerDesc.includes('security')
    ) {
      return 'security';
    }

    if (
      lowerTitle.includes('architecture') ||
      lowerTitle.includes('refactor') ||
      lowerDesc.includes('architecture')
    ) {
      return 'architecture';
    }

    if (
      lowerTitle.includes('performance') ||
      lowerTitle.includes('optimization') ||
      lowerDesc.includes('performance')
    ) {
      return 'performance';
    }

    return 'general';
  }

  /**
   * 전문 리뷰어 찾기 또는 생성
   */
  private async findOrCreateSpecializedReviewer(
    role: string,
    _pr: TaskPullRequest,
  ): Promise<{ hollonId: string; type: ReviewerType }> {
    // 해당 역할의 가용한 홀론 찾기
    const existingReviewer = await this.hollonRepo.findOne({
      where: {
        name: role,
        status: HollonStatus.IDLE,
      },
    });

    if (existingReviewer) {
      return {
        hollonId: existingReviewer.id,
        type: this.mapRoleToReviewerType(role),
      };
    }

    // 없으면 임시 홀론 생성
    this.logger.log(`Creating temporary reviewer hollon: ${role}`);
    // TODO: HollonService의 createTemporary 메서드 구현 후 활성화
    // const reviewer = await this.hollonService.createTemporary({
    //   name: role,
    //   organizationId: pr.task.project.organizationId,
    //   lifecycle: 'temporary',
    // });

    // 임시로 시스템 기본 리뷰어 반환 (실제 구현 시 제거)
    const systemReviewer = await this.hollonRepo.findOne({
      where: { status: HollonStatus.IDLE },
    });

    if (!systemReviewer) {
      throw new Error('No available reviewer found');
    }

    return {
      hollonId: systemReviewer.id,
      type: this.mapRoleToReviewerType(role),
    };
  }

  /**
   * 팀 동료 찾기
   */
  private async findAvailableTeammate(
    _pr: TaskPullRequest,
  ): Promise<Hollon | null> {
    // 같은 팀의 가용한 홀론 찾기
    // TODO: Task에서 teamId를 가져와서 같은 팀의 홀론 조회
    const availableHollons = await this.hollonRepo.find({
      where: { status: HollonStatus.IDLE },
      take: 1,
    });

    return availableHollons[0] || null;
  }

  /**
   * Role을 ReviewerType으로 매핑
   */
  private mapRoleToReviewerType(role: string): ReviewerType {
    switch (role) {
      case 'SecurityReviewer':
        return ReviewerType.SECURITY_REVIEWER;
      case 'ArchitectureReviewer':
        return ReviewerType.ARCHITECTURE_REVIEWER;
      case 'PerformanceReviewer':
        return ReviewerType.PERFORMANCE_REVIEWER;
      default:
        return ReviewerType.CODE_REVIEWER;
    }
  }

  /**
   * 리뷰 요청 메시지 포맷
   */
  private formatReviewRequest(pr: TaskPullRequest): string {
    return `
Code Review Request

PR: #${pr.prNumber}
URL: ${pr.prUrl}
Repository: ${pr.repository}
Branch: ${pr.branchName || 'N/A'}

Task: ${pr.task.title}
Description: ${pr.task.description}

Please review this pull request.
    `.trim();
  }

  /**
   * 리뷰 결과 메시지 포맷
   */
  private formatReviewResult(
    pr: TaskPullRequest,
    review: ReviewSubmissionDto,
  ): string {
    return `
Code Review Result

PR: #${pr.prNumber}
Decision: ${review.decision}
${review.comments ? `\nComments:\n${review.comments}` : ''}

${review.decision === PullRequestStatus.APPROVED ? 'PR is approved and ready to merge.' : 'Changes are requested. Please address the comments and resubmit.'}
    `.trim();
  }

  /**
   * Task의 PR 목록 조회
   */
  async getPullRequestsForTask(taskId: string): Promise<TaskPullRequest[]> {
    return this.prRepo.find({
      where: { taskId },
      relations: ['authorHollon', 'reviewerHollon'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * PR 상세 조회
   */
  async getPullRequest(prId: string): Promise<TaskPullRequest> {
    const pr = await this.prRepo.findOne({
      where: { id: prId },
      relations: ['task', 'authorHollon', 'reviewerHollon'],
    });

    if (!pr) {
      throw new NotFoundException(`PR ${prId} not found`);
    }

    return pr;
  }
}
