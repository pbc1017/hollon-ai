import {
  IsEnum,
  IsUUID,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { EdgeType } from '../entities/edge.entity';

export class CreateEdgeDto {
  @IsUUID()
  sourceNodeId: string;

  @IsUUID()
  targetNodeId: string;

  @IsEnum(EdgeType)
  type: EdgeType;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  properties?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
