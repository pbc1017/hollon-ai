import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsObject } from 'class-validator';
import { CreateKnowledgeDto } from './create-knowledge.dto';

export class UpdateKnowledgeDto extends PartialType(CreateKnowledgeDto) {
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
