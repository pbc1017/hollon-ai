import { IsString, IsArray, IsOptional, IsDateString } from 'class-validator';

export class DependencyRequestDto {
  @IsString()
  description: string;

  @IsArray()
  @IsString({ each: true })
  deliverables: string[];

  @IsOptional()
  @IsDateString()
  deadline?: string;
}
