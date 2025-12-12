import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeVersionService } from './knowledge-version.service';
import {
  KnowledgeVersion,
  ChangeType,
} from '../entities/knowledge-version.entity';
import { Document, DocumentType } from '../entities/document.entity';

describe('KnowledgeVersionService', () => {
  let service: KnowledgeVersionService;
  let versionRepository: Repository<KnowledgeVersion>;
  let documentRepository: Repository<Document>;

  const mockDocument = {
    id: 'doc-1',
    title: 'Test Knowledge',
    content: 'Line 1\nLine 2\nLine 3',
    type: DocumentType.KNOWLEDGE,
    organizationId: 'org-1',
    taskId: 'task-1',
    tags: ['typescript', 'nestjs'],
    metadata: { priority: 'P1', filesChanged: ['file1.ts'] },
    teamId: null,
    projectId: null,
    hollonId: null,
    embedding: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Document;

  const mockVersion = {
    id: 'version-1',
    documentId: 'doc-1',
    taskId: 'task-1',
    version: 1,
    title: 'Test Knowledge',
    content: 'Line 1\nLine 2',
    tags: ['typescript'],
    metadata: { priority: 'P1' },
    changeTypes: [ChangeType.CREATED],
    changeSummary: 'Initial version created',
    diff: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as KnowledgeVersion;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeVersionService,
        {
          provide: getRepositoryToken(KnowledgeVersion),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Document),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<KnowledgeVersionService>(KnowledgeVersionService);
    versionRepository = module.get<Repository<KnowledgeVersion>>(
      getRepositoryToken(KnowledgeVersion),
    );
    documentRepository = module.get<Repository<Document>>(
      getRepositoryToken(Document),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createVersion', () => {
    it('should create initial version without previous version', async () => {
      const savedVersion = { ...mockVersion, id: 'new-version-1' };
      jest.spyOn(versionRepository, 'create').mockReturnValue(savedVersion);
      jest.spyOn(versionRepository, 'save').mockResolvedValue(savedVersion);

      const result = await service.createVersion(mockDocument);

      expect(result).toEqual(savedVersion);
      expect(versionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: mockDocument.id,
          taskId: mockDocument.taskId,
          version: 1,
          changeTypes: [ChangeType.CREATED],
          changeSummary: 'Initial version created',
        }),
      );
    });

    it('should create version with diff when previous version exists', async () => {
      const updatedDoc = {
        ...mockDocument,
        content: 'Line 1\nLine 2\nLine 3\nLine 4',
        tags: ['typescript', 'nestjs', 'testing'],
      };

      const newVersion = {
        ...mockVersion,
        version: 2,
        changeTypes: [
          ChangeType.UPDATED,
          ChangeType.CONTENT_CHANGED,
          ChangeType.TAGS_CHANGED,
        ],
      };

      jest.spyOn(versionRepository, 'create').mockReturnValue(newVersion);
      jest.spyOn(versionRepository, 'save').mockResolvedValue(newVersion);

      const result = await service.createVersion(updatedDoc, mockVersion);

      expect(result.version).toBe(2);
      expect(result.changeTypes).toContain(ChangeType.UPDATED);
      expect(result.changeTypes).toContain(ChangeType.CONTENT_CHANGED);
      expect(result.changeTypes).toContain(ChangeType.TAGS_CHANGED);
      expect(result.diff).toBeDefined();
    });
  });

  describe('getLatestVersion', () => {
    it('should return latest version for document', async () => {
      jest.spyOn(versionRepository, 'findOne').mockResolvedValue(mockVersion);

      const result = await service.getLatestVersion('doc-1');

      expect(result).toEqual(mockVersion);
      expect(versionRepository.findOne).toHaveBeenCalledWith({
        where: { documentId: 'doc-1' },
        order: { version: 'DESC' },
      });
    });

    it('should return null when no versions exist', async () => {
      jest.spyOn(versionRepository, 'findOne').mockResolvedValue(null);

      const result = await service.getLatestVersion('doc-1');

      expect(result).toBeNull();
    });
  });

  describe('getVersionHistory', () => {
    it('should return all versions ordered by version number', async () => {
      const versions = [
        { ...mockVersion, version: 1 },
        { ...mockVersion, version: 2 },
        { ...mockVersion, version: 3 },
      ];
      jest.spyOn(versionRepository, 'find').mockResolvedValue(versions);

      const result = await service.getVersionHistory('doc-1');

      expect(result).toEqual(versions);
      expect(result).toHaveLength(3);
      expect(versionRepository.find).toHaveBeenCalledWith({
        where: { documentId: 'doc-1' },
        order: { version: 'ASC' },
      });
    });
  });

  describe('getVersionByNumber', () => {
    it('should return specific version by number', async () => {
      jest.spyOn(versionRepository, 'findOne').mockResolvedValue(mockVersion);

      const result = await service.getVersionByNumber('doc-1', 1);

      expect(result).toEqual(mockVersion);
      expect(versionRepository.findOne).toHaveBeenCalledWith({
        where: { documentId: 'doc-1', version: 1 },
      });
    });
  });

  describe('getVersionsByTask', () => {
    it('should return all versions for a task', async () => {
      const versions = [mockVersion];
      jest.spyOn(versionRepository, 'find').mockResolvedValue(versions);

      const result = await service.getVersionsByTask('task-1');

      expect(result).toEqual(versions);
      expect(versionRepository.find).toHaveBeenCalledWith({
        where: { taskId: 'task-1' },
        order: { version: 'ASC' },
      });
    });
  });

  describe('findKnowledgeDocumentByTask', () => {
    it('should find knowledge document by task ID', async () => {
      jest.spyOn(documentRepository, 'findOne').mockResolvedValue(mockDocument);

      const result = await service.findKnowledgeDocumentByTask('task-1');

      expect(result).toEqual(mockDocument);
      expect(documentRepository.findOne).toHaveBeenCalledWith({
        where: {
          taskId: 'task-1',
          type: DocumentType.KNOWLEDGE,
        },
      });
    });

    it('should return null when no knowledge document exists', async () => {
      jest.spyOn(documentRepository, 'findOne').mockResolvedValue(null);

      const result = await service.findKnowledgeDocumentByTask('task-1');

      expect(result).toBeNull();
    });
  });

  describe('diff calculation', () => {
    it('should detect content changes', async () => {
      const oldVersion = {
        ...mockVersion,
        content: 'Line 1\nLine 2',
      };

      const newDoc = {
        ...mockDocument,
        content: 'Line 1\nLine 2 modified\nLine 3',
      };

      jest
        .spyOn(versionRepository, 'create')
        .mockImplementation((data) => data as KnowledgeVersion);
      jest
        .spyOn(versionRepository, 'save')
        .mockImplementation((data) =>
          Promise.resolve(data as KnowledgeVersion),
        );

      const result = await service.createVersion(newDoc, oldVersion);

      expect(result.diff?.content).toBeDefined();
      expect(result.diff?.content?.additions).toBeGreaterThan(0);
      expect(result.changeTypes).toContain(ChangeType.CONTENT_CHANGED);
    });

    it('should detect tag changes', async () => {
      const oldVersion = {
        ...mockVersion,
        tags: ['typescript'],
      };

      const newDoc = {
        ...mockDocument,
        tags: ['typescript', 'nestjs', 'testing'],
      };

      jest
        .spyOn(versionRepository, 'create')
        .mockImplementation((data) => data as KnowledgeVersion);
      jest
        .spyOn(versionRepository, 'save')
        .mockImplementation((data) =>
          Promise.resolve(data as KnowledgeVersion),
        );

      const result = await service.createVersion(newDoc, oldVersion);

      expect(result.diff?.tags).toBeDefined();
      expect(result.diff?.tags?.added).toContain('nestjs');
      expect(result.diff?.tags?.added).toContain('testing');
      expect(result.changeTypes).toContain(ChangeType.TAGS_CHANGED);
    });

    it('should detect metadata changes', async () => {
      const oldVersion = {
        ...mockVersion,
        metadata: { priority: 'P1' },
      };

      const newDoc = {
        ...mockDocument,
        metadata: { priority: 'P2', filesChanged: ['file1.ts'] },
      };

      jest
        .spyOn(versionRepository, 'create')
        .mockImplementation((data) => data as KnowledgeVersion);
      jest
        .spyOn(versionRepository, 'save')
        .mockImplementation((data) =>
          Promise.resolve(data as KnowledgeVersion),
        );

      const result = await service.createVersion(newDoc, oldVersion);

      expect(result.diff?.metadata).toBeDefined();
      expect(result.diff?.metadata?.modified).toBeDefined();
      expect(result.diff?.metadata?.added).toBeDefined();
      expect(result.changeTypes).toContain(ChangeType.METADATA_CHANGED);
    });
  });
});
