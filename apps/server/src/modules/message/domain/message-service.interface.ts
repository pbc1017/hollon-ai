import { Message } from '../entities/message.entity';
import { SendMessageDto } from '../dto/send-message.dto';
import { InboxOptions } from '../interfaces/message.interface';

/**
 * Message Service Interface
 *
 * Communication Context의 서비스 계약
 * DDD에서 Service 인터페이스 역할
 */
export interface IMessageService {
  /**
   * 메시지 전송
   */
  send(dto: SendMessageDto): Promise<Message>;

  /**
   * ID로 메시지 조회
   */
  findById(id: string): Promise<Message | null>;

  /**
   * 메시지 읽음 처리
   */
  markAsRead(id: string): Promise<void>;

  /**
   * 받은 메시지함 조회
   */
  getInbox(
    participantType: string,
    participantId: string,
    options?: InboxOptions,
  ): Promise<Message[]>;

  /**
   * 읽지 않은 메시지 조회
   */
  findUnreadMessages(
    participantType: string,
    participantId: string,
    limit?: number,
  ): Promise<Message[]>;

  /**
   * 메시지 검색
   */
  findAll(filters: {
    isRead?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Message[]>;
}
