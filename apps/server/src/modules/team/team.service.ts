import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './entities/team.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Hollon } from '../hollon/entities/hollon.entity';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
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

    // Phase 3.5: leaderHollonId 변경 시 자동으로 managerId 동기화
    const leaderChanged =
      dto.leaderHollonId && dto.leaderHollonId !== team.leaderHollonId;

    Object.assign(team, dto);
    const updated = await this.teamRepo.save(team);

    // 팀 리더가 변경되면 해당 팀의 모든 홀론 managerId 동기화
    if (leaderChanged) {
      await this.syncManagerReferences(updated.id);
    }

    return updated;
  }

  /**
   * Phase 3.5: Team 변경 시 자동 managerId 동기화
   *
   * Team.leaderHollonId가 변경되면 해당 팀의 모든 Hollon.managerId를 업데이트
   */
  private async syncManagerReferences(teamId: string): Promise<void> {
    const team = await this.teamRepo.findOne({
      where: { id: teamId },
    });

    if (!team) {
      this.logger.warn(`Team ${teamId} not found for managerId sync`);
      return;
    }

    if (!team.leaderHollonId) {
      this.logger.debug(`Team ${teamId} has no leader, skipping sync`);
      return;
    }

    // 해당 팀의 모든 홀론 업데이트 (리더 본인 제외)
    const result = await this.hollonRepo
      .createQueryBuilder()
      .update(Hollon)
      .set({ managerId: team.leaderHollonId })
      .where('team_id = :teamId', { teamId })
      .andWhere('id != :leaderId', { leaderId: team.leaderHollonId })
      .execute();

    this.logger.log(
      `✅ Synced managerId for ${result.affected || 0} hollons in team ${teamId}`,
    );
  }

  async remove(id: string): Promise<void> {
    const team = await this.findOne(id);
    await this.teamRepo.remove(team);
  }
}
