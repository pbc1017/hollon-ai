import {
  IsString,
  IsArray,
  IsOptional,
  IsDateString,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ContractPriority } from '../entities/cross-team-contract.entity';

export class DependencyRequestDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  description: string;

  @IsArray()
  @IsString({ each: true })
  deliverables: string[];

  @IsOptional()
  @IsEnum(ContractPriority)
  priority?: ContractPriority;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}
