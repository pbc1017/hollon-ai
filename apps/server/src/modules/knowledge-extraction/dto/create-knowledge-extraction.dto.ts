import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsObject,
  IsUUID,
} from 'class-validator';

export class CreateKnowledgeExtractionDto {
  @IsString()
  @IsNotEmpty({ message: 'Content is required and cannot be empty' })
  content: string;

  @IsString()
  @IsNotEmpty({ message: 'Source is required and cannot be empty' })
  source: string;

  @IsDateString()
  extractedAt: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  organizationId: string;
}
