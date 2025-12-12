import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { DocumentType } from '../../document/entities/document.entity';

export class VectorSearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  topK?: number = 10;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Min(0)
  @Max(1)
  minSimilarity?: number = 0.7;
}

export class VectorSearchResultDto {
  id: string;
  title: string;
  content: string;
  type: DocumentType;
  tags: string[];
  similarity: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
  organizationId: string;
  projectId?: string | null;
  teamId?: string | null;
}

export class VectorSearchResponseDto {
  results: VectorSearchResultDto[];
  query: string;
  topK: number;
  totalFound: number;
  executionTimeMs: number;
}
