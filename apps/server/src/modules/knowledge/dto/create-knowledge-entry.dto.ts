import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
  IsObject,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  KnowledgeEntryType,
  KnowledgeCategory,
} from '../entities/knowledge-entry.entity';

export class CreateKnowledgeEntryDto {
  @ApiProperty({ description: 'Title of the knowledge entry', maxLength: 255 })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Content of the knowledge entry' })
  @IsString()
  content: string;

  @ApiProperty({
    description: 'Type of knowledge entry',
    enum: KnowledgeEntryType,
    default: KnowledgeEntryType.LESSON_LEARNED,
  })
  @IsEnum(KnowledgeEntryType)
  type: KnowledgeEntryType;

  @ApiProperty({
    description: 'Category of knowledge entry',
    enum: KnowledgeCategory,
    default: KnowledgeCategory.TECHNICAL,
  })
  @IsEnum(KnowledgeCategory)
  category: KnowledgeCategory;

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

  @ApiPropertyOptional({ description: 'Task ID' })
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({
    description: 'Hollon ID that extracted this knowledge',
  })
  @IsOptional()
  @IsUUID()
  extractedByHollonId?: string;

  @ApiPropertyOptional({
    description: 'Tags for categorization',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Source references',
    example: { taskIds: ['uuid'], documentIds: ['uuid'], hollonIds: ['uuid'] },
  })
  @IsOptional()
  @IsObject()
  sources?: {
    taskIds?: string[];
    documentIds?: string[];
    hollonIds?: string[];
  };

  @ApiPropertyOptional({
    description: 'Confidence score (0-100)',
    minimum: 0,
    maximum: 100,
    default: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  confidenceScore?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: {
      codeSnippets: ['code example'],
      relatedFiles: ['file.ts'],
      dependencies: ['package'],
      context: { key: 'value' },
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    codeSnippets?: string[];
    relatedFiles?: string[];
    dependencies?: string[];
    context?: Record<string, unknown>;
  };
}
