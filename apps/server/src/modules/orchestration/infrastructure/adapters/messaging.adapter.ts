import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IMessagingPort,
  NotificationData,
} from '../../domain/ports/messaging.port';
import { IMessageService } from '../../../message/domain/message-service.interface';
import {
  Message,
  MessageType,
  ParticipantType,
} from '../../../message/entities/message.entity';

/**
 * Messaging Adapter
 *
 * IMessagingPort의 구현체
 * Orchestration Context가 Communication Context에 접근하기 위한 Adapter
 */
@Injectable()
export class MessagingAdapter implements IMessagingPort {
  private readonly logger = new Logger(MessagingAdapter.name);

  constructor(
    @Inject('IMessageService')
    private readonly messageService: IMessageService,
  ) {}

  async sendNotification(
    toId: string,
    notification: NotificationData,
  ): Promise<Message> {
    this.logger.log(`Sending notification to ${toId}: ${notification.title}`);

    return this.messageService.send({
      toId,
      toType: ParticipantType.HOLLON,
      fromType: ParticipantType.SYSTEM,
      messageType: MessageType.GENERAL,
      content: `${notification.title}\n\n${notification.message}`,
      metadata: notification.metadata || {},
      requiresResponse: false,
    });
  }

  async sendReviewRequest(reviewerId: string, prId: string): Promise<Message> {
    this.logger.log(`Sending review request to ${reviewerId} for PR ${prId}`);

    return this.messageService.send({
      toId: reviewerId,
      toType: ParticipantType.HOLLON,
      fromType: ParticipantType.SYSTEM,
      messageType: MessageType.REVIEW_REQUEST,
      content: `You have been assigned as a reviewer for PR ${prId}`,
      metadata: { prId },
      requiresResponse: true,
    });
  }

  async sendTaskMessage(
    fromHollonId: string,
    toHollonId: string,
    messageType: MessageType,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<Message> {
    this.logger.log(
      `Sending ${messageType} from ${fromHollonId} to ${toHollonId}`,
    );

    return this.messageService.send({
      fromId: fromHollonId,
      fromType: ParticipantType.HOLLON,
      toId: toHollonId,
      toType: ParticipantType.HOLLON,
      messageType,
      content,
      metadata: metadata || {},
    });
  }

  async findMessageById(messageId: string): Promise<Message | null> {
    return this.messageService.findById(messageId);
  }
}
