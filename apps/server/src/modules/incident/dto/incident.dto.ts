import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IncidentSeverity } from '../entities/incident.entity';

export class CreateIncidentDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsUUID()
  reporterHollonId?: string;
}
