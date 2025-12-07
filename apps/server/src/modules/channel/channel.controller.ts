import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ChannelService } from './channel.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { SendChannelMessageDto } from './dto/channel-message.dto';
import { Channel } from './entities/channel.entity';
import { ChannelMembership } from './entities/channel-membership.entity';
import { ChannelMessage } from './entities/channel-message.entity';

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
}
