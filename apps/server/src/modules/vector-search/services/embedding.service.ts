import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string;
  private readonly model = 'text-embedding-3-small'; // 1536 dimensions
  private readonly baseUrl = 'https://api.openai.com/v1/embeddings';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not configured - embedding service will not work',
      );
    }
  }

  /**
   * Generate embedding for a given text using OpenAI API
   * @param text - Input text to embed
   * @returns Embedding vector and token count
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const startTime = Date.now();

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: text,
          model: this.model,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>;
        usage: { total_tokens: number };
      };
      const duration = Date.now() - startTime;

      this.logger.debug(
        `Generated embedding in ${duration}ms, tokens: ${data.usage.total_tokens}`,
      );

      return {
        embedding: data.data[0].embedding,
        tokenCount: data.usage.total_tokens,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param texts - Array of texts to embed
   * @returns Array of embedding results
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const startTime = Date.now();

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: texts,
          model: this.model,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>;
        usage: { total_tokens: number };
      };
      const duration = Date.now() - startTime;

      this.logger.debug(
        `Generated ${texts.length} embeddings in ${duration}ms, tokens: ${data.usage.total_tokens}`,
      );

      return data.data.map((item) => ({
        embedding: item.embedding,
        tokenCount: Math.floor(data.usage.total_tokens / texts.length), // Approximate per-text count
      }));
    } catch (error) {
      this.logger.error(
        `Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Convert embedding array to pgvector format string
   * @param embedding - Array of numbers
   * @returns pgvector formatted string
   */
  embeddingToVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  /**
   * Parse pgvector string to array
   * @param vectorString - pgvector formatted string
   * @returns Array of numbers
   */
  vectorToEmbedding(vectorString: string): number[] {
    // Remove brackets and split by comma
    return vectorString
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((n) => parseFloat(n));
  }
}
