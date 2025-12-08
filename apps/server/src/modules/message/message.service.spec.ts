import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { MessageService } from './message.service';
import {
  Message,
  MessageType,
  ParticipantType,
} from './entities/message.entity';
import { Conversation } from './entities/conversation.entity';
import { ConversationHistory } from './entities/conversation-history.entity';

describe('MessageService', () => {
  let service: MessageService;

  const mockMessageRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockConversationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockConversationHistoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockMessage: Partial<Message> = {
    id: 'message-123',
    fromType: ParticipantType.HOLLON,
    fromId: 'hollon-123',
    toType: ParticipantType.HOLLON,
    toId: 'hollon-456',
    messageType: MessageType.GENERAL,
    content: 'Test message content',
    metadata: {},
    requiresResponse: false,
    isRead: false,
    readAt: null,
    repliedToId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockConversation = {
    id: 'conv-123',
    participant1Type: ParticipantType.HOLLON,
    participant1Id: 'hollon-123',
    participant2Type: ParticipantType.HOLLON,
    participant2Id: 'hollon-456',
    lastMessageId: 'message-123',
    lastMessageAt: new Date(),
  };

  /**
   * Helper function to create a mock query builder
   */
  const createMockQueryBuilder = (result: any = []) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
    getMany: jest.fn().mockResolvedValue(result),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessageRepository,
        },
        {
          provide: getRepositoryToken(Conversation),
          useValue: mockConversationRepository,
        },
        {
          provide: getRepositoryToken(ConversationHistory),
          useValue: mockConversationHistoryRepository,
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('send', () => {
    it('should create and save a message with all required fields', async () => {
      const sendDto = {
        fromType: ParticipantType.HOLLON,
        fromId: 'hollon-123',
        toType: ParticipantType.HOLLON,
        toId: 'hollon-456',
        messageType: MessageType.GENERAL,
        content: 'Hello!',
      };

      const createdMessage = { ...mockMessage, ...sendDto };
      mockMessageRepository.create.mockReturnValue(createdMessage);
      mockMessageRepository.save.mockResolvedValue(createdMessage);
      mockConversationRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder(null),
      );
      mockConversationRepository.create.mockReturnValue(mockConversation);
      mockConversationRepository.save.mockResolvedValue(mockConversation);
      mockConversationHistoryRepository.create.mockReturnValue({
        conversationId: 'conv-123',
        messageId: createdMessage.id,
      });
      mockConversationHistoryRepository.save.mockResolvedValue({});

      const result = await service.send(sendDto);

      expect(mockMessageRepository.create).toHaveBeenCalledWith({
        fromType: sendDto.fromType,
        fromId: sendDto.fromId,
        toType: sendDto.toType,
        toId: sendDto.toId,
        messageType: sendDto.messageType,
        content: sendDto.content,
        metadata: {},
        requiresResponse: false,
        repliedToId: null,
      });
      expect(mockMessageRepository.save).toHaveBeenCalled();
      expect(result).toEqual(createdMessage);
    });

    it('should create message with optional metadata and requiresResponse', async () => {
      const sendDto = {
        fromType: ParticipantType.HOLLON,
        fromId: 'hollon-123',
        toType: ParticipantType.HOLLON,
        toId: 'hollon-456',
        messageType: MessageType.TASK_ASSIGNMENT,
        content: 'Please review this',
        metadata: { priority: 'high', category: 'review' },
        requiresResponse: true,
      };

      const createdMessage = { ...mockMessage, ...sendDto };
      mockMessageRepository.create.mockReturnValue(createdMessage);
      mockMessageRepository.save.mockResolvedValue(createdMessage);
      mockConversationRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder(null),
      );
      mockConversationRepository.create.mockReturnValue(mockConversation);
      mockConversationRepository.save.mockResolvedValue(mockConversation);
      mockConversationHistoryRepository.create.mockReturnValue({});
      mockConversationHistoryRepository.save.mockResolvedValue({});

      const result = await service.send(sendDto);

      expect(mockMessageRepository.create).toHaveBeenCalledWith({
        fromType: sendDto.fromType,
        fromId: sendDto.fromId,
        toType: sendDto.toType,
        toId: sendDto.toId,
        messageType: sendDto.messageType,
        content: sendDto.content,
        metadata: sendDto.metadata,
        requiresResponse: true,
        repliedToId: null,
      });
      expect(result.requiresResponse).toBe(true);
      expect(result.metadata).toEqual(sendDto.metadata);
    });

    it('should handle system message without fromId', async () => {
      const sendDto = {
        fromType: ParticipantType.SYSTEM,
        toType: ParticipantType.HOLLON,
        toId: 'hollon-456',
        messageType: MessageType.TASK_ASSIGNMENT,
        content: 'Task assigned',
      };

      const createdMessage = {
        ...mockMessage,
        ...sendDto,
        fromId: null,
      };
      mockMessageRepository.create.mockReturnValue(createdMessage);
      mockMessageRepository.save.mockResolvedValue(createdMessage);

      const result = await service.send(sendDto);

      expect(result.fromId).toBeNull();
      // Conversation should not be created/updated when fromId is null
      expect(
        mockConversationRepository.createQueryBuilder,
      ).not.toHaveBeenCalled();
    });

    it('should create a new conversation if none exists', async () => {
      const sendDto = {
        fromType: ParticipantType.HOLLON,
        fromId: 'hollon-123',
        toType: ParticipantType.HOLLON,
        toId: 'hollon-456',
        messageType: MessageType.GENERAL,
        content: 'First message',
      };

      const createdMessage = { ...mockMessage, ...sendDto };
      mockMessageRepository.create.mockReturnValue(createdMessage);
      mockMessageRepository.save.mockResolvedValue(createdMessage);
      mockConversationRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder(null),
      );
      mockConversationRepository.create.mockReturnValue(mockConversation);
      mockConversationRepository.save.mockResolvedValue(mockConversation);
      mockConversationHistoryRepository.create.mockReturnValue({
        conversationId: 'conv-123',
        messageId: createdMessage.id,
      });
      mockConversationHistoryRepository.save.mockResolvedValue({});

      await service.send(sendDto);

      expect(mockConversationRepository.create).toHaveBeenCalledWith({
        participant1Type: sendDto.fromType,
        participant1Id: sendDto.fromId,
        participant2Type: sendDto.toType,
        participant2Id: sendDto.toId,
        lastMessageId: createdMessage.id,
        lastMessageAt: createdMessage.createdAt,
      });
      expect(mockConversationRepository.save).toHaveBeenCalled();
      expect(mockConversationHistoryRepository.create).toHaveBeenCalled();
      expect(mockConversationHistoryRepository.save).toHaveBeenCalled();
    });

    it('should update existing conversation with new message', async () => {
      const sendDto = {
        fromType: ParticipantType.HOLLON,
        fromId: 'hollon-123',
        toType: ParticipantType.HOLLON,
        toId: 'hollon-456',
        messageType: MessageType.GENERAL,
        content: 'Follow-up message',
      };

      const existingConversation = { ...mockConversation };
      const createdMessage = { ...mockMessage, ...sendDto };

      mockMessageRepository.create.mockReturnValue(createdMessage);
      mockMessageRepository.save.mockResolvedValue(createdMessage);
      mockConversationRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder(existingConversation),
      );
      mockConversationRepository.save.mockResolvedValue(existingConversation);
      mockConversationHistoryRepository.create.mockReturnValue({
        conversationId: 'conv-123',
        messageId: createdMessage.id,
      });
      mockConversationHistoryRepository.save.mockResolvedValue({});

      await service.send(sendDto);

      // Should not create new conversation
      expect(mockConversationRepository.create).not.toHaveBeenCalled();
      // Should update existing conversation
      expect(mockConversationRepository.save).toHaveBeenCalled();
      expect(mockConversationHistoryRepository.create).toHaveBeenCalled();
    });

    it('should handle reply message with repliedToId', async () => {
      const sendDto = {
        fromType: ParticipantType.HOLLON,
        fromId: 'hollon-123',
        toType: ParticipantType.HOLLON,
        toId: 'hollon-456',
        messageType: MessageType.GENERAL,
        content: 'This is a reply',
        repliedToId: 'original-message-id',
      };

      const createdMessage = { ...mockMessage, ...sendDto };
      mockMessageRepository.create.mockReturnValue(createdMessage);
      mockMessageRepository.save.mockResolvedValue(createdMessage);
      mockConversationRepository.createQueryBuilder.mockReturnValue(
        createMockQueryBuilder(null),
      );
      mockConversationRepository.create.mockReturnValue(mockConversation);
      mockConversationRepository.save.mockResolvedValue(mockConversation);
      mockConversationHistoryRepository.create.mockReturnValue({});
      mockConversationHistoryRepository.save.mockResolvedValue({});

      const result = await service.send(sendDto);

      expect(result.repliedToId).toBe('original-message-id');
    });
  });

  describe('findOne', () => {
    it('should return a message if found', async () => {
      mockMessageRepository.findOne.mockResolvedValue(mockMessage);

      const result = await service.findOne('message-123');

      expect(mockMessageRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'message-123' },
        relations: ['repliedTo'],
      });
      expect(result).toEqual(mockMessage);
    });

    it('should throw NotFoundException if message not found', async () => {
      mockMessageRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent')).rejects.toThrow(
        'Message with ID non-existent not found',
      );
    });
  });

  describe('findAll', () => {
    it('should return all messages with default pagination', async () => {
      const messages = [mockMessage, { ...mockMessage, id: 'message-456' }];
      const mockQueryBuilder = createMockQueryBuilder(messages);
      mockMessageRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findAll();

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'message.created_at',
        'DESC',
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(50);
      expect(result).toEqual(messages);
    });

    it('should apply all filters when provided', async () => {
      const mockQueryBuilder = createMockQueryBuilder([mockMessage]);
      mockMessageRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      await service.findAll({
        fromType: ParticipantType.HOLLON,
        fromId: 'hollon-123',
        toType: ParticipantType.HOLLON,
        toId: 'hollon-456',
        messageType: MessageType.GENERAL,
        isRead: false,
        limit: 10,
        offset: 5,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.from_type = :fromType',
        { fromType: ParticipantType.HOLLON },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.from_id = :fromId',
        { fromId: 'hollon-123' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.to_type = :toType',
        { toType: ParticipantType.HOLLON },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.to_id = :toId',
        { toId: 'hollon-456' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.message_type = :messageType',
        { messageType: MessageType.GENERAL },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.is_read = :isRead',
        { isRead: false },
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should handle isRead filter as false', async () => {
      const mockQueryBuilder = createMockQueryBuilder([]);
      mockMessageRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      await service.findAll({ isRead: false });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.is_read = :isRead',
        { isRead: false },
      );
    });

    it('should handle isRead filter as true', async () => {
      const mockQueryBuilder = createMockQueryBuilder([]);
      mockMessageRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      await service.findAll({ isRead: true });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.is_read = :isRead',
        { isRead: true },
      );
    });

    it('should not apply filter when value is undefined', async () => {
      const mockQueryBuilder = createMockQueryBuilder([]);
      mockMessageRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      await service.findAll({ fromType: ParticipantType.HOLLON });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.from_type = :fromType',
        { fromType: ParticipantType.HOLLON },
      );
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        'message.from_id = :fromId',
        expect.anything(),
      );
    });
  });

  describe('update', () => {
    it('should update message content', async () => {
      const existingMessage = { ...mockMessage };
      mockMessageRepository.findOne.mockResolvedValue(existingMessage);
      mockMessageRepository.save.mockResolvedValue({
        ...existingMessage,
        content: 'Updated content',
      });

      const result = await service.update('message-123', {
        content: 'Updated content',
      });

      expect(mockMessageRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'message-123' },
        relations: ['repliedTo'],
      });
      expect(mockMessageRepository.save).toHaveBeenCalled();
      expect(result.content).toBe('Updated content');
    });

    it('should update message metadata', async () => {
      const existingMessage = { ...mockMessage };
      mockMessageRepository.findOne.mockResolvedValue(existingMessage);
      mockMessageRepository.save.mockResolvedValue({
        ...existingMessage,
        metadata: { priority: 'high' },
      });

      const result = await service.update('message-123', {
        metadata: { priority: 'high' },
      });

      expect(result.metadata).toEqual({ priority: 'high' });
    });

    it('should update requiresResponse flag', async () => {
      const existingMessage = { ...mockMessage };
      mockMessageRepository.findOne.mockResolvedValue(existingMessage);
      mockMessageRepository.save.mockResolvedValue({
        ...existingMessage,
        requiresResponse: true,
      });

      const result = await service.update('message-123', {
        requiresResponse: true,
      });

      expect(result.requiresResponse).toBe(true);
    });

    it('should update multiple fields at once', async () => {
      const existingMessage = { ...mockMessage };
      mockMessageRepository.findOne.mockResolvedValue(existingMessage);
      mockMessageRepository.save.mockResolvedValue({
        ...existingMessage,
        content: 'New content',
        metadata: { updated: true },
        requiresResponse: true,
      });

      const result = await service.update('message-123', {
        content: 'New content',
        metadata: { updated: true },
        requiresResponse: true,
      });

      expect(result.content).toBe('New content');
      expect(result.metadata).toEqual({ updated: true });
      expect(result.requiresResponse).toBe(true);
    });

    it('should throw NotFoundException if message not found', async () => {
      mockMessageRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { content: 'New content' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not modify fields that are not provided', async () => {
      const existingMessage = {
        ...mockMessage,
        content: 'Original content',
        metadata: { original: true },
        requiresResponse: false,
      };
      mockMessageRepository.findOne.mockResolvedValue(existingMessage);
      mockMessageRepository.save.mockImplementation((msg) => msg);

      await service.update('message-123', {
        content: 'Updated content',
      });

      const saveCall = mockMessageRepository.save.mock.calls[0][0];
      expect(saveCall.content).toBe('Updated content');
      expect(saveCall.metadata).toEqual({ original: true });
      expect(saveCall.requiresResponse).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove a message', async () => {
      mockMessageRepository.findOne.mockResolvedValue(mockMessage);
      mockMessageRepository.remove.mockResolvedValue(mockMessage);

      await service.remove('message-123');

      expect(mockMessageRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'message-123' },
        relations: ['repliedTo'],
      });
      expect(mockMessageRepository.remove).toHaveBeenCalledWith(mockMessage);
    });

    it('should throw NotFoundException if message not found', async () => {
      mockMessageRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark an unread message as read', async () => {
      const unreadMessage = { ...mockMessage, isRead: false, readAt: null };
      mockMessageRepository.findOne.mockResolvedValue(unreadMessage);
      mockMessageRepository.save.mockResolvedValue({
        ...unreadMessage,
        isRead: true,
        readAt: expect.any(Date),
      });

      await service.markAsRead('message-123');

      expect(mockMessageRepository.save).toHaveBeenCalled();
      expect(unreadMessage.isRead).toBe(true);
      expect(unreadMessage.readAt).toBeDefined();
      expect(unreadMessage.readAt).toBeInstanceOf(Date);
    });

    it('should not update already read message', async () => {
      const readMessage = {
        ...mockMessage,
        isRead: true,
        readAt: new Date('2024-01-01'),
      };
      mockMessageRepository.findOne.mockResolvedValue(readMessage);

      await service.markAsRead('message-123');

      expect(mockMessageRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if message not found', async () => {
      mockMessageRepository.findOne.mockResolvedValue(null);

      await expect(service.markAsRead('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.markAsRead('non-existent')).rejects.toThrow(
        'Message with ID non-existent not found',
      );
    });
  });

  describe('getInbox', () => {
    it('should return inbox messages with default options', async () => {
      const messages = [mockMessage];
      const mockQueryBuilder = createMockQueryBuilder(messages);
      mockMessageRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.getInbox(
        ParticipantType.HOLLON,
        'hollon-456',
      );

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'message.to_type = :toType',
        { toType: ParticipantType.HOLLON },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.to_id = :toId',
        { toId: 'hollon-456' },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'message.created_at',
        'DESC',
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(50);
      expect(result).toEqual(messages);
    });

    it('should apply unreadOnly filter', async () => {
      const mockQueryBuilder = createMockQueryBuilder([]);
      mockMessageRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      await service.getInbox(ParticipantType.HOLLON, 'hollon-456', {
        unreadOnly: true,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.is_read = false',
      );
    });

    it('should apply requiresResponse filter', async () => {
      const mockQueryBuilder = createMockQueryBuilder([]);
      mockMessageRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      await service.getInbox(ParticipantType.HOLLON, 'hollon-456', {
        requiresResponse: true,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.requires_response = true',
      );
    });

    it('should apply both filters simultaneously', async () => {
      const mockQueryBuilder = createMockQueryBuilder([]);
      mockMessageRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      await service.getInbox(ParticipantType.HOLLON, 'hollon-456', {
        unreadOnly: true,
        requiresResponse: true,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.is_read = false',
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.requires_response = true',
      );
    });

    it('should apply custom pagination', async () => {
      const mockQueryBuilder = createMockQueryBuilder([]);
      mockMessageRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      await service.getInbox(ParticipantType.HOLLON, 'hollon-456', {
        limit: 20,
        offset: 10,
      });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });

    it('should handle user participant type', async () => {
      const mockQueryBuilder = createMockQueryBuilder([]);
      mockMessageRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      await service.getInbox(ParticipantType.HUMAN, 'user-123');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'message.to_type = :toType',
        { toType: ParticipantType.HUMAN },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'message.to_id = :toId',
        { toId: 'user-123' },
      );
    });
  });

  describe('getConversationHistory', () => {
    it('should return empty array if no conversation exists', async () => {
      const mockQueryBuilder = createMockQueryBuilder(null);
      mockConversationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.getConversationHistory(
        { type: ParticipantType.HOLLON, id: 'hollon-123' },
        { type: ParticipantType.HOLLON, id: 'hollon-456' },
      );

      expect(result).toEqual([]);
    });

    it('should return conversation history if conversation exists', async () => {
      const conversation = { id: 'conv-123' };
      const message1 = { ...mockMessage, id: 'msg-1', content: 'First' };
      const message2 = { ...mockMessage, id: 'msg-2', content: 'Second' };
      const mockHistory = [
        { message: message2, createdAt: new Date('2024-01-02') },
        { message: message1, createdAt: new Date('2024-01-01') },
      ];

      const convQueryBuilder = createMockQueryBuilder(conversation);
      mockConversationRepository.createQueryBuilder.mockReturnValue(
        convQueryBuilder,
      );

      const historyQueryBuilder = createMockQueryBuilder(mockHistory);
      mockConversationHistoryRepository.createQueryBuilder.mockReturnValue(
        historyQueryBuilder,
      );

      const result = await service.getConversationHistory(
        { type: ParticipantType.HOLLON, id: 'hollon-123' },
        { type: ParticipantType.HOLLON, id: 'hollon-456' },
      );

      expect(historyQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'history.message',
        'message',
      );
      expect(historyQueryBuilder.where).toHaveBeenCalledWith(
        'history.conversation_id = :conversationId',
        { conversationId: 'conv-123' },
      );
      expect(historyQueryBuilder.orderBy).toHaveBeenCalledWith(
        'history.created_at',
        'DESC',
      );
      expect(historyQueryBuilder.take).toHaveBeenCalledWith(50);

      // Messages should be reversed (chronological order)
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
    });

    it('should apply custom limit to conversation history', async () => {
      const conversation = { id: 'conv-123' };
      const convQueryBuilder = createMockQueryBuilder(conversation);
      mockConversationRepository.createQueryBuilder.mockReturnValue(
        convQueryBuilder,
      );

      const historyQueryBuilder = createMockQueryBuilder([]);
      mockConversationHistoryRepository.createQueryBuilder.mockReturnValue(
        historyQueryBuilder,
      );

      await service.getConversationHistory(
        { type: ParticipantType.HOLLON, id: 'hollon-123' },
        { type: ParticipantType.HOLLON, id: 'hollon-456' },
        100,
      );

      expect(historyQueryBuilder.take).toHaveBeenCalledWith(100);
    });

    it('should find bidirectional conversations', async () => {
      const conversation = { id: 'conv-123' };
      const mockQueryBuilder = createMockQueryBuilder(conversation);
      mockConversationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

      const historyQueryBuilder = createMockQueryBuilder([]);
      mockConversationHistoryRepository.createQueryBuilder.mockReturnValue(
        historyQueryBuilder,
      );

      await service.getConversationHistory(
        { type: ParticipantType.HOLLON, id: 'hollon-123' },
        { type: ParticipantType.HUMAN, id: 'user-456' },
      );

      // Should search for conversation in both directions
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining('participant1_type'),
        {
          p1Type: ParticipantType.HOLLON,
          p1Id: 'hollon-123',
          p2Type: ParticipantType.HUMAN,
          p2Id: 'user-456',
        },
      );
    });
  });
});
