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

  async findAll(): Promise<Role[]> {
    return this.roleRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Role #${id} not found`);
    }
    return role;
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);
    Object.assign(role, dto);
    return this.roleRepo.save(role);
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    this.logger.log(`Removing role "${role.name}" (${id})`);
    await this.roleRepo.remove(role);
  }

  /**
   * Find all roles for a specific organization
   */
  async findByOrganization(organizationId: string): Promise<Role[]> {
    return this.roleRepo.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
  }

  /**
   * Find all roles available for temporary hollons
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
