import {
  IsEnum,
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { KnowledgeCategory } from '../entities/knowledge.entity';

export class CreateKnowledgeDto {
  @IsEnum(KnowledgeCategory)
  category: KnowledgeCategory;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  relevanceScore?: number;
}
