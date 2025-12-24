import {
  IsString,
  IsNotEmpty,
  ValidateNested,
  IsOptional,
  IsDate,
  IsArray,
  MinLength,
  MaxLength,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { KnowledgeItemDto } from './knowledge-item.dto';
import { KnowledgeSourceDto } from './knowledge-source.dto';

/**
 * DTO for extracting knowledge from content
 */
export class ExtractKnowledgeDto {
  /**
   * The content to extract knowledge from
   * Must be a non-empty string with a minimum length of 1 and maximum length of 100000 characters
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100000)
  content: string;

  /**
   * Source information for the content
   * Must be a valid KnowledgeSourceDto object
   */
  @ValidateNested()
  @Type(() => KnowledgeSourceDto)
  source: KnowledgeSourceDto;

  /**
   * Optional metadata about the extraction request
   * Must be a valid object if provided
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  /**
   * Optional list of knowledge items if already extracted
   * Must be an array of valid KnowledgeItemDto objects if provided
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KnowledgeItemDto)
  knowledgeItems?: KnowledgeItemDto[];

  /**
   * Timestamp when the extraction was requested
   * Must be a valid Date object
   */
  @IsDate()
  @Type(() => Date)
  timestamp: Date;
}
