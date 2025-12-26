import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  MaxLength,
  IsBoolean,
} from 'class-validator';

export class CreatePromptTemplateDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  template: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredVariables?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePromptTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredVariables?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
