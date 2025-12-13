import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenAIProvider } from './openai.provider';
import { BrainExecutionError } from '../exceptions/brain-execution.error';

// Mock OpenAI
jest.mock('openai');

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  const mockOpenAIClient = {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                OPENAI_API_KEY: 'test-api-key',
                OPENAI_MAX_REQUESTS_PER_MINUTE: 60,
                OPENAI_MODEL: 'gpt-4-turbo-preview',
                OPENAI_TIMEOUT_MS: 120000,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<OpenAIProvider>(OpenAIProvider);

    // Replace the OpenAI client with our mock
    (provider as any).client = mockOpenAIClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should successfully execute a request', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4-turbo-preview',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Test response',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await provider.execute({
        prompt: 'Test prompt',
        systemPrompt: 'You are a helpful assistant',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Test response');
      expect(result.cost.inputTokens).toBe(10);
      expect(result.cost.outputTokens).toBe(5);
      expect(result.metadata).toEqual({
        model: 'gpt-4-turbo-preview',
        finishReason: 'stop',
        id: 'chatcmpl-123',
      });
    });

    it('should include system prompt when provided', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4-turbo-preview',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.execute({
        prompt: 'Test prompt',
        systemPrompt: 'Custom system prompt',
      });

      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'Custom system prompt' },
            { role: 'user', content: 'Test prompt' },
          ],
        }),
      );
    });

    it('should handle API errors', async () => {
      mockOpenAIClient.chat.completions.create.mockRejectedValue(
        new Error('API Error'),
      );

      await expect(
        provider.execute({
          prompt: 'Test prompt',
        }),
      ).rejects.toThrow(BrainExecutionError);
    });

    it('should respect timeout option', async () => {
      mockOpenAIClient.chat.completions.create.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  id: 'test',
                  model: 'gpt-4',
                  choices: [
                    { message: { content: 'Response' }, finish_reason: 'stop' },
                  ],
                  usage: {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                  },
                }),
              2000,
            ),
          ),
      );

      await expect(
        provider.execute({
          prompt: 'Test prompt',
          options: { timeoutMs: 100 },
        }),
      ).rejects.toThrow('timed out');
    });

    it('should respect max tokens option', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4-turbo-preview',
        choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.execute({
        prompt: 'Test prompt',
        options: { maxTokens: 500 },
      });

      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 500,
        }),
      );
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is healthy', async () => {
      const mockResponse = {
        id: 'test',
        model: 'gpt-4',
        choices: [{ message: { content: 'pong' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };

      mockOpenAIClient.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await provider.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when API is unhealthy', async () => {
      mockOpenAIClient.chat.completions.create.mockRejectedValue(
        new Error('Service unavailable'),
      );

      const result = await provider.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return rate limit status', () => {
      const status = provider.getRateLimitStatus();

      expect(status).toHaveProperty('requestsInLastMinute');
      expect(status).toHaveProperty('remainingSlots');
      expect(status).toHaveProperty('isLimited');
    });
  });
});
