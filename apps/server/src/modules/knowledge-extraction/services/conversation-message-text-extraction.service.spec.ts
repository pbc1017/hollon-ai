import { Test, TestingModule } from '@nestjs/testing';
import { ConversationMessageTextExtractionService } from './conversation-message-text-extraction.service';
import { Message } from '../../message/entities/message.entity';
import { Conversation } from '../../message/entities/conversation.entity';
import {
  MessageType,
  ParticipantType,
  MessagePriority,
  ConversationContext,
} from '../../message/enums/message.enums';

describe('ConversationMessageTextExtractionService', () => {
  let service: ConversationMessageTextExtractionService;

  const mockMessage: Message = {
    id: 'msg-123',
    conversationId: 'conv-123',
    fromType: ParticipantType.HOLLON,
    fromId: 'hollon-456',
    toType: ParticipantType.HOLLON,
    toId: 'hollon-789',
    messageType: MessageType.GENERAL,
    priority: MessagePriority.NORMAL,
    content: 'Hello, this is a test message',
    metadata: { key: 'value' },
    requiresResponse: false,
    isRead: false,
    readAt: null,
    repliedToId: null,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  } as Message;

  const mockConversation: Conversation = {
    id: 'conv-123',
    participant1Type: ParticipantType.HOLLON,
    participant1Id: 'hollon-456',
    participant2Type: ParticipantType.HOLLON,
    participant2Id: 'hollon-789',
    context: ConversationContext.GENERAL,
    contextId: null,
    lastMessageId: 'msg-123',
    lastMessageAt: new Date('2024-01-01T10:00:00Z'),
    unreadCount: 0,
    createdAt: new Date('2024-01-01T09:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    messages: [],
  } as Conversation;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConversationMessageTextExtractionService],
    }).compile();

    service = module.get<ConversationMessageTextExtractionService>(
      ConversationMessageTextExtractionService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractFromMessage', () => {
    it('should extract all fields from a message', () => {
      const result = service.extractFromMessage(mockMessage);

      expect(result).toEqual({
        messageId: 'msg-123',
        senderType: ParticipantType.HOLLON,
        senderId: 'hollon-456',
        recipientType: ParticipantType.HOLLON,
        recipientId: 'hollon-789',
        contentType: MessageType.GENERAL,
        priority: MessagePriority.NORMAL,
        textContent: 'Hello, this is a test message',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        requiresResponse: false,
        isRead: false,
        metadata: { key: 'value' },
        replyToMessageId: null,
        conversationId: 'conv-123',
      });
    });

    it('should handle system message with null senderId', () => {
      const systemMessage = {
        ...mockMessage,
        fromType: ParticipantType.SYSTEM,
        fromId: null,
      } as Message;

      const result = service.extractFromMessage(systemMessage);

      expect(result.senderType).toBe(ParticipantType.SYSTEM);
      expect(result.senderId).toBeNull();
    });

    it('should clean whitespace from content', () => {
      const messageWithWhitespace = {
        ...mockMessage,
        content: '  Hello  \n\n\n  World  \r\n  Test  ',
      } as Message;

      const result = service.extractFromMessage(messageWithWhitespace);

      expect(result.textContent).toBe('Hello\n\nWorld\nTest');
    });

    it('should handle empty metadata', () => {
      const messageWithoutMetadata = {
        ...mockMessage,
        metadata: undefined,
      } as Message;

      const result = service.extractFromMessage(messageWithoutMetadata);

      expect(result.metadata).toEqual({});
    });

    it('should preserve reply relationship', () => {
      const replyMessage = {
        ...mockMessage,
        repliedToId: 'original-msg-id',
      } as Message;

      const result = service.extractFromMessage(replyMessage);

      expect(result.replyToMessageId).toBe('original-msg-id');
    });
  });

  describe('extractConversationContext', () => {
    it('should extract all conversation fields', () => {
      const result = service.extractConversationContext(mockConversation);

      expect(result).toEqual({
        conversationId: 'conv-123',
        participant1Type: ParticipantType.HOLLON,
        participant1Id: 'hollon-456',
        participant2Type: ParticipantType.HOLLON,
        participant2Id: 'hollon-789',
        context: ConversationContext.GENERAL,
        contextId: null,
        createdAt: new Date('2024-01-01T09:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        lastMessageAt: new Date('2024-01-01T10:00:00Z'),
        unreadCount: 0,
      });
    });

    it('should handle conversation with context', () => {
      const taskConversation = {
        ...mockConversation,
        context: ConversationContext.TASK,
        contextId: 'task-123',
      } as Conversation;

      const result = service.extractConversationContext(taskConversation);

      expect(result.context).toBe(ConversationContext.TASK);
      expect(result.contextId).toBe('task-123');
    });
  });

  describe('extractConversationWithMessages', () => {
    it('should throw error if messages are not loaded', () => {
      const conversationWithoutMessages = {
        ...mockConversation,
        messages: [],
      } as Conversation;

      expect(() =>
        service.extractConversationWithMessages(conversationWithoutMessages),
      ).toThrow(
        'Conversation must have messages relation loaded with at least one message',
      );
    });

    it('should extract conversation with single message', () => {
      const conversation = {
        ...mockConversation,
        messages: [mockMessage],
      } as Conversation;

      const result = service.extractConversationWithMessages(conversation);

      expect(result.conversation.conversationId).toBe('conv-123');
      expect(result.messages).toHaveLength(1);
      expect(result.messageCount).toBe(1);
      expect(result.fullText).toContain('Hello, this is a test message');
    });

    it('should extract conversation with multiple messages in chronological order', () => {
      const message1 = {
        ...mockMessage,
        id: 'msg-1',
        content: 'First message',
        createdAt: new Date('2024-01-01T09:00:00Z'),
      } as Message;

      const message2 = {
        ...mockMessage,
        id: 'msg-2',
        content: 'Second message',
        createdAt: new Date('2024-01-01T10:00:00Z'),
      } as Message;

      const message3 = {
        ...mockMessage,
        id: 'msg-3',
        content: 'Third message',
        createdAt: new Date('2024-01-01T11:00:00Z'),
      } as Message;

      const conversation = {
        ...mockConversation,
        messages: [message2, message1, message3], // Out of order
      } as Conversation;

      const result = service.extractConversationWithMessages(conversation);

      expect(result.messageCount).toBe(3);
      expect(result.messages).toHaveLength(3);

      // Check that fullText is in chronological order
      const lines = result.fullText.split('\n\n');
      expect(lines[0]).toContain('First message');
      expect(lines[1]).toContain('Second message');
      expect(lines[2]).toContain('Third message');
    });

    it('should include metadata in fullText format', () => {
      const conversation = {
        ...mockConversation,
        messages: [mockMessage],
      } as Conversation;

      const result = service.extractConversationWithMessages(conversation);

      expect(result.fullText).toContain('2024-01-01T10:00:00.000Z');
      expect(result.fullText).toContain('Hollon-hollon-4');
      expect(result.fullText).toContain('General');
    });
  });

  describe('extractFromMessages', () => {
    it('should extract multiple messages', () => {
      const messages = [
        mockMessage,
        { ...mockMessage, id: 'msg-2', content: 'Second message' },
      ] as Message[];

      const result = service.extractFromMessages(messages);

      expect(result).toHaveLength(2);
      expect(result[0].messageId).toBe('msg-123');
      expect(result[1].messageId).toBe('msg-2');
    });

    it('should handle empty array', () => {
      const result = service.extractFromMessages([]);

      expect(result).toEqual([]);
    });
  });

  describe('extractCombinedText', () => {
    it('should combine multiple messages in chronological order', () => {
      const message1 = {
        ...mockMessage,
        id: 'msg-1',
        content: 'First',
        createdAt: new Date('2024-01-01T09:00:00Z'),
      } as Message;

      const message2 = {
        ...mockMessage,
        id: 'msg-2',
        content: 'Second',
        createdAt: new Date('2024-01-01T10:00:00Z'),
      } as Message;

      const result = service.extractCombinedText([message2, message1]);

      const lines = result.split('\n\n');
      expect(lines[0]).toContain('First');
      expect(lines[1]).toContain('Second');
    });

    it('should handle empty messages array', () => {
      const result = service.extractCombinedText([]);

      expect(result).toBe('');
    });
  });

  describe('filterByContentType', () => {
    it('should filter messages by content type', () => {
      const messages = [
        service.extractFromMessage(mockMessage),
        service.extractFromMessage({
          ...mockMessage,
          messageType: MessageType.TASK_ASSIGNMENT,
        } as Message),
        service.extractFromMessage({
          ...mockMessage,
          messageType: MessageType.QUESTION,
        } as Message),
      ];

      const result = service.filterByContentType(messages, [
        MessageType.TASK_ASSIGNMENT,
        MessageType.QUESTION,
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].contentType).toBe(MessageType.TASK_ASSIGNMENT);
      expect(result[1].contentType).toBe(MessageType.QUESTION);
    });

    it('should return empty array if no matches', () => {
      const messages = [service.extractFromMessage(mockMessage)];

      const result = service.filterByContentType(messages, [
        MessageType.TASK_ASSIGNMENT,
      ]);

      expect(result).toEqual([]);
    });
  });

  describe('filterBySenderType', () => {
    it('should filter messages by sender type', () => {
      const hollonMessage = service.extractFromMessage(mockMessage);
      const systemMessage = service.extractFromMessage({
        ...mockMessage,
        fromType: ParticipantType.SYSTEM,
      } as Message);
      const humanMessage = service.extractFromMessage({
        ...mockMessage,
        fromType: ParticipantType.HUMAN,
      } as Message);

      const messages = [hollonMessage, systemMessage, humanMessage];

      const result = service.filterBySenderType(messages, [
        ParticipantType.HOLLON,
        ParticipantType.HUMAN,
      ]);

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.senderType)).toContain(ParticipantType.HOLLON);
      expect(result.map((m) => m.senderType)).toContain(ParticipantType.HUMAN);
      expect(result.map((m) => m.senderType)).not.toContain(
        ParticipantType.SYSTEM,
      );
    });
  });

  describe('filterByPriority', () => {
    it('should filter messages by priority', () => {
      const normalMessage = service.extractFromMessage(mockMessage);
      const urgentMessage = service.extractFromMessage({
        ...mockMessage,
        priority: MessagePriority.URGENT,
      } as Message);
      const highMessage = service.extractFromMessage({
        ...mockMessage,
        priority: MessagePriority.HIGH,
      } as Message);

      const messages = [normalMessage, urgentMessage, highMessage];

      const result = service.filterByPriority(messages, [
        MessagePriority.URGENT,
        MessagePriority.HIGH,
      ]);

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.priority)).toContain(MessagePriority.URGENT);
      expect(result.map((m) => m.priority)).toContain(MessagePriority.HIGH);
    });
  });

  describe('getMessagesRequiringResponse', () => {
    it('should return only unread messages that require response', () => {
      const requiresResponseUnread = service.extractFromMessage({
        ...mockMessage,
        requiresResponse: true,
        isRead: false,
      } as Message);

      const requiresResponseRead = service.extractFromMessage({
        ...mockMessage,
        requiresResponse: true,
        isRead: true,
      } as Message);

      const noResponse = service.extractFromMessage({
        ...mockMessage,
        requiresResponse: false,
        isRead: false,
      } as Message);

      const messages = [
        requiresResponseUnread,
        requiresResponseRead,
        noResponse,
      ];

      const result = service.getMessagesRequiringResponse(messages);

      expect(result).toHaveLength(1);
      expect(result[0].messageId).toBe(requiresResponseUnread.messageId);
    });

    it('should return empty array if no messages require response', () => {
      const messages = [service.extractFromMessage(mockMessage)];

      const result = service.getMessagesRequiringResponse(messages);

      expect(result).toEqual([]);
    });
  });

  describe('groupByContentType', () => {
    it('should group messages by content type', () => {
      const messages = [
        service.extractFromMessage(mockMessage),
        service.extractFromMessage({
          ...mockMessage,
          id: 'msg-2',
          messageType: MessageType.TASK_ASSIGNMENT,
        } as Message),
        service.extractFromMessage({
          ...mockMessage,
          id: 'msg-3',
          messageType: MessageType.GENERAL,
        } as Message),
        service.extractFromMessage({
          ...mockMessage,
          id: 'msg-4',
          messageType: MessageType.TASK_ASSIGNMENT,
        } as Message),
      ];

      const result = service.groupByContentType(messages);

      expect(result.size).toBe(2);
      expect(result.get(MessageType.GENERAL)).toHaveLength(2);
      expect(result.get(MessageType.TASK_ASSIGNMENT)).toHaveLength(2);
    });

    it('should return empty map for empty messages array', () => {
      const result = service.groupByContentType([]);

      expect(result.size).toBe(0);
    });
  });

  describe('getConversationStatistics', () => {
    it('should calculate statistics for conversation data', () => {
      const message1 = {
        ...mockMessage,
        id: 'msg-1',
        content: 'Hello',
        messageType: MessageType.GENERAL,
        fromType: ParticipantType.HOLLON,
        fromId: 'hollon-1',
        requiresResponse: true,
        isRead: false,
      } as Message;

      const message2 = {
        ...mockMessage,
        id: 'msg-2',
        content: 'World!',
        messageType: MessageType.TASK_ASSIGNMENT,
        fromType: ParticipantType.HOLLON,
        fromId: 'hollon-2',
        requiresResponse: false,
        isRead: true,
      } as Message;

      const conversation = {
        ...mockConversation,
        messages: [message1, message2],
      } as Conversation;

      const data = service.extractConversationWithMessages(conversation);
      const stats = service.getConversationStatistics(data);

      expect(stats.totalMessages).toBe(2);
      expect(stats.messagesByType[MessageType.GENERAL]).toBe(1);
      expect(stats.messagesByType[MessageType.TASK_ASSIGNMENT]).toBe(1);
      expect(stats.messagesRequiringResponse).toBe(1);
      expect(stats.unreadMessages).toBe(1);
      expect(stats.averageMessageLength).toBeGreaterThan(0);
    });

    it('should handle empty messages in statistics', () => {
      const conversation = {
        ...mockConversation,
        messages: [mockMessage],
      } as Conversation;

      const data = service.extractConversationWithMessages(conversation);
      const stats = service.getConversationStatistics(data);

      expect(stats.totalMessages).toBe(1);
      expect(stats.averageMessageLength).toBeGreaterThan(0);
    });

    it('should count messages by sender correctly', () => {
      const message1 = {
        ...mockMessage,
        fromType: ParticipantType.HOLLON,
        fromId: 'hollon-1',
      } as Message;

      const message2 = {
        ...mockMessage,
        id: 'msg-2',
        fromType: ParticipantType.HOLLON,
        fromId: 'hollon-1',
      } as Message;

      const message3 = {
        ...mockMessage,
        id: 'msg-3',
        fromType: ParticipantType.SYSTEM,
        fromId: null,
      } as Message;

      const conversation = {
        ...mockConversation,
        messages: [message1, message2, message3],
      } as Conversation;

      const data = service.extractConversationWithMessages(conversation);
      const stats = service.getConversationStatistics(data);

      expect(stats.messagesBySender['hollon-hollon-1']).toBe(2);
      expect(stats.messagesBySender['system-system']).toBe(1);
    });
  });
});
