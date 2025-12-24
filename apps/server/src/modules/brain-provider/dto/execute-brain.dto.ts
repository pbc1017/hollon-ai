import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class ExecuteBrainDto {
  @IsString()
  @MaxLength(50000)
  prompt: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  systemPrompt?: string;

  @IsString()
  organizationId: string;

  @IsOptional()
  @IsString()
  hollonId?: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  workingDirectory?: string;

  @IsOptional()
  @IsInt()
  @Min(5000)
  @Max(1200000) // 20 minutes for complex code generation tasks
  timeoutMs?: number;
}
