import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateEdgeDto } from './create-edge.dto';

export class UpdateEdgeDto extends PartialType(
  OmitType(CreateEdgeDto, [
    'organizationId',
    'sourceNodeId',
    'targetNodeId',
  ] as const),
) {}
