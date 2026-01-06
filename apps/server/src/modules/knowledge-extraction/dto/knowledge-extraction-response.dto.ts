import {
  IsString,
  IsDate,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class KnowledgeExtractionResponseDto {
  @IsUUID()
  id: string;

  @IsString()
  content: string;

  @IsString()
  type: string;

  @IsDate()
  extractedAt: Date;

  @IsOptional()
  @IsObject()
  metadata: Record<string, unknown> | null;

  @IsUUID()
  organizationId: string;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}
