import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum MessageType {
  TASK_ASSIGNMENT = 'task_assignment',
  TASK_UPDATE = 'task_update',
  TASK_COMPLETION = 'task_completion',
  QUESTION = 'question',
  RESPONSE = 'response',
  DELEGATION_REQUEST = 'delegation_request',
  DELEGATION_APPROVAL = 'delegation_approval',
  COLLABORATION_REQUEST = 'collaboration_request',
  REVIEW_REQUEST = 'review_request',
  CONFLICT_NOTIFICATION = 'conflict_notification',
  GENERAL = 'general',
}

export enum ParticipantType {
  HOLLON = 'hollon',
  HUMAN = 'human',
  SYSTEM = 'system',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
