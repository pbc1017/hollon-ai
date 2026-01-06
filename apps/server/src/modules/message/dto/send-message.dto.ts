import {
  IsEnum,
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { MessageType, ParticipantType } from '../entities/message.entity';

export class SendMessageDto {
  @IsEnum(ParticipantType)
  fromType: ParticipantType;

  @IsOptional()
  @IsUUID()
  fromId?: string;

  @IsEnum(ParticipantType)
  toType: ParticipantType;

  @IsUUID()
  toId: string;

  @IsEnum(MessageType)
  messageType: MessageType;

  @IsString()
  content: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  requiresResponse?: boolean;

  @IsOptional()
  @IsUUID()
  repliedToId?: string;
}
