import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageService } from '../message.service';
import { MessageType, ParticipantType } from '../entities/message.entity';
import { CodeReviewService } from '../../collaboration/services/code-review.service';
import { ReviewerHollonService } from '../../collaboration/services/reviewer-hollon.service';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import { ResourcePlannerService } from '../../task/services/resource-planner.service';
import { TaskService } from '../../task/task.service';

/**
 * MessageListener: 메시지 이벤트를 자동으로 처리
 *
 * Phase 3.5 요구사항:
 * - REVIEW_REQUEST 메시지 수신 시 자동으로 코드 리뷰 실행
 * - 리뷰어 Hollon의 inbox를 주기적으로 확인
 * - 메시지를 읽고 적절한 액션 실행
 *
 * Phase 3 Week 15-16 추가:
 * - IDLE 상태 Hollon에게 자동으로 Task 할당
 * - ResourcePlannerService 활용하여 최적 Task 매칭
 */
@Injectable()
export class MessageListener {
  private readonly logger = new Logger(MessageListener.name);

  constructor(
    private readonly messageService: MessageService,
    private readonly codeReviewService: CodeReviewService,
    private readonly reviewerHollonService: ReviewerHollonService,
    private readonly resourcePlanner: ResourcePlannerService,
    private readonly taskService: TaskService,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
  ) {}

  /**
   * 주기적으로 미처리 메시지 확인 (매 1분마다)
   *
   * Production에서는 메시지 큐(Redis, RabbitMQ)를 사용하는 것이 더 효율적이지만,
   * Phase 3.5에서는 간단한 폴링 방식으로 구현
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processUnreadMessages(): Promise<void> {
    try {
      this.logger.debug('Checking for unread messages...');

      // 모든 미읽은 메시지 조회
      const unreadMessages = await this.messageService.findAll({
        isRead: false,
        limit: 100,
      });

      if (unreadMessages.length === 0) {
        return;
      }

      this.logger.log(
        `Found ${unreadMessages.length} unread messages to process`,
      );

      // 메시지 타입별로 처리
      for (const message of unreadMessages) {
        try {
          await this.handleMessage(message);
          await this.messageService.markAsRead(message.id);
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to handle message ${message.id}: ${err.message}`,
            err.stack,
          );
          // 에러가 발생해도 다음 메시지는 계속 처리
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error in processUnreadMessages: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Phase 3 Week 15-16: IDLE Hollon 자동 Task 할당
   *
   * 매 30초마다 IDLE 상태의 Hollon을 확인하고,
   * ResourcePlannerService를 통해 최적의 Task를 자동으로 할당합니다.
   *
   * 이는 TaskPoolService의 Pull 방식을 보완하는 Push 방식 할당입니다:
   * - TaskPoolService: Hollon이 능동적으로 Task를 요청 (Pull)
   * - 이 메서드: 시스템이 IDLE Hollon에게 Task를 능동적으로 할당 (Push)
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async autoAssignIdleHollons(): Promise<void> {
    try {
      this.logger.debug('Checking for IDLE hollons to auto-assign tasks...');

      // 1. IDLE 상태의 Hollon 조회
      const idleHollons = await this.hollonRepo.find({
        where: { status: HollonStatus.IDLE },
        relations: ['role', 'team', 'organization'],
      });

      if (idleHollons.length === 0) {
        return;
      }

      this.logger.log(
        `Found ${idleHollons.length} IDLE hollons for auto-assignment`,
      );

      // 2. 각 Hollon에게 최적의 Task 찾아서 할당
      for (const hollon of idleHollons) {
        try {
          // 조직의 unassigned Task 중 최적 Task 추천
          const recommendation =
            await this.resourcePlanner.recommendTaskForHollon(hollon.id);

          if (!recommendation.recommendedTask) {
            this.logger.debug(
              `No suitable task found for hollon ${hollon.name} (${hollon.id})`,
            );
            continue;
          }

          // Task 할당
          await this.taskService.assignToHollon(
            recommendation.recommendedTask.id,
            hollon.id,
          );

          this.logger.log(
            `Auto-assigned task "${recommendation.recommendedTask.title}" to hollon ${hollon.name} ` +
              `(match score: ${recommendation.matchScore})`,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Failed to auto-assign task to hollon ${hollon.name}: ${errorMessage}`,
          );
          // 에러가 발생해도 다른 Hollon은 계속 처리
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error in autoAssignIdleHollons: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * 메시지 타입에 따라 적절한 핸들러 실행
   */
  private async handleMessage(message: any): Promise<void> {
    this.logger.debug(
      `Handling message ${message.id} of type ${message.messageType}`,
    );

    switch (message.messageType) {
      case MessageType.REVIEW_REQUEST:
        await this.handleReviewRequest(message);
        break;

      case MessageType.TASK_ASSIGNMENT:
        // 향후 확장: 작업 할당 자동 처리
        this.logger.debug(`TASK_ASSIGNMENT message received: ${message.id}`);
        break;

      default:
        this.logger.debug(
          `No handler for message type: ${message.messageType}`,
        );
    }
  }

  /**
   * REVIEW_REQUEST 메시지 처리: 자동으로 코드 리뷰 실행
   * Phase 3.13: AI-powered review via ReviewerHollonService
   */
  private async handleReviewRequest(message: any): Promise<void> {
    const { prId, taskId } = message.metadata || {};

    if (!prId) {
      this.logger.warn(
        `REVIEW_REQUEST message ${message.id} missing prId in metadata`,
      );
      return;
    }

    this.logger.log(
      `Auto-executing code review for PR ${prId} (task: ${taskId})`,
    );

    try {
      // 리뷰어 Hollon이 자동으로 리뷰 실행
      const reviewerHollonId = message.toId;

      if (!reviewerHollonId) {
        this.logger.warn(
          `REVIEW_REQUEST message ${message.id} has no recipient`,
        );
        return;
      }

      // CodeReviewService를 통해 PR 존재 확인
      const pr = await this.codeReviewService.findPullRequest(prId);

      if (!pr) {
        this.logger.warn(`PR ${prId} not found for review request`);
        return;
      }

      // Phase 3.13: AI-powered review 활성화 여부 확인
      const enableAIReview = process.env.ENABLE_AI_CODE_REVIEW === 'true';

      if (enableAIReview) {
        // AI-powered review (BrainProvider 사용)
        this.logger.log(
          `Executing AI-powered review for PR ${prId} by hollon ${reviewerHollonId}`,
        );
        await this.reviewerHollonService.performReview(prId, reviewerHollonId);
      } else {
        // Fallback: Simple heuristic review
        this.logger.log(
          `Executing heuristic review for PR ${prId} (AI review disabled)`,
        );
        await this.codeReviewService.performAutomatedReview(
          prId,
          reviewerHollonId,
        );
      }

      this.logger.log(`Automated review completed for PR ${prId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to execute automated review for PR ${prId}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * 특정 Hollon의 미처리 메시지를 수동으로 처리 (테스트/디버깅용)
   */
  async processMessagesForHollon(hollonId: string): Promise<void> {
    this.logger.log(`Processing messages for Hollon ${hollonId}`);

    const messages = await this.messageService.getInbox(
      ParticipantType.HOLLON,
      hollonId,
      {
        unreadOnly: true,
        limit: 50,
      },
    );

    for (const message of messages) {
      try {
        await this.handleMessage(message);
        await this.messageService.markAsRead(message.id);
      } catch (error) {
        const err = error as Error;
        this.logger.error(
          `Failed to handle message ${message.id}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Processed ${messages.length} messages for Hollon ${hollonId}`,
    );
  }
}
