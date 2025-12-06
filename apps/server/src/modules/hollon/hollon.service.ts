import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hollon, HollonStatus } from './entities/hollon.entity';
import { CreateHollonDto } from './dto/create-hollon.dto';
import { UpdateHollonDto } from './dto/update-hollon.dto';

@Injectable()
export class HollonService {
  constructor(
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
  ) {}

  async create(dto: CreateHollonDto): Promise<Hollon> {
    const hollon = this.hollonRepo.create(dto);
    return this.hollonRepo.save(hollon);
  }

  async findAll(filters?: {
    organizationId?: string;
    teamId?: string;
    status?: HollonStatus;
  }): Promise<Hollon[]> {
    const query = this.hollonRepo.createQueryBuilder('hollon');

    if (filters?.organizationId) {
      query.andWhere('hollon.organization_id = :orgId', {
        orgId: filters.organizationId,
      });
    }

    if (filters?.teamId) {
      query.andWhere('hollon.team_id = :teamId', { teamId: filters.teamId });
    }

    if (filters?.status) {
      query.andWhere('hollon.status = :status', { status: filters.status });
    }

    return query.orderBy('hollon.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<Hollon> {
    const hollon = await this.hollonRepo.findOne({
      where: { id },
      relations: ['organization', 'team', 'role'],
    });
    if (!hollon) {
      throw new NotFoundException(`Hollon #${id} not found`);
    }
    return hollon;
  }

  async findIdleHollons(organizationId: string): Promise<Hollon[]> {
    return this.hollonRepo.find({
      where: {
        organizationId,
        status: HollonStatus.IDLE,
      },
      relations: ['role'],
    });
  }

  async update(id: string, dto: UpdateHollonDto): Promise<Hollon> {
    const hollon = await this.findOne(id);
    Object.assign(hollon, dto);
    return this.hollonRepo.save(hollon);
  }

  async updateStatus(id: string, status: HollonStatus): Promise<Hollon> {
    const hollon = await this.findOne(id);
    hollon.status = status;
    if (status === HollonStatus.WORKING) {
      hollon.lastActiveAt = new Date();
    }
    return this.hollonRepo.save(hollon);
  }

  async remove(id: string): Promise<void> {
    const hollon = await this.findOne(id);
    await this.hollonRepo.remove(hollon);
  }
}
