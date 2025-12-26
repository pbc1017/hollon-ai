import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreatePermanentHollonDto {
  @IsString()
  name: string;

  @IsUUID()
  organizationId: string;

  @IsUUID()
  @IsOptional()
  teamId?: string;

  @IsUUID()
  roleId: string;

  @IsString()
  roleName: string;

  @IsString()
  @IsOptional()
  brainProviderId?: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsUUID()
  @IsOptional()
  createdBy?: string;
}
