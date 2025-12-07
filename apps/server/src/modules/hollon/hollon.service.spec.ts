import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { NotFoundException } from '@nestjs/common';

describe('HollonService', () => {
  let service: HollonService;
  let _repository: Repository<Hollon>;
  let _approvalService: ApprovalService;

  const mockHollonRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockApprovalService = {
    create: jest.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HollonService,
        {
          provide: getRepositoryToken(Hollon),
          useValue: mockHollonRepository,
        },
        {
          provide: ApprovalService,
          useValue: mockApprovalService,
        },
      ],
    }).compile();

    service = module.get<HollonService>(HollonService);
    _repository = module.get<Repository<Hollon>>(getRepositoryToken(Hollon));
    _approvalService = module.get<ApprovalService>(ApprovalService);

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
        status: HollonStatus.IDLE,
      };

      mockHollonRepository.create.mockReturnValue(tempHollon);
      mockHollonRepository.save.mockResolvedValue({
        id: 'temp-hollon-id',
        ...tempHollon,
      });

      const result = await service.createTemporary(config);

      expect(result.lifecycle).toBe(HollonLifecycle.TEMPORARY);
      expect(result.createdByHollonId).toBe('hollon-parent');
      expect(mockApprovalService.create).not.toHaveBeenCalled();
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
