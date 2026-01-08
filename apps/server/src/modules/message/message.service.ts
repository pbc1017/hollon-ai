import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
    // Validate and sanitize inputs
    const sanitizedContent = this.sanitizeContent(dto.content);
    const validatedMetadata = this.validateMetadata(dto.metadata);
    
    // Validate UUIDs
    this.validateOptionalUUID(dto.fromId, 'fromId');
    this.validateUUID(dto.toId, 'toId');
    this.validateOptionalUUID(dto.repliedToId, 'repliedToId');

    // Validate repliedToId exists if provided
    if (dto.repliedToId) {
      const repliedToMessage = await this.messageRepo.findOne({
        where: { id: dto.repliedToId },
      });
      if (!repliedToMessage) {
        throw new BadRequestException(
          `Replied-to message with ID ${dto.repliedToId} not found`,
        );
      }
    }

    // Create message
    const message = this.messageRepo.create({
      fromType: dto.fromType,
      fromId: dto.fromId ?? null,
      toType: dto.toType,
      toId: dto.toId,
      messageType: dto.messageType,
      content: sanitizedContent,
      metadata: validatedMetadata,
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
    // Validate participant ID
    this.validateUUID(participantId, 'participantId');

    // Validate pagination parameters
    const { limit, offset } = this.validatePaginationParams({
      limit: options?.limit,
      offset: options?.offset,
    });

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
    // Validate pagination parameters
    const { limit, offset } = this.validatePaginationParams({
      limit: filters?.limit,
      offset: filters?.offset,
    });

    // Validate UUIDs if provided
    if (filters?.fromId) {
      this.validateOptionalUUID(filters.fromId, 'fromId');
    }
    if (filters?.toId) {
      this.validateOptionalUUID(filters.toId, 'toId');
    }

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
      // Validate and sanitize content
      const sanitizedContent = this.sanitizeContent(updates.content);
      message.content = sanitizedContent;
    }

    if (updates.metadata !== undefined) {
      // Validate metadata
      const validatedMetadata = this.validateMetadata(updates.metadata);
      message.metadata = validatedMetadata;
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
    // Validate participants
    this.validateParticipant(participant1, 'participant1');
    this.validateParticipant(participant2, 'participant2');

    // Validate limit
    const validatedLimit = Math.min(Math.max(1, Math.floor(limit) || 50), 1000);

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
      .take(validatedLimit)
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

  /**
   * Validate UUID format
   */
  private validateUUID(id: string | undefined | null, fieldName: string): void {
    if (!id) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new BadRequestException(
        `${fieldName} must be a valid UUID format`,
      );
    }
  }

  /**
   * Validate optional UUID format
   */
  private validateOptionalUUID(
    id: string | undefined | null,
    fieldName: string,
  ): void {
    if (id && id.trim()) {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new BadRequestException(
          `${fieldName} must be a valid UUID format`,
        );
      }
    }
  }

  /**
   * Sanitize content by removing control characters and normalizing whitespace
   */
  private sanitizeContent(content: string | undefined | null): string {
    if (!content) {
      throw new BadRequestException('Content cannot be empty or null');
    }

    if (typeof content !== 'string') {
      throw new BadRequestException('Content must be a string');
    }

    // Remove control characters except newlines, tabs, and carriage returns
    // eslint-disable-next-line no-control-regex
    let sanitized = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Trim leading/trailing whitespace
    sanitized = sanitized.trim();

    if (sanitized.length === 0) {
      throw new BadRequestException(
        'Content cannot be empty after sanitization',
      );
    }

    // Enforce maximum content length (1MB)
    const maxLength = 1024 * 1024;
    if (sanitized.length > maxLength) {
      throw new BadRequestException(
        `Content exceeds maximum length of ${maxLength} characters`,
      );
    }

    return sanitized;
  }

  /**
   * Validate and sanitize metadata object
   */
  private validateMetadata(
    metadata: Record<string, unknown> | undefined | null,
  ): Record<string, unknown> {
    if (!metadata) {
      return {};
    }

    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new BadRequestException('Metadata must be a valid object');
    }

    try {
      // Validate JSON serializability
      JSON.stringify(metadata);
    } catch {
      throw new BadRequestException(
        'Metadata must be a JSON-serializable object',
      );
    }

    return metadata;
  }

  /**
   * Validate pagination parameters
   */
  private validatePaginationParams(params: {
    limit?: number;
    offset?: number;
  }): { limit: number; offset: number } {
    let limit = params.limit ?? 50;
    let offset = params.offset ?? 0;

    // Validate and sanitize limit
    if (typeof limit !== 'number' || !Number.isInteger(limit)) {
      throw new BadRequestException('Limit must be an integer');
    }
    if (limit < 1) {
      throw new BadRequestException('Limit must be at least 1');
    }
    if (limit > 1000) {
      throw new BadRequestException('Limit cannot exceed 1000');
    }

    // Validate and sanitize offset
    if (typeof offset !== 'number' || !Number.isInteger(offset)) {
      throw new BadRequestException('Offset must be an integer');
    }
    if (offset < 0) {
      throw new BadRequestException('Offset cannot be negative');
    }

    return { limit, offset };
  }

  /**
   * Validate participant data
   */
  private validateParticipant(
    participant: Participant | undefined | null,
    participantName: string,
  ): void {
    if (!participant) {
      throw new BadRequestException(`${participantName} is required`);
    }

    if (!participant.type) {
      throw new BadRequestException(
        `${participantName} type is required`,
      );
    }

    if (!participant.id) {
      throw new BadRequestException(`${participantName} ID is required`);
    }

    this.validateUUID(participant.id, `${participantName} ID`);
  }
}
