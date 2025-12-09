import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MessageService } from '../message.service';
import { MessageType, ParticipantType } from '../entities/message.entity';
import { CodeReviewService } from '../../collaboration/services/code-review.service';

/**
 * MessageListener: 메시지 이벤트를 자동으로 처리
 *
 * Phase 3.5 요구사항:
 * - REVIEW_REQUEST 메시지 수신 시 자동으로 코드 리뷰 실행
 * - 리뷰어 Hollon의 inbox를 주기적으로 확인
 * - 메시지를 읽고 적절한 액션 실행
 */
@Injectable()
export class MessageListener {
  private readonly logger = new Logger(MessageListener.name);

  constructor(
    private readonly messageService: MessageService,
    private readonly codeReviewService: CodeReviewService,
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

      // CodeReviewService를 통해 자동 리뷰 실행
      // Phase 3.5에서는 자동으로 승인하지 않고, 리뷰 코멘트만 생성
      const pr = await this.codeReviewService.findPullRequest(prId);

      if (!pr) {
        this.logger.warn(`PR ${prId} not found for review request`);
        return;
      }

      // 리뷰 자동 실행 (BrainProvider를 통해)
      await this.codeReviewService.performAutomatedReview(
        prId,
        reviewerHollonId,
      );

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
