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
}
