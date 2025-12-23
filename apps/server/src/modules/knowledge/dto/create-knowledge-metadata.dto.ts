import {
  IsString,
  IsEnum,
  IsUUID,
  IsOptional,
  IsNumber,
  MinLength,
  Max,
  Min,
} from 'class-validator';
import { MetadataKeyType } from '../entities';

export class CreateKnowledgeMetadataDto {
  @IsUUID()
  knowledgeId: string;

  @IsEnum(MetadataKeyType)
  keyType: MetadataKeyType;

  @IsString()
  @MinLength(1)
  value: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceScore?: number; // 0-1 confidence
}
