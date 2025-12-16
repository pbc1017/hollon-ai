import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  KnowledgeEntryType,
  KnowledgeCategory,
} from '../entities/knowledge-entry.entity';

export class SemanticSearchDto {
  @ApiProperty({ description: 'Search query text' })
  @IsString()
  query: string;

  @ApiProperty({ description: 'Organization ID' })
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({ description: 'Team ID' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ description: 'Project ID' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Type of knowledge entry',
    enum: KnowledgeEntryType,
  })
  @IsOptional()
  @IsEnum(KnowledgeEntryType)
  type?: KnowledgeEntryType;

  @ApiPropertyOptional({
    description: 'Category of knowledge entry',
    enum: KnowledgeCategory,
  })
  @IsOptional()
  @IsEnum(KnowledgeCategory)
  category?: KnowledgeCategory;

  @ApiPropertyOptional({ description: 'Maximum number of results', default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Minimum confidence score',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minConfidence?: number;
}
