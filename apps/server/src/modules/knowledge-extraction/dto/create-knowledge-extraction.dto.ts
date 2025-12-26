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
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  source: string;

  @IsDateString()
  extractedAt: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsUUID()
  organizationId: string;
}
