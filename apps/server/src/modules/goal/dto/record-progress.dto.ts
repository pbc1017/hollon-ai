import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
} from 'class-validator';

export class RecordProgressDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent: number;

  @IsOptional()
  @IsNumber()
  currentValue?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsUUID()
  recordedBy?: string;
}
