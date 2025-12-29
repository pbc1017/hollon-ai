import { IsString, IsObject, IsOptional, IsNumber } from 'class-validator';

export class ComposedPromptResponseDto {
  @IsString()
  composedPrompt: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  tokensEstimate?: number;
}
