import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsArray,
  IsUUID,
} from 'class-validator';

export class CreateKnowledgeDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  hollonId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}
