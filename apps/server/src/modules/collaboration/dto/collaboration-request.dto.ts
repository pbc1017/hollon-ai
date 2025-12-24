import {
  IsEnum,
  IsString,
  IsUUID,
  IsOptional,
  IsObject,
} from 'class-validator';
import { CollaborationType } from '../entities/collaboration-session.entity';

export class CollaborationRequestDto {
  @IsEnum(CollaborationType)
  type: CollaborationType;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsUUID()
  preferredTeamId?: string;
}
