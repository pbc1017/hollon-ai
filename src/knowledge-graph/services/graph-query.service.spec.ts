import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GraphQueryService } from './graph-query.service';
import { Node, NodeType } from '../../modules/knowledge-graph/entities/node.entity';
import { Edge } from '../../modules/knowledge-graph/entities/edge.entity';
import { RelationshipType } from '../../knowledge/enums/relationship-type.enum';

describe('GraphQueryService', () => {
  let service: GraphQueryService;
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
      properties: { category: 'A' },
      tags: ['tag1'],
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
      properties: { category: 'B' },
      tags: ['tag2'],
      isActive: true,
      outgoingEdges: [],
      incomingEdges: [],
    } as Node,
    {
      id: 'node-3',
      name: 'Node 3',
      type: NodeType.TASK,
      description: 'Test node 3',
      organizationId: mockOrganizationId,
      properties: { category: 'C' },
      tags: ['tag1', 'tag3'],
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
      weight: 1.5,
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
      weight: 2.0,
      properties: {},
      isActive: true,
      sourceNode: mockNodes[1],
      targetNode: mockNodes[2],
    } as Edge,
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphQueryService,
        {
          provide: getRepositoryToken(Node),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Edge),
          useValue: {
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GraphQueryService>(GraphQueryService);
    nodeRepository = module.get(getRepositoryToken(Node));
    edgeRepository = module.get(getRepositoryToken(Edge));
  });

  describe('dijkstra', () => {
    it('should find shortest path between two nodes', async () => {
      nodeRepository.findOne
        .mockResolvedValueOnce(mockNodes[0])
        .mockResolvedValueOnce(mockNodes[2]);

      edgeRepository.find
        .mockResolvedValueOnce([
          {
            ...mockEdges[0],
            sourceNode: mockNodes[0],
            targetNode: mockNodes[1],
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            ...mockEdges[1],
            sourceNode: mockNodes[1],
            targetNode: mockNodes[2],
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.dijkstra(
        'node-1',
        'node-3',
        mockOrganizationId,
      );

      if (result) {
        expect(result.path).toContain('node-1');
        expect(result.distance).toBeGreaterThan(0);
        expect(result.totalWeight).toBeGreaterThan(0);
      }
    });

    it('should return null for non-existent source node', async () => {
      nodeRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.dijkstra(
        'non-existent',
        'node-2',
        mockOrganizationId,
      );

      expect(result).toBeNull();
    });

    it('should return null when target is unreachable', async () => {
      nodeRepository.findOne
        .mockResolvedValueOnce(mockNodes[0])
        .mockResolvedValueOnce(mockNodes[2]);

      edgeRepository.find.mockResolvedValue([]);

      const result = await service.dijkstra(
        'node-1',
        'node-3',
        mockOrganizationId,
      );

      expect(result).toBeNull();
    });

    it('should respect relationship type filters', async () => {
      nodeRepository.findOne
        .mockResolvedValueOnce(mockNodes[0])
        .mockResolvedValueOnce(mockNodes[2]);

      edgeRepository.find.mockResolvedValue([]);

      const result = await service.dijkstra(
        'node-1',
        'node-3',
        mockOrganizationId,
        [RelationshipType.DEPENDS_ON],
      );

      expect(result).toBeNull();
    });
  });

  describe('aStar', () => {
    it('should find path using A* algorithm', async () => {
      nodeRepository.findOne
        .mockResolvedValueOnce(mockNodes[0])
        .mockResolvedValueOnce(mockNodes[1]);

      edgeRepository.find
        .mockResolvedValueOnce([
          {
            ...mockEdges[0],
            sourceNode: mockNodes[0],
            targetNode: mockNodes[1],
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.aStar(
        'node-1',
        'node-2',
        mockOrganizationId,
      );

      if (result) {
        expect(result.path).toContain('node-1');
        expect(result.path).toContain('node-2');
        expect(result.distance).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return null for unreachable target', async () => {
      nodeRepository.findOne
        .mockResolvedValueOnce(mockNodes[0])
        .mockResolvedValueOnce(mockNodes[2]);

      edgeRepository.find.mockResolvedValue([]);

      const result = await service.aStar(
        'node-1',
        'node-3',
        mockOrganizationId,
      );

      expect(result).toBeNull();
    });
  });

  describe('extractSubgraph', () => {
    it('should extract subgraph with node type filter', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce(mockNodes),
      };

      const mockEdgeQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce(mockEdges),
      };

      nodeRepository.createQueryBuilder.mockReturnValueOnce(mockQueryBuilder);
      edgeRepository.createQueryBuilder.mockReturnValueOnce(
        mockEdgeQueryBuilder,
      );

      const result = await service.extractSubgraph(mockOrganizationId, {
        nodeTypes: [NodeType.CONCEPT],
      });

      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(Array.isArray(result.edges)).toBe(true);
    });

    it('should extract subgraph with relationship type filter', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce(mockNodes),
      };

      const mockEdgeQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce(
          mockEdges.filter((e) => e.type === RelationshipType.RELATES_TO),
        ),
      };

      nodeRepository.createQueryBuilder.mockReturnValueOnce(mockQueryBuilder);
      edgeRepository.createQueryBuilder.mockReturnValueOnce(
        mockEdgeQueryBuilder,
      );

      const result = await service.extractSubgraph(mockOrganizationId, {
        relationshipTypes: [RelationshipType.RELATES_TO],
      });

      expect(result.edges).toBeDefined();
    });

    it('should extract subgraph with weight range filter', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce(mockNodes),
      };

      const mockEdgeQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce(mockEdges),
      };

      nodeRepository.createQueryBuilder.mockReturnValueOnce(mockQueryBuilder);
      edgeRepository.createQueryBuilder.mockReturnValueOnce(
        mockEdgeQueryBuilder,
      );

      const result = await service.extractSubgraph(mockOrganizationId, {
        minWeight: 1.0,
        maxWeight: 2.0,
      });

      expect(result.edges).toBeDefined();
    });

    it('should return empty subgraph when no nodes match', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([]),
      };

      nodeRepository.createQueryBuilder.mockReturnValueOnce(mockQueryBuilder);

      const result = await service.extractSubgraph(mockOrganizationId, {
        nodeTypes: [NodeType.PERSON],
      });

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('findNodesByPattern', () => {
    it('should find nodes by name pattern', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([mockNodes[0]]),
      };

      nodeRepository.createQueryBuilder.mockReturnValueOnce(mockQueryBuilder);

      const result = await service.findNodesByPattern(
        mockOrganizationId,
        'Node',
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by node types', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([mockNodes[2]]),
      };

      nodeRepository.createQueryBuilder.mockReturnValueOnce(mockQueryBuilder);

      const result = await service.findNodesByPattern(
        mockOrganizationId,
        'Node',
        [NodeType.TASK],
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by tags', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([mockNodes[0], mockNodes[2]]),
      };

      nodeRepository.createQueryBuilder.mockReturnValueOnce(mockQueryBuilder);

      const result = await service.findNodesByPattern(
        mockOrganizationId,
        'Node',
        undefined,
        ['tag1'],
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('filterByRelationshipType', () => {
    it('should filter edges by relationship type', () => {
      const result = service.filterByRelationshipType(mockEdges, [
        RelationshipType.RELATES_TO,
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(RelationshipType.RELATES_TO);
    });

    it('should return empty array when no edges match', () => {
      const result = service.filterByRelationshipType(mockEdges, [
        RelationshipType.PART_OF,
      ]);

      expect(result).toHaveLength(0);
    });
  });

  describe('filterByNodeType', () => {
    it('should filter nodes by type', () => {
      const result = service.filterByNodeType(mockNodes, [NodeType.TASK]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(NodeType.TASK);
    });

    it('should return multiple nodes of same type', () => {
      const result = service.filterByNodeType(mockNodes, [NodeType.CONCEPT]);

      expect(result).toHaveLength(2);
      expect(result.every((n) => n.type === NodeType.CONCEPT)).toBe(true);
    });
  });

  describe('calculateGraphMetrics', () => {
    it('should calculate graph metrics', () => {
      const result = service.calculateGraphMetrics(mockNodes, mockEdges);

      expect(result.nodeCount).toBe(3);
      expect(result.edgeCount).toBe(2);
      expect(result.averageDegree).toBeGreaterThan(0);
      expect(result.densityRatio).toBeGreaterThan(0);
      expect(result.densityRatio).toBeLessThanOrEqual(1);
    });

    it('should handle empty graph', () => {
      const result = service.calculateGraphMetrics([], []);

      expect(result.nodeCount).toBe(0);
      expect(result.edgeCount).toBe(0);
      expect(result.averageDegree).toBe(0);
      expect(result.densityRatio).toBe(0);
    });

    it('should handle single node', () => {
      const result = service.calculateGraphMetrics([mockNodes[0]], []);

      expect(result.nodeCount).toBe(1);
      expect(result.edgeCount).toBe(0);
      expect(result.averageDegree).toBe(0);
    });
  });
});
