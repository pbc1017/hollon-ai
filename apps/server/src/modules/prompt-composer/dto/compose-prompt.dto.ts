import {
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PromptContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  systemContext?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  userInput?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  knowledgeContext?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ComposePromptDto {
  @ValidateNested()
  @Type(() => PromptContextDto)
  context: PromptContextDto;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  templateName?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}
