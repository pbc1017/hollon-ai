import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsNumber,
  IsObject,
  IsBoolean,
  Min,
  Max,
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
  @Min(0)
  @Max(1000)
  weight?: number;

  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
