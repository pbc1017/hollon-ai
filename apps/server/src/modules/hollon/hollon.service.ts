import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Hollon,
  HollonStatus,
  HollonLifecycle,
  ExperienceLevel,
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
import { RoleService } from '../role/role.service';
import { TeamService } from '../team/team.service';
import { OrganizationService } from '../organization/organization.service';
import { Team } from '../team/entities/team.entity';
import { Role } from '../role/entities/role.entity';

@Injectable()
export class HollonService {
  private readonly logger = new Logger(HollonService.name);

  constructor(
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly approvalService: ApprovalService,
    private readonly roleService: RoleService,
    private readonly teamService: TeamService,
    private readonly organizationService: OrganizationService,
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
   * Phase 3.7: 최대 1단계 깊이까지만 임시 홀론 생성 가능 (depth=1 제약)
   */
  async createTemporary(config: CreateTemporaryHollonDto): Promise<Hollon> {
    const MAX_TEMPORARY_HOLLON_DEPTH = 1; // Phase 3.7: depth=1 제약

    let depth = 0;

    // 권한 검증 1: Role 존재 확인
    await this.roleService.findOne(config.roleId);

    // 권한 검증 2: Organization 존재 및 설정 확인
    const organization = await this.organizationService.findOne(
      config.organizationId,
    );

    // 권한 검증 3: Team 존재 및 조직 일치 확인 (teamId가 있을 경우)
    if (config.teamId) {
      const team = await this.teamService.findOne(config.teamId);

      if (team.organizationId !== config.organizationId) {
        throw new ForbiddenException(
          'Team does not belong to the specified organization',
        );
      }

      // 권한 검증 4: 팀당 최대 홀론 수 검증
      const maxHollonsPerTeam =
        (organization.settings as { maxHollonsPerTeam?: number })
          ?.maxHollonsPerTeam || 10;

      const currentTeamHollonCount = await this.hollonRepo.count({
        where: { teamId: config.teamId },
      });

      if (currentTeamHollonCount >= maxHollonsPerTeam) {
        throw new BadRequestException(
          `Team has reached maximum hollon limit (${maxHollonsPerTeam}). Cannot create more hollons.`,
        );
      }
    }

    // 부모 홀론이 있으면 권한 검증 및 깊이 계산
    if (config.createdBy) {
      const parentHollon = await this.hollonRepo.findOne({
        where: { id: config.createdBy },
      });

      // 권한 검증 5: 생성자 홀론 존재 확인
      if (!parentHollon) {
        throw new NotFoundException(
          `Creator hollon #${config.createdBy} not found`,
        );
      }

      // 권한 검증 6: 생성자 홀론의 조직 일치 확인
      if (parentHollon.organizationId !== config.organizationId) {
        throw new ForbiddenException(
          'Cannot create hollon in a different organization',
        );
      }

      // 권한 검증 7: 생성자 홀론 상태 확인 (활성 상태만 생성 가능)
      if (
        parentHollon.status !== HollonStatus.IDLE &&
        parentHollon.status !== HollonStatus.WORKING
      ) {
        throw new BadRequestException(
          `Creator hollon must be in IDLE or WORKING status, current: ${parentHollon.status}`,
        );
      }

      // 안전장치: 최대 깊이 체크 (임시 홀론만)
      if (parentHollon.lifecycle === HollonLifecycle.TEMPORARY) {
        if (parentHollon.depth >= MAX_TEMPORARY_HOLLON_DEPTH) {
          throw new BadRequestException(
            `Maximum temporary hollon depth (${MAX_TEMPORARY_HOLLON_DEPTH}) exceeded`,
          );
        }
        depth = parentHollon.depth + 1;
      }
      // 영구 홀론이 만든 임시 홀론은 depth 0부터 시작
    }

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
      depth,
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

  // ========================================
  // Phase 3.5: 계층적 조직 구조 메서드
  // ========================================

  /**
   * Phase 3.5: managerId로 매니저 조회
   * 이유: stored 방식으로 성능 최적화 (읽기 >> 쓰기)
   */
  async getManager(hollonId: string): Promise<Hollon | null> {
    const hollon = await this.hollonRepo.findOne({
      where: { id: hollonId },
      relations: ['manager'], // 단순 JOIN (computed 대비 3배 빠름)
    });

    return hollon?.manager || null;
  }

  /**
   * Phase 3.5: 팀 구조 변경 시 managerId 동기화
   * 호출 시점: Team.leaderHollonId 변경, Hollon.teamId 변경
   */
  async syncManagerReferences(teamId: string): Promise<void> {
    const team = await this.teamRepo.findOne({
      where: { id: teamId },
      relations: ['hollons', 'leader', 'parentTeam', 'parentTeam.leader'],
    });

    if (!team) {
      this.logger.warn(`Team ${teamId} not found for manager sync`);
      return;
    }

    for (const hollon of team.hollons) {
      // 팀 리더인 경우 → 상위 팀 리더가 매니저
      if (hollon.id === team.leaderHollonId) {
        hollon.managerId = team.parentTeam?.leaderHollonId || null;
      } else {
        // 팀원인 경우 → 현재 팀 리더가 매니저
        hollon.managerId = team.leaderHollonId;
      }
    }

    await this.hollonRepo.save(team.hollons);
    this.logger.log(`✅ Manager references synced for team: ${team.name}`);
  }

  /**
   * Phase 3.5: 팀 내 홀론의 역할을 동적으로 변경
   * SSOT 원칙: 홀론은 교체 가능한 워커, 역할 전환 가능
   *
   * 사용 예시:
   * - 백엔드 개발자 → 프론트엔드 개발자 (필요 시)
   * - 주니어 개발자 → QA 엔지니어 (일시적)
   * - 개발자 → 리뷰어 (코드 리뷰 시)
   */
  async reassignRole(
    hollonId: string,
    newRoleId: string,
    reason?: string,
  ): Promise<Hollon> {
    const hollon = await this.hollonRepo.findOne({
      where: { id: hollonId },
      relations: ['role', 'team'],
    });

    if (!hollon) {
      throw new NotFoundException(`Hollon ${hollonId} not found`);
    }

    const newRole = await this.roleRepo.findOne({
      where: { id: newRoleId },
    });

    if (!newRole) {
      throw new NotFoundException(`Role ${newRoleId} not found`);
    }

    const oldRoleName = hollon.role.name;

    // 역할 변경
    hollon.roleId = newRoleId;

    // 경험 레벨 초기화 (새 역할에서는 초보자)
    hollon.experienceLevel = ExperienceLevel.JUNIOR;

    await this.hollonRepo.save(hollon);

    this.logger.log(
      `🔄 Role reassignment: ${hollon.name} ` +
        `(${oldRoleName} → ${newRole.name}) ${reason ? `- ${reason}` : ''}`,
    );

    return hollon;
  }

  /**
   * Phase 3.5: 특정 Role을 수행할 임시 홀론 스폰
   * SSOT 원칙: 임시 홀론 생성은 자율적 (Phase 1 정의)
   *
   * 사용 예시:
   * - Security Reviewer 홀론 (코드 리뷰 전용)
   * - Performance Tester 홀론 (부하 테스트 전용)
   * - Migration Specialist 홀론 (DB 마이그레이션 전용)
   */
  async spawnTemporaryHollonForRole(
    roleId: string,
    teamId: string,
    reason: string,
    createdBy?: string,
  ): Promise<Hollon> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    const team = await this.teamRepo.findOne({ where: { id: teamId } });

    if (!role || !team) {
      throw new NotFoundException('Role or Team not found');
    }

    // 임시 홀론 생성
    const tempHollon = this.hollonRepo.create({
      name: `${role.name}-temp-${Date.now()}`,
      roleId: role.id,
      teamId: team.id,
      organizationId: team.organizationId,
      lifecycle: HollonLifecycle.TEMPORARY,
      status: HollonStatus.IDLE,
      experienceLevel: ExperienceLevel.MID, // 임시는 중급으로 시작
      managerId: team.leaderHollonId, // 팀 리더가 매니저
      createdByHollonId: createdBy || null,
    });

    await this.hollonRepo.save(tempHollon);

    this.logger.log(
      `🐣 Temporary hollon spawned: ${tempHollon.name} ` +
        `(Role: ${role.name}, Reason: ${reason})`,
    );

    return tempHollon;
  }

  /**
   * Phase 3.5: 임시 홀론 종료 (태스크 완료 시)
   */
  async terminateTemporaryHollon(hollonId: string): Promise<void> {
    const hollon = await this.hollonRepo.findOne({
      where: { id: hollonId, lifecycle: HollonLifecycle.TEMPORARY },
    });

    if (!hollon) {
      this.logger.warn(
        `Temporary hollon ${hollonId} not found or not temporary`,
      );
      return;
    }

    await this.hollonRepo.softRemove(hollon);

    this.logger.log(`💀 Temporary hollon terminated: ${hollon.name}`);
  }
}
