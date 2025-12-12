import { Message, MessageType } from '../../../message/entities/message.entity';

/**
 * Messaging Port Interface
 *
 * Orchestration Context가 메시징 기능에 접근하기 위한 Port
 * DDD Port/Adapter 패턴의 Port 역할
 */

export interface NotificationData {
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface IMessagingPort {
  /**
   * 일반 알림 전송
   */
  sendNotification(
    toId: string,
    notification: NotificationData,
  ): Promise<Message>;

  /**
   * 리뷰 요청 메시지 전송
   */
  sendReviewRequest(reviewerId: string, prId: string): Promise<Message>;

  /**
   * Task 관련 메시지 전송
   */
  sendTaskMessage(
    fromHollonId: string,
    toHollonId: string,
    messageType: MessageType,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<Message>;

  /**
   * 메시지 조회
   */
  findMessageById(messageId: string): Promise<Message | null>;
}
