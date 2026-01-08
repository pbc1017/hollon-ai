import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validator constraint to ensure chunkIndex is less than totalChunks
 */
@ValidatorConstraint({ name: 'isValidChunkIndex', async: false })
export class IsValidChunkIndexConstraint implements ValidatorConstraintInterface {
  validate(chunkIndex: number, args: ValidationArguments): boolean {
    const object = args.object as Record<string, unknown>;
    const totalChunks = object.totalChunks;

    // If chunkIndex is not provided, validation passes
    if (chunkIndex === null || chunkIndex === undefined) {
      return true;
    }

    // If totalChunks is not provided, we can't validate the relationship
    // but we don't fail validation in this case
    if (totalChunks === null || totalChunks === undefined) {
      return true;
    }

    // Ensure chunkIndex < totalChunks
    return chunkIndex < totalChunks;
  }

  defaultMessage(args: ValidationArguments): string {
    const object = args.object as Record<string, unknown>;
    const totalChunks = object.totalChunks;
    const chunkIndex = args.value;

    return `chunkIndex (${chunkIndex}) must be less than totalChunks (${totalChunks})`;
  }
}

/**
 * Decorator to validate that chunkIndex is less than totalChunks
 *
 * @param validationOptions - Optional validation options
 *
 * @example
 * class MetadataDto {
 *   @IsOptional()
 *   @IsInt()
 *   @Min(0)
 *   @IsValidChunkIndex()
 *   chunkIndex?: number;
 *
 *   @IsOptional()
 *   @IsInt()
 *   @Min(1)
 *   totalChunks?: number;
 * }
 */
export function IsValidChunkIndex(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidChunkIndexConstraint,
    });
  };
}
