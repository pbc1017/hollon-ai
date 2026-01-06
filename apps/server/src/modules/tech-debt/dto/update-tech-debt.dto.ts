import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TechDebtStatus } from '../entities/tech-debt.entity';
import { CreateTechDebtDto } from './create-tech-debt.dto';

export class UpdateTechDebtDto extends PartialType(CreateTechDebtDto) {
  @IsOptional()
  @IsEnum(TechDebtStatus)
  status?: TechDebtStatus;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
