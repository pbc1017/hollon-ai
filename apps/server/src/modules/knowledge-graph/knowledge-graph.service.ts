import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Node } from './entities/node.entity';
import { Edge } from './entities/edge.entity';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { UpdateEdgeDto } from './dto/update-edge.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';

/**
 * KnowledgeGraphService
 *
 * Core service for managing the knowledge graph, providing business logic for
 * graph operations including node and edge management, graph traversal, and
 * relationship queries.
 *
 * Purpose:
 * - Provides a flexible graph-based data structure for representing relationships
 *   between entities in the Hollon-AI system
 * - Manages CRUD operations for nodes (entities/concepts) and edges (relationships)
 * - Enables graph traversal and querying capabilities for relationship discovery
 * - Supports knowledge extraction and relationship inference
 *
 * Responsibilities:
 * - Node management: Create, read, update, and delete graph nodes
 * - Edge management: Create, read, update, and delete graph edges
 * - Graph queries: Find nodes and edges by various criteria
 * - Graph traversal: Navigate relationships between nodes
 * - Data validation: Ensure graph integrity and consistency
 *
 * Role within the knowledge graph module:
 * - Acts as the primary business logic layer between the controller and data layer
 * - Encapsulates all graph operations and enforces business rules
 * - Provides a clean API for other modules to interact with the knowledge graph
 * - Manages TypeORM repositories for Node and Edge entities
 *
 * Future enhancements:
 * - Advanced graph queries (pattern matching, path finding)
 * - Graph analytics (centrality, clustering, community detection)
 * - ML-based relationship inference
 * - Graph visualization data preparation
 * - Performance optimization for large graphs
 */
@Injectable()
export class KnowledgeGraphService {
  /**
   * Constructor
   *
   * Initializes the KnowledgeGraphService with TypeORM repositories for
   * Node and Edge entities.
   *
   * @param nodeRepository - TypeORM repository for Node entity operations
   * @param edgeRepository - TypeORM repository for Edge entity operations
   */
  constructor(
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    @InjectRepository(Edge)
    private readonly edgeRepository: Repository<Edge>,
  ) {}

  /**
   * Find all nodes
   *
   * Retrieves all nodes from the knowledge graph. This is a placeholder
   * implementation that will be enhanced with filtering, pagination,
   * and sorting capabilities in future tasks.
   *
   * @returns Promise resolving to an array of all Node entities
   *
   * @example
   * ```typescript
   * const nodes = await knowledgeGraphService.findAllNodes();
   * console.log(`Found ${nodes.length} nodes`);
   * ```
   *
   * Future enhancements:
   * - Add filtering by type, organization, tags
   * - Implement pagination for large graphs
   * - Add sorting options
   * - Support for query options (relations, select fields)
   */
  async findAllNodes(): Promise<Node[]> {
    return this.nodeRepository.find();
  }

  /**
   * Create a new node
   *
   * Creates a new node in the knowledge graph with the provided data.
   *
   * @param createNodeDto - DTO containing node creation data
   * @returns Promise resolving to the created Node entity
   *
   * @example
   * ```typescript
   * const node = await knowledgeGraphService.createNode({
   *   name: 'User Profile Feature',
   *   type: NodeType.TASK,
   *   organizationId: 'org-uuid',
   *   tags: ['frontend', 'authentication']
   * });
   * ```
   */
  async createNode(createNodeDto: CreateNodeDto): Promise<Node> {
    const node = this.nodeRepository.create(createNodeDto);
    return this.nodeRepository.save(node);
  }

  /**
   * Find a single node by ID
   *
   * Retrieves a specific node by its UUID. Throws NotFoundException
   * if the node doesn't exist.
   *
   * @param id - UUID of the node to retrieve
   * @returns Promise resolving to the Node entity
   * @throws NotFoundException if node is not found
   *
   * @example
   * ```typescript
   * const node = await knowledgeGraphService.findOneNode('node-uuid');
   * ```
   */
  async findOneNode(id: string): Promise<Node> {
    const node = await this.nodeRepository.findOne({
      where: { id },
      relations: ['outgoingEdges', 'incomingEdges'],
    });

    if (!node) {
      throw new NotFoundException(`Node #${id} not found`);
    }

    return node;
  }

