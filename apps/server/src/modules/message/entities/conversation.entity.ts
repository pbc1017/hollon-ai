import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ParticipantType, ConversationContext } from '../enums/message.enums';
import { Message } from './message.entity';

// Re-export for backward compatibility
export { ConversationContext };

@Entity('conversations')
@Index(['participant1Type', 'participant1Id'])
@Index(['participant2Type', 'participant2Id'])
export class Conversation extends BaseEntity {
  @Column({
    type: 'enum',
    enum: ParticipantType,
    name: 'participant1_type',
  })
  participant1Type: ParticipantType;

  @Column({ type: 'uuid', name: 'participant1_id' })
  participant1Id: string;

  @Column({
    type: 'enum',
    enum: ParticipantType,
    name: 'participant2_type',
  })
  participant2Type: ParticipantType;

  @Column({ type: 'uuid', name: 'participant2_id' })
  participant2Id: string;

  @Column({
    type: 'enum',
    enum: ConversationContext,
    name: 'context',
    default: ConversationContext.GENERAL,
  })
  context: ConversationContext;

  @Column({ name: 'context_id', type: 'uuid', nullable: true })
  contextId: string | null;

  @Column({ name: 'last_message_id', type: 'uuid', nullable: true })
  lastMessageId: string | null;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'last_message_id' })
  lastMessage?: Message;

  @Column({ type: 'timestamp', name: 'last_message_at', nullable: true })
  lastMessageAt: Date | null;

  @Column({ name: 'unread_count', default: 0 })
  unreadCount: number;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
