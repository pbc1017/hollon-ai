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

export enum ChannelRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Entity('channel_memberships')
export class ChannelMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'channel_id' })
  channelId: string;

  @ManyToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @Column({
    type: 'enum',
    enum: ParticipantType,
    name: 'member_type',
  })
  memberType: ParticipantType;

  @Column({ type: 'uuid', name: 'member_id' })
  memberId: string;

  @Column({
    type: 'enum',
    enum: ChannelRole,
    default: ChannelRole.MEMBER,
  })
  role: ChannelRole;

  @Column({ type: 'timestamp', name: 'joined_at' })
  joinedAt: Date;

  @Column({ type: 'timestamp', name: 'last_read_at', nullable: true })
  lastReadAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
