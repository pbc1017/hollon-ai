import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UserService', () => {
  let service: UserService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phoneNumber: '1234567890',
    isActive: true,
    organizationId: '123e4567-e89b-12d3-a456-426614174001',
    organization: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createUserDto: CreateUserDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phoneNumber: '1234567890',
        isActive: true,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      });
      expect(mockRepository.create).toHaveBeenCalledWith(createUserDto);
      expect(mockRepository.save).toHaveBeenCalledWith(mockUser);
    });

    it('should throw ConflictException if email already exists', async () => {
      const createUserDto: CreateUserDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phoneNumber: '1234567890',
        isActive: true,
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
      };

      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      });
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const users = [mockUser];
      mockRepository.find.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toEqual(users);
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { lastName: 'ASC', firstName: 'ASC' },
        relations: ['organization'],
      });
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        relations: ['organization'],
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail(mockUser.email);

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockUser.email },
        relations: ['organization'],
      });
    });

    it('should return null if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByOrganization', () => {
    it('should return users by organization id', async () => {
      const users = [mockUser];
      mockRepository.find.mockResolvedValue(users);

      const result = await service.findByOrganization(mockUser.organizationId);

      expect(result).toEqual(users);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { organizationId: mockUser.organizationId },
        order: { lastName: 'ASC', firstName: 'ASC' },
        relations: ['organization'],
      });
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateUserDto: UpdateUserDto = {
        firstName: 'Jane',
      };

      const updatedUser = { ...mockUser, ...updateUserDto };

      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.save.mockResolvedValue(updatedUser);

      const result = await service.update(mockUser.id, updateUserDto);

      expect(result).toEqual(updatedUser);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(updateUserDto),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      const updateUserDto: UpdateUserDto = {
        firstName: 'Jane',
      };

      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', updateUserDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if updating to existing email', async () => {
      const updateUserDto: UpdateUserDto = {
        email: 'existing@example.com',
      };

      const anotherUser = { ...mockUser, id: 'another-id' };

      mockRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(anotherUser);

      await expect(service.update(mockUser.id, updateUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.remove.mockResolvedValue(mockUser);

      await service.remove(mockUser.id);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
