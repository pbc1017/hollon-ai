import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CreateHollonDto } from './create-hollon.dto';
import { HollonStatus } from '../entities/hollon.entity';

export class UpdateHollonDto extends PartialType(
  OmitType(CreateHollonDto, ['organizationId'] as const),
) {
  @IsOptional()
  @IsEnum(HollonStatus)
  status?: HollonStatus;

  @IsOptional()
  @IsUUID()
  managerId?: string;
}
