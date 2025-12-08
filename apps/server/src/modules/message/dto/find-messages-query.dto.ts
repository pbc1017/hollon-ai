import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ParticipantType, MessageType } from '../enums/message.enums';

export class FindMessagesQueryDto {
  @IsOptional()
  @IsEnum(ParticipantType)
  fromType?: ParticipantType;

  @IsOptional()
  @IsUUID()
  fromId?: string;

  @IsOptional()
  @IsEnum(ParticipantType)
  toType?: ParticipantType;

  @IsOptional()
  @IsUUID()
  toId?: string;

  @IsOptional()
  @IsEnum(MessageType)
  messageType?: MessageType;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isRead?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}
