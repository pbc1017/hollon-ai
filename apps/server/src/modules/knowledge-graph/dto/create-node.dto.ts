import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  MaxLength,
  IsArray,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { NodeType } from '../entities/node.entity';

export class CreateNodeDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsEnum(NodeType)
  type: NodeType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
