import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  MinLength,
} from 'class-validator';
import { RelationType } from '../entities';

export class CreateKnowledgeRelationDto {
  @IsUUID()
  sourceId: string;

  @IsUUID()
  targetId: string;

  @IsEnum(RelationType)
  type: RelationType;

  @IsOptional()
  @IsString()
  @MinLength(5)
  description?: string;

  @IsOptional()
  @IsNumber()
  strength?: number; // 0-1 confidence score
}
