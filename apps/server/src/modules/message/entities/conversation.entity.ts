import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ParticipantType } from './message.entity';
import { Message } from './message.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ name: 'last_message_id', type: 'uuid', nullable: true })
  lastMessageId: string | null;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'last_message_id' })
  lastMessage?: Message;

  @Column({ type: 'timestamp', name: 'last_message_at', nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
