import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Channel } from './channel.entity';
import { ParticipantType } from '../../message/entities/message.entity';

@Entity('channel_messages')
export class ChannelMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'channel_id' })
  channelId!: string;

  @ManyToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel!: Channel;

  @Column({
    type: 'enum',
    enum: ParticipantType,
    name: 'sender_type',
  })
  senderType!: ParticipantType;

  @Column({ name: 'sender_id', type: 'uuid', nullable: true })
  senderId!: string | null;

  @Column('text')
  content!: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @Column({ name: 'thread_parent_id', type: 'uuid', nullable: true })
  threadParentId!: string | null;

  @ManyToOne(() => ChannelMessage, { nullable: true })
  @JoinColumn({ name: 'thread_parent_id' })
  threadParent?: ChannelMessage;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
