import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  /**
   * Creates a new role in the system
   * Validates that the role name is unique within the organization
   *
   * @param dto - Role creation data including name and organization ID
   * @returns Promise resolving to the newly created Role entity
   * @throws ConflictException if a role with the same name already exists in the organization
   */
  async create(dto: CreateRoleDto): Promise<Role> {
    // Check for duplicate role name within the organization
    const existing = await this.roleRepo.findOne({
      where: {
        name: dto.name,
        organizationId: dto.organizationId,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Role with name "${dto.name}" already exists in this organization`,
      );
    }

    const role = this.roleRepo.create(dto);
    this.logger.log(
      `Creating role "${dto.name}" for organization ${dto.organizationId}`,
    );
    return this.roleRepo.save(role);
  }

  /**
   * Retrieves all roles in the system
   * Results are ordered alphabetically by name
   *
   * @returns Promise resolving to an array of all Role entities
   */
  async findAll(): Promise<Role[]> {
    return this.roleRepo.find({ order: { name: 'ASC' } });
  }

  /**
   * Retrieves a single role by ID
   *
   * @param id - The unique identifier of the role
   * @returns Promise resolving to the Role entity
   * @throws NotFoundException if the role is not found
   */
  async findOne(id: string): Promise<Role> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role #${id} not found`);
    }
    return role;
  }

  /**
   * Updates an existing role with new data
   *
   * @param id - The unique identifier of the role to update
   * @param dto - Updated role data
   * @returns Promise resolving to the updated Role entity
   * @throws NotFoundException if the role is not found
   */
  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);
    Object.assign(role, dto);
    return this.roleRepo.save(role);
  }

  /**
   * Removes a role from the system
   *
   * @param id - The unique identifier of the role to remove
   * @returns Promise that resolves when the role is successfully removed
   * @throws NotFoundException if the role is not found
   */
  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    this.logger.log(`Removing role "${role.name}" (${id})`);
    await this.roleRepo.remove(role);
  }

  /**
   * Find all roles for a specific organization
   * Results are ordered alphabetically by name
   *
   * @param organizationId - The unique identifier of the organization
   * @returns Promise resolving to an array of Role entities for the specified organization
   */
  async findByOrganization(organizationId: string): Promise<Role[]> {
    return this.roleRepo.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
  }

  /**
   * Find all roles available for temporary hollons
   * Filters roles by availableForTemporaryHollon flag
   * Results are ordered alphabetically by name
   *
   * @param organizationId - Optional organization ID to filter roles by organization
   * @returns Promise resolving to an array of Role entities available for temporary hollons
   */
  async findAvailableForTemporaryHollon(
    organizationId?: string,
  ): Promise<Role[]> {
    const where: any = { availableForTemporaryHollon: true };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.roleRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }
}
