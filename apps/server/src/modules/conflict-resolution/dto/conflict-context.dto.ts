import { IsUUID, IsOptional, IsArray, IsString } from 'class-validator';

export class ConflictContextDto {
  @IsUUID()
  organizationId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  taskIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedFiles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedResources?: string[];
}
