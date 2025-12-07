import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Hollon,
  HollonStatus,
  HollonLifecycle,
} from './entities/hollon.entity';
import { CreateHollonDto } from './dto/create-hollon.dto';
import { UpdateHollonDto } from './dto/update-hollon.dto';
import { CreateTemporaryHollonDto } from './dto/create-temporary-hollon.dto';
import { CreatePermanentHollonDto } from './dto/create-permanent-hollon.dto';
import { ApprovalService } from '../approval/approval.service';
import {
  ApprovalRequest,
  ApprovalRequestType,
} from '../approval/entities/approval-request.entity';

@Injectable()
export class HollonService {
  constructor(
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    private readonly approvalService: ApprovalService,
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

  /**
   * 임시 홀론 생성 (자율 가능)
   * ssot.md 6.2: 임시 홀론 생성/종료는 홀론이 자율적으로 수행
   */
  async createTemporary(config: CreateTemporaryHollonDto): Promise<Hollon> {
    // 임시 홀론만 자율 생성 가능
    const hollon = this.hollonRepo.create({
      name: config.name,
      organizationId: config.organizationId,
      teamId: config.teamId || null,
      roleId: config.roleId,
      brainProviderId: config.brainProviderId || 'claude_code',
      systemPrompt: config.systemPrompt || undefined,
      lifecycle: HollonLifecycle.TEMPORARY,
      createdByHollonId: config.createdBy || null,
      status: HollonStatus.IDLE,
    });
    return this.hollonRepo.save(hollon);
  }

  /**
   * 영구 홀론 생성 (인간 승인 필요)
   * ssot.md 6.2: 영구 홀론 생성/삭제는 인간 승인 필요
   */
  async createPermanent(
    config: CreatePermanentHollonDto,
  ): Promise<ApprovalRequest> {
    // 승인 요청 생성
    const approvalRequest = await this.approvalService.create({
      requestType: ApprovalRequestType.CREATE_PERMANENT_HOLLON,
      description: `영구 홀론 생성 요청: ${config.name} (Role: ${config.roleName})`,
      metadata: config,
      requestedBy: config.createdBy,
    });

    return approvalRequest;
  }

  /**
   * 영구 홀론 삭제 (인간 승인 필요)
   */
  async requestDeletePermanent(
    hollonId: string,
    requestedBy?: string,
  ): Promise<ApprovalRequest> {
    const hollon = await this.findOne(hollonId);

    if (hollon.lifecycle !== HollonLifecycle.PERMANENT) {
      throw new Error('Only permanent hollons require approval for deletion');
    }

    return this.approvalService.create({
      requestType: ApprovalRequestType.DELETE_PERMANENT_HOLLON,
      description: `영구 홀론 삭제 요청: ${hollon.name}`,
      metadata: { hollonId, hollon },
      requestedBy: requestedBy || undefined,
    });
  }

  /**
   * 임시 홀론 자동 삭제 (승인 불필요)
   */
  async deleteTemporary(hollonId: string): Promise<void> {
    const hollon = await this.findOne(hollonId);

    if (hollon.lifecycle !== HollonLifecycle.TEMPORARY) {
      throw new Error('Only temporary hollons can be deleted without approval');
    }

    await this.hollonRepo.remove(hollon);
  }
}
