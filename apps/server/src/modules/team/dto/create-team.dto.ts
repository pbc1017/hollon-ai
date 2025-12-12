import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsUUID()
  leaderHollonId?: string; // Phase 3.5: 팀 리더

  @IsOptional()
  @IsUUID()
  managerHollonId?: string; // Phase 3.8: Manager hollon (hierarchical task distribution)
}
