import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsNumber,
  IsArray,
  IsBoolean,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import {
  GoalType,
  GoalStatus,
  GoalPriority,
  MetricType,
} from '../entities/goal.entity';

export class CreateGoalDto {
  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  parentGoalId?: string;

  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GoalType)
  goalType?: GoalType;

  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsEnum(GoalPriority)
  priority?: GoalPriority;

  // Key Result 측정 기준
  @IsOptional()
  @IsEnum(MetricType)
  metricType?: MetricType;

  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @IsOptional()
  @IsNumber()
  currentValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  successCriteria?: string[];

  @IsOptional()
  @IsUUID()
  ownerHollonId?: string;

  @IsOptional()
  @IsBoolean()
  autoDecomposed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  decompositionStrategy?: string;

  @IsOptional()
  @IsUUID()
  createdByHollonId?: string;
}
