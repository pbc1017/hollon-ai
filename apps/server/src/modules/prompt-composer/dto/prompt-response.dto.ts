import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsBoolean,
  IsInt,
  IsDate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for variable usage metadata
 */
export class VariableUsageDto {
  /**
   * Name of the variable
   */
  @IsString()
  name: string;

  /**
   * Whether the variable was used in the composition
   */
  @IsBoolean()
  used: boolean;

  /**
   * Value that was interpolated
   */
  @IsOptional()
  @IsObject()
  value?: any;

  /**
   * Number of times the variable appeared in the template
   */
  @IsOptional()
  @IsInt()
  occurrences?: number;
}

/**
 * DTO for composition metrics
 */
export class CompositionMetricsDto {
  /**
   * Character count of the composed prompt
   */
  @IsInt()
  characterCount: number;

  /**
   * Word count of the composed prompt
   */
  @IsInt()
  wordCount: number;

  /**
   * Number of variables used
   */
  @IsInt()
  variablesUsed: number;

  /**
   * Processing time in milliseconds
   */
  @IsInt()
  processingTimeMs: number;

  /**
   * Whether the prompt met length constraints
   */
  @IsBoolean()
  withinLengthLimits: boolean;

  /**
   * Estimated token count (for LLM usage estimation)
   */
  @IsOptional()
  @IsInt()
  estimatedTokenCount?: number;
}

/**
 * DTO for composition validation errors
 */
export class CompositionErrorDto {
  /**
   * Error code for programmatic handling
   */
  @IsString()
  code: string;

  /**
   * Human-readable error message
   */
  @IsString()
  message: string;

  /**
   * Field or variable that caused the error
   */
  @IsOptional()
  @IsString()
  field?: string;

  /**
   * Detailed error information
   */
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}

/**
 * DTO for composition warnings
 */
export class CompositionWarningDto {
  /**
   * Warning code for programmatic handling
   */
  @IsString()
  code: string;

  /**
   * Human-readable warning message
   */
  @IsString()
  message: string;

  /**
   * Severity level: 'low', 'medium', 'high'
   */
  @IsString()
  severity: 'low' | 'medium' | 'high';

  /**
   * Related field or variable
   */
  @IsOptional()
  @IsString()
  field?: string;
}

/**
 * DTO for composition metadata
 */
export class CompositionMetadataDto {
  /**
   * Template name or ID used
   */
  @IsOptional()
  @IsString()
  templateName?: string;

  /**
   * Template version
   */
  @IsOptional()
  @IsString()
  templateVersion?: string;

  /**
   * Timestamp when the prompt was composed
   */
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  composedAt?: Date;

  /**
   * Variables used in composition
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariableUsageDto)
  variablesUsed?: VariableUsageDto[];

  /**
   * Composition metrics
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CompositionMetricsDto)
  metrics?: CompositionMetricsDto;

  /**
   * Custom metadata
   */
  @IsOptional()
  @IsObject()
  customData?: Record<string, any>;

  /**
   * Request ID for tracing
   */
  @IsOptional()
  @IsString()
  requestId?: string;
}

/**
 * DTO for successful prompt composition response
 */
export class ComposedPromptDto {
  /**
   * The composed prompt text
   */
  @IsString()
  prompt: string;

  /**
   * Template name that was used
   */
  @IsOptional()
  @IsString()
  templateName?: string;

  /**
   * Variables that were used
   */
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  /**
   * Composition metadata
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CompositionMetadataDto)
  metadata?: CompositionMetadataDto;
}

/**
 * DTO for prompt composition response with validation results
 */
export class PromptCompositionResponseDto {
  /**
   * Whether the composition was successful
   */
  @IsBoolean()
  success: boolean;

  /**
   * The composed prompt (only present if success is true)
   */
  @IsOptional()
  @IsString()
  prompt?: string;

  /**
   * Composition metadata
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CompositionMetadataDto)
  metadata?: CompositionMetadataDto;

  /**
   * Any errors that occurred during composition
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompositionErrorDto)
  errors?: CompositionErrorDto[];

  /**
   * Any warnings that occurred during composition
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompositionWarningDto)
  warnings?: CompositionWarningDto[];

  /**
   * Human-readable status message
   */
  @IsOptional()
  @IsString()
  message?: string;
}

/**
 * DTO for batch composition response
 */
export class BatchCompositionResultDto {
  /**
   * Index of the prompt in the batch
   */
  @IsInt()
  index: number;

  /**
   * Whether this prompt was composed successfully
   */
  @IsBoolean()
  success: boolean;

  /**
   * The composed prompt (only present if success is true)
   */
  @IsOptional()
  @IsString()
  prompt?: string;

  /**
   * Error details (only present if success is false)
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CompositionErrorDto)
  error?: CompositionErrorDto;

  /**
   * Warnings for this prompt
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompositionWarningDto)
  warnings?: CompositionWarningDto[];

  /**
   * Metrics for this composition
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CompositionMetricsDto)
  metrics?: CompositionMetricsDto;
}

/**
 * DTO for batch prompt composition response
 */
export class BatchPromptCompositionResponseDto {
  /**
   * Overall success status (true if all prompts succeeded)
   */
  @IsBoolean()
  success: boolean;

  /**
   * Total number of prompts processed
   */
  @IsInt()
  totalCount: number;

  /**
   * Number of successfully composed prompts
   */
  @IsInt()
  successCount: number;

  /**
   * Number of failed prompts
   */
  @IsInt()
  failureCount: number;

  /**
   * Results for each prompt
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchCompositionResultDto)
  results: BatchCompositionResultDto[];

  /**
   * Aggregate metrics
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CompositionMetricsDto)
  aggregateMetrics?: CompositionMetricsDto;

  /**
   * Overall status message
   */
  @IsOptional()
  @IsString()
  message?: string;
}

/**
 * DTO for prompt validation response (without composition)
 */
export class PromptValidationResponseDto {
  /**
   * Whether the prompt is valid
   */
  @IsBoolean()
  valid: boolean;

  /**
   * Variables found in the template
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  foundVariables?: string[];

  /**
   * Missing required variables
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  missingVariables?: string[];

  /**
   * Validation errors
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompositionErrorDto)
  errors?: CompositionErrorDto[];

  /**
   * Validation warnings
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompositionWarningDto)
  warnings?: CompositionWarningDto[];

  /**
   * Detailed analysis
   */
  @IsOptional()
  @IsObject()
  analysis?: {
    templateLength?: number;
    estimatedComposedLength?: number;
    variableCount?: number;
  };
}

/**
 * DTO for generic success response
 */
export class PromptComposerSuccessDto<T> {
  /**
   * Success indicator
   */
  @IsBoolean()
  success: boolean;

  /**
   * Response data
   */
  @IsOptional()
  @IsObject()
  data?: T;

  /**
   * Optional message
   */
  @IsOptional()
  @IsString()
  message?: string;

  /**
   * Timestamp of the response
   */
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  timestamp?: Date;
}

/**
 * DTO for generic error response
 */
export class PromptComposerErrorDto {
  /**
   * Success indicator (always false for errors)
   */
  @IsBoolean()
  success: boolean;

  /**
   * Error code
   */
  @IsString()
  code: string;

  /**
   * Error message
   */
  @IsString()
  message: string;

  /**
   * Error details
   */
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;

  /**
   * Request ID for debugging
   */
  @IsOptional()
  @IsString()
  requestId?: string;
}
