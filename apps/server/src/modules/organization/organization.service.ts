import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
  ) {}

  async create(dto: CreateOrganizationDto): Promise<Organization> {
    const organization = this.organizationRepo.create(dto);
    return this.organizationRepo.save(organization);
  }

  async findAll(): Promise<Organization[]> {
    return this.organizationRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Organization> {
    const organization = await this.organizationRepo.findOne({
      where: { id },
      relations: ['teams', 'hollons', 'projects'],
    });

    if (!organization) {
      throw new NotFoundException(`Organization #${id} not found`);
    }

    return organization;
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    const organization = await this.findOne(id);
    Object.assign(organization, dto);
    return this.organizationRepo.save(organization);
  }

  async remove(id: string): Promise<void> {
    const organization = await this.findOne(id);
    await this.organizationRepo.remove(organization);
  }

  /**
   * Phase 3.7: Emergency Stop - Kill switch for autonomous execution
   *
   * Sets autonomousExecutionEnabled = false to stop HollonExecutionService
   * from automatically executing tasks
   */
  async emergencyStop(
    id: string,
    reason?: string,
  ): Promise<{ message: string; organization: Organization }> {
    const organization = await this.findOne(id);

    const settings = (organization.settings || {}) as Record<string, unknown>;
    settings.autonomousExecutionEnabled = false;
    settings.emergencyStopReason = reason || 'Emergency stop initiated';
    settings.emergencyStopAt = new Date().toISOString();

    organization.settings = settings;
    await this.organizationRepo.save(organization);

    this.logger.warn(
      `Emergency stop activated for organization ${organization.name}: ${reason || 'No reason provided'}`,
    );

    return {
      message: 'Autonomous execution has been stopped',
      organization,
    };
  }

  /**
   * Phase 3.7: Resume Execution - Resume autonomous execution after emergency stop
   *
   * Sets autonomousExecutionEnabled = true to resume HollonExecutionService
   */
  async resumeExecution(
    id: string,
  ): Promise<{ message: string; organization: Organization }> {
    const organization = await this.findOne(id);

    const settings = (organization.settings || {}) as Record<string, unknown>;
    settings.autonomousExecutionEnabled = true;
    delete settings.emergencyStopReason;
    delete settings.emergencyStopAt;
    settings.resumedAt = new Date().toISOString();

    organization.settings = settings;
    await this.organizationRepo.save(organization);

    this.logger.log(
      `Autonomous execution resumed for organization ${organization.name}`,
    );

    return {
      message: 'Autonomous execution has been resumed',
      organization,
    };
  }
}