  /**
   * Find nodes with pagination
   *
   * Retrieves nodes with pagination support. Returns both the data
   * and pagination metadata.
   *
   * @param paginationQuery - Pagination parameters (page, limit)
   * @returns Promise resolving to paginated nodes with metadata
   *
   * @example
   * ```typescript
   * const result = await knowledgeGraphService.findAllNodesPaginated({
   *   page: 1,
   *   limit: 20
   * });
   * console.log(`Page ${result.page} of ${result.totalPages}`);
   * ```
   */
  async findAllNodesPaginated(paginationQuery: PaginationQueryDto): Promise<{
    data: Node[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10 } = paginationQuery;
    const skip = (page - 1) * limit;

    const [data, total] = await this.nodeRepository.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update a node
   *
   * Updates an existing node with the provided data. Throws NotFoundException
   * if the node doesn't exist.
   *
   * @param id - UUID of the node to update
   * @param updateNodeDto - DTO containing update data
   * @returns Promise resolving to the updated Node entity
   * @throws NotFoundException if node is not found
   *
   * @example
   * ```typescript
   * const updated = await knowledgeGraphService.updateNode('node-uuid', {
   *   name: 'Updated Name',
   *   tags: ['new-tag']
   * });
   * ```
   */
  async updateNode(id: string, updateNodeDto: UpdateNodeDto): Promise<Node> {
    const node = await this.findOneNode(id);
    Object.assign(node, updateNodeDto);
    return this.nodeRepository.save(node);
  }

  /**
   * Delete a node
   *
   * Permanently removes a node from the knowledge graph. Also removes
   * associated edges due to CASCADE delete configuration.
   *
   * @param id - UUID of the node to delete
   * @returns Promise resolving when deletion is complete
   * @throws NotFoundException if node is not found
   *
   * @example
   * ```typescript
   * await knowledgeGraphService.deleteNode('node-uuid');
   * ```
   */
  async deleteNode(id: string): Promise<void> {
    const node = await this.findOneNode(id);
    await this.nodeRepository.remove(node);
  }

  /**
   * Find all edges
   *
   * Retrieves all edges (relationships) from the knowledge graph. This is a
   * placeholder implementation that will be enhanced with filtering, pagination,
   * and sorting capabilities in future tasks.
   *
   * @returns Promise resolving to an array of all Edge entities
   *
   * @example
   * ```typescript
   * const edges = await knowledgeGraphService.findAllEdges();
   * console.log(`Found ${edges.length} edges`);
   * ```
   *
   * Future enhancements:
   * - Add filtering by edge type, source/target nodes
   * - Implement pagination for large graphs
   * - Add sorting options
   * - Support for query options (relations, select fields)
   * - Include node data in results
   */
  async findAllEdges(): Promise<Edge[]> {
    return this.edgeRepository.find();
  }

  /**
   * Create a new edge
   *
   * Creates a new edge (relationship) in the knowledge graph connecting
   * two nodes. Validates that both source and target nodes exist.
   *
   * @param createEdgeDto - DTO containing edge creation data
   * @returns Promise resolving to the created Edge entity
   * @throws NotFoundException if source or target node doesn't exist
   *
   * @example
   * ```typescript
   * const edge = await knowledgeGraphService.createEdge({
   *   sourceNodeId: 'node-uuid-1',
   *   targetNodeId: 'node-uuid-2',
   *   type: EdgeType.DEPENDS_ON,
   *   organizationId: 'org-uuid',
   *   weight: 0.8
   * });
   * ```
   */
  async createEdge(createEdgeDto: CreateEdgeDto): Promise<Edge> {
    // Validate that source and target nodes exist
    await this.findOneNode(createEdgeDto.sourceNodeId);
    await this.findOneNode(createEdgeDto.targetNodeId);

    const edge = this.edgeRepository.create(createEdgeDto);
    return this.edgeRepository.save(edge);
  }

  /**
   * Find a single edge by ID
   *
   * Retrieves a specific edge by its UUID. Includes the source and target
   * node data in the result. Throws NotFoundException if the edge doesn't exist.
   *
   * @param id - UUID of the edge to retrieve
   * @returns Promise resolving to the Edge entity with node relations
   * @throws NotFoundException if edge is not found
   *
   * @example
   * ```typescript
   * const edge = await knowledgeGraphService.findOneEdge('edge-uuid');
   * console.log(`${edge.sourceNode.name} -> ${edge.targetNode.name}`);
   * ```
   */
  async findOneEdge(id: string): Promise<Edge> {
    const edge = await this.edgeRepository.findOne({
      where: { id },
      relations: ['sourceNode', 'targetNode'],
    });

    if (!edge) {
      throw new NotFoundException(`Edge #${id} not found`);
    }

    return edge;
  }

  /**
   * Find edges with pagination
   *
   * Retrieves edges with pagination support. Includes source and target
   * node data in the results. Returns both the data and pagination metadata.
   *
   * @param paginationQuery - Pagination parameters (page, limit)
   * @returns Promise resolving to paginated edges with metadata
   *
   * @example
   * ```typescript
   * const result = await knowledgeGraphService.findAllEdgesPaginated({
   *   page: 1,
   *   limit: 20
   * });
   * console.log(`Found ${result.total} edges`);
   * ```
   */
  async findAllEdgesPaginated(paginationQuery: PaginationQueryDto): Promise<{
    data: Edge[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10 } = paginationQuery;
    const skip = (page - 1) * limit;

    const [data, total] = await this.edgeRepository.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['sourceNode', 'targetNode'],
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update an edge
   *
   * Updates an existing edge with the provided data. If sourceNodeId or
   * targetNodeId are being updated, validates that the new nodes exist.
   * Throws NotFoundException if the edge doesn't exist.
   *
   * @param id - UUID of the edge to update
   * @param updateEdgeDto - DTO containing update data
   * @returns Promise resolving to the updated Edge entity
   * @throws NotFoundException if edge or referenced nodes are not found
   *
   * @example
   * ```typescript
   * const updated = await knowledgeGraphService.updateEdge('edge-uuid', {
   *   weight: 0.9,
   *   type: EdgeType.IMPLEMENTS
   * });
   * ```
   */
  async updateEdge(id: string, updateEdgeDto: UpdateEdgeDto): Promise<Edge> {
    const edge = await this.findOneEdge(id);

    // Validate new source/target nodes if they're being updated
    if (updateEdgeDto.sourceNodeId) {
      await this.findOneNode(updateEdgeDto.sourceNodeId);
    }
    if (updateEdgeDto.targetNodeId) {
      await this.findOneNode(updateEdgeDto.targetNodeId);
    }

    Object.assign(edge, updateEdgeDto);
    return this.edgeRepository.save(edge);
  }

  /**
   * Delete an edge
   *
   * Permanently removes an edge from the knowledge graph. The connected
   * nodes are not affected.
   *
   * @param id - UUID of the edge to delete
   * @returns Promise resolving when deletion is complete
   * @throws NotFoundException if edge is not found
   *
   * @example
   * ```typescript
   * await knowledgeGraphService.deleteEdge('edge-uuid');
   * ```
   */
  async deleteEdge(id: string): Promise<void> {
    const edge = await this.findOneEdge(id);
    await this.edgeRepository.remove(edge);
  }
}
