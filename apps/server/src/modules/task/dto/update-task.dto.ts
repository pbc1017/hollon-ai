import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsUUID, IsString } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';
import { TaskStatus } from '../entities/task.entity';

export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['projectId', 'parentTaskId'] as const),
) {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  assignedHollonId?: string;

  @IsOptional()
  @IsString()
  estimatedComplexity?: 'low' | 'medium' | 'high';
}
