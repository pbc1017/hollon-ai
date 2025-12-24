import {
  IsEnum,
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChannelType } from '../entities/channel.entity';
import { ParticipantType } from '../../message/entities/message.entity';
import { ChannelRole } from '../entities/channel-membership.entity';

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

  @IsOptional()
  @IsInt()
  @Min(2)
  maxMembers?: number;
}

export class ChannelMemberDto {
  @IsEnum(ParticipantType)
  type: ParticipantType;

  @IsUUID()
  id: string;

  @IsOptional()
  @IsEnum(ChannelRole)
  role?: ChannelRole;
}

export class CreateGroupChannelDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ParticipantType)
  createdByType: ParticipantType;

  @IsUUID()
  createdById: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelMemberDto)
  members: ChannelMemberDto[];

  @IsOptional()
  @IsInt()
  @Min(2)
  maxMembers?: number;
}

export class AddChannelMembersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelMemberDto)
  members: ChannelMemberDto[];
}

export class UpdateMemberRoleDto {
  @IsEnum(ParticipantType)
  memberType: ParticipantType;

  @IsUUID()
  memberId: string;

  @IsEnum(ChannelRole)
  role: ChannelRole;
}
