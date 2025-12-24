import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  MaxLength,
  IsObject,
  MinLength,
} from 'class-validator';

/**
 * DTO for knowledge source information
 */
export class KnowledgeSourceDto {
  /**
   * Type of the knowledge source (e.g., 'github-issue', 'slack-message', 'document')
   * Must be a non-empty string with a minimum length of 1 and maximum length of 100 characters
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  type: string;

  /**
   * Unique identifier for the source
   * Must be a non-empty string with a minimum length of 1 and maximum length of 255 characters
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  id: string;

  /**
   * Optional URL to the source
   * Must be a valid URL if provided, with a maximum length of 2000 characters
   */
  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  url?: string;

  /**
   * Additional metadata about the source
   * Must be a valid object if provided
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
