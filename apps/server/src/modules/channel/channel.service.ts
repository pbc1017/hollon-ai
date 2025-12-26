import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel, ChannelType } from './entities/channel.entity';
import {
  ChannelMembership,
  ChannelRole,
} from './entities/channel-membership.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { CreateChannelDto } from './dto/create-channel.dto';
import { SendChannelMessageDto } from './dto/channel-message.dto';
import { ParticipantType } from '../message/entities/message.entity';

@Injectable()
export class ChannelService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    @InjectRepository(ChannelMembership)
    private readonly membershipRepo: Repository<ChannelMembership>,
    @InjectRepository(ChannelMessage)
    private readonly channelMessageRepo: Repository<ChannelMessage>,
  ) {}

  /**
   * Create a new channel
   */
  async create(dto: CreateChannelDto): Promise<Channel> {
    const isGroup = dto.channelType === ChannelType.GROUP;

    const channel = this.channelRepo.create({
      organizationId: dto.organizationId,
      teamId: dto.teamId ?? null,
      name: dto.name,
      description: dto.description ?? null,
      channelType: dto.channelType,
      createdByType: dto.createdByType,
      createdById: dto.createdById ?? null,
      isGroup,
      maxMembers: dto.maxMembers ?? null,
    });

    const savedChannel = await this.channelRepo.save(channel);

    // Add creator as owner
    if (dto.createdById) {
      await this.addMember(
        savedChannel.id,
        dto.createdByType,
        dto.createdById,
        ChannelRole.OWNER,
      );
    }

    return savedChannel;
  }

  /**
   * Find channel by ID
   */
  async findOne(channelId: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({
      where: { id: channelId },
      relations: ['organization', 'team'],
    });

    if (!channel) {
      throw new NotFoundException(`Channel with ID ${channelId} not found`);
    }

    return channel;
  }

  /**
   * Find channels by organization
   */
  async findByOrganization(organizationId: string): Promise<Channel[]> {
    return this.channelRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find channels by team
   */
  async findByTeam(teamId: string): Promise<Channel[]> {
    return this.channelRepo.find({
      where: { teamId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Add member to channel
   */
  async addMember(
    channelId: string,
    memberType: ParticipantType,
    memberId: string,
    role: ChannelRole = ChannelRole.MEMBER,
  ): Promise<ChannelMembership> {
    // Check if already a member
    const existing = await this.membershipRepo.findOne({
      where: { channelId, memberType, memberId },
    });

    if (existing) {
      return existing;
    }

    const membership = this.membershipRepo.create({
      channelId,
      memberType,
      memberId,
      role,
      joinedAt: new Date(),
    });

    return this.membershipRepo.save(membership);
  }

  /**
   * Remove member from channel
   */
  async removeMember(
    channelId: string,
    memberType: ParticipantType,
    memberId: string,
  ): Promise<void> {
    await this.membershipRepo.delete({
      channelId,
      memberType,
      memberId,
    });
  }

  /**
   * Get channel members
   */
  async getMembers(channelId: string): Promise<ChannelMembership[]> {
    return this.membershipRepo.find({
      where: { channelId },
      order: { joinedAt: 'ASC' },
    });
  }

  /**
   * Send message to channel
   */
  async sendMessage(dto: SendChannelMessageDto): Promise<ChannelMessage> {
    const message = this.channelMessageRepo.create({
      channelId: dto.channelId,
      senderType: dto.senderType,
      senderId: dto.senderId ?? null,
      content: dto.content,
      metadata: dto.metadata ?? {},
      threadParentId: dto.threadParentId ?? null,
    });

    return this.channelMessageRepo.save(message);
  }

  /**
   * Get channel messages
   */
  async getMessages(
    channelId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<ChannelMessage[]> {
    return this.channelMessageRepo
      .createQueryBuilder('message')
      .where('message.channel_id = :channelId', { channelId })
      .andWhere('message.thread_parent_id IS NULL') // Only top-level messages
      .orderBy('message.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getMany();
  }

  /**
   * Get thread messages
   */
  async getThreadMessages(
    threadParentId: string,
    limit: number = 50,
  ): Promise<ChannelMessage[]> {
    return this.channelMessageRepo.find({
      where: { threadParentId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * Send message to team channel
   */
  async sendToTeamChannel(
    teamId: string,
    content: string,
  ): Promise<ChannelMessage | null> {
    // Find team channel
    const teamChannels = await this.findByTeam(teamId);
    const teamChannel = teamChannels.find((ch) => ch.name.includes('team'));

    if (!teamChannel) {
      return null;
    }

    return this.sendMessage({
      channelId: teamChannel.id,
      senderType: ParticipantType.SYSTEM,
      content,
    });
  }

  /**
   * Create a group channel with multiple members
   */
  async createGroupChannel(
    organizationId: string,
    creatorType: ParticipantType,
    creatorId: string,
    name: string,
    memberIds: Array<{ type: ParticipantType; id: string }>,
    description?: string,
    maxMembers?: number,
  ): Promise<Channel> {
    // Validate member count
    if (maxMembers && memberIds.length > maxMembers) {
      throw new BadRequestException(
        `Cannot add more than ${maxMembers} members`,
      );
    }

    // Create group channel
    const channel = await this.create({
      organizationId,
      name,
      description,
      channelType: ChannelType.GROUP,
      createdByType: creatorType,
      createdById: creatorId,
      maxMembers,
    });

    // Add all members
    for (const member of memberIds) {
      await this.addMember(channel.id, member.type, member.id);
    }

    return channel;
  }

  /**
   * Add multiple members to a channel
   */
  async addMembers(
    channelId: string,
    members: Array<{ type: ParticipantType; id: string; role?: ChannelRole }>,
  ): Promise<ChannelMembership[]> {
    const channel = await this.findOne(channelId);

    // Check max members limit for group channels
    if (channel.isGroup && channel.maxMembers) {
      const currentMemberCount = await this.membershipRepo.count({
        where: { channelId },
      });

      if (currentMemberCount + members.length > channel.maxMembers) {
        throw new BadRequestException(
          `Cannot exceed maximum member limit of ${channel.maxMembers}`,
        );
      }
    }

    const memberships: ChannelMembership[] = [];

    for (const member of members) {
      const membership = await this.addMember(
        channelId,
        member.type,
        member.id,
        member.role,
      );
      memberships.push(membership);
    }

    return memberships;
  }

  /**
   * Check if user is a member of the channel
   */
  async isMember(
    channelId: string,
    memberType: ParticipantType,
    memberId: string,
  ): Promise<boolean> {
    const membership = await this.membershipRepo.findOne({
      where: { channelId, memberType, memberId },
    });

    return !!membership;
  }

  /**
   * Get member role in channel
   */
  async getMemberRole(
    channelId: string,
    memberType: ParticipantType,
    memberId: string,
  ): Promise<ChannelRole | null> {
    const membership = await this.membershipRepo.findOne({
      where: { channelId, memberType, memberId },
    });

    return membership?.role ?? null;
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    channelId: string,
    memberType: ParticipantType,
    memberId: string,
    newRole: ChannelRole,
  ): Promise<ChannelMembership> {
    const membership = await this.membershipRepo.findOne({
      where: { channelId, memberType, memberId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    membership.role = newRole;
    return this.membershipRepo.save(membership);
  }

  /**
   * Get channels user is a member of
   */
  async findUserChannels(
    memberType: ParticipantType,
    memberId: string,
  ): Promise<Channel[]> {
    const memberships = await this.membershipRepo.find({
      where: { memberType, memberId },
      relations: ['channel'],
    });

    return memberships.map((m) => m.channel);
  }

  /**
   * Find or create direct channel between two users
   */
  async findOrCreateDirectChannel(
    organizationId: string,
    user1Type: ParticipantType,
    user1Id: string,
    user2Type: ParticipantType,
    user2Id: string,
  ): Promise<Channel> {
    // Find existing direct channel
    const user1Channels = await this.findUserChannels(user1Type, user1Id);
    const directChannels = user1Channels.filter(
      (ch) => ch.channelType === ChannelType.DIRECT,
    );

    for (const channel of directChannels) {
      const members = await this.getMembers(channel.id);
      if (
        members.length === 2 &&
        members.some(
          (m) => m.memberType === user2Type && m.memberId === user2Id,
        )
      ) {
        return channel;
      }
    }

    // Create new direct channel
    const channelName = `DM-${user1Id.slice(0, 8)}-${user2Id.slice(0, 8)}`;
    const channel = await this.create({
      organizationId,
      name: channelName,
      channelType: ChannelType.DIRECT,
      createdByType: user1Type,
      createdById: user1Id,
    });

    // Add both users
    await this.addMember(channel.id, user2Type, user2Id);

    return channel;
  }
}
