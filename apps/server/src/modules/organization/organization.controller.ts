import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { EmergencyStopDto } from './dto/emergency-stop.dto';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Get()
  findAll() {
    return this.organizationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.remove(id);
  }

  /**
   * Phase 3.7: Emergency Stop - Kill switch for autonomous execution
   */
  @Post(':id/emergency-stop')
  emergencyStop(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EmergencyStopDto,
  ) {
    return this.organizationService.emergencyStop(id, dto.reason);
  }

  /**
   * Phase 3.7: Resume Execution - Resume autonomous execution after emergency stop
   */
  @Post(':id/resume-execution')
  resumeExecution(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.resumeExecution(id);
  }
}
