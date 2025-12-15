import {
  IsUUID,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class LinkTaskKnowledgeDto {
  @IsUUID()
  taskId: string;

  @IsUUID()
  knowledgeId: string;

  @IsOptional()
  @IsString()
  contextNotes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  applicationScore?: number;
}
