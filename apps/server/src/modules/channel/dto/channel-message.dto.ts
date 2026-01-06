import {
  IsEnum,
  IsString,
  IsUUID,
  IsOptional,
  IsObject,
} from 'class-validator';
import { ParticipantType } from '../../message/entities/message.entity';

export class SendChannelMessageDto {
  @IsUUID()
  channelId: string;

  @IsEnum(ParticipantType)
  senderType: ParticipantType;

  @IsOptional()
  @IsUUID()
  senderId?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsUUID()
  threadParentId?: string;
}
