import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { GraphNode } from './entities/graph-node.entity';
import { GraphEdge } from './entities/graph-edge.entity';

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;

  const mockGraphNodeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockGraphEdgeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockNode: Partial<GraphNode> = {
    id: 'node-123',
    externalId: 'ext-123',
    externalType: 'document',
    organizationId: 'org-123',
    metadata: { title: 'Test Document' },
  };

  const mockEdge: Partial<GraphEdge> = {
    id: 'edge-123',
    sourceNodeId: 'node-123',
    targetNodeId: 'node-456',
    relationshipType: 'references',
    metadata: { weight: 1.0 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeGraphService,
        {
          provide: getRepositoryToken(GraphNode),
          useValue: mockGraphNodeRepository,
        },
        {
          provide: getRepositoryToken(GraphEdge),
          useValue: mockGraphEdgeRepository,
        },
      ],
    }).compile();

    service = module.get<KnowledgeGraphService>(KnowledgeGraphService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNode', () => {
    it('should create a new node', async () => {
      const nodeData: Partial<GraphNode> = {
        externalId: 'ext-123',
        externalType: 'document',
        organizationId: 'org-123',
      };

      mockGraphNodeRepository.create.mockReturnValue(mockNode);
      mockGraphNodeRepository.save.mockResolvedValue(mockNode);

      const result = await service.createNode(nodeData);

      expect(mockGraphNodeRepository.create).toHaveBeenCalledWith(nodeData);
      expect(mockGraphNodeRepository.save).toHaveBeenCalledWith(mockNode);
      expect(result).toEqual(mockNode);
    });
  });

  describe('createEdge', () => {
    it('should create a new edge', async () => {
      const edgeData: Partial<GraphEdge> = {
        sourceNodeId: 'node-123',
        targetNodeId: 'node-456',
        relationshipType: 'references',
      };

      mockGraphEdgeRepository.create.mockReturnValue(mockEdge);
      mockGraphEdgeRepository.save.mockResolvedValue(mockEdge);

      const result = await service.createEdge(edgeData);

      expect(mockGraphEdgeRepository.create).toHaveBeenCalledWith(edgeData);
      expect(mockGraphEdgeRepository.save).toHaveBeenCalledWith(mockEdge);
      expect(result).toEqual(mockEdge);
    });
  });

  describe('findNodeById', () => {
    it('should return a node when found', async () => {
      mockGraphNodeRepository.findOne.mockResolvedValue(mockNode);

      const result = await service.findNodeById('node-123');

      expect(mockGraphNodeRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'node-123' },
      });
      expect(result).toEqual(mockNode);
    });

    it('should return null when node not found', async () => {
      mockGraphNodeRepository.findOne.mockResolvedValue(null);

      const result = await service.findNodeById('invalid-id');

      expect(mockGraphNodeRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'invalid-id' },
      });
      expect(result).toBeNull();
    });
  });

  describe('findNodesByOrganization', () => {
    it('should return nodes for a specific organization', async () => {
      const nodes = [mockNode];
      mockGraphNodeRepository.find.mockResolvedValue(nodes);

      const result = await service.findNodesByOrganization('org-123');

      expect(mockGraphNodeRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(nodes);
    });

    it('should return empty array if no nodes found', async () => {
      mockGraphNodeRepository.find.mockResolvedValue([]);

      const result = await service.findNodesByOrganization('org-456');

      expect(result).toEqual([]);
    });
  });

  describe('findEdgesByNode', () => {
    it('should return edges for a specific node', async () => {
      const edges = [mockEdge];
      mockGraphEdgeRepository.find.mockResolvedValue(edges);

      const result = await service.findEdgesByNode('node-123');

      expect(mockGraphEdgeRepository.find).toHaveBeenCalledWith({
        where: [{ sourceNodeId: 'node-123' }, { targetNodeId: 'node-123' }],
        relations: ['sourceNode', 'targetNode'],
      });
      expect(result).toEqual(edges);
    });

    it('should return empty array if no edges found', async () => {
      mockGraphEdgeRepository.find.mockResolvedValue([]);

      const result = await service.findEdgesByNode('node-456');

      expect(result).toEqual([]);
    });
  });

  describe('deleteNode', () => {
    it('should delete a node', async () => {
      mockGraphNodeRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deleteNode('node-123');

      expect(mockGraphNodeRepository.delete).toHaveBeenCalledWith('node-123');
    });
  });

  describe('deleteEdge', () => {
    it('should delete an edge', async () => {
      mockGraphEdgeRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deleteEdge('edge-123');

      expect(mockGraphEdgeRepository.delete).toHaveBeenCalledWith('edge-123');
    });
  });
});
