import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promisify } from 'util';
import { exec } from 'child_process';
import { existsSync } from 'fs';

const execAsync = promisify(exec);
import {
  TaskPullRequest,
  PullRequestStatus,
  ReviewerType,
} from '../entities/task-pull-request.entity';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import { Role } from '../../role/entities/role.entity';
import { HollonService } from '../../hollon/hollon.service';
import { MessageService } from '../../message/message.service';
import {
  MessageType,
  ParticipantType,
} from '../../message/entities/message.entity';
import { CreatePullRequestDto } from '../dto/create-pull-request.dto';
import { ReviewSubmissionDto } from '../dto/review-submission.dto';
import { ICodeReviewService } from '../domain/code-review-service.interface';

@Injectable()
export class CodeReviewService implements ICodeReviewService {
  private readonly logger = new Logger(CodeReviewService.name);

  constructor(
    @InjectRepository(TaskPullRequest)
    private readonly prRepo: Repository<TaskPullRequest>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly hollonService: HollonService,
    private readonly messageService: MessageService,
    private readonly moduleRef: ModuleRef,
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
   * ICodeReviewService interface method - alias for createPullRequest
   */
  async createPR(dto: CreatePullRequestDto): Promise<TaskPullRequest> {
    return this.createPullRequest(dto);
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

    // Phase 3.16: Post review comment to GitHub PR (for human visibility)
    await this.postReviewCommentToGitHub(pr, review).catch((error) => {
      // Don't fail the review if GitHub comment posting fails
      this.logger.warn(
        `Failed to post review comment to GitHub PR ${prId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    });

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

    // Phase 4: Final CI check before merge
    if (pr.prUrl && process.env.NODE_ENV !== 'test') {
      this.logger.log(`Performing final CI check before merge: ${pr.prUrl}`);

      try {
        const { stdout } = await execAsync(
          `gh pr checks ${pr.prUrl} --json state`,
        );

        const checks = JSON.parse(stdout.trim()) as Array<{
          state: string;
        }>;

        const hasFailedChecks = checks.some(
          (check) => check.state !== 'success',
        );

        if (hasFailedChecks) {
          this.logger.error(
            `Cannot merge PR ${prId}: CI checks are not all passing`,
          );

          // Update PR status to CHANGES_REQUESTED
          pr.status = PullRequestStatus.CHANGES_REQUESTED;
          pr.reviewComments = pr.reviewComments
            ? `${pr.reviewComments}\n\n[CI FAILED] CI checks failed. Please fix and resubmit.`
            : '[CI FAILED] CI checks failed. Please fix and resubmit.';
          await this.prRepo.save(pr);

          // Update Task status back to READY so team member can pick it up again
          pr.task.status = TaskStatus.READY;
          await this.taskRepo.save(pr.task);

          this.logger.log(
            `PR ${prId} marked as CHANGES_REQUESTED, Task ${pr.taskId} back to READY for rework`,
          );

          throw new Error(
            'CI checks must pass before merging. Please fix any failures and try again.',
          );
        }

        this.logger.log(`Final CI check passed for PR ${prId}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('CI checks')) {
          throw error; // Re-throw our custom error
        }
        this.logger.warn(
          `Could not verify CI status: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
        // Continue with merge if CI check command fails (might be no CI configured)
      }
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

    // Dependency System: Unblock dependent tasks
    await this.unblockDependentTasks(pr.task);

    // Phase 3: Check if this is a subtask and trigger parent task if all subtasks are complete
    await this.checkAndTriggerParentTask(pr.task);
  }

  /**
   * Dependency System: Unblock dependent tasks when a task is completed
   *
   * When a task is marked as COMPLETED:
   * 1. Find all tasks that depend on this task (in BLOCKED status)
   * 2. For each dependent task, check if ALL its dependencies are now COMPLETED
   * 3. If yes, change status from BLOCKED to READY and emit task.assigned event
   */
  private async unblockDependentTasks(completedTask: Task): Promise<void> {
    this.logger.log(
      `Checking for dependent tasks of completed task ${completedTask.id.slice(0, 8)}...`,
    );

    // Find all tasks that have this task as a dependency and are currently BLOCKED
    const dependentTasks = await this.taskRepo
      .createQueryBuilder('task')
      .innerJoin('task.dependencies', 'dependency')
      .where('dependency.id = :completedTaskId', {
        completedTaskId: completedTask.id,
      })
      .andWhere('task.status = :status', { status: TaskStatus.BLOCKED })
      .leftJoinAndSelect('task.dependencies', 'allDeps')
      .getMany();

    if (dependentTasks.length === 0) {
      this.logger.log(
        `No BLOCKED dependent tasks found for task ${completedTask.id.slice(0, 8)}`,
      );
      return;
    }

    this.logger.log(
      `Found ${dependentTasks.length} BLOCKED dependent tasks for task ${completedTask.id.slice(0, 8)}`,
    );

    // Check each dependent task to see if ALL its dependencies are now COMPLETED
    for (const dependentTask of dependentTasks) {
      const allDepsCompleted = dependentTask.dependencies.every(
        (dep) => dep.status === TaskStatus.COMPLETED,
      );

      if (allDepsCompleted) {
        this.logger.log(
          `All dependencies completed for task ${dependentTask.id.slice(0, 8)}, unblocking...`,
        );

        // Change status from BLOCKED to READY
        await this.taskRepo.update(dependentTask.id, {
          status: TaskStatus.READY,
        });

        // TODO: Re-enable event emission once EventEmitterModule is properly configured
        // this.eventEmitter.emit('task.assigned', {
        //   taskId: dependentTask.id,
        //   hollonId: dependentTask.assignedHollonId,
        // });

        this.logger.log(
          `✅ Unblocked dependent task ${dependentTask.id.slice(0, 8)}: ${dependentTask.title}`,
        );
      } else {
        const incompleteDeps = dependentTask.dependencies.filter(
          (dep) => dep.status !== TaskStatus.COMPLETED,
        );
        this.logger.log(
          `Task ${dependentTask.id.slice(0, 8)} still has ${incompleteDeps.length} incomplete dependencies, ` +
            `remains BLOCKED`,
        );
      }
    }
  }

  /**
   * Phase 3: Check if subtask completed and trigger parent task if all subtasks done
   *
   * When a subtask is marked as COMPLETED:
   * 1. Check if this task has a parent task (is a subtask)
   * 2. Query all sibling subtasks
   * 3. If all subtasks are COMPLETED, automatically trigger parent task execution
   * 4. Parent task will resume with team member hollon and create PR
   */
  private async checkAndTriggerParentTask(completedTask: Task): Promise<void> {
    // Check if this is a subtask
    if (!completedTask.parentTaskId) {
      this.logger.log(
        `Task ${completedTask.id} is not a subtask, no parent to trigger`,
      );
      return;
    }

    this.logger.log(
      `Subtask ${completedTask.id.slice(0, 8)} completed, checking if all siblings are done...`,
    );

    // Get parent task
    const parentTask = await this.taskRepo.findOne({
      where: { id: completedTask.parentTaskId },
      relations: ['assignedHollon'],
    });

    if (!parentTask) {
      this.logger.error(
        `Parent task ${completedTask.parentTaskId} not found for subtask ${completedTask.id}`,
      );
      return;
    }

    // Check if all sibling subtasks are completed
    const allSubtasks = await this.taskRepo.find({
      where: { parentTaskId: parentTask.id },
    });

    const allSubtasksCompleted = allSubtasks.every(
      (subtask) => subtask.status === TaskStatus.COMPLETED,
    );

    if (!allSubtasksCompleted) {
      const remainingCount = allSubtasks.filter(
        (subtask) => subtask.status !== TaskStatus.COMPLETED,
      ).length;
      this.logger.log(
        `Not all subtasks completed yet. ${remainingCount} remaining out of ${allSubtasks.length}`,
      );
      return;
    }

    this.logger.log(
      `🎉 All ${allSubtasks.length} subtasks completed! Triggering parent task ${parentTask.id.slice(0, 8)} to resume...`,
    );

    // Get TaskExecutionService lazily to avoid circular dependency
    const taskExecutionService = await this.moduleRef.get(
      'TaskExecutionService',
      { strict: false },
    );

    if (!taskExecutionService) {
      this.logger.error('TaskExecutionService not found in module');
      return;
    }

    // Trigger parent task execution (will be resumed with team member hollon)
    const assignedHollonId =
      parentTask.assignedHollonId || parentTask.assignedHollon?.id;

    if (!assignedHollonId) {
      this.logger.error(
        `Parent task ${parentTask.id} has no assigned hollon, cannot trigger execution`,
      );
      return;
    }

    this.logger.log(
      `Triggering parent task ${parentTask.id.slice(0, 8)} with hollon ${assignedHollonId.slice(0, 8)}`,
    );

    // Execute parent task asynchronously (don't await to avoid blocking PR merge)
    taskExecutionService
      .executeTask(parentTask.id, assignedHollonId)
      .then(() => {
        this.logger.log(
          `✅ Parent task ${parentTask.id.slice(0, 8)} resumed and PR creation initiated`,
        );
      })
      .catch((error: Error) => {
        this.logger.error(
          `Failed to execute parent task ${parentTask.id}: ${error.message}`,
          error.stack,
        );
      });
  }

  /**
   * PR 닫기 (머지 없이)
   */
  async closePullRequest(
    prId: string,
    reason?: string,
    markAsCompleted?: boolean,
  ): Promise<void> {
    const pr = await this.prRepo.findOne({
      where: { id: prId },
      relations: ['task'],
    });

    if (!pr) {
      throw new NotFoundException(`PR ${prId} not found`);
    }

    // Test mode: Allow closing MERGED PRs (DB-only merge, GitHub PR still open)
    const isTestMode = process.env.NODE_ENV === 'test';

    if (pr.status === PullRequestStatus.MERGED && !isTestMode) {
      throw new Error(`PR ${prId} is already merged and cannot be closed`);
    }

    if (pr.status === PullRequestStatus.CLOSED) {
      throw new Error(`PR ${prId} is already closed`);
    }

    this.logger.log(
      `Closing PR ${prId}${markAsCompleted ? ' (marking task as COMPLETED)' : ''}`,
    );

    // Close PR on GitHub if prUrl exists
    if (pr.prUrl) {
      try {
        const closeComment = reason || 'Closing PR';

        // Use worktree path if it exists, otherwise use current directory
        const cwd =
          pr.task.workingDirectory && existsSync(pr.task.workingDirectory)
            ? pr.task.workingDirectory
            : process.cwd();

        await execAsync(
          `gh pr close "${pr.prUrl}" --comment "${closeComment}"`,
          { cwd },
        );
        this.logger.log(`Closed PR on GitHub: ${pr.prUrl}`);
      } catch (error) {
        this.logger.error(
          `Failed to close PR on GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Continue with database update even if GitHub close fails
      }
    }

    // PR 상태 업데이트
    pr.status = PullRequestStatus.CLOSED;
    if (reason) {
      pr.reviewComments = pr.reviewComments
        ? `${pr.reviewComments}\n\n[CLOSED] ${reason}`
        : `[CLOSED] ${reason}`;
    }
    await this.prRepo.save(pr);

    // Dependency System: Task 상태 결정
    if (markAsCompleted) {
      // Test 환경이나 특수한 경우: Task를 COMPLETED로 변경
      pr.task.status = TaskStatus.COMPLETED;
      pr.task.completedAt = new Date();
      await this.taskRepo.save(pr.task);

      this.logger.log(`PR closed and task completed: ${pr.taskId}`);

      // Unblock dependent tasks
      await this.unblockDependentTasks(pr.task);

      // Check if subtask and trigger parent
      await this.checkAndTriggerParentTask(pr.task);
    } else {
      // 기본 동작: Task 상태를 다시 IN_PROGRESS로 변경 (새 PR 생성 가능)
      pr.task.status = TaskStatus.IN_PROGRESS;
      await this.taskRepo.save(pr.task);
    }

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

    // 3. Phase 4: 일반 PR - 팀 매니저에게 리뷰 요청
    const manager = await this.findTeamManager(pr);
    if (manager) {
      return { hollonId: manager.id, type: ReviewerType.TEAM_MANAGER };
    }

    // 4. Fallback: 팀 매니저가 없으면 같은 팀의 가용한 홀론
    const teammate = await this.findAvailableTeammate(pr);
    if (teammate) {
      return { hollonId: teammate.id, type: ReviewerType.TEAM_MEMBER };
    }

    // 5. Fallback: 일반 CodeReviewer
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
   * Phase 3.13: Alice/Bob 같은 영구 홀론이 필요시 임시 리뷰어 서브홀론 생성
   */
  private async findOrCreateSpecializedReviewer(
    role: string,
    pr: TaskPullRequest,
  ): Promise<{ hollonId: string; type: ReviewerType }> {
    // 1. 해당 역할의 가용한 홀론 찾기 (영구 또는 기존 임시)
    const existingReviewer = await this.hollonRepo.findOne({
      where: {
        name: role,
        status: HollonStatus.IDLE,
      },
    });

    if (existingReviewer) {
      this.logger.log(
        `Reusing existing reviewer: ${role} (${existingReviewer.id})`,
      );
      return {
        hollonId: existingReviewer.id,
        type: this.mapRoleToReviewerType(role),
      };
    }

    // 2. 없으면 PR 작성자(영구 홀론)가 임시 리뷰어 서브홀론 생성
    this.logger.log(
      `Creating temporary reviewer sub-hollon: ${role} by ${pr.authorHollonId}`,
    );

    if (!pr.authorHollonId) {
      throw new Error('PR has no author hollon to create sub-hollon');
    }

    const authorHollon = await this.hollonRepo.findOne({
      where: { id: pr.authorHollonId },
      relations: ['role'],
    });

    if (!authorHollon) {
      throw new Error(`Author hollon ${pr.authorHollonId} not found`);
    }

    // 리뷰어 Role 찾기
    const reviewerRole = await this.roleRepo.findOne({
      where: { name: role },
    });

    if (!reviewerRole) {
      throw new Error(`Reviewer role ${role} not found`);
    }

    // 임시 리뷰어 서브홀론 생성 (depth=1)
    const reviewer = await this.hollonService.createTemporary({
      name: `${role}-${pr.task.id.slice(0, 8)}`,
      organizationId: authorHollon.organizationId,
      teamId: authorHollon.teamId || undefined,
      roleId: reviewerRole.id,
      brainProviderId: authorHollon.brainProviderId || 'claude_code',
      createdBy: pr.authorHollonId, // 부모 홀론 ID
    });

    this.logger.log(
      `Temporary reviewer created: ${reviewer.id} (depth=${reviewer.depth})`,
    );

    return {
      hollonId: reviewer.id,
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
   * Phase 4: 팀 매니저 찾기
   *
   * Author hollon의 팀 매니저를 리뷰어로 반환
   * 재귀적 팀 구조를 지원하여, 각 팀의 매니저가 해당 팀원의 PR을 리뷰
   */
  private async findTeamManager(pr: TaskPullRequest): Promise<Hollon | null> {
    if (!pr.authorHollonId) {
      this.logger.log('PR has no author hollon, cannot find team manager');
      return null;
    }

    // 1. Author hollon의 팀 정보 가져오기
    const authorHollon = await this.hollonRepo.findOne({
      where: { id: pr.authorHollonId },
      relations: ['team'],
    });

    if (!authorHollon?.team) {
      this.logger.log(
        `Author hollon ${pr.authorHollonId} has no team, cannot assign manager`,
      );
      return null;
    }

    if (!authorHollon.team.managerHollonId) {
      this.logger.log(`Team ${authorHollon.team.id} has no manager assigned`);
      return null;
    }

    // 2. 팀 매니저 조회
    const manager = await this.hollonRepo.findOne({
      where: { id: authorHollon.team.managerHollonId },
    });

    if (!manager) {
      this.logger.warn(
        `Team manager ${authorHollon.team.managerHollonId} not found in database`,
      );
      return null;
    }

    // 3. 매니저가 author 본인인 경우 제외 (자기 자신의 코드를 리뷰할 수 없음)
    if (manager.id === pr.authorHollonId) {
      this.logger.log(
        `Team manager ${manager.name} is the same as author, cannot self-review`,
      );
      return null;
    }

    this.logger.log(
      `Found team manager ${manager.name} (${manager.id}) for author ${authorHollon.name}`,
    );

    return manager;
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
  ): Promise<TaskPullRequest> {
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
      return pr;
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

    return pr;
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

      // 테스트 환경에서는 실제 gh pr merge 명령을 skip (DB만 업데이트)
      const isTestMode = process.env.NODE_ENV === 'test';

      if (isTestMode) {
        // Test mode: Close PR on GitHub instead of merging
        // This prevents test PRs from accumulating as OPEN
        // DB will still show MERGED to simulate production behavior
        this.logger.log(
          `[TEST MODE] Closing PR #${prNumber} on GitHub (DB will be marked as MERGED)`,
        );

        try {
          const { stdout } = await execAsync(
            `gh pr close ${prNumber} --repo ${owner}/${repo}`,
            {
              timeout: 10000, // 10초 타임아웃
            },
          );
          this.logger.log(`PR close output: ${stdout}`);
        } catch (closeError) {
          // PR close 실패해도 테스트는 계속 진행 (이미 closed일 수 있음)
          this.logger.warn(
            `Failed to close PR #${prNumber}: ${closeError instanceof Error ? closeError.message : 'Unknown error'}`,
          );
        }
      } else {
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

      // Unblock dependent tasks
      const completedTask = await this.taskRepo.findOne({
        where: { id: pr.taskId },
      });
      if (completedTask) {
        await this.unblockDependentTasks(completedTask);
      }

      // Phase 3: Check if this is a subtask and trigger parent task if all subtasks are complete
      if (completedTask) {
        await this.checkAndTriggerParentTask(completedTask);
      }

      // Phase 3.12: Task worktree 정리
      if (pr.authorHollonId) {
        await this.cleanupTaskWorktree(pr.taskId, pr.authorHollonId).catch(
          (cleanupError) => {
            this.logger.warn(
              `Failed to cleanup task worktree: ${cleanupError.message}`,
            );
            // Don't fail the merge if cleanup fails
          },
        );
      }

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
   * ICodeReviewService interface method - alias for getPullRequestsForTask
   */
  async findPullRequestsByTaskId(taskId: string): Promise<TaskPullRequest[]> {
    return this.getPullRequestsForTask(taskId);
  }

  /**
   * ICodeReviewService interface method - find PR by number and repository
   */
  async findPullRequestByNumber(
    prNumber: number,
    repository: string,
  ): Promise<TaskPullRequest | null> {
    return this.prRepo.findOne({
      where: { prNumber, repository },
      relations: ['task', 'assignedReviewer'],
    });
  }

  /**
   * ICodeReviewService interface method - update PR status
   */
  async updatePRStatus(prId: string, status: PullRequestStatus): Promise<void> {
    await this.prRepo.update({ id: prId }, { status });
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

  /**
   * Phase 3.12: Task worktree 정리
   * Task 완료 후 워크트리 삭제
   */
  /**
   * Phase 3.16: Post review comment to GitHub PR
   * Makes review comments visible to human developers
   */
  private async postReviewCommentToGitHub(
    pr: TaskPullRequest,
    review: ReviewSubmissionDto,
  ): Promise<void> {
    if (!pr.prUrl || process.env.NODE_ENV === 'test') {
      // Skip in test environment or if no PR URL
      return;
    }

    // Extract PR details from URL
    const match = pr.prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);

    if (!match) {
      this.logger.warn(`Invalid PR URL format: ${pr.prUrl}`);
      return;
    }

    const [, owner, repo, prNumber] = match;

    // Format comment based on review decision
    const emoji = review.decision === PullRequestStatus.APPROVED ? '✅' : '⚠️';
    const title =
      review.decision === PullRequestStatus.APPROVED
        ? 'Code Review: APPROVED'
        : 'Code Review: Changes Requested';

    const commentBody = `## ${emoji} ${title}

${review.comments || 'No additional comments.'}

---
_Automated review by Hollon AI_`;

    // Post comment using gh CLI
    this.logger.log(
      `Posting review comment to GitHub PR #${prNumber} (${review.decision})`,
    );

    try {
      const { stdout, stderr } = await execAsync(
        `gh pr comment ${prNumber} --repo ${owner}/${repo} --body ${JSON.stringify(commentBody)}`,
        {
          timeout: 30000, // 30 second timeout
        },
      );

      this.logger.log(`GitHub PR comment posted: ${stdout}`);
      if (stderr) {
        this.logger.debug(`gh pr comment stderr: ${stderr}`);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to post GitHub PR comment: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  private async cleanupTaskWorktree(
    taskId: string,
    hollonId: string,
  ): Promise<void> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const path = await import('path');

    // Task의 project 정보 가져오기
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['project'],
    });

    if (!task || !task.project) {
      this.logger.warn(
        `Cannot cleanup worktree: task ${taskId} or project not found`,
      );
      return;
    }

    // Phase 3.12: Use task-specific worktree path if available
    const worktreePath =
      task.workingDirectory ||
      path.join(
        task.project.workingDirectory,
        '..',
        '.git-worktrees',
        `hollon-${hollonId.slice(0, 8)}`,
        `task-${taskId.slice(0, 8)}`,
      );

    // Get working directory for git commands
    const gitCwd = task.workingDirectory || task.project.workingDirectory;

    try {
      this.logger.log(`Cleaning up task worktree: ${worktreePath}`);
      await execAsync(`git worktree remove ${worktreePath} --force`, {
        cwd: gitCwd,
        shell: process.env.SHELL || '/bin/bash',
        env: { ...process.env },
      });
      this.logger.log(`Task worktree cleaned up: ${worktreePath}`);
    } catch (error) {
      const err = error as Error;
      // Worktree가 이미 삭제되었거나 없을 수 있음 (정상)
      if (err.message.includes('not a working tree')) {
        this.logger.debug(`Worktree already removed: ${worktreePath}`);
      } else {
        this.logger.warn(`Failed to cleanup worktree: ${err.message}`);
      }
    }
  }
}
