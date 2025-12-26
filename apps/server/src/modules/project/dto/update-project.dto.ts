import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateProjectDto } from './create-project.dto';
import { ProjectStatus } from '../entities/project.entity';

export class UpdateProjectDto extends PartialType(
  OmitType(CreateProjectDto, ['organizationId'] as const),
) {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
