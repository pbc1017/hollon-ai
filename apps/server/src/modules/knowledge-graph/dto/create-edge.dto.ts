import {
  IsEnum,
  IsUUID,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { RelationshipType } from '../../../knowledge/enums/relationship-type.enum';

export class CreateEdgeDto {
  @IsUUID()
  sourceNodeId: string;

  @IsUUID()
  targetNodeId: string;

  @IsEnum(RelationshipType)
  type: RelationshipType;

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
