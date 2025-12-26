import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { CreateCycleDto } from './create-cycle.dto';
import { CycleStatus } from '../entities/cycle.entity';

export class UpdateCycleDto extends PartialType(CreateCycleDto) {
  @IsOptional()
  @IsEnum(CycleStatus)
  status?: CycleStatus;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
