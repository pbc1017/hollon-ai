import { Injectable } from '@nestjs/common';

export interface SimilarityResult {
  itemId1: string;
  itemId2: string;
  similarity: number;
  isDuplicate: boolean;
  reason?: string;
}

export interface DuplicateGroup {
  canonical: { id: string; content: string };
  duplicates: Array<{ id: string; content: string; similarity: number }>;
  confidenceScore: number;
}

export interface DeduplicationConfig {
  similarityThreshold?: number;
  useHashComparison?: boolean;
  hashAlgorithm?: 'md5' | 'sha256';
  minContentLength?: number;
  crossOrganization?: boolean;
}

@Injectable()
export class DeduplicationService {
  async deduplicateItems(
    items: Array<{ id: string; content: string }>,
    config: DeduplicationConfig = {},
  ): Promise<DuplicateGroup[]> {
    if (!items || items.length === 0) {
      return [];
    }

    const { similarityThreshold = 0.85, minContentLength = 10 } = config;

    const validItems = items.filter(
      (item) => item.content && item.content.length >= minContentLength,
    );

    if (validItems.length === 0) {
      return [];
    }

    const duplicateGroups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    for (const item of validItems) {
      if (processed.has(item.id)) {
        continue;
      }

      const similarities: Array<{
        itemId: string;
        content: string;
        similarity: number;
      }> = [];

      for (const compareItem of validItems) {
        if (compareItem.id === item.id || processed.has(compareItem.id)) {
          continue;
        }

        const similarity = this.calculateSimilarity(
          item.content,
          compareItem.content,
        );

        if (similarity >= similarityThreshold) {
          similarities.push({
            itemId: compareItem.id,
            content: compareItem.content,
            similarity,
          });
          processed.add(compareItem.id);
        }
      }

      if (similarities.length > 0) {
        duplicateGroups.push({
          canonical: { id: item.id, content: item.content },
          duplicates: similarities.sort((a, b) => b.similarity - a.similarity),
          confidenceScore:
            similarities.reduce((sum, s) => sum + s.similarity, 0) /
              similarities.length +
            0.1,
        });
      }

      processed.add(item.id);
    }

    return duplicateGroups;
  }

  async compareItems(
    item1: { id: string; content: string },
    item2: { id: string; content: string },
    config: DeduplicationConfig = {},
  ): Promise<SimilarityResult> {
    const { similarityThreshold = 0.85 } = config;
    const similarity = this.calculateSimilarity(item1.content, item2.content);
    const isDuplicate = similarity >= similarityThreshold;

    return {
      itemId1: item1.id,
      itemId2: item2.id,
      similarity,
      isDuplicate,
      reason: this.getComparisonReason(similarity, similarityThreshold),
    };
  }

  async findDuplicates(
    item: { id: string; content: string },
    collection: Array<{ id: string; content: string }>,
    config: DeduplicationConfig = {},
  ): Promise<Array<{ id: string; content: string; similarity: number }>> {
    const { similarityThreshold = 0.85 } = config;
    const duplicates: Array<{
      id: string;
      content: string;
      similarity: number;
    }> = [];

    for (const collectionItem of collection) {
      if (collectionItem.id === item.id) {
        continue;
      }

      const similarity = this.calculateSimilarity(
        item.content,
        collectionItem.content,
      );

      if (similarity >= similarityThreshold) {
        duplicates.push({
          id: collectionItem.id,
          content: collectionItem.content,
          similarity,
        });
      }
    }

    return duplicates.sort((a, b) => b.similarity - a.similarity);
  }

  decideMerges(groups: DuplicateGroup[]): {
    toDelete: string[];
    mergeMap: Map<string, string>;
  } {
    const toDelete: string[] = [];
    const mergeMap = new Map<string, string>();

    for (const group of groups) {
      const canonicalId = group.canonical.id;
      for (const duplicate of group.duplicates) {
        toDelete.push(duplicate.id);
        mergeMap.set(duplicate.id, canonicalId);
      }
    }

    return { toDelete, mergeMap };
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const normalized1 = this.normalizeText(text1);
    const normalized2 = this.normalizeText(text2);

    if (normalized1 === normalized2) {
      return 1.0;
    }

    const jaccardSim = this.calculateJaccardSimilarity(
      normalized1,
      normalized2,
    );
    const cosineSim = this.calculateCosineSimilarity(normalized1, normalized2);
    const lcsRatio = this.calculateLCSRatio(normalized1, normalized2);

    return jaccardSim * 0.4 + cosineSim * 0.4 + lcsRatio * 0.2;
  }

  private calculateJaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateCosineSimilarity(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    const tf1 = this.buildTFVector(words1);
    const tf2 = this.buildTFVector(words2);
    const allWords = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);

    if (allWords.size === 0) {
      return 0;
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const word of allWords) {
      const v1 = tf1[word] || 0;
      const v2 = tf2[word] || 0;
      dotProduct += v1 * v2;
      magnitude1 += v1 * v1;
      magnitude2 += v2 * v2;
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  private calculateLCSRatio(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    const lcsLength = this.getLCSLength(words1, words2);
    const maxLength = Math.max(words1.length, words2.length);
    return maxLength > 0 ? lcsLength / maxLength : 0;
  }

  private getLCSLength(arr1: string[], arr2: string[]): number {
    const m = arr1.length;
    const n = arr2.length;
    const dp = Array(m + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (arr1[i - 1] === arr2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  private buildTFVector(words: string[]): Record<string, number> {
    const tf: Record<string, number> = {};
    for (const word of words) {
      const normalized = word.toLowerCase();
      tf[normalized] = (tf[normalized] || 0) + 1;
    }
    const total = words.length;
    for (const word of Object.keys(tf)) {
      tf[word] = tf[word] / total;
    }
    return tf;
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private getComparisonReason(similarity: number, threshold: number): string {
    if (similarity === 1.0) {
      return 'Exact duplicate';
    }
    if (similarity >= 0.95) {
      return 'Near-exact duplicate';
    }
    if (similarity >= threshold) {
      return `High similarity (${(similarity * 100).toFixed(1)}%)`;
    }
    return `Below threshold (${(similarity * 100).toFixed(1)}%)`;
  }
}
