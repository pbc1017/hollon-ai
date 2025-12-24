import { IsString, IsObject, MaxLength } from 'class-validator';

export class EnrichContextDto {
  @IsString()
  @MaxLength(10000)
  basePrompt: string;

  @IsObject()
  contextData: Record<string, any>;
}
