import { IsEnum, IsString, IsUUID, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { MeetingType } from '../entities/meeting-record.entity';

export class CreateMeetingDto {
  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsEnum(MeetingType)
  meetingType: MeetingType;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledAt?: Date;
}
