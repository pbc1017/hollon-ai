import { IsString, IsObject, IsOptional } from 'class-validator';

export class ComposedPromptResponseDto {
  @IsString()
  composedPrompt: string;

  @IsString()
  templateName: string;

  @IsObject()
  variables: Record<string, any>;

  @IsOptional()
  @IsObject()
  metadata?: {
    templateVersion?: string;
    composedAt?: Date;
    variablesUsed?: string[];
  };
}
