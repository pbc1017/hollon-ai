import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './entities/team.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
  ) {}

  async create(dto: CreateTeamDto): Promise<Team> {
    const team = this.teamRepo.create(dto);
    return this.teamRepo.save(team);
  }

  async findAll(organizationId?: string): Promise<Team[]> {
    const query = this.teamRepo.createQueryBuilder('team');

    if (organizationId) {
      query.where('team.organization_id = :organizationId', { organizationId });
    }

    return query.orderBy('team.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<Team> {
    const team = await this.teamRepo.findOne({
      where: { id },
      relations: ['organization', 'hollons'],
    });
    if (!team) {
      throw new NotFoundException(`Team #${id} not found`);
    }
    return team;
  }

  async update(id: string, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(id);
    Object.assign(team, dto);
    return this.teamRepo.save(team);
  }

  async remove(id: string): Promise<void> {
    const team = await this.findOne(id);
    await this.teamRepo.remove(team);
  }
}
