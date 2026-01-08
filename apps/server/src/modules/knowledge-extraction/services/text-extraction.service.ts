import { Injectable } from '@nestjs/common';

export interface ExtractedEntity {
  text: string;
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'TECHNICAL' | 'CONCEPT';
  confidence: number;
  position: { start: number; end: number };
}

export interface ExtractedRelationship {
  source: ExtractedEntity;
  target: ExtractedEntity;
  type: string;
  confidence: number;
}

export interface ExtractedKeyPhrase {
  phrase: string;
  frequency: number;
  importance: number;
  context: string[];
}

export interface ExtractedKnowledge {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  keyPhrases: ExtractedKeyPhrase[];
  summary?: string;
  confidence: number;
}

@Injectable()
export class TextExtractionService {
  private readonly technicalTerms = [
    'machine learning',
    'deep learning',
    'neural network',
    'api',
    'database',
    'kubernetes',
    'docker',
    'microservice',
    'rest api',
    'graphql',
    'typescript',
    'python',
    'javascript',
    'distributed system',
    'load balancing',
    'cache',
    'index',
    'query',
    'transaction',
  ];

  private readonly stopWords = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'but',
    'by',
    'for',
    'from',
    'has',
    'he',
    'in',
    'is',
    'it',
    'its',
    'of',
    'on',
    'or',
    'that',
    'the',
    'to',
    'was',
    'will',
    'with',
  ]);

  async extractKnowledge(
    text: string,
    conversationContext: string[] = [],
  ): Promise<ExtractedKnowledge> {
    if (!text || text.trim().length === 0) {
      return {
        entities: [],
        relationships: [],
        keyPhrases: [],
        confidence: 0,
      };
    }

    const normalizedText = this.normalizeText(text);
    const allContext = [...conversationContext, normalizedText];

    const entities = this.extractEntities(normalizedText);
    const relationships = this.extractRelationships(normalizedText, entities);
    const keyPhrases = this.extractKeyPhrases(normalizedText, allContext);
    const confidence = this.calculateConfidence({
      entities,
      relationships,
      keyPhrases,
    });

    return {
      entities,
      relationships,
      keyPhrases,
      confidence,
    };
  }

  private extractEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    for (const term of this.technicalTerms) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type: 'TECHNICAL',
          confidence: 0.9,
          position: { start: match.index, end: match.index + match[0].length },
        });
      }
    }

    const namePattern = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g;
    let match;
    while ((match = namePattern.exec(text)) !== null) {
      if (!this.isCommonWord(match[0])) {
        entities.push({
          text: match[0],
          type: 'PERSON',
          confidence: 0.6,
          position: { start: match.index, end: match.index + match[0].length },
        });
      }
    }

    const conceptPattern = /["']([^"']+)["']|\(([^)]+)\)/g;
    while ((match = conceptPattern.exec(text)) !== null) {
      const concept = match[1] || match[2];
      entities.push({
        text: concept.trim(),
        type: 'CONCEPT',
        confidence: 0.75,
        position: { start: match.index, end: match.index + match[0].length },
      });
    }

    return this.deduplicateEntities(entities).sort(
      (a, b) => a.position.start - b.position.start,
    );
  }

  private extractRelationships(
    text: string,
    entities: ExtractedEntity[],
  ): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];

    if (entities.length < 2) {
      return relationships;
    }

    const relationshipPatterns = [
      { pattern: /is\s+(?:a|an|the)\s+/i, type: 'is_a' },
      { pattern: /is\s+part\s+of\s+/i, type: 'part_of' },
      { pattern: /works\s+at|works\s+with\s+/i, type: 'works_at' },
      { pattern: /uses\s+/i, type: 'uses' },
      { pattern: /related\s+to\s+/i, type: 'related_to' },
      { pattern: /depends\s+on\s+/i, type: 'depends_on' },
    ];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        const betweenText = text.substring(
          entity1.position.end,
          entity2.position.start,
        );

        for (const { pattern, type } of relationshipPatterns) {
          if (pattern.test(betweenText)) {
            relationships.push({
              source: entity1,
              target: entity2,
              type,
              confidence: 0.7,
            });
            break;
          }
        }
      }
    }

    return relationships;
  }

  private extractKeyPhrases(
    text: string,
    contextTexts: string[],
  ): ExtractedKeyPhrase[] {
    const phrases = new Map<string, ExtractedKeyPhrase>();
    const words = this.tokenize(text);

    for (let n = 1; n <= 3; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const phrase = words
          .slice(i, i + n)
          .join(' ')
          .toLowerCase();

        if (n > 1 && words.slice(i, i + n).some((w) => this.stopWords.has(w))) {
          continue;
        }

        const frequency = this.countOccurrences(text.toLowerCase(), phrase);

        if (frequency > 0) {
          const importance = this.calculatePhraseImportance(
            phrase,
            frequency,
            contextTexts,
          );

          if (importance > 0.1 && !phrases.has(phrase)) {
            phrases.set(phrase, {
              phrase,
              frequency,
              importance,
              context: this.extractPhraseContext(text, phrase),
            });
          }
        }
      }
    }

    return Array.from(phrases.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 20);
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'");
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, ''))
      .filter((word) => word.length > 0);
  }

  private countOccurrences(text: string, phrase: string): number {
    const regex = new RegExp(
      `\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'gi',
    );
    return (text.match(regex) || []).length;
  }

  private calculatePhraseImportance(
    phrase: string,
    frequency: number,
    contextTexts: string[],
  ): number {
    const tf = Math.min(frequency / 5, 1);

    let contextCount = 0;
    for (const contextText of contextTexts) {
      if (contextText.toLowerCase().includes(phrase.toLowerCase())) {
        contextCount++;
      }
    }
    const idf =
      contextTexts.length > 0
        ? Math.log(contextTexts.length / (contextCount + 1))
        : 1;
    const normalizedIdf = Math.min(idf / 3, 1);

    const words = phrase.split(/\s+/).length;
    const lengthBonus = Math.min(words / 5, 1);

    return tf * 0.5 + normalizedIdf * 0.3 + lengthBonus * 0.2;
  }

  private extractPhraseContext(text: string, phrase: string): string[] {
    const contexts: string[] = [];
    const regex = new RegExp(
      `([^.!?]*\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^.!?]*)`,
      'gi',
    );

    let match;
    while ((match = regex.exec(text)) !== null && contexts.length < 3) {
      const context = match[1].trim();
      if (context.length > 0 && !contexts.includes(context)) {
        contexts.push(context);
      }
    }

    return contexts;
  }

  private deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const seen = new Map<string, ExtractedEntity>();

    for (const entity of entities) {
      const key = `${entity.text.toLowerCase()}-${entity.type}`;
      const existing = seen.get(key);
      if (!existing || entity.confidence > existing.confidence) {
        seen.set(key, entity);
      }
    }

    return Array.from(seen.values());
  }

  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'The',
      'This',
      'That',
      'These',
      'Those',
      'Which',
      'What',
      'Where',
      'When',
      'Why',
    ]);
    return commonWords.has(word);
  }

  private calculateConfidence(knowledge: {
    entities: ExtractedEntity[];
    relationships: ExtractedRelationship[];
    keyPhrases: ExtractedKeyPhrase[];
  }): number {
    const scores: number[] = [];

    if (knowledge.entities.length > 0) {
      scores.push(
        knowledge.entities.reduce((sum, e) => sum + e.confidence, 0) /
          knowledge.entities.length,
      );
    }

    if (knowledge.relationships.length > 0) {
      scores.push(
        knowledge.relationships.reduce((sum, r) => sum + r.confidence, 0) /
          knowledge.relationships.length,
      );
    }

    if (knowledge.keyPhrases.length > 0) {
      scores.push(
        knowledge.keyPhrases.reduce((sum, kp) => sum + kp.importance, 0) /
          knowledge.keyPhrases.length,
      );
    }

    return scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;
  }
}
