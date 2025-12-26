import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VariableSchema {
  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  required?: boolean;
}

export class PromptTemplateDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  template: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariableSchema)
  variablesSchema?: VariableSchema[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
