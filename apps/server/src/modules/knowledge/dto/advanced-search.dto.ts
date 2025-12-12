import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  IsEnum,
  IsUUID,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentType } from '../../document/entities/document.entity';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum SortField {
  RELEVANCE = 'relevance',
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
  TITLE = 'title',
}

export class AdvancedSearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @IsOptional()
  @IsDateString()
  updatedAfter?: string;

  @IsOptional()
  @IsDateString()
  updatedBefore?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeEmbeddings?: boolean;

  @IsOptional()
  @IsEnum(SortField)
  sortBy?: SortField;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}
