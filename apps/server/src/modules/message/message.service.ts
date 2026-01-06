import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { Conversation } from './entities/conversation.entity';
import { ConversationHistory } from './entities/conversation-history.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { Participant, InboxOptions } from './interfaces/message.interface';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(ConversationHistory)
    private readonly conversationHistoryRepo: Repository<ConversationHistory>,
  ) {}

  /**
   * Send a message
   */
  async send(dto: SendMessageDto): Promise<Message> {
    // Create message
    const message = this.messageRepo.create({
      fromType: dto.fromType,
      fromId: dto.fromId ?? null,
      toType: dto.toType,
      toId: dto.toId,
      messageType: dto.messageType,
      content: dto.content,
      metadata: dto.metadata ?? {},
      requiresResponse: dto.requiresResponse ?? false,
      repliedToId: dto.repliedToId ?? null,
    });

    const savedMessage = await this.messageRepo.save(message);

    // Update or create conversation
    if (dto.fromId) {
      await this.updateConversation(
        { type: dto.fromType, id: dto.fromId },
        { type: dto.toType, id: dto.toId },
        savedMessage,
      );
    }

    return savedMessage;
  }

  /**
   * Get inbox messages for a participant
   */
  async getInbox(
    participantType: string,
    participantId: string,
    options?: InboxOptions,
  ): Promise<Message[]> {
    const queryBuilder = this.messageRepo
      .createQueryBuilder('message')
      .where('message.to_type = :toType', { toType: participantType })
      .andWhere('message.to_id = :toId', { toId: participantId })
      .orderBy('message.created_at', 'DESC');

    if (options?.unreadOnly) {
      queryBuilder.andWhere('message.is_read = false');
    }

    if (options?.requiresResponse) {
      queryBuilder.andWhere('message.requires_response = true');
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    queryBuilder.skip(offset).take(limit);

    return queryBuilder.getMany();
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    if (!message.isRead) {
      message.isRead = true;
      message.readAt = new Date();
      await this.messageRepo.save(message);
    }
  }

  /**
   * Find a single message by ID
   */
  async findOne(id: string): Promise<Message> {
    const message = await this.messageRepo.findOne({
      where: { id },
      relations: ['repliedTo'],
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }

    return message;
  }

  /**
   * Find all messages with optional filters
   */
  async findAll(filters?: {
    fromType?: string;
    fromId?: string;
    toType?: string;
    toId?: string;
    messageType?: string;
    isRead?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Message[]> {
    const queryBuilder = this.messageRepo.createQueryBuilder('message');

    if (filters?.fromType) {
      queryBuilder.andWhere('message.from_type = :fromType', {
        fromType: filters.fromType,
      });
    }

    if (filters?.fromId) {
      queryBuilder.andWhere('message.from_id = :fromId', {
        fromId: filters.fromId,
      });
    }

    if (filters?.toType) {
      queryBuilder.andWhere('message.to_type = :toType', {
        toType: filters.toType,
      });
    }

    if (filters?.toId) {
      queryBuilder.andWhere('message.to_id = :toId', {
        toId: filters.toId,
      });
    }

    if (filters?.messageType) {
      queryBuilder.andWhere('message.message_type = :messageType', {
        messageType: filters.messageType,
      });
    }

    if (filters?.isRead !== undefined) {
      queryBuilder.andWhere('message.is_read = :isRead', {
        isRead: filters.isRead,
      });
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    return queryBuilder
      .orderBy('message.created_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();
  }

  /**
   * Update a message
   */
  async update(
    id: string,
    updates: Partial<
      Pick<Message, 'content' | 'metadata' | 'requiresResponse'>
    >,
  ): Promise<Message> {
    const message = await this.findOne(id);

    if (updates.content !== undefined) {
      message.content = updates.content;
    }

    if (updates.metadata !== undefined) {
      message.metadata = updates.metadata;
    }

    if (updates.requiresResponse !== undefined) {
      message.requiresResponse = updates.requiresResponse;
    }

    return this.messageRepo.save(message);
  }

  /**
   * Remove a message
   */
  async remove(id: string): Promise<void> {
    const message = await this.findOne(id);
    await this.messageRepo.remove(message);
  }

  /**
   * Get conversation history between two participants
   */
  async getConversationHistory(
    participant1: Participant,
    participant2: Participant,
    limit: number = 50,
  ): Promise<Message[]> {
    // Find conversation
    const conversation = await this.findConversation(
      participant1,
      participant2,
    );

    if (!conversation) {
      return [];
    }

    // Get conversation history
    const history = await this.conversationHistoryRepo
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.message', 'message')
      .where('history.conversation_id = :conversationId', {
        conversationId: conversation.id,
      })
      .orderBy('history.created_at', 'DESC')
      .take(limit)
      .getMany();

    return history.map((h) => h.message).reverse();
  }

  /**
   * Find or create conversation between two participants
   */
  private async updateConversation(
    participant1: Participant,
    participant2: Participant,
    message: Message,
  ): Promise<Conversation> {
    let conversation = await this.findConversation(participant1, participant2);

    if (!conversation) {
      // Create new conversation
      conversation = this.conversationRepo.create({
        participant1Type: participant1.type,
        participant1Id: participant1.id,
        participant2Type: participant2.type,
        participant2Id: participant2.id,
        lastMessageId: message.id,
        lastMessageAt: message.createdAt,
      });
      conversation = await this.conversationRepo.save(conversation);
    } else {
      // Update existing conversation
      conversation.lastMessageId = message.id;
      conversation.lastMessageAt = message.createdAt;
      await this.conversationRepo.save(conversation);
    }

    // Add to conversation history
    const historyEntry = this.conversationHistoryRepo.create({
      conversationId: conversation.id,
      messageId: message.id,
    });
    await this.conversationHistoryRepo.save(historyEntry);

    return conversation;
  }

  /**
   * Find conversation between two participants (bidirectional)
   */
  private async findConversation(
    participant1: Participant,
    participant2: Participant,
  ): Promise<Conversation | null> {
    return this.conversationRepo
      .createQueryBuilder('conversation')
      .where(
        `(
          (conversation.participant1_type = :p1Type AND conversation.participant1_id = :p1Id
            AND conversation.participant2_type = :p2Type AND conversation.participant2_id = :p2Id)
          OR
          (conversation.participant1_type = :p2Type AND conversation.participant1_id = :p2Id
            AND conversation.participant2_type = :p1Type AND conversation.participant2_id = :p1Id)
        )`,
        {
          p1Type: participant1.type,
          p1Id: participant1.id,
          p2Type: participant2.type,
          p2Id: participant2.id,
        },
      )
      .getOne();
  }
}
