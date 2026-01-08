import {
  IsString,
  IsOptional,
  IsObject,
  IsUUID,
  ValidateNested,
  MaxLength,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for prompt variables
 * Defines variables that will be interpolated into template placeholders
 */
export class PromptVariableDto {
  /**
   * Variable name to match placeholders in template (e.g., "name" for {{name}})
   */
  @IsString()
  @MaxLength(100)
  name: string;

  /**
   * Variable value - can be any JSON-serializable type
   */
  @IsOptional()
  value?: string | number | boolean | Record<string, any> | any[];

  /**
   * Whether this variable is required in the template
   */
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  /**
   * Description of what this variable represents
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

/**
 * DTO for context enrichment data
 */
export class ContextEnrichmentDto {
  /**
   * System-level instructions or context
   */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  systemContext?: string;

  /**
   * User input or query for context
   */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  userInput?: string;

  /**
   * Knowledge base context or additional information
   */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  knowledgeContext?: string;

  /**
   * Additional metadata for context enrichment
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  /**
   * Tags for categorizing context
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

/**
 * DTO for composition options
 */
export class CompositionOptionsDto {
  /**
   * Maximum length of the composed prompt in characters
   * @default 10000
   */
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(50000)
  maxLength?: number;

  /**
   * Whether to include timestamps in the composed prompt
   * @default false
   */
  @IsOptional()
  @IsBoolean()
  includeTimestamp?: boolean;

  /**
   * Whether to format the output with markdown
   * @default false
   */
  @IsOptional()
  @IsBoolean()
  formatAsMarkdown?: boolean;

  /**
   * Whether to validate the composed prompt length
   * @default true
   */
  @IsOptional()
  @IsBoolean()
  validateLength?: boolean;

  /**
   * Whether to sanitize variables for security
   * @default true
   */
  @IsOptional()
  @IsBoolean()
  sanitizeVariables?: boolean;

  /**
   * Custom formatting options
   */
  @IsOptional()
  @IsObject()
  customOptions?: Record<string, any>;
}

/**
 * DTO for template-based prompt request
 */
export class TemplatePromptRequestDto {
  /**
   * Name or ID of the template to use
   */
  @IsString()
  @MaxLength(100)
  templateName: string;

  /**
   * Organization ID for template access control
   */
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  /**
   * Variables to interpolate into the template
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptVariableDto)
  variables?: PromptVariableDto[];

  /**
   * Context data for enrichment
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ContextEnrichmentDto)
  context?: ContextEnrichmentDto;

  /**
   * Composition options
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CompositionOptionsDto)
  options?: CompositionOptionsDto;
}

/**
 * DTO for direct prompt composition request (without template)
 */
export class DirectPromptRequestDto {
  /**
   * Template string with placeholders for variables
   * @example "Hello {{name}}, welcome to {{system}}"
   */
  @IsString()
  @MaxLength(10000)
  template: string;

  /**
   * Variables to be interpolated into the template
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptVariableDto)
  variables?: PromptVariableDto[];

  /**
   * Context information for prompt enrichment
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ContextEnrichmentDto)
  context?: ContextEnrichmentDto;

  /**
   * Options for controlling composition behavior
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CompositionOptionsDto)
  options?: CompositionOptionsDto;
}

/**
 * Union type for prompt requests
 */
export type PromptRequestDto =
  | TemplatePromptRequestDto
  | DirectPromptRequestDto;

/**
 * DTO for batch prompt composition request
 */
export class BatchPromptRequestDto {
  /**
   * List of prompts to compose
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectPromptRequestDto)
  prompts: DirectPromptRequestDto[];

  /**
   * Whether to stop on first error or continue processing
   * @default false
   */
  @IsOptional()
  @IsBoolean()
  continueOnError?: boolean;

  /**
   * Shared context for all prompts in the batch
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ContextEnrichmentDto)
  sharedContext?: ContextEnrichmentDto;

  /**
   * Shared options for all prompts in the batch
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CompositionOptionsDto)
  sharedOptions?: CompositionOptionsDto;
}
