import {
  IsString,
  IsUUID,
  IsInt,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateCycleDto {
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsInt()
  @Min(1)
  number: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetCents?: number;
}
