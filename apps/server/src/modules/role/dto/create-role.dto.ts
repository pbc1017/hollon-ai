import {
  IsString,
  IsOptional,
  IsArray,
  MaxLength,
  IsUUID,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsUUID()
  organizationId: string;
}
