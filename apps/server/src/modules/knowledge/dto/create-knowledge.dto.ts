import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsArray,
  MaxLength,
  MinLength,
  IsJSON,
} from 'class-validator';
import { KnowledgeCategory, KnowledgeSource } from '../entities';

export class CreateKnowledgeDto {
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(10)
  content: string;

  @IsEnum(KnowledgeCategory)
  category: KnowledgeCategory;

  @IsEnum(KnowledgeSource)
  source: KnowledgeSource;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsUUID()
  relevantTaskId?: string;

  @IsOptional()
  @IsUUID()
  createdByHollonId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsJSON()
  metadata?: Record<string, unknown>;
}
