import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ChannelService } from './channel.service';
import {
  CreateChannelDto,
  CreateGroupChannelDto,
  AddChannelMembersDto,
  UpdateMemberRoleDto,
} from './dto/create-channel.dto';
import { SendChannelMessageDto } from './dto/channel-message.dto';
import { Channel } from './entities/channel.entity';
import { ChannelMembership } from './entities/channel-membership.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { ParticipantType } from '../message/entities/message.entity';

@Controller('channels')
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  /**
   * Create a new channel
   * POST /channels
   */
  @Post()
  async createChannel(@Body() dto: CreateChannelDto): Promise<Channel> {
    return this.channelService.create(dto);
  }

  /**
   * Get channel by ID
   * GET /channels/:channelId
   */
  @Get(':channelId')
  async getChannel(
    @Param('channelId', ParseUUIDPipe) channelId: string,
  ): Promise<Channel> {
    return this.channelService.findOne(channelId);
  }

  /**
   * Get channels by organization
   * GET /channels/organization/:organizationId
   */
  @Get('organization/:organizationId')
  async getOrganizationChannels(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<Channel[]> {
    return this.channelService.findByOrganization(organizationId);
  }

  /**
   * Get channels by team
   * GET /channels/team/:teamId
   */
  @Get('team/:teamId')
  async getTeamChannels(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ): Promise<Channel[]> {
    return this.channelService.findByTeam(teamId);
  }

  /**
   * Get channel members
   * GET /channels/:channelId/members
   */
  @Get(':channelId/members')
  async getChannelMembers(
    @Param('channelId', ParseUUIDPipe) channelId: string,
  ): Promise<ChannelMembership[]> {
    return this.channelService.getMembers(channelId);
  }

  /**
   * Send message to channel
   * POST /channels/messages
   */
  @Post('messages')
  async sendChannelMessage(
    @Body() dto: SendChannelMessageDto,
  ): Promise<ChannelMessage> {
    return this.channelService.sendMessage(dto);
  }

  /**
   * Get channel messages
   * GET /channels/:channelId/messages
   */
  @Get(':channelId/messages')
  async getChannelMessages(
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ): Promise<ChannelMessage[]> {
    return this.channelService.getMessages(channelId, limit, offset);
  }

  /**
   * Get thread messages
   * GET /channels/messages/:messageId/thread
   */
  @Get('messages/:messageId/thread')
  async getThreadMessages(
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<ChannelMessage[]> {
    return this.channelService.getThreadMessages(messageId, limit);
  }

  /**
   * Create a group channel
   * POST /channels/group
   */
  @Post('group')
  async createGroupChannel(
    @Body() dto: CreateGroupChannelDto,
  ): Promise<Channel> {
    return this.channelService.createGroupChannel(
      dto.organizationId,
      dto.createdByType,
      dto.createdById,
      dto.name,
      dto.members,
      dto.description,
      dto.maxMembers,
    );
  }

  /**
   * Add members to channel
   * POST /channels/:channelId/members
   */
  @Post(':channelId/members')
  async addMembers(
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Body() dto: AddChannelMembersDto,
  ): Promise<ChannelMembership[]> {
    return this.channelService.addMembers(channelId, dto.members);
  }

  /**
   * Remove member from channel
   * DELETE /channels/:channelId/members/:memberType/:memberId
   */
  @Delete(':channelId/members/:memberType/:memberId')
  async removeMember(
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Param('memberType') memberType: ParticipantType,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    return this.channelService.removeMember(channelId, memberType, memberId);
  }

  /**
   * Update member role
   * PUT /channels/:channelId/members/role
   */
  @Put(':channelId/members/role')
  async updateMemberRole(
    @Param('channelId', ParseUUIDPipe) channelId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<ChannelMembership> {
    return this.channelService.updateMemberRole(
      channelId,
      dto.memberType,
      dto.memberId,
      dto.role,
    );
  }

  /**
   * Get user's channels
   * GET /channels/user/:memberType/:memberId
   */
  @Get('user/:memberType/:memberId')
  async getUserChannels(
    @Param('memberType') memberType: ParticipantType,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<Channel[]> {
    return this.channelService.findUserChannels(memberType, memberId);
  }

  /**
   * Find or create direct channel
   * POST /channels/direct
   */
  @Post('direct')
  async findOrCreateDirectChannel(
    @Body()
    body: {
      organizationId: string;
      user1Type: ParticipantType;
      user1Id: string;
      user2Type: ParticipantType;
      user2Id: string;
    },
  ): Promise<Channel> {
    return this.channelService.findOrCreateDirectChannel(
      body.organizationId,
      body.user1Type,
      body.user1Id,
      body.user2Type,
      body.user2Id,
    );
  }
}
