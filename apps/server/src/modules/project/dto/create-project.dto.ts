import { IsString, IsOptional, IsUUID, IsUrl, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  repositoryUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  workingDirectory?: string;

  @IsOptional()
  settings?: Record<string, unknown>;
}
