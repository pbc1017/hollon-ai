import { IsString, IsOptional, IsObject, IsUUID } from 'class-validator';

export class ComposePromptDto {
  @IsUUID()
  templateId: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsString()
  context?: string;
}
