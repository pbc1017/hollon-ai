import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { KnowledgeType } from '../entities/knowledge.entity';

export class CreateKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(KnowledgeType)
  type: KnowledgeType;

  @IsString()
  @IsNotEmpty()
  source: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
