import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsNumber,
  IsUUID,
  Min,
} from 'class-validator';
import {
  TechDebtCategory,
  TechDebtSeverity,
} from '../entities/tech-debt.entity';

export class CreateTechDebtDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(TechDebtCategory)
  category: TechDebtCategory;

  @IsEnum(TechDebtSeverity)
  severity: TechDebtSeverity;

  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedFiles?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedEffortHours?: number;

  @IsOptional()
  @IsString()
  detectedBy?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
