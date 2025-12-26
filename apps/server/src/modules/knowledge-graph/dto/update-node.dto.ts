import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateNodeDto } from './create-node.dto';

export class UpdateNodeDto extends PartialType(
  OmitType(CreateNodeDto, ['organizationId'] as const),
) {}
