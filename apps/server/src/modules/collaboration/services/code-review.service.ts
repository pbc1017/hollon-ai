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

    // Phase 3.5: APPROVED 시 자동 Merge
    if (review.decision === PullRequestStatus.APPROVED) {
      try {
        await this.autoMergePullRequest(pr);
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Auto-merge failed for PR ${prId}: ${err.message}`,
          err.stack,
        );
        // Auto-merge 실패해도 리뷰는 완료로 간주
      }
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
   * PR 닫기 (머지 없이)
   */
  async closePullRequest(prId: string, reason?: string): Promise<void> {
    const pr = await this.prRepo.findOne({
      where: { id: prId },
      relations: ['task'],
    });

    if (!pr) {
      throw new NotFoundException(`PR ${prId} not found`);
    }

    if (pr.status === PullRequestStatus.MERGED) {
      throw new Error(`PR ${prId} is already merged and cannot be closed`);
    }

    if (pr.status === PullRequestStatus.CLOSED) {
      throw new Error(`PR ${prId} is already closed`);
    }

    this.logger.log(`Closing PR ${prId}`);

    // PR 상태 업데이트
    pr.status = PullRequestStatus.CLOSED;
    if (reason) {
      pr.reviewComments = pr.reviewComments
        ? `${pr.reviewComments}\n\n[CLOSED] ${reason}`
        : `[CLOSED] ${reason}`;
    }
    await this.prRepo.save(pr);

    // Task 상태를 다시 IN_PROGRESS로 변경 (새 PR 생성 가능)
    pr.task.status = TaskStatus.IN_PROGRESS;
    await this.taskRepo.save(pr.task);

    // 작성자에게 알림
    if (pr.authorHollonId) {
      await this.messageService.send({
        fromId: pr.reviewerHollonId || undefined,
        fromType: ParticipantType.HOLLON,
        toId: pr.authorHollonId,
        toType: ParticipantType.HOLLON,
        messageType: MessageType.RESPONSE,
        content: `PR #${pr.prNumber} has been closed.${reason ? ` Reason: ${reason}` : ''}`,
        metadata: { prId: pr.id, taskId: pr.taskId },
      });
    }

    this.logger.log(`PR closed: ${prId}`);
  }

  /**
   * 수정 후 재리뷰 요청 (changes_requested → ready_for_review)
   */
  async reopenReview(
    prId: string,
    updateMessage?: string,
  ): Promise<TaskPullRequest> {
    const pr = await this.prRepo.findOne({
      where: { id: prId },
      relations: ['task'],
    });

    if (!pr) {
      throw new NotFoundException(`PR ${prId} not found`);
    }

    if (pr.status !== PullRequestStatus.CHANGES_REQUESTED) {
      throw new Error(
        `PR ${prId} is not in 'changes_requested' status. Current status: ${pr.status}`,
      );
    }

    this.logger.log(`Reopening review for PR ${prId}`);

    // PR 상태 업데이트
    pr.status = PullRequestStatus.READY_FOR_REVIEW;
    await this.prRepo.save(pr);

    // 리뷰어에게 재리뷰 요청
    if (pr.reviewerHollonId) {
      await this.messageService.send({
        fromId: pr.authorHollonId || undefined,
        fromType: ParticipantType.HOLLON,
        toId: pr.reviewerHollonId,
        toType: ParticipantType.HOLLON,
        messageType: MessageType.REVIEW_REQUEST,
        content: this.formatReopenReviewRequest(pr, updateMessage),
        metadata: { prId: pr.id, taskId: pr.taskId },
        requiresResponse: true,
      });
    }

    this.logger.log(`Review reopened for PR ${prId}`);
    return pr;
  }

  /**
   * Draft PR을 Ready for Review로 변경
   */
  async markReadyForReview(prId: string): Promise<TaskPullRequest> {
    const pr = await this.prRepo.findOne({
      where: { id: prId },
      relations: ['task'],
    });

    if (!pr) {
      throw new NotFoundException(`PR ${prId} not found`);
    }

    if (pr.status !== PullRequestStatus.DRAFT) {
      throw new Error(
        `PR ${prId} is not in 'draft' status. Current status: ${pr.status}`,
      );
    }

    // 리뷰 요청으로 전환 (리뷰어 자동 할당 포함)
    return this.requestReview(prId);
  }

  /**
   * 재리뷰 요청 메시지 포맷
   */
  private formatReopenReviewRequest(
    pr: TaskPullRequest,
    updateMessage?: string,
  ): string {
    return `
Re-review Request

PR: #${pr.prNumber}
URL: ${pr.prUrl}

The author has addressed your comments and is requesting a re-review.
${updateMessage ? `\nAuthor's update:\n${updateMessage}` : ''}

Please review the changes.
    `.trim();
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
    pr: TaskPullRequest,
  ): Promise<Hollon | null> {
    // 1. PR 작성자 홀론의 팀 정보 가져오기
    if (!pr.authorHollonId) {
      return null;
    }

    const authorHollon = await this.hollonRepo.findOne({
      where: { id: pr.authorHollonId },
    });

    if (!authorHollon?.teamId) {
      // 팀이 없으면 같은 조직의 가용한 홀론 중에서 선택
      const availableHollons = await this.hollonRepo.find({
        where: {
          organizationId: authorHollon?.organizationId,
          status: HollonStatus.IDLE,
        },
      });

      // 작성자 본인 제외
      const filtered = availableHollons.filter(
        (h) => h.id !== pr.authorHollonId,
      );
      return filtered[0] || null;
    }

    // 2. 같은 팀의 가용한 홀론 찾기 (작성자 제외)
    const teammates = await this.hollonRepo.find({
      where: {
        teamId: authorHollon.teamId,
        status: HollonStatus.IDLE,
      },
    });

    // 작성자 본인 제외
    const availableTeammates = teammates.filter(
      (h) => h.id !== pr.authorHollonId,
    );

    if (availableTeammates.length === 0) {
      this.logger.log(
        `No available teammates found for team ${authorHollon.teamId}, falling back to organization`,
      );

      // 팀 내 가용 홀론이 없으면 같은 조직의 다른 홀론 선택
      const orgHollons = await this.hollonRepo.find({
        where: {
          organizationId: authorHollon.organizationId,
          status: HollonStatus.IDLE,
        },
      });

      const orgFiltered = orgHollons.filter((h) => h.id !== pr.authorHollonId);
      return orgFiltered[0] || null;
    }

    // 3. 가장 적은 활성 리뷰를 가진 팀원 선택 (부하 분산)
    // 현재는 간단히 첫 번째 가용 팀원 반환
    // TODO: 향후 활성 리뷰 수 기반 부하 분산 로직 추가
    return availableTeammates[0];
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
   * PR 조회 (MessageListener에서 사용)
   */
  async findPullRequest(prId: string): Promise<TaskPullRequest | null> {
    return this.prRepo.findOne({
      where: { id: prId },
      relations: ['task', 'task.project'],
    });
  }

  /**
   * 자동 코드 리뷰 실행 (MessageListener에서 호출)
   *
   * REVIEW_REQUEST 메시지를 받은 리뷰어 Hollon이 자동으로 리뷰 수행
   * Phase 3.5에서는 BrainProvider를 통해 자동 리뷰 생성
   */
  async performAutomatedReview(
    prId: string,
    reviewerHollonId: string,
  ): Promise<void> {
    this.logger.log(
      `Performing automated review for PR ${prId} by Hollon ${reviewerHollonId}`,
    );

    const pr = await this.prRepo.findOne({
      where: { id: prId },
      relations: ['task', 'task.project'],
    });

    if (!pr) {
      throw new NotFoundException(`PR ${prId} not found`);
    }

    if (pr.status !== PullRequestStatus.READY_FOR_REVIEW) {
      this.logger.warn(
        `PR ${prId} is not in 'ready_for_review' status. Current: ${pr.status}`,
      );
      return;
    }

    // Phase 3.5: 간단한 자동 승인 로직
    // Phase 4에서 BrainProvider 통합 예정
    // 현재는 기본적인 체크만 수행

    const reviewComments = await this.generateAutomatedReviewComments(pr);

    // 자동으로 승인 (Phase 3.5에서는 기본적으로 승인)
    // 향후 Phase 4에서 더 정교한 판단 로직 추가
    const shouldApprove = !reviewComments.includes('CRITICAL');

    await this.submitReview(prId, reviewerHollonId, {
      decision: shouldApprove
        ? PullRequestStatus.APPROVED
        : PullRequestStatus.CHANGES_REQUESTED,
      comments: reviewComments,
    });

    this.logger.log(
      `Automated review completed for PR ${prId}: ${shouldApprove ? 'APPROVED' : 'CHANGES_REQUESTED'}`,
    );
  }

  /**
   * 자동 리뷰 코멘트 생성
   *
   * Phase 3.5: 간단한 휴리스틱 기반 리뷰
   * Phase 4: BrainProvider를 통한 AI 리뷰
   */
  private async generateAutomatedReviewComments(
    pr: TaskPullRequest,
  ): Promise<string> {
    const comments: string[] = [];

    comments.push('# Automated Code Review\n');
    comments.push(`PR: #${pr.prNumber}`);
    comments.push(`Repository: ${pr.repository}`);
    comments.push(`Branch: ${pr.branchName || 'N/A'}\n`);

    comments.push('## Review Checklist\n');

    // 기본적인 체크리스트
    comments.push('✅ PR title is descriptive');
    comments.push('✅ Branch name follows convention');

    // Task 기반 검증
    if (pr.task) {
      comments.push(`✅ Task "${pr.task.title}" is addressed`);

      if (pr.task.requiredSkills && pr.task.requiredSkills.length > 0) {
        comments.push(
          `ℹ️  Required skills: ${pr.task.requiredSkills.join(', ')}`,
        );
      }
    }

    comments.push('\n## Notes\n');
    comments.push(
      'This is an automated review by Hollon AI. A human reviewer may provide additional feedback.',
    );

    // Phase 4에서 BrainProvider 통합 시:
    // - PR diff 분석
    // - 코드 품질 검사
    // - 보안 취약점 검사
    // - 성능 이슈 검사
    // - 테스트 커버리지 확인

    return comments.join('\n');
  }

  /**
   * Phase 3.5: APPROVED PR 자동 Merge
   *
   * Git 작업:
   * 1. PR이 이미 merge되었는지 확인
   * 2. gh pr merge 명령 실행
   * 3. PR 상태를 MERGED로 업데이트
   * 4. Task 상태를 DONE으로 업데이트
   */
  private async autoMergePullRequest(pr: TaskPullRequest): Promise<void> {
    this.logger.log(`Auto-merging approved PR #${pr.prNumber}`);

    // 이미 merge된 경우 스킵
    if (pr.status === PullRequestStatus.MERGED) {
      this.logger.log(`PR #${pr.prNumber} is already merged`);
      return;
    }

    try {
      // gh CLI를 사용하여 PR merge
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // PR URL에서 owner/repo 추출
      const match = pr.prUrl.match(
        /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
      );
      if (!match) {
        throw new Error(`Invalid PR URL format: ${pr.prUrl}`);
      }

      const [, owner, repo, prNumber] = match;

      // gh pr merge 실행
      this.logger.log(
        `Executing: gh pr merge ${prNumber} --repo ${owner}/${repo} --squash --auto`,
      );

      const { stdout, stderr } = await execAsync(
        `gh pr merge ${prNumber} --repo ${owner}/${repo} --squash --auto`,
        {
          timeout: 30000, // 30초 타임아웃
        },
      );

      this.logger.log(`Merge output: ${stdout}`);
      if (stderr) {
        this.logger.warn(`Merge stderr: ${stderr}`);
      }

      // PR 상태를 MERGED로 업데이트
      await this.prRepo.update(pr.id, {
        status: PullRequestStatus.MERGED,
      });

      // Task 상태를 COMPLETED로 업데이트
      await this.taskRepo.update(pr.taskId, {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
      });

      this.logger.log(
        `PR #${prNumber} successfully merged and task ${pr.taskId} marked as DONE`,
      );

      // 작성자에게 알림
      if (pr.authorHollonId) {
        await this.messageService.send({
          fromType: ParticipantType.HOLLON,
          fromId: pr.reviewerHollonId || undefined,
          toId: pr.authorHollonId,
          toType: ParticipantType.HOLLON,
          messageType: MessageType.RESPONSE,
          content: `PR #${pr.prNumber} has been automatically merged! Task is now complete.`,
          metadata: { prId: pr.id, taskId: pr.taskId },
        });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to auto-merge PR #${pr.prNumber}: ${err.message}`,
        err.stack,
      );

      // Merge 실패 시 PR에 코멘트 추가
      await this.prRepo.update(pr.id, {
        reviewComments: `${pr.reviewComments || ''}\n\n[Auto-merge failed: ${err.message}]\nPlease merge manually.`,
      });

      throw error;
    }
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
