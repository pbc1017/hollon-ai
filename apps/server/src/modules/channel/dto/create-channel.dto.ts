import {
  IsEnum,
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ChannelType } from '../entities/channel.entity';
import { ParticipantType } from '../../message/entities/message.entity';

export class CreateChannelDto {
  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ChannelType)
  channelType: ChannelType;

  @IsEnum(ParticipantType)
  createdByType: ParticipantType;

  @IsOptional()
  @IsUUID()
  createdById?: string;
}
