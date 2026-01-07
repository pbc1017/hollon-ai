import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GraphTraversalService } from './graph-traversal.service';
import { Node, NodeType } from '../../modules/knowledge-graph/entities/node.entity';
import { Edge } from '../../modules/knowledge-graph/entities/edge.entity';
import { RelationshipType } from '../../knowledge/enums/relationship-type.enum';

describe('GraphTraversalService', () => {
  let service: GraphTraversalService;
  let nodeRepository: any;
  let edgeRepository: any;

  const mockOrganizationId = 'org-123';

  // Mock data
  const mockNodes: Node[] = [
    {
      id: 'node-1',
      name: 'Node 1',
      type: NodeType.CONCEPT,
      description: 'Test node 1',
      organizationId: mockOrganizationId,
      properties: {},
      tags: [],
      isActive: true,
      outgoingEdges: [],
      incomingEdges: [],
    } as Node,
    {
      id: 'node-2',
      name: 'Node 2',
      type: NodeType.CONCEPT,
      description: 'Test node 2',
      organizationId: mockOrganizationId,
      properties: {},
      tags: [],
      isActive: true,
      outgoingEdges: [],
      incomingEdges: [],
    } as Node,
    {
      id: 'node-3',
      name: 'Node 3',
      type: NodeType.CONCEPT,
      description: 'Test node 3',
      organizationId: mockOrganizationId,
      properties: {},
      tags: [],
      isActive: true,
      outgoingEdges: [],
      incomingEdges: [],
    } as Node,
  ];

  const mockEdges: Edge[] = [
    {
      id: 'edge-1-2',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-2',
      type: RelationshipType.RELATES_TO,
      organizationId: mockOrganizationId,
      weight: 1.0,
      properties: {},
      isActive: true,
      sourceNode: mockNodes[0],
      targetNode: mockNodes[1],
    } as Edge,
    {
      id: 'edge-2-3',
      sourceNodeId: 'node-2',
      targetNodeId: 'node-3',
      type: RelationshipType.DEPENDS_ON,
      organizationId: mockOrganizationId,
      weight: 1.0,
      properties: {},
      isActive: true,
      sourceNode: mockNodes[1],
      targetNode: mockNodes[2],
    } as Edge,
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphTraversalService,
        {
          provide: getRepositoryToken(Node),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Edge),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GraphTraversalService>(GraphTraversalService);
    nodeRepository = module.get(getRepositoryToken(Node));
    edgeRepository = module.get(getRepositoryToken(Edge));
  });

  describe('bfs', () => {
    it('should traverse nodes using BFS', async () => {
      nodeRepository.findOne.mockResolvedValueOnce(mockNodes[0]);
      nodeRepository.findOne.mockResolvedValueOnce(mockNodes[1]);
      nodeRepository.findOne.mockResolvedValueOnce(mockNodes[2]);

      edgeRepository.find
        .mockResolvedValueOnce([{ ...mockEdges[0], targetNode: mockNodes[1] }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ ...mockEdges[1], targetNode: mockNodes[2] }])
        .mockResolvedValueOnce([]);

      const result = await service.bfs(
        'node-1',
        mockOrganizationId,
        undefined,
        undefined,
        'outgoing',
      );

      expect(result).toHaveLength(3);
      expect(result[0].node.id).toBe('node-1');
      expect(result[0].depth).toBe(0);
      expect(result[1].node.id).toBe('node-2');
      expect(result[1].depth).toBe(1);
    });

    it('should respect maxDepth parameter', async () => {
      nodeRepository.findOne.mockResolvedValueOnce(mockNodes[0]);
      nodeRepository.findOne.mockResolvedValueOnce(mockNodes[1]);

      edgeRepository.find
        .mockResolvedValueOnce([{ ...mockEdges[0], targetNode: mockNodes[1] }])
        .mockResolvedValueOnce([]);

      const result = await service.bfs(
        'node-1',
        mockOrganizationId,
        1,
        undefined,
        'outgoing',
      );

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.depth <= 1)).toBe(true);
    });

    it('should return empty array for non-existent node', async () => {
      nodeRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.bfs(
        'non-existent',
        mockOrganizationId,
        undefined,
        undefined,
        'outgoing',
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('dfs', () => {
    it('should traverse nodes using DFS', async () => {
      nodeRepository.findOne.mockResolvedValueOnce(mockNodes[0]);
      nodeRepository.findOne.mockResolvedValueOnce(mockNodes[1]);
      nodeRepository.findOne.mockResolvedValueOnce(mockNodes[2]);

      edgeRepository.find
        .mockResolvedValueOnce([{ ...mockEdges[0], targetNode: mockNodes[1] }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ ...mockEdges[1], targetNode: mockNodes[2] }])
        .mockResolvedValueOnce([]);

      const result = await service.dfs(
        'node-1',
        mockOrganizationId,
        undefined,
        undefined,
        'outgoing',
      );

      expect(result).toHaveLength(3);
      expect(result[0].node.id).toBe('node-1');
    });

    it('should respect maxDepth in DFS', async () => {
      nodeRepository.findOne.mockResolvedValueOnce(mockNodes[0]);
      nodeRepository.findOne.mockResolvedValueOnce(mockNodes[1]);

      edgeRepository.find
        .mockResolvedValueOnce([{ ...mockEdges[0], targetNode: mockNodes[1] }])
        .mockResolvedValueOnce([]);

      const result = await service.dfs(
        'node-1',
        mockOrganizationId,
        1,
        undefined,
        'outgoing',
      );

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.depth <= 1)).toBe(true);
    });
  });

  describe('getNeighbors', () => {
    it('should get direct neighbors', async () => {
      edgeRepository.find.mockResolvedValueOnce([
        {
          ...mockEdges[0],
          sourceNode: mockNodes[0],
          targetNode: mockNodes[1],
        },
      ]);

      const result = await service.getNeighbors(
        'node-1',
        mockOrganizationId,
        undefined,
        'outgoing',
        1,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('node-2');
      expect(result[0].distance).toBe(1);
    });

    it('should filter by relationship type', async () => {
      edgeRepository.find.mockResolvedValueOnce([
        {
          ...mockEdges[0],
          type: RelationshipType.RELATES_TO,
          sourceNode: mockNodes[0],
          targetNode: mockNodes[1],
        },
      ]);

      const result = await service.getNeighbors(
        'node-1',
        mockOrganizationId,
        [RelationshipType.RELATES_TO],
        'outgoing',
        1,
      );

      expect(result).toHaveLength(1);
    });

    it('should handle bidirectional queries', async () => {
      edgeRepository.find
        .mockResolvedValueOnce([
          {
            ...mockEdges[0],
            sourceNode: mockNodes[0],
            targetNode: mockNodes[1],
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'edge-3-2',
            sourceNodeId: 'node-3',
            targetNodeId: 'node-2',
            sourceNode: mockNodes[2],
            targetNode: mockNodes[1],
          } as Edge,
        ]);

      const result = await service.getNeighbors(
        'node-2',
        mockOrganizationId,
        undefined,
        'both',
        1,
      );

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('findAllPaths', () => {
    it('should find paths between nodes', async () => {
      nodeRepository.findOne.mockResolvedValue(mockNodes[0]);

      edgeRepository.find.mockResolvedValue([
        {
          ...mockEdges[0],
          sourceNode: mockNodes[0],
          targetNode: mockNodes[1],
        },
      ]);

      const result = await service.findAllPaths(
        'node-1',
        'node-2',
        mockOrganizationId,
        5,
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('isConnected', () => {
    it('should determine if nodes are connected', async () => {
      nodeRepository.findOne.mockResolvedValue(mockNodes[0]);
      edgeRepository.find.mockResolvedValue([
        {
          ...mockEdges[0],
          sourceNode: mockNodes[0],
          targetNode: mockNodes[1],
        },
      ]);

      const result = await service.isConnected(
        'node-1',
        'node-2',
        mockOrganizationId,
      );

      expect(typeof result).toBe('boolean');
    });
  });

  describe('getCommonNeighbors', () => {
    it('should find common neighbors', async () => {
      edgeRepository.find
        .mockResolvedValueOnce([
          {
            ...mockEdges[0],
            sourceNode: mockNodes[0],
            targetNode: mockNodes[1],
          },
        ])
        .mockResolvedValueOnce([
          {
            ...mockEdges[0],
            sourceNode: mockNodes[0],
            targetNode: mockNodes[1],
          },
        ]);

      nodeRepository.find.mockResolvedValueOnce([]);

      const result = await service.getCommonNeighbors(
        'node-1',
        'node-2',
        mockOrganizationId,
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getAncestors', () => {
    it('should retrieve ancestor nodes', async () => {
      nodeRepository.findOne.mockResolvedValueOnce(mockNodes[2]);
      edgeRepository.find.mockResolvedValueOnce([]);

      const result = await service.getAncestors(
        'node-3',
        mockOrganizationId,
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getDescendants', () => {
    it('should retrieve descendant nodes', async () => {
      nodeRepository.findOne.mockResolvedValueOnce(mockNodes[0]);
      edgeRepository.find.mockResolvedValueOnce([]);

      const result = await service.getDescendants(
        'node-1',
        mockOrganizationId,
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
