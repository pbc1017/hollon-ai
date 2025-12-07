import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from './entities/channel.entity';
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
    const channel = this.channelRepo.create({
      organizationId: dto.organizationId,
      teamId: dto.teamId ?? null,
      name: dto.name,
      description: dto.description ?? null,
      channelType: dto.channelType,
      createdByType: dto.createdByType,
      createdById: dto.createdById ?? null,
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
}
