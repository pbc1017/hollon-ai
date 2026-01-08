import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validator constraint to ensure embedding dimensions match array length
 */
@ValidatorConstraint({ name: 'matchesDimensions', async: false })
export class MatchesDimensionsConstraint
  implements ValidatorConstraintInterface
{
  validate(embedding: number[], args: ValidationArguments): boolean {
    const object = args.object as Record<string, unknown>;
    const dimensions = object.dimensions;

    if (!embedding || !Array.isArray(embedding)) {
      return false;
    }

    if (typeof dimensions !== 'number') {
      return false;
    }

    return embedding.length === dimensions;
  }

  defaultMessage(args: ValidationArguments): string {
    const object = args.object as Record<string, unknown>;
    const dimensions = object.dimensions;
    const actualLength = Array.isArray(args.value) ? args.value.length : 0;

    return `Embedding array length (${actualLength}) must match dimensions field (${dimensions})`;
  }
}

/**
 * Validator constraint to ensure all embedding values are valid numbers (no NaN, no Infinity)
 */
@ValidatorConstraint({ name: 'isValidEmbedding', async: false })
export class IsValidEmbeddingConstraint
  implements ValidatorConstraintInterface
{
  validate(embedding: unknown[]): boolean {
    if (!embedding || !Array.isArray(embedding)) {
      return false;
    }

    return embedding.every((value) => {
      if (typeof value !== 'number') {
        return false;
      }

      // Reject NaN and Infinity
      if (!Number.isFinite(value)) {
        return false;
      }

      return true;
    });
  }

  defaultMessage(): string {
    return 'Embedding array must contain only finite numbers (no NaN or Infinity values)';
  }
}

/**
 * Validator constraint to ensure embedding values are normalized (between -1 and 1)
 */
@ValidatorConstraint({ name: 'isNormalizedEmbedding', async: false })
export class IsNormalizedEmbeddingConstraint
  implements ValidatorConstraintInterface
{
  validate(embedding: unknown[]): boolean {
    if (!embedding || !Array.isArray(embedding)) {
      return false;
    }

    return embedding.every((value) => {
      if (typeof value !== 'number') {
        return false;
      }

      // Check if value is between -1 and 1 (inclusive)
      return value >= -1 && value <= 1;
    });
  }

  defaultMessage(): string {
    return 'Embedding array values must be normalized (between -1 and 1)';
  }
}

/**
 * Decorator to validate that embedding array length matches the dimensions field
 *
 * @param validationOptions - Optional validation options
 *
 * @example
 * class EmbeddingDto {
 *   @IsArray()
 *   @MatchesDimensions()
 *   embedding: number[];
 *
 *   @IsInt()
 *   dimensions: number;
 * }
 */
export function MatchesDimensions(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: MatchesDimensionsConstraint,
    });
  };
}

/**
 * Decorator to validate that embedding contains only valid finite numbers
 *
 * @param validationOptions - Optional validation options
 *
 * @example
 * class EmbeddingDto {
 *   @IsArray()
 *   @IsValidEmbedding()
 *   embedding: number[];
 * }
 */
export function IsValidEmbedding(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidEmbeddingConstraint,
    });
  };
}

/**
 * Decorator to validate that embedding values are normalized (between -1 and 1)
 * Note: This is optional validation since not all embeddings need to be normalized
 *
 * @param validationOptions - Optional validation options
 *
 * @example
 * class EmbeddingDto {
 *   @IsArray()
 *   @IsNormalizedEmbedding()
 *   embedding: number[];
 * }
 */
export function IsNormalizedEmbedding(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNormalizedEmbeddingConstraint,
    });
  };
}
