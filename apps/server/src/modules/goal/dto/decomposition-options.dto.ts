import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';

export enum DecompositionStrategy {
  TASK_BASED = 'task_based',
  MILESTONE_BASED = 'milestone_based',
  HYBRID = 'hybrid',
}

export class DecompositionOptionsDto {
  @IsOptional()
  @IsEnum(DecompositionStrategy)
  strategy?: DecompositionStrategy;

  @IsOptional()
  @IsString()
  preferredModel?: string;

  @IsOptional()
  @IsBoolean()
  createMilestones?: boolean;

  @IsOptional()
  @IsBoolean()
  autoAssign?: boolean;
}
