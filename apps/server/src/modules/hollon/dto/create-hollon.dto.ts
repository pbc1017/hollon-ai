import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { HollonLifecycle } from '../entities/hollon.entity';

export class CreateHollonDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsUUID()
  roleId: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  brainProviderId?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxConcurrentTasks?: number;

  @IsOptional()
  @IsEnum(HollonLifecycle)
  lifecycle?: HollonLifecycle;
}
