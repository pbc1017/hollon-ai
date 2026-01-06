import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageQueryDto } from './dto/message-query.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { FindMessagesQueryDto } from './dto/find-messages-query.dto';
import { Message } from './entities/message.entity';
import { ParticipantType } from './entities/message.entity';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  /**
   * Send a message
   * POST /messages
   */
  @Post()
  async sendMessage(@Body() dto: SendMessageDto): Promise<Message> {
    return this.messageService.send(dto);
  }

  /**
   * Get all messages with optional filters
   * GET /messages
   */
  @Get()
  async findAll(@Query() query: FindMessagesQueryDto): Promise<Message[]> {
    return this.messageService.findAll({
      fromType: query.fromType,
      fromId: query.fromId,
      toType: query.toType,
      toId: query.toId,
      messageType: query.messageType,
      isRead: query.isRead,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /**
   * Get inbox messages for a hollon
   * GET /messages/inbox/hollon/:hollonId
   */
  @Get('inbox/hollon/:hollonId')
  async getHollonInbox(
    @Param('hollonId', ParseUUIDPipe) hollonId: string,
    @Query() query: MessageQueryDto,
  ): Promise<Message[]> {
    return this.messageService.getInbox(
      ParticipantType.HOLLON,
      hollonId,
      query,
    );
  }

  /**
   * Get inbox messages for a human
   * GET /messages/inbox/human/:humanId
   */
  @Get('inbox/human/:humanId')
  async getHumanInbox(
    @Param('humanId', ParseUUIDPipe) humanId: string,
    @Query() query: MessageQueryDto,
  ): Promise<Message[]> {
    return this.messageService.getInbox(ParticipantType.HUMAN, humanId, query);
  }

  /**
   * Get conversation history between two hollons
   * GET /messages/conversation/hollon/:hollon1Id/hollon/:hollon2Id
   */
  @Get('conversation/hollon/:hollon1Id/hollon/:hollon2Id')
  async getHollonConversation(
    @Param('hollon1Id', ParseUUIDPipe) hollon1Id: string,
    @Param('hollon2Id', ParseUUIDPipe) hollon2Id: string,
    @Query('limit') limit?: number,
  ): Promise<Message[]> {
    return this.messageService.getConversationHistory(
      { type: ParticipantType.HOLLON, id: hollon1Id },
      { type: ParticipantType.HOLLON, id: hollon2Id },
      limit,
    );
  }

  /**
   * Get a single message by ID
   * GET /messages/:id
   * Note: This route is placed after specific routes to avoid matching 'inbox', 'conversation' as :id
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Message> {
    return this.messageService.findOne(id);
  }

  /**
   * Mark message as read
   * PATCH /messages/:messageId/read
   * Note: This route must be before PATCH /:id to avoid route conflict
   */
  @Patch(':messageId/read')
  async markAsRead(
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<{ success: boolean }> {
    await this.messageService.markAsRead(messageId);
    return { success: true };
  }

  /**
   * Update a message
   * PATCH /messages/:id
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMessageDto,
  ): Promise<Message> {
    return this.messageService.update(id, dto);
  }

  /**
   * Delete a message
   * DELETE /messages/:id
   */
  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    await this.messageService.remove(id);
    return { success: true };
  }
}
