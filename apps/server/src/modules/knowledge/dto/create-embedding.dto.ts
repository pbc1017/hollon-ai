import {
  IsString,
  IsEnum,
  IsUUID,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { EmbeddingModel } from '../entities';

export class CreateEmbeddingDto {
  @IsUUID()
  knowledgeId: string;

  @IsArray()
  @ArrayMinSize(1)
  vector: number[]; // Will be stored as JSON string

  @IsEnum(EmbeddingModel)
  model: EmbeddingModel;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}
