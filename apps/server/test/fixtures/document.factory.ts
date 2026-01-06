import { Repository, DeepPartial } from 'typeorm';
import {
  Document,
  DocumentType,
} from '../../src/modules/document/entities/document.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test Data Factory for Document entity
 * Provides methods to create test documents with unique titles
 */
export class DocumentFactory {
  /**
   * Create document data (not persisted)
   * @param overrides - Partial document data to override defaults
   */
  static create(overrides?: Partial<Document>): DeepPartial<Document> {
    const uniqueId = uuidv4().slice(0, 8);
    return {
      title: `Test_Document_${uniqueId}`,
      content: 'Auto-generated test document content',
      type: DocumentType.KNOWLEDGE,
      tags: ['test'],
      metadata: {},
      ...overrides,
    };
  }

  /**
   * Create and persist document to database
   * @param repo - TypeORM repository for Document
   * @param overrides - Partial document data to override defaults
   */
  static async createPersisted(
    repo: Repository<Document>,
    overrides?: Partial<Document>,
  ): Promise<Document> {
    const document = this.create(overrides);
    return repo.save(document);
  }

  /**
   * Create multiple documents
   * @param count - Number of documents to create
   * @param overrides - Partial document data to override defaults
   */
  static createMany(
    count: number,
    overrides?: Partial<Document>,
  ): DeepPartial<Document>[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create and persist multiple documents
   * @param repo - TypeORM repository for Document
   * @param count - Number of documents to create
   * @param overrides - Partial document data to override defaults
   */
  static async createManyPersisted(
    repo: Repository<Document>,
    count: number,
    overrides?: Partial<Document>,
  ): Promise<Document[]> {
    const documents = this.createMany(count, overrides);
    return repo.save(documents);
  }

  /**
   * Create SSOT knowledge document (for Phase 3.5 testing)
   */
  static createKnowledge(
    organizationId: string,
    projectId: string,
    content: string,
  ): DeepPartial<Document> {
    const uniqueId = uuidv4().slice(0, 8);
    return {
      title: `SSOT_Knowledge_${uniqueId}`,
      content,
      type: DocumentType.KNOWLEDGE,
      organizationId,
      projectId,
      tags: ['ssot', 'knowledge'],
      metadata: { source: 'test-fixture' },
    };
  }
}
