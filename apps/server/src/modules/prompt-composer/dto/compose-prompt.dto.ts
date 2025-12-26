import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ContextVariable {
  @IsString()
  @MaxLength(100)
  key: string;

  @IsString()
  value: string;
}

export class ComposePromptDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @MaxLength(100)
  templateName: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContextVariable)
  contextVariables?: ContextVariable[];

  @IsOptional()
  @IsString()
  additionalContext?: string;
}
