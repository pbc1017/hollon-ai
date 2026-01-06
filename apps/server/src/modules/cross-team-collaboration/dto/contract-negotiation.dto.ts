import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ContractStatus } from '../entities/cross-team-contract.entity';

export class ContractNegotiationDto {
  @IsEnum(ContractStatus)
  status: ContractStatus;

  @IsOptional()
  @IsDateString()
  agreedDeadline?: string;

  @IsOptional()
  @IsString()
  negotiationNotes?: string;
}
