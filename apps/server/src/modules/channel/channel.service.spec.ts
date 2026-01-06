import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChannelService } from './channel.service';
import { Channel, ChannelType } from './entities/channel.entity';
import {
  ChannelMembership,
  ChannelRole,
} from './entities/channel-membership.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { ParticipantType } from '../message/entities/message.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ChannelService', () => {
  let service: ChannelService;

  const mockChannelRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockMembershipRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  const mockMessageRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelService,
        {
          provide: getRepositoryToken(Channel),
          useValue: mockChannelRepo,
        },
        {
          provide: getRepositoryToken(ChannelMembership),
          useValue: mockMembershipRepo,
        },
        {
          provide: getRepositoryToken(ChannelMessage),
          useValue: mockMessageRepo,
        },
      ],
    }).compile();

    service = module.get<ChannelService>(ChannelService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a public channel', async () => {
      const dto = {
        organizationId: 'org-123',
        name: 'Test Channel',
        channelType: ChannelType.PUBLIC,
        createdByType: ParticipantType.HUMAN,
        createdById: 'user-123',
      };

      const mockChannel = {
        id: 'channel-123',
        ...dto,
        isGroup: false,
        maxMembers: null,
      };

      mockChannelRepo.create.mockReturnValue(mockChannel);
      mockChannelRepo.save.mockResolvedValue(mockChannel);
      mockMembershipRepo.create.mockReturnValue({});
      mockMembershipRepo.save.mockResolvedValue({});

      const result = await service.create(dto);

      expect(result).toEqual(mockChannel);
      expect(mockChannelRepo.create).toHaveBeenCalledWith({
        organizationId: dto.organizationId,
        teamId: null,
        name: dto.name,
        description: null,
        channelType: dto.channelType,
        createdByType: dto.createdByType,
        createdById: dto.createdById,
        isGroup: false,
        maxMembers: null,
      });
    });

    it('should create a group channel', async () => {
      const dto = {
        organizationId: 'org-123',
        name: 'Group Channel',
        channelType: ChannelType.GROUP,
        createdByType: ParticipantType.HUMAN,
        createdById: 'user-123',
        maxMembers: 10,
      };

      const mockChannel = {
        id: 'channel-123',
        ...dto,
        isGroup: true,
      };

      mockChannelRepo.create.mockReturnValue(mockChannel);
      mockChannelRepo.save.mockResolvedValue(mockChannel);
      mockMembershipRepo.create.mockReturnValue({});
      mockMembershipRepo.save.mockResolvedValue({});

      const result = await service.create(dto);

      expect(result).toEqual(mockChannel);
      expect(mockChannelRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isGroup: true,
          maxMembers: 10,
        }),
      );
    });
  });

  describe('createGroupChannel', () => {
    it('should create a group channel with members', async () => {
      const organizationId = 'org-123';
      const creatorType = ParticipantType.HUMAN;
      const creatorId = 'user-123';
      const name = 'Test Group';
      const members = [
        { type: ParticipantType.HUMAN, id: 'user-456' },
        { type: ParticipantType.HUMAN, id: 'user-789' },
      ];

      const mockChannel = {
        id: 'channel-123',
        organizationId,
        name,
        channelType: ChannelType.GROUP,
        isGroup: true,
        createdByType: creatorType,
        createdById: creatorId,
      };

      mockChannelRepo.create.mockReturnValue(mockChannel);
      mockChannelRepo.save.mockResolvedValue(mockChannel);
      mockMembershipRepo.create.mockReturnValue({});
      mockMembershipRepo.save.mockResolvedValue({});
      mockMembershipRepo.findOne.mockResolvedValue(null);

      const result = await service.createGroupChannel(
        organizationId,
        creatorType,
        creatorId,
        name,
        members,
      );

      expect(result).toEqual(mockChannel);
      expect(mockMembershipRepo.save).toHaveBeenCalledTimes(3); // Creator + 2 members
    });

    it('should throw error if member count exceeds max', async () => {
      const members = [
        { type: ParticipantType.HUMAN, id: 'user-1' },
        { type: ParticipantType.HUMAN, id: 'user-2' },
        { type: ParticipantType.HUMAN, id: 'user-3' },
      ];
      const maxMembers = 2;

      await expect(
        service.createGroupChannel(
          'org-123',
          ParticipantType.HUMAN,
          'user-123',
          'Test',
          members,
          undefined,
          maxMembers,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addMembers', () => {
    it('should add multiple members to a channel', async () => {
      const channelId = 'channel-123';
      const members = [
        { type: ParticipantType.HUMAN, id: 'user-1' },
        { type: ParticipantType.HUMAN, id: 'user-2' },
      ];

      const mockChannel = {
        id: channelId,
        isGroup: true,
        maxMembers: 10,
      };

      mockChannelRepo.findOne.mockResolvedValue(mockChannel);
      mockMembershipRepo.count.mockResolvedValue(2);
      mockMembershipRepo.findOne.mockResolvedValue(null);
      mockMembershipRepo.create.mockReturnValue({});
      mockMembershipRepo.save.mockResolvedValue({});

      const result = await service.addMembers(channelId, members);

      expect(result).toHaveLength(2);
      expect(mockMembershipRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should throw error if exceeding max members', async () => {
      const channelId = 'channel-123';
      const members = [
        { type: ParticipantType.HUMAN, id: 'user-1' },
        { type: ParticipantType.HUMAN, id: 'user-2' },
      ];

      const mockChannel = {
        id: channelId,
        isGroup: true,
        maxMembers: 5,
      };

      mockChannelRepo.findOne.mockResolvedValue(mockChannel);
      mockMembershipRepo.count.mockResolvedValue(4); // Already 4 members

      await expect(service.addMembers(channelId, members)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('isMember', () => {
    it('should return true if user is a member', async () => {
      mockMembershipRepo.findOne.mockResolvedValue({ id: 'membership-123' });

      const result = await service.isMember(
        'channel-123',
        ParticipantType.HUMAN,
        'user-123',
      );

      expect(result).toBe(true);
    });

    it('should return false if user is not a member', async () => {
      mockMembershipRepo.findOne.mockResolvedValue(null);

      const result = await service.isMember(
        'channel-123',
        ParticipantType.HUMAN,
        'user-123',
      );

      expect(result).toBe(false);
    });
  });

  describe('getMemberRole', () => {
    it('should return member role', async () => {
      mockMembershipRepo.findOne.mockResolvedValue({
        role: ChannelRole.ADMIN,
      });

      const result = await service.getMemberRole(
        'channel-123',
        ParticipantType.HUMAN,
        'user-123',
      );

      expect(result).toBe(ChannelRole.ADMIN);
    });

    it('should return null if not a member', async () => {
      mockMembershipRepo.findOne.mockResolvedValue(null);

      const result = await service.getMemberRole(
        'channel-123',
        ParticipantType.HUMAN,
        'user-123',
      );

      expect(result).toBeNull();
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const membership = {
        id: 'membership-123',
        role: ChannelRole.MEMBER,
      };

      mockMembershipRepo.findOne.mockResolvedValue(membership);
      mockMembershipRepo.save.mockResolvedValue({
        ...membership,
        role: ChannelRole.ADMIN,
      });

      const result = await service.updateMemberRole(
        'channel-123',
        ParticipantType.HUMAN,
        'user-123',
        ChannelRole.ADMIN,
      );

      expect(result.role).toBe(ChannelRole.ADMIN);
      expect(mockMembershipRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if membership not found', async () => {
      mockMembershipRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(
          'channel-123',
          ParticipantType.HUMAN,
          'user-123',
          ChannelRole.ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOrCreateDirectChannel', () => {
    it('should return existing direct channel', async () => {
      const user1Type = ParticipantType.HUMAN;
      const user1Id = 'user-1';
      const user2Type = ParticipantType.HUMAN;
      const user2Id = 'user-2';

      const existingChannel = {
        id: 'channel-123',
        channelType: ChannelType.DIRECT,
        channel: {
          id: 'channel-123',
          channelType: ChannelType.DIRECT,
        },
      };

      const members = [
        { memberType: user1Type, memberId: user1Id },
        { memberType: user2Type, memberId: user2Id },
      ];

      mockMembershipRepo.find.mockResolvedValue([existingChannel]);
      mockMembershipRepo.find.mockResolvedValueOnce([existingChannel]);
      // Mock getMembers call
      jest
        .spyOn(service, 'findUserChannels')
        .mockResolvedValue([existingChannel.channel as any]);
      jest.spyOn(service, 'getMembers').mockResolvedValue(members as any);

      const result = await service.findOrCreateDirectChannel(
        'org-123',
        user1Type,
        user1Id,
        user2Type,
        user2Id,
      );

      expect(result).toEqual(existingChannel.channel);
    });

    it('should create new direct channel if not exists', async () => {
      const user1Type = ParticipantType.HUMAN;
      const user1Id = 'user-1';
      const user2Type = ParticipantType.HUMAN;
      const user2Id = 'user-2';

      const newChannel = {
        id: 'channel-123',
        channelType: ChannelType.DIRECT,
        name: `DM-${user1Id.slice(0, 8)}-${user2Id.slice(0, 8)}`,
      };

      jest.spyOn(service, 'findUserChannels').mockResolvedValue([]);
      mockChannelRepo.create.mockReturnValue(newChannel);
      mockChannelRepo.save.mockResolvedValue(newChannel);
      mockMembershipRepo.create.mockReturnValue({});
      mockMembershipRepo.save.mockResolvedValue({});
      mockMembershipRepo.findOne.mockResolvedValue(null);

      const result = await service.findOrCreateDirectChannel(
        'org-123',
        user1Type,
        user1Id,
        user2Type,
        user2Id,
      );

      expect(result).toEqual(newChannel);
      expect(mockChannelRepo.save).toHaveBeenCalled();
      expect(mockMembershipRepo.save).toHaveBeenCalledTimes(2); // Both users
    });
  });

  describe('findUserChannels', () => {
    it('should return all channels user is a member of', async () => {
      const memberships = [
        { channel: { id: 'channel-1', name: 'Channel 1' } },
        { channel: { id: 'channel-2', name: 'Channel 2' } },
      ];

      // Clear previous mocks
      mockMembershipRepo.find.mockReset();
      mockMembershipRepo.find.mockResolvedValue(memberships);

      const result = await service.findUserChannels(
        ParticipantType.HUMAN,
        'user-123',
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(memberships[0].channel);
      expect(result[1]).toEqual(memberships[1].channel);
    });
  });
});
