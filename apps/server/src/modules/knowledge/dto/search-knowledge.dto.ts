import {
  IsUUID,
  IsOptional,
  IsEnum,
  IsArray,
  IsString,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  KnowledgeEntryType,
  KnowledgeCategory,
} from '../entities/knowledge-entry.entity';

export class SearchKnowledgeDto {
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

  @ApiPropertyOptional({ description: 'Tags to filter by', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

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

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset for pagination', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}
