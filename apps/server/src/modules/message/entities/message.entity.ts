import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Conversation } from './conversation.entity';
import {
  MessageType,
  ParticipantType,
  MessagePriority,
} from '../enums/message.enums';

// Re-export enums for backward compatibility
export { MessageType, ParticipantType, MessagePriority };

@Entity('messages')
@Index(['conversationId', 'createdAt'])
@Index(['fromType', 'fromId'])
@Index(['toType', 'toId'])
export class Message extends BaseEntity {
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({
    type: 'enum',
    enum: ParticipantType,
    name: 'from_type',
  })
  fromType: ParticipantType;

  @Column({ name: 'from_id', type: 'uuid', nullable: true })
  fromId: string | null;

  @Column({
    type: 'enum',
    enum: ParticipantType,
    name: 'to_type',
  })
  toType: ParticipantType;

  @Column({ type: 'uuid', name: 'to_id' })
  toId: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    name: 'message_type',
    default: MessageType.GENERAL,
  })
  messageType: MessageType;

  @Column({
    type: 'enum',
    enum: MessagePriority,
    name: 'priority',
    default: MessagePriority.NORMAL,
  })
  priority: MessagePriority;

  @Column('text')
  content: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ name: 'requires_response', default: false })
  requiresResponse: boolean;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', name: 'read_at', nullable: true })
  readAt: Date | null;

  @Column({ name: 'replied_to_id', type: 'uuid', nullable: true })
  repliedToId: string | null;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'replied_to_id' })
  repliedTo?: Message;
}
