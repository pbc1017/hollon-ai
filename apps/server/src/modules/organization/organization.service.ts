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

  /**
   * Creates a new organization in the system
   *
   * @param dto - Organization creation data including name and settings
   * @returns Promise resolving to the newly created Organization entity
   */
  async create(dto: CreateOrganizationDto): Promise<Organization> {
    const organization = this.organizationRepo.create(dto);
    return this.organizationRepo.save(organization);
  }

  /**
   * Retrieves all organizations in the system
   * Results are ordered by creation date (newest first)
   *
   * @returns Promise resolving to an array of all Organization entities
   */
  async findAll(): Promise<Organization[]> {
    return this.organizationRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Retrieves a single organization by ID with related entities
   * Includes teams, hollons, and projects relationships
   *
   * @param id - The unique identifier of the organization
   * @returns Promise resolving to the Organization entity with relations
   * @throws NotFoundException if the organization is not found
   */
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

  /**
   * Updates an existing organization with new data
   *
   * @param id - The unique identifier of the organization to update
   * @param dto - Updated organization data
   * @returns Promise resolving to the updated Organization entity
   * @throws NotFoundException if the organization is not found
   */
  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    const organization = await this.findOne(id);
    Object.assign(organization, dto);
    return this.organizationRepo.save(organization);
  }

  /**
   * Removes an organization from the system
   *
   * @param id - The unique identifier of the organization to remove
   * @returns Promise that resolves when the organization is successfully removed
   * @throws NotFoundException if the organization is not found
   */
  async remove(id: string): Promise<void> {
    const organization = await this.findOne(id);
    await this.organizationRepo.remove(organization);
  }

  /**
   * Phase 3.7: Emergency Stop - Kill switch for autonomous execution
   *
   * Sets autonomousExecutionEnabled = false to stop HollonExecutionService
   * from automatically executing tasks. Records the reason and timestamp
   * of the emergency stop in organization settings.
   *
   * @param id - The unique identifier of the organization
   * @param reason - Optional reason for the emergency stop
   * @returns Promise resolving to a success message and the updated Organization entity
   * @throws NotFoundException if the organization is not found
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
   * Sets autonomousExecutionEnabled = true to resume HollonExecutionService.
   * Clears emergency stop reason and timestamp, and records the resume timestamp
   * in organization settings.
   *
   * @param id - The unique identifier of the organization
   * @returns Promise resolving to a success message and the updated Organization entity
   * @throws NotFoundException if the organization is not found
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
