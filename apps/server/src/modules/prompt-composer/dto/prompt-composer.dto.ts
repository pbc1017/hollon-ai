import {
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
  MaxLength,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Context information for prompt composition
 * Contains system context, user input, and knowledge base context
 */
export class ContextDto {
  /**
   * System-level context or instructions
   * @example "You are a helpful AI assistant specialized in software development"
   */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  systemContext?: string;

  /**
   * User's input or query
   * @example "Help me debug this authentication issue"
   */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  userInput?: string;

  /**
   * Additional context from knowledge base or external sources
   * @example "Authentication is handled via JWT tokens in the auth module"
   */
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  knowledgeContext?: string;

  /**
   * Additional metadata for context enrichment
   * @example { "userId": "123", "sessionId": "abc" }
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * Options for controlling prompt composition behavior
 */
export class OptionsDto {
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
   * Custom formatting options
   */
  @IsOptional()
  @IsObject()
  customOptions?: Record<string, any>;
}

/**
 * Data Transfer Object for prompt composition
 * Used to compose prompts from templates with variables and context
 */
export class PromptComposerDto {
  /**
   * Template string with placeholders for variables
   * @example "Hello {{name}}, welcome to {{system}}"
   */
  @IsString()
  @MaxLength(10000)
  template: string;

  /**
   * Variables to be interpolated into the template
   * @example { "name": "John", "system": "Hollon-AI" }
   */
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  /**
   * Context information for prompt enrichment
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ContextDto)
  context?: ContextDto;

  /**
   * Options for controlling composition behavior
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => OptionsDto)
  options?: OptionsDto;
}
