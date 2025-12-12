import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { KnowledgeRepository } from './knowledge.repository';
import { Document } from '../entities/document.entity';
import { DocumentType } from '../entities/document.entity';

describe('KnowledgeRepository', () => {
  let service: KnowledgeRepository;
  let documentRepo: jest.Mocked<Repository<Document>>;
  let dataSource: jest.Mocked<DataSource>;
  let queryBuilder: jest.Mocked<SelectQueryBuilder<Document>>;

  const mockOrganizationId = 'org-123';
  const mockProjectId = 'project-123';
  const mockTeamId = 'team-123';
  const mockHollonId = 'hollon-123';
  const mockTaskId = 'task-123';

  const mockKnowledgeDocument: Partial<Document> = {
    id: 'doc-123',
    title: 'Test Knowledge',
    content: 'Test content',
    type: DocumentType.KNOWLEDGE,
    organizationId: mockOrganizationId,
    projectId: mockProjectId,
    teamId: mockTeamId,
    hollonId: mockHollonId,
    taskId: mockTaskId,
    tags: ['test', 'knowledge'],
    metadata: { category: 'testing' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Mock QueryBuilder with fluent API
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockKnowledgeDocument]),
      getManyAndCount: jest.fn().mockResolvedValue([[mockKnowledgeDocument], 1]),
      getCount: jest.fn().mockResolvedValue(1),
      getOne: jest.fn().mockResolvedValue(mockKnowledgeDocument),
    } as any;

    // Mock Repository
    const mockRepository = {
      create: jest.fn((data) => ({ ...data, id: 'new-doc-id' })),
      save: jest.fn((doc) => Promise.resolve(doc)),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    // Mock DataSource
    const mockDataSource = {
      transaction: jest.fn((callback) =>
        callback({
          create: jest.fn((entity, data) => ({ ...data, id: 'new-doc-id' })),
          save: jest.fn((entity, data) => Promise.resolve(data)),
          findOne: jest.fn(),
          find: jest.fn(),
          remove: jest.fn(),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeRepository,
        {
          provide: getRepositoryToken(Document),
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<KnowledgeRepository>(KnowledgeRepository);
    documentRepo = module.get(getRepositoryToken(Document));
    dataSource = module.get(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a knowledge document', async () => {
      const createData = {
        title: 'New Knowledge',
        content: 'New content',
        organizationId: mockOrganizationId,
        tags: ['new'],
        metadata: { test: true },
      };

      documentRepo.create.mockReturnValue({
        ...createData,
        type: DocumentType.KNOWLEDGE,
        id: 'new-doc-id',
      } as any);

      documentRepo.save.mockResolvedValue({
        ...createData,
        type: DocumentType.KNOWLEDGE,
        id: 'new-doc-id',
      } as any);

      const result = await service.create(createData);

      expect(documentRepo.create).toHaveBeenCalledWith({
        ...createData,
        type: DocumentType.KNOWLEDGE,
        tags: createData.tags,
        metadata: createData.metadata,
      });
      expect(result.type).toBe(DocumentType.KNOWLEDGE);
    });

    it('should create with default empty tags and metadata', async () => {
      const createData = {
        title: 'New Knowledge',
        content: 'New content',
        organizationId: mockOrganizationId,
      };

      documentRepo.create.mockReturnValue({
        ...createData,
        type: DocumentType.KNOWLEDGE,
        tags: [],
        metadata: {},
      } as any);

      await service.create(createData);

      expect(documentRepo.create).toHaveBeenCalledWith({
        ...createData,
        type: DocumentType.KNOWLEDGE,
        tags: [],
        metadata: {},
      });
    });
  });

  describe('bulkInsert', () => {
    it('should bulk insert multiple documents in transaction', async () => {
      const documents = [
        {
          title: 'Doc 1',
          content: 'Content 1',
          organizationId: mockOrganizationId,
        },
        {
          title: 'Doc 2',
          content: 'Content 2',
          organizationId: mockOrganizationId,
        },
      ];

      const result = await service.bulkInsert(documents);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('findById', () => {
    it('should find a knowledge document by ID', async () => {
      documentRepo.findOne.mockResolvedValue(mockKnowledgeDocument as Document);

      const result = await service.findById('doc-123');

      expect(documentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'doc-123', type: DocumentType.KNOWLEDGE },
        relations: ['organization', 'project', 'hollon'],
      });
      expect(result).toEqual(mockKnowledgeDocument);
    });

    it('should throw NotFoundException if document not found', async () => {
      documentRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByOrganization', () => {
    it('should find knowledge documents by organization', async () => {
      const result = await service.findByOrganization(mockOrganizationId);

      expect(documentRepo.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'doc.organization_id = :orgId',
        { orgId: mockOrganizationId },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('doc.type = :type', {
        type: DocumentType.KNOWLEDGE,
      });
      expect(result).toEqual([mockKnowledgeDocument]);
    });

    it('should apply limit and offset', async () => {
      await service.findByOrganization(mockOrganizationId, {
        limit: 10,
        offset: 5,
      });

      expect(queryBuilder.limit).toHaveBeenCalledWith(10);
      expect(queryBuilder.offset).toHaveBeenCalledWith(5);
    });

    it('should filter by projectId', async () => {
      await service.findByOrganization(mockOrganizationId, {
        projectId: mockProjectId,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.project_id = :projectId',
        { projectId: mockProjectId },
      );
    });

    it('should filter by null projectId for org-level knowledge', async () => {
      await service.findByOrganization(mockOrganizationId, {
        projectId: null,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.project_id IS NULL',
      );
    });
  });

  describe('searchByMetadata', () => {
    it('should search by metadata filters', async () => {
      const metadataFilters = {
        category: 'testing',
        status: 'active',
      };

      await service.searchByMetadata(mockOrganizationId, metadataFilters);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('@>'),
        expect.objectContaining({
          metadata_category: JSON.stringify({ category: 'testing' }),
        }),
      );
    });

    it('should apply optional filters', async () => {
      await service.searchByMetadata(
        mockOrganizationId,
        { category: 'test' },
        { projectId: mockProjectId, limit: 10 },
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'doc.project_id = :projectId',
        { projectId: mockProjectId },
      );
      expect(queryBuilder.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('searchByTags', () => {
    it('should search by tags with OR logic (default)', async () => {
      const tags = ['test', 'knowledge'];

      await service.searchByTags(mockOrganizationId, tags);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('doc.tags && :tags', {
        tags,
      });
    });

    it('should search by tags with AND logic', async () => {
      const tags = ['test', 'knowledge'];

      await service.searchByTags(mockOrganizationId, tags, { matchAll: true });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('doc.tags @> :tags', {
        tags,
      });
    });
  });

  describe('findByHollon', () => {
    it('should find documents by hollon ID', async () => {
      await service.findByHollon(mockHollonId);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'doc.hollon_id = :hollonId',
        { hollonId: mockHollonId },
      );
    });
  });

  describe('findByTask', () => {
    it('should find documents by task ID', async () => {
      await service.findByTask(mockTaskId);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'doc.task_id = :taskId',
        { taskId: mockTaskId },
      );
    });
  });

  describe('findByProject', () => {
    it('should find documents by project ID', async () => {
      await service.findByProject(mockProjectId);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'doc.project_id = :projectId',
        { projectId: mockProjectId },
      );
    });

    it('should include relations when requested', async () => {
      await service.findByProject(mockProjectId, { includeRelations: true });

      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'doc.organization',
        'organization',
      );
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'doc.project',
        'project',
      );
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'doc.hollon',
        'hollon',
      );
    });
  });

  describe('findByMultipleRelations', () => {
    it('should find documents by multiple relations', async () => {
      const filters = {
        organizationId: mockOrganizationId,
        projectIds: [mockProjectId],
        teamIds: [mockTeamId],
        hollonIds: [mockHollonId],
        taskIds: [mockTaskId],
        tags: ['test'],
      };

      await service.findByMultipleRelations(filters);

      expect(queryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a knowledge document', async () => {
      const updates = {
        title: 'Updated Title',
        content: 'Updated Content',
      };

      const mockManager = {
        findOne: jest.fn().mockResolvedValue(mockKnowledgeDocument),
        save: jest
          .fn()
          .mockResolvedValue({ ...mockKnowledgeDocument, ...updates }),
      };

      dataSource.transaction.mockImplementation((callback) =>
        callback(mockManager),
      );

      const result = await service.update('doc-123', updates);

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if document not found during update', async () => {
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      dataSource.transaction.mockImplementation((callback) =>
        callback(mockManager),
      );

      await expect(
        service.update('non-existent', { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a knowledge document', async () => {
      documentRepo.findOne.mockResolvedValue(mockKnowledgeDocument as Document);
      documentRepo.remove.mockResolvedValue(mockKnowledgeDocument as Document);

      await service.delete('doc-123');

      expect(documentRepo.remove).toHaveBeenCalledWith(mockKnowledgeDocument);
    });
  });

  describe('bulkDelete', () => {
    it('should bulk delete documents in transaction', async () => {
      const ids = ['doc-1', 'doc-2'];
      const mockDocuments = [
        { ...mockKnowledgeDocument, id: 'doc-1' },
        { ...mockKnowledgeDocument, id: 'doc-2' },
      ];

      const mockManager = {
        find: jest.fn().mockResolvedValue(mockDocuments),
        remove: jest.fn().mockResolvedValue(mockDocuments),
      };

      dataSource.transaction.mockImplementation((callback) =>
        callback(mockManager),
      );

      await service.bulkDelete(ids);

      expect(mockManager.remove).toHaveBeenCalledWith(Document, mockDocuments);
    });

    it('should throw NotFoundException if some documents not found', async () => {
      const ids = ['doc-1', 'doc-2', 'doc-3'];
      const mockDocuments = [
        { ...mockKnowledgeDocument, id: 'doc-1' },
        { ...mockKnowledgeDocument, id: 'doc-2' },
      ];

      const mockManager = {
        find: jest.fn().mockResolvedValue(mockDocuments),
      };

      dataSource.transaction.mockImplementation((callback) =>
        callback(mockManager),
      );

      await expect(service.bulkDelete(ids)).rejects.toThrow(NotFoundException);
    });
  });

  describe('countByOrganization', () => {
    it('should count knowledge documents', async () => {
      queryBuilder.getCount.mockResolvedValue(5);

      const count = await service.countByOrganization(mockOrganizationId);

      expect(count).toBe(5);
    });

    it('should count with filters', async () => {
      queryBuilder.getCount.mockResolvedValue(3);

      const count = await service.countByOrganization(mockOrganizationId, {
        projectId: mockProjectId,
        teamId: mockTeamId,
      });

      expect(count).toBe(3);
    });
  });

  describe('findWithPagination', () => {
    it('should return paginated results', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([
        [mockKnowledgeDocument],
        10,
      ]);

      const result = await service.findWithPagination(mockOrganizationId, 1, 10);

      expect(result).toEqual({
        data: [mockKnowledgeDocument],
        total: 10,
        page: 1,
        pageSize: 10,
      });
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should handle page 2', async () => {
      await service.findWithPagination(mockOrganizationId, 2, 10);

      expect(queryBuilder.skip).toHaveBeenCalledWith(10);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
    });
  });
});
