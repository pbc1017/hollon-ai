import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { Node, NodeType } from './entities/node.entity';
import { Edge } from './entities/edge.entity';
import { RelationshipType } from '@/knowledge/enums/relationship-type.enum';

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;

  const mockNodeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockEdgeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockNode: Partial<Node> = {
    id: 'node-123',
    name: 'Test Document',
    type: NodeType.DOCUMENT,
    organizationId: 'org-123',
    description: 'A test document',
    properties: { title: 'Test Document' },
    tags: ['test'],
    isActive: true,
  };

  const mockEdge: Partial<Edge> = {
    id: 'edge-123',
    organizationId: 'org-123',
    sourceNodeId: 'node-123',
    targetNodeId: 'node-456',
    type: RelationshipType.REFERENCES,
    weight: 1.0,
    properties: { metadata: 'test' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeGraphService,
        {
          provide: getRepositoryToken(Node),
          useValue: mockNodeRepository,
        },
        {
          provide: getRepositoryToken(Edge),
          useValue: mockEdgeRepository,
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
      const nodeData: Partial<Node> = {
        name: 'Test Document',
        type: NodeType.DOCUMENT,
        organizationId: 'org-123',
      };

      mockNodeRepository.create.mockReturnValue(mockNode);
      mockNodeRepository.save.mockResolvedValue(mockNode);

      const result = await service.createNode(nodeData);

      expect(mockNodeRepository.create).toHaveBeenCalledWith(nodeData);
      expect(mockNodeRepository.save).toHaveBeenCalledWith(mockNode);
      expect(result).toEqual(mockNode);
    });
  });

  describe('createEdge', () => {
    it('should create a new edge', async () => {
      const edgeData: Partial<Edge> = {
        organizationId: 'org-123',
        sourceNodeId: 'node-123',
        targetNodeId: 'node-456',
        type: RelationshipType.REFERENCES,
      };

      mockEdgeRepository.create.mockReturnValue(mockEdge);
      mockEdgeRepository.save.mockResolvedValue(mockEdge);

      const result = await service.createEdge(edgeData);

      expect(mockEdgeRepository.create).toHaveBeenCalledWith(edgeData);
      expect(mockEdgeRepository.save).toHaveBeenCalledWith(mockEdge);
      expect(result).toEqual(mockEdge);
    });
  });

  describe('findNodeById', () => {
    it('should return a node when found', async () => {
      mockNodeRepository.findOne.mockResolvedValue(mockNode);

      const result = await service.findNodeById('node-123');

      expect(mockNodeRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'node-123' },
      });
      expect(result).toEqual(mockNode);
    });

    it('should return null when node not found', async () => {
      mockNodeRepository.findOne.mockResolvedValue(null);

      const result = await service.findNodeById('invalid-id');

      expect(mockNodeRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'invalid-id' },
      });
      expect(result).toBeNull();
    });
  });

  describe('findNodesByOrganization', () => {
    it('should return nodes for a specific organization', async () => {
      const nodes = [mockNode];
      mockNodeRepository.find.mockResolvedValue(nodes);

      const result = await service.findNodesByOrganization('org-123');

      expect(mockNodeRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(nodes);
    });

    it('should return empty array if no nodes found', async () => {
      mockNodeRepository.find.mockResolvedValue([]);

      const result = await service.findNodesByOrganization('org-456');

      expect(result).toEqual([]);
    });
  });

  describe('findEdgesByNode', () => {
    it('should return edges for a specific node', async () => {
      const edges = [mockEdge];
      mockEdgeRepository.find.mockResolvedValue(edges);

      const result = await service.findEdgesByNode('node-123');

      expect(mockEdgeRepository.find).toHaveBeenCalledWith({
        where: [{ sourceNodeId: 'node-123' }, { targetNodeId: 'node-123' }],
        relations: ['sourceNode', 'targetNode'],
      });
      expect(result).toEqual(edges);
    });

    it('should return empty array if no edges found', async () => {
      mockEdgeRepository.find.mockResolvedValue([]);

      const result = await service.findEdgesByNode('node-456');

      expect(result).toEqual([]);
    });
  });

  describe('deleteNode', () => {
    it('should delete a node', async () => {
      mockNodeRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deleteNode('node-123');

      expect(mockNodeRepository.delete).toHaveBeenCalledWith('node-123');
    });
  });

  describe('deleteEdge', () => {
    it('should delete an edge', async () => {
      mockEdgeRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deleteEdge('edge-123');

      expect(mockEdgeRepository.delete).toHaveBeenCalledWith('edge-123');
    });
  });
});
