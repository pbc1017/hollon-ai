import { PartialType } from '@nestjs/mapped-types';
import { CreateKnowledgeExtractionDto } from './create-knowledge-extraction.dto';

export class UpdateKnowledgeExtractionDto extends PartialType(
  CreateKnowledgeExtractionDto,
) {}
