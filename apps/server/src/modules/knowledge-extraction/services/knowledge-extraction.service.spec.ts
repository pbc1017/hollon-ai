import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KnowledgeExtractionService } from './knowledge-extraction.service';
import { KnowledgeItem } from '../entities/knowledge-item.entity';

describe('KnowledgeExtractionService', () => {
  let service: KnowledgeExtractionService;

  const mockKnowledgeItemRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeExtractionService,
        {
          provide: getRepositoryToken(KnowledgeItem),
          useValue: mockKnowledgeItemRepository,
        },
      ],
    }).compile();

    service = module.get<KnowledgeExtractionService>(
      KnowledgeExtractionService,
    );

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractTextFromMessage', () => {
    const organizationId = 'org-123';

    it('should extract text from a valid message', () => {
      const message = {
        content: 'Hello, this is a test message',
        id: 'msg-123',
        conversationId: 'conv-456',
        messageType: 'GENERAL',
        metadata: { priority: 'high' },
        createdAt: new Date('2024-01-01'),
      };

      const result = service.extractTextFromMessage(message, organizationId);

      expect(result).toBeDefined();
      expect(result?.content).toBe('Hello, this is a test message');
      expect(result?.source).toBe('conversation:conv-456');
      expect(result?.organizationId).toBe(organizationId);
      expect(result?.metadata).toMatchObject({
        messageId: 'msg-123',
        conversationId: 'conv-456',
        messageType: 'GENERAL',
        priority: 'high',
        extractedLength: 29,
      });
      expect(result?.extractedAt).toBeInstanceOf(Date);
    });

    it('should normalize whitespace in content', () => {
      const message = {
        content: '  Multiple   spaces   and\n\nnewlines  ',
        id: 'msg-123',
        conversationId: 'conv-456',
      };

      const result = service.extractTextFromMessage(message, organizationId);

      expect(result?.content).toBe('Multiple spaces and newlines');
      expect(result?.metadata?.extractedLength).toBe(28);
    });

    it('should handle message without optional fields', () => {
      const message = {
        content: 'Simple message',
      };

      const result = service.extractTextFromMessage(message, organizationId);

      expect(result).toBeDefined();
      expect(result?.content).toBe('Simple message');
      expect(result?.source).toBe('message');
      expect(result?.metadata?.messageId).toBeUndefined();
      expect(result?.metadata?.conversationId).toBeUndefined();
    });

    it('should return null for empty content', () => {
      const message = {
        content: '',
        id: 'msg-123',
      };

      const result = service.extractTextFromMessage(message, organizationId);

      expect(result).toBeNull();
    });

    it('should return null for whitespace-only content', () => {
      const message = {
        content: '   \n\t   ',
        id: 'msg-123',
      };

      const result = service.extractTextFromMessage(message, organizationId);

      expect(result).toBeNull();
    });

    it('should return null for non-string content', () => {
      const message = {
        content: null as any,
        id: 'msg-123',
      };

      const result = service.extractTextFromMessage(message, organizationId);

      expect(result).toBeNull();
    });

    it('should return null for undefined content', () => {
      const message = {
        content: undefined as any,
        id: 'msg-123',
      };

      const result = service.extractTextFromMessage(message, organizationId);

      expect(result).toBeNull();
    });

    it('should handle special characters correctly', () => {
      const message = {
        content: 'Special chars: @#$%^&*(){}[]<>?/\\|~`',
        id: 'msg-123',
        conversationId: 'conv-456',
      };

      const result = service.extractTextFromMessage(message, organizationId);

      expect(result).toBeDefined();
      expect(result?.content).toBe('Special chars: @#$%^&*(){}[]<>?/\\|~`');
    });

    it('should handle unicode and emoji characters', () => {
      const message = {
        content: 'Hello 世界 🌍 emoji test 😀',
        id: 'msg-123',
      };

      const result = service.extractTextFromMessage(message, organizationId);

      expect(result).toBeDefined();
      expect(result?.content).toBe('Hello 世界 🌍 emoji test 😀');
    });
  });

  describe('extractTextFromMessages', () => {
    const organizationId = 'org-123';

    it('should extract text from multiple valid messages', () => {
      const messages = [
        {
          content: 'First message',
          id: 'msg-1',
          conversationId: 'conv-1',
        },
        {
          content: 'Second message',
          id: 'msg-2',
          conversationId: 'conv-1',
        },
        {
          content: 'Third message',
          id: 'msg-3',
          conversationId: 'conv-2',
        },
      ];

      const results = service.extractTextFromMessages(messages, organizationId);

      expect(results).toHaveLength(3);
      expect(results[0].content).toBe('First message');
      expect(results[1].content).toBe('Second message');
      expect(results[2].content).toBe('Third message');
    });

    it('should filter out messages with empty content', () => {
      const messages = [
        {
          content: 'Valid message',
          id: 'msg-1',
        },
        {
          content: '',
          id: 'msg-2',
        },
        {
          content: '   ',
          id: 'msg-3',
        },
        {
          content: 'Another valid message',
          id: 'msg-4',
        },
      ];

      const results = service.extractTextFromMessages(messages, organizationId);

      expect(results).toHaveLength(2);
      expect(results[0].content).toBe('Valid message');
      expect(results[1].content).toBe('Another valid message');
    });

    it('should return empty array for empty input array', () => {
      const results = service.extractTextFromMessages([], organizationId);

      expect(results).toEqual([]);
    });

    it('should return empty array for non-array input', () => {
      const results = service.extractTextFromMessages(
        null as any,
        organizationId,
      );

      expect(results).toEqual([]);
    });

    it('should handle mixed valid and invalid messages', () => {
      const messages = [
        {
          content: 'Valid message 1',
          id: 'msg-1',
        },
        {
          content: null as any,
          id: 'msg-2',
        },
        {
          content: 'Valid message 2',
          id: 'msg-3',
        },
        {
          content: undefined as any,
          id: 'msg-4',
        },
        {
          content: '  ',
          id: 'msg-5',
        },
      ];

      const results = service.extractTextFromMessages(messages, organizationId);

      expect(results).toHaveLength(2);
      expect(results[0].content).toBe('Valid message 1');
      expect(results[1].content).toBe('Valid message 2');
    });

    it('should preserve message order', () => {
      const messages = [
        { content: 'First', id: 'msg-1' },
        { content: 'Second', id: 'msg-2' },
        { content: 'Third', id: 'msg-3' },
      ];

      const results = service.extractTextFromMessages(messages, organizationId);

      expect(results[0].metadata?.messageId).toBe('msg-1');
      expect(results[1].metadata?.messageId).toBe('msg-2');
      expect(results[2].metadata?.messageId).toBe('msg-3');
    });

    it('should handle large batch of messages', () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        content: `Message ${i}`,
        id: `msg-${i}`,
        conversationId: `conv-${Math.floor(i / 10)}`,
      }));

      const results = service.extractTextFromMessages(messages, organizationId);

      expect(results).toHaveLength(100);
      expect(results[0].content).toBe('Message 0');
      expect(results[99].content).toBe('Message 99');
    });
  });
});
