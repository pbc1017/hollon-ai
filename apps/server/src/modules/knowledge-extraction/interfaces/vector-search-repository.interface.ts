export interface VectorSearchResult {
  itemId: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorSearchOptions {
  limit?: number;
  threshold?: number;
  organizationId?: string;
  types?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface HybridSearchOptions extends VectorSearchOptions {
  semanticWeight?: number;
  lexicalWeight?: number;
}

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
  normalize?: boolean;
}

export interface IVectorSearchRepository {
  generateEmbedding(
    text: string,
    options?: EmbeddingOptions,
  ): Promise<number[]>;
  indexItem(
    itemId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  removeFromIndex(itemId: string): Promise<void>;
  updateIndex(
    itemId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  searchSimilar(
    query: string,
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]>;
  searchSimilarById(
    itemId: string,
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]>;
  hybridSearch(
    query: string,
    options?: HybridSearchOptions,
  ): Promise<VectorSearchResult[]>;
  batchIndex(
    items: Array<{
      itemId: string;
      content: string;
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<void>;
  batchRemoveFromIndex(itemIds: string[]): Promise<number>;
  clearIndex(): Promise<number>;
  getIndexStats(): Promise<{
    totalItems: number;
    indexSize: number;
    lastUpdated: Date;
  }>;
  rebuildIndex(organizationId?: string): Promise<number>;
  isIndexed(itemId: string): Promise<boolean>;
  getEmbedding(itemId: string): Promise<number[] | null>;
}
