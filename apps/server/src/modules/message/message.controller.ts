import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageQueryDto } from './dto/message-query.dto';
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
   * Mark message as read
   * PATCH /messages/:messageId/read
   */
  @Patch(':messageId/read')
  async markAsRead(
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<{ success: boolean }> {
    await this.messageService.markAsRead(messageId);
    return { success: true };
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
}
