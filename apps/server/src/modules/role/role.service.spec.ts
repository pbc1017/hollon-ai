import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { RoleService } from './role.service';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

describe('RoleService', () => {
  let service: RoleService;

  const mockRoleRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };

  const mockRole: Partial<Role> = {
    id: 'role-123',
    name: 'Developer',
    description: 'Software developer role',
    capabilities: ['code', 'review'],
    systemPrompt: 'You are a software developer',
    availableForTemporaryHollon: false,
    organizationId: 'org-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateRoleDto = {
      name: 'Developer',
      description: 'Software developer role',
      capabilities: ['code', 'review'],
      systemPrompt: 'You are a software developer',
      organizationId: 'org-123',
    };

    it('should create a new role', async () => {
      mockRoleRepository.findOne.mockResolvedValue(null);
      mockRoleRepository.create.mockReturnValue(mockRole);
      mockRoleRepository.save.mockResolvedValue(mockRole);

      const result = await service.create(createDto);

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: createDto.name,
          organizationId: createDto.organizationId,
        },
      });
      expect(mockRoleRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRoleRepository.save).toHaveBeenCalledWith(mockRole);
      expect(result).toEqual(mockRole);
    });

    it('should throw ConflictException if role name already exists in organization', async () => {
      mockRoleRepository.findOne.mockResolvedValue(mockRole);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        `Role with name "${createDto.name}" already exists in this organization`,
      );
      expect(mockRoleRepository.create).not.toHaveBeenCalled();
      expect(mockRoleRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return an array of roles', async () => {
      const roles = [mockRole];
      mockRoleRepository.find.mockResolvedValue(roles);

      const result = await service.findAll();

      expect(mockRoleRepository.find).toHaveBeenCalledWith({
        order: { name: 'ASC' },
      });
      expect(result).toEqual(roles);
    });
  });

  describe('findOne', () => {
    it('should return a role', async () => {
      mockRoleRepository.findOne.mockResolvedValue(mockRole);

      const result = await service.findOne('role-123');

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'role-123' },
      });
      expect(result).toEqual(mockRole);
    });

    it('should throw NotFoundException if role not found', async () => {
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        'Role #invalid-id not found',
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateRoleDto = {
      description: 'Updated description',
    };

    it('should update a role', async () => {
      const updatedRole = { ...mockRole, ...updateDto };
      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      mockRoleRepository.save.mockResolvedValue(updatedRole);

      const result = await service.update('role-123', updateDto);

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'role-123' },
      });
      expect(mockRoleRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedRole);
    });

    it('should throw NotFoundException if role not found', async () => {
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(service.update('invalid-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a role', async () => {
      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      mockRoleRepository.remove.mockResolvedValue(mockRole);

      await service.remove('role-123');

      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'role-123' },
      });
      expect(mockRoleRepository.remove).toHaveBeenCalledWith(mockRole);
    });

    it('should throw NotFoundException if role not found', async () => {
      mockRoleRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRoleRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('findByOrganization', () => {
    it('should return roles for a specific organization', async () => {
      const roles = [mockRole];
      mockRoleRepository.find.mockResolvedValue(roles);

      const result = await service.findByOrganization('org-123');

      expect(mockRoleRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        order: { name: 'ASC' },
      });
      expect(result).toEqual(roles);
    });

    it('should return empty array if no roles found', async () => {
      mockRoleRepository.find.mockResolvedValue([]);

      const result = await service.findByOrganization('org-456');

      expect(result).toEqual([]);
    });
  });

  describe('findAvailableForTemporaryHollon', () => {
    const tempRole = {
      ...mockRole,
      availableForTemporaryHollon: true,
    };

    it('should return roles available for temporary hollons', async () => {
      const roles = [tempRole];
      mockRoleRepository.find.mockResolvedValue(roles);

      const result = await service.findAvailableForTemporaryHollon();

      expect(mockRoleRepository.find).toHaveBeenCalledWith({
        where: { availableForTemporaryHollon: true },
        order: { name: 'ASC' },
      });
      expect(result).toEqual(roles);
    });

    it('should filter by organization when organizationId is provided', async () => {
      const roles = [tempRole];
      mockRoleRepository.find.mockResolvedValue(roles);

      const result = await service.findAvailableForTemporaryHollon('org-123');

      expect(mockRoleRepository.find).toHaveBeenCalledWith({
        where: {
          availableForTemporaryHollon: true,
          organizationId: 'org-123',
        },
        order: { name: 'ASC' },
      });
      expect(result).toEqual(roles);
    });

    it('should return empty array if no available roles found', async () => {
      mockRoleRepository.find.mockResolvedValue([]);

      const result = await service.findAvailableForTemporaryHollon();

      expect(result).toEqual([]);
    });
  });
});
