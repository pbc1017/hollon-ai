import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  MaxLength,
  MinLength,
  IsJSON,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { KnowledgeCategory, KnowledgeSource } from '../entities';

export class UpdateKnowledgeDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;

  @IsOptional()
  @IsEnum(KnowledgeCategory)
  category?: KnowledgeCategory;

  @IsOptional()
  @IsEnum(KnowledgeSource)
  source?: KnowledgeSource;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsJSON()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsNumber()
  verificationCount?: number;
}
