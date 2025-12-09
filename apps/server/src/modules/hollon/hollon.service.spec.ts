import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HollonService } from './hollon.service';
import {
  Hollon,
  HollonStatus,
  HollonLifecycle,
} from './entities/hollon.entity';
import { ApprovalService } from '../approval/approval.service';
import {
  ApprovalRequest,
  ApprovalRequestType,
  ApprovalStatus,
} from '../approval/entities/approval-request.entity';
import { RoleService } from '../role/role.service';
import { TeamService } from '../team/team.service';
import { OrganizationService } from '../organization/organization.service';
import { Team } from '../team/entities/team.entity';
import { Role } from '../role/entities/role.entity';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

describe('HollonService', () => {
  let service: HollonService;

  const mockHollonRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockApprovalService = {
    create: jest.fn(),
  };

  const mockRoleService = {
    findOne: jest.fn(),
  };

  const mockTeamService = {
    findOne: jest.fn(),
  };

  const mockOrganizationService = {
    findOne: jest.fn(),
  };

  const mockHollon: Partial<Hollon> = {
    id: 'hollon-123',
    name: 'Test Hollon',
    organizationId: 'org-123',
    teamId: 'team-123',
    roleId: 'role-123',
    brainProviderId: 'claude_code',
    status: HollonStatus.IDLE,
    lifecycle: HollonLifecycle.PERMANENT,
    maxConcurrentTasks: 1,
  };

  const mockRole = {
    id: 'role-123',
    name: 'Test Role',
  };

  const mockTeam = {
    id: 'team-123',
    name: 'Test Team',
    organizationId: 'org-123',
  };

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    settings: { maxHollonsPerTeam: 10 },
  };

  const mockTeamRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockRoleRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HollonService,
        {
          provide: getRepositoryToken(Hollon),
          useValue: mockHollonRepository,
        },
        {
          provide: getRepositoryToken(Team),
          useValue: mockTeamRepository,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
        {
          provide: ApprovalService,
          useValue: mockApprovalService,
        },
        {
          provide: RoleService,
          useValue: mockRoleService,
        },
        {
          provide: TeamService,
          useValue: mockTeamService,
        },
        {
          provide: OrganizationService,
          useValue: mockOrganizationService,
        },
      ],
    }).compile();

    service = module.get<HollonService>(HollonService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a hollon', async () => {
      const createDto = {
        name: 'New Hollon',
        organizationId: 'org-123',
        teamId: 'team-123',
        roleId: 'role-123',
        brainProviderId: 'claude_code',
      };

      mockHollonRepository.create.mockReturnValue(createDto);
      mockHollonRepository.save.mockResolvedValue({
        id: 'new-hollon-id',
        ...createDto,
      });

      const result = await service.create(createDto);

      expect(mockHollonRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockHollonRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'new-hollon-id');
    });
  });

  describe('findOne', () => {
    it('should return a hollon if found', async () => {
      mockHollonRepository.findOne.mockResolvedValue(mockHollon);

      const result = await service.findOne('hollon-123');

      expect(mockHollonRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'hollon-123' },
        relations: ['organization', 'team', 'role'],
      });
      expect(result).toEqual(mockHollon);
    });

    it('should throw NotFoundException if hollon not found', async () => {
      mockHollonRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent')).rejects.toThrow(
        'Hollon #non-existent not found',
      );
    });
  });

  describe('findIdleHollons', () => {
    it('should return idle hollons for an organization', async () => {
      const idleHollons = [
        { ...mockHollon, status: HollonStatus.IDLE },
        {
          ...mockHollon,
          id: 'hollon-456',
          name: 'Another Hollon',
          status: HollonStatus.IDLE,
        },
      ];
      mockHollonRepository.find.mockResolvedValue(idleHollons);

      const result = await service.findIdleHollons('org-123');

      expect(mockHollonRepository.find).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-123',
          status: HollonStatus.IDLE,
        },
        relations: ['role'],
      });
      expect(result).toHaveLength(2);
      expect(result.every((h) => h.status === HollonStatus.IDLE)).toBe(true);
    });
  });

  describe('updateStatus', () => {
    it('should update hollon status to WORKING and set lastActiveAt', async () => {
      const hollon = { ...mockHollon };
      mockHollonRepository.findOne.mockResolvedValue(hollon);
      mockHollonRepository.save.mockResolvedValue({
        ...hollon,
        status: HollonStatus.WORKING,
        lastActiveAt: expect.any(Date),
      });

      const result = await service.updateStatus(
        'hollon-123',
        HollonStatus.WORKING,
      );

      expect(result.status).toBe(HollonStatus.WORKING);
      expect(result.lastActiveAt).toBeDefined();
    });

    it('should update status without changing lastActiveAt for non-WORKING status', async () => {
      const hollon = { ...mockHollon };
      mockHollonRepository.findOne.mockResolvedValue(hollon);
      mockHollonRepository.save.mockResolvedValue({
        ...hollon,
        status: HollonStatus.PAUSED,
      });

      const result = await service.updateStatus(
        'hollon-123',
        HollonStatus.PAUSED,
      );

      expect(result.status).toBe(HollonStatus.PAUSED);
    });
  });

  describe('createTemporary', () => {
    it('should create a temporary hollon without approval', async () => {
      const config = {
        name: 'Temp Hollon',
        organizationId: 'org-123',
        teamId: 'team-123',
        roleId: 'role-123',
        brainProviderId: 'claude_code',
        createdBy: 'hollon-parent',
      };

      const tempHollon = {
        ...config,
        lifecycle: HollonLifecycle.TEMPORARY,
        createdByHollonId: 'hollon-parent',
        depth: 1,
        status: HollonStatus.IDLE,
      };

      mockRoleService.findOne.mockResolvedValue(mockRole);
      mockOrganizationService.findOne.mockResolvedValue(mockOrganization);
      mockTeamService.findOne.mockResolvedValue(mockTeam);
      mockHollonRepository.count.mockResolvedValue(5);
      mockHollonRepository.findOne.mockResolvedValue({
        id: 'hollon-parent',
        organizationId: 'org-123',
        lifecycle: HollonLifecycle.TEMPORARY,
        status: HollonStatus.WORKING,
        depth: 0,
      });
      mockHollonRepository.create.mockReturnValue(tempHollon);
      mockHollonRepository.save.mockResolvedValue({
        id: 'temp-hollon-id',
        ...tempHollon,
      });

      const result = await service.createTemporary(config);

      expect(mockRoleService.findOne).toHaveBeenCalledWith('role-123');
      expect(mockOrganizationService.findOne).toHaveBeenCalledWith('org-123');
      expect(mockTeamService.findOne).toHaveBeenCalledWith('team-123');
      expect(result.lifecycle).toBe(HollonLifecycle.TEMPORARY);
      expect(result.createdByHollonId).toBe('hollon-parent');
      expect(result.depth).toBe(1);
      expect(mockApprovalService.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if role does not exist', async () => {
      const config = {
        name: 'Temp Hollon',
        organizationId: 'org-123',
        roleId: 'non-existent-role',
      };

      mockRoleService.findOne.mockRejectedValue(
        new NotFoundException('Role #non-existent-role not found'),
      );

      await expect(service.createTemporary(config)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if team belongs to different organization', async () => {
      const config = {
        name: 'Temp Hollon',
        organizationId: 'org-123',
        teamId: 'team-456',
        roleId: 'role-123',
      };

      mockRoleService.findOne.mockResolvedValue(mockRole);
      mockOrganizationService.findOne.mockResolvedValue(mockOrganization);
      mockTeamService.findOne.mockResolvedValue({
        id: 'team-456',
        organizationId: 'org-different', // 다른 조직
      });

      await expect(service.createTemporary(config)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.createTemporary(config)).rejects.toThrow(
        'Team does not belong to the specified organization',
      );
    });

    it('should throw BadRequestException if team has reached maximum hollon limit', async () => {
      const config = {
        name: 'Temp Hollon',
        organizationId: 'org-123',
        teamId: 'team-123',
        roleId: 'role-123',
      };

      mockRoleService.findOne.mockResolvedValue(mockRole);
      mockOrganizationService.findOne.mockResolvedValue(mockOrganization);
      mockTeamService.findOne.mockResolvedValue(mockTeam);
      mockHollonRepository.count.mockResolvedValue(10); // 이미 10개 (최대치 도달)

      await expect(service.createTemporary(config)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createTemporary(config)).rejects.toThrow(
        'Team has reached maximum hollon limit (10). Cannot create more hollons.',
      );
    });

    it('should throw error if max temporary hollon depth exceeded', async () => {
      const config = {
        name: 'Too Deep Hollon',
        organizationId: 'org-123',
        teamId: 'team-123',
        roleId: 'role-123',
        brainProviderId: 'claude_code',
        createdBy: 'hollon-parent',
      };

      mockRoleService.findOne.mockResolvedValue(mockRole);
      mockOrganizationService.findOne.mockResolvedValue(mockOrganization);
      mockTeamService.findOne.mockResolvedValue(mockTeam);
      mockHollonRepository.count.mockResolvedValue(5);
      mockHollonRepository.findOne.mockResolvedValue({
        id: 'hollon-parent',
        organizationId: 'org-123',
        lifecycle: HollonLifecycle.TEMPORARY,
        status: HollonStatus.WORKING,
        depth: 3,
      });

      await expect(service.createTemporary(config)).rejects.toThrow(
        'Maximum temporary hollon depth (3) exceeded',
      );
    });

    it('should allow permanent hollon to create temporary hollon at depth 0', async () => {
      const config = {
        name: 'Temp from Permanent',
        organizationId: 'org-123',
        teamId: 'team-123',
        roleId: 'role-123',
        brainProviderId: 'claude_code',
        createdBy: 'permanent-hollon',
      };

      const tempHollon = {
        ...config,
        lifecycle: HollonLifecycle.TEMPORARY,
        createdByHollonId: 'permanent-hollon',
        depth: 0,
        status: HollonStatus.IDLE,
      };

      mockRoleService.findOne.mockResolvedValue(mockRole);
      mockOrganizationService.findOne.mockResolvedValue(mockOrganization);
      mockTeamService.findOne.mockResolvedValue(mockTeam);
      mockHollonRepository.count.mockResolvedValue(5);
      mockHollonRepository.findOne.mockResolvedValue({
        id: 'permanent-hollon',
        organizationId: 'org-123',
        lifecycle: HollonLifecycle.PERMANENT,
        status: HollonStatus.IDLE,
        depth: 5, // 영구 홀론의 depth는 제한 없음
      });
      mockHollonRepository.create.mockReturnValue(tempHollon);
      mockHollonRepository.save.mockResolvedValue({
        id: 'temp-hollon-id',
        ...tempHollon,
      });

      const result = await service.createTemporary(config);

      expect(result.depth).toBe(0); // 영구 홀론이 만든 임시 홀론은 depth 0
      expect(result.lifecycle).toBe(HollonLifecycle.TEMPORARY);
    });

    it('should throw ForbiddenException if creator hollon is from different organization', async () => {
      const config = {
        name: 'Temp Hollon',
        organizationId: 'org-123',
        roleId: 'role-123',
        createdBy: 'hollon-from-other-org',
      };

      mockRoleService.findOne.mockResolvedValue(mockRole);
      mockOrganizationService.findOne.mockResolvedValue(mockOrganization);
      mockHollonRepository.findOne.mockResolvedValue({
        id: 'hollon-from-other-org',
        organizationId: 'org-different', // 다른 조직
        status: HollonStatus.IDLE,
      });

      await expect(service.createTemporary(config)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.createTemporary(config)).rejects.toThrow(
        'Cannot create hollon in a different organization',
      );
    });

    it('should throw BadRequestException if creator hollon is not in active status', async () => {
      const config = {
        name: 'Temp Hollon',
        organizationId: 'org-123',
        roleId: 'role-123',
        createdBy: 'paused-hollon',
      };

      mockRoleService.findOne.mockResolvedValue(mockRole);
      mockOrganizationService.findOne.mockResolvedValue(mockOrganization);
      mockHollonRepository.findOne.mockResolvedValue({
        id: 'paused-hollon',
        organizationId: 'org-123',
        status: HollonStatus.PAUSED, // 비활성 상태
      });

      await expect(service.createTemporary(config)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createTemporary(config)).rejects.toThrow(
        'Creator hollon must be in IDLE or WORKING status, current: paused',
      );
    });
  });

  describe('createPermanent', () => {
    it('should create approval request for permanent hollon', async () => {
      const config = {
        name: 'Permanent Hollon',
        organizationId: 'org-123',
        roleName: 'Backend Engineer',
        roleId: 'role-123',
        teamId: 'team-123',
        brainProviderId: 'claude_code',
        createdBy: 'hollon-123',
      };

      const mockApprovalRequest: Partial<ApprovalRequest> = {
        id: 'approval-123',
        requestType: ApprovalRequestType.CREATE_PERMANENT_HOLLON,
        description: `영구 홀론 생성 요청: ${config.name} (Role: ${config.roleName})`,
        metadata: config,
        requestedBy: config.createdBy,
        status: ApprovalStatus.PENDING,
      };

      mockApprovalService.create.mockResolvedValue(mockApprovalRequest);

      const result = await service.createPermanent(config);

      expect(mockApprovalService.create).toHaveBeenCalledWith({
        requestType: ApprovalRequestType.CREATE_PERMANENT_HOLLON,
        description: `영구 홀론 생성 요청: ${config.name} (Role: ${config.roleName})`,
        metadata: config,
        requestedBy: config.createdBy,
      });
      expect(result).toEqual(mockApprovalRequest);
      expect(mockHollonRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('requestDeletePermanent', () => {
    it('should create approval request for deleting permanent hollon', async () => {
      const hollon = {
        ...mockHollon,
        lifecycle: HollonLifecycle.PERMANENT,
      };

      mockHollonRepository.findOne.mockResolvedValue(hollon);

      const mockApprovalRequest: Partial<ApprovalRequest> = {
        id: 'approval-456',
        requestType: ApprovalRequestType.DELETE_PERMANENT_HOLLON,
        description: `영구 홀론 삭제 요청: ${hollon.name}`,
        status: ApprovalStatus.PENDING,
      };

      mockApprovalService.create.mockResolvedValue(mockApprovalRequest);

      const result = await service.requestDeletePermanent(
        'hollon-123',
        'user-123',
      );

      expect(mockApprovalService.create).toHaveBeenCalled();
      expect(result.requestType).toBe(
        ApprovalRequestType.DELETE_PERMANENT_HOLLON,
      );
      expect(mockHollonRepository.remove).not.toHaveBeenCalled();
    });

    it('should throw error when trying to request deletion approval for non-permanent hollon', async () => {
      const hollon = {
        ...mockHollon,
        lifecycle: HollonLifecycle.TEMPORARY,
      };

      mockHollonRepository.findOne.mockResolvedValue(hollon);

      await expect(
        service.requestDeletePermanent('hollon-123'),
      ).rejects.toThrow('Only permanent hollons require approval for deletion');
    });
  });

  describe('remove', () => {
    it('should remove a hollon', async () => {
      mockHollonRepository.findOne.mockResolvedValue(mockHollon);
      mockHollonRepository.remove.mockResolvedValue(mockHollon);

      await service.remove('hollon-123');

      expect(mockHollonRepository.findOne).toHaveBeenCalled();
      expect(mockHollonRepository.remove).toHaveBeenCalledWith(mockHollon);
    });

    it('should throw NotFoundException if hollon to remove not found', async () => {
      mockHollonRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
