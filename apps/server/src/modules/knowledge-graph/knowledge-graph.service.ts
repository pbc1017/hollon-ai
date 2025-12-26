import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Node, NodeType } from './entities/node.entity';
import { Edge, EdgeType } from './entities/edge.entity';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { UpdateEdgeDto } from './dto/update-edge.dto';

@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);

  constructor(
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    @InjectRepository(Edge)
    private readonly edgeRepository: Repository<Edge>,
  ) {}

  // ========================================
  // Node CRUD Operations
  // ========================================

  /**
   * Create a new node in the knowledge graph
   */
  async createNode(dto: CreateNodeDto): Promise<Node> {
    const node = this.nodeRepository.create({
      ...dto,
      properties: dto.properties || {},
      tags: dto.tags || [],
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    const savedNode = await this.nodeRepository.save(node);
    this.logger.log(`Created node: ${savedNode.name} (${savedNode.type})`);
    return savedNode;
  }

  /**
   * Find all nodes with optional filters
   */
  async findAllNodes(filters?: {
    organizationId?: string;
    type?: NodeType;
    tags?: string[];
    isActive?: boolean;
  }): Promise<Node[]> {
    const query = this.nodeRepository.createQueryBuilder('node');

    if (filters?.organizationId) {
      query.andWhere('node.organization_id = :orgId', {
        orgId: filters.organizationId,
      });
    }

    if (filters?.type) {
      query.andWhere('node.type = :type', { type: filters.type });
    }

    if (filters?.tags && filters.tags.length > 0) {
      query.andWhere('node.tags && :tags', { tags: filters.tags });
    }

    if (filters?.isActive !== undefined) {
      query.andWhere('node.is_active = :isActive', {
        isActive: filters.isActive,
      });
    }

    return query.orderBy('node.created_at', 'DESC').getMany();
  }

  /**
   * Find a single node by ID
   */
  async findNodeById(id: string): Promise<Node> {
    const node = await this.nodeRepository.findOne({
      where: { id },
      relations: ['outgoingEdges', 'incomingEdges'],
    });

    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    return node;
  }

  /**
   * Update a node
   */
  async updateNode(id: string, dto: UpdateNodeDto): Promise<Node> {
    const node = await this.findNodeById(id);

    Object.assign(node, dto);

    const updatedNode = await this.nodeRepository.save(node);
    this.logger.log(`Updated node: ${updatedNode.name} (${updatedNode.id})`);
    return updatedNode;
  }

  /**
   * Soft delete a node by setting isActive to false
   */
  async softDeleteNode(id: string): Promise<void> {
    const node = await this.findNodeById(id);
    node.isActive = false;
    await this.nodeRepository.save(node);
    this.logger.log(`Soft deleted node: ${node.name} (${node.id})`);
  }

  /**
   * Hard delete a node (permanently remove from database)
   */
  async deleteNode(id: string): Promise<void> {
    const node = await this.findNodeById(id);
    await this.nodeRepository.remove(node);
    this.logger.log(`Deleted node: ${node.name} (${node.id})`);
  }

  /**
   * Search nodes by name or description
   */
  async searchNodes(
    searchTerm: string,
    organizationId?: string,
  ): Promise<Node[]> {
    const query = this.nodeRepository.createQueryBuilder('node');

    query.where(
      '(LOWER(node.name) LIKE LOWER(:search) OR LOWER(node.description) LIKE LOWER(:search))',
      { search: `%${searchTerm}%` },
    );

    if (organizationId) {
      query.andWhere('node.organization_id = :orgId', {
        orgId: organizationId,
      });
    }

    query.andWhere('node.is_active = :isActive', { isActive: true });

    return query.orderBy('node.created_at', 'DESC').getMany();
  }

  // ========================================
  // Edge CRUD Operations
  // ========================================

  /**
   * Create a new edge between two nodes
   */
  async createEdge(dto: CreateEdgeDto): Promise<Edge> {
    // Validate that both nodes exist
    const sourceNode = await this.nodeRepository.findOne({
      where: { id: dto.sourceNodeId },
    });
    const targetNode = await this.nodeRepository.findOne({
      where: { id: dto.targetNodeId },
    });

    if (!sourceNode) {
      throw new NotFoundException(
        `Source node with ID ${dto.sourceNodeId} not found`,
      );
    }

    if (!targetNode) {
      throw new NotFoundException(
        `Target node with ID ${dto.targetNodeId} not found`,
      );
    }

    // Validate that nodes belong to the same organization
    if (
      sourceNode.organizationId !== dto.organizationId ||
      targetNode.organizationId !== dto.organizationId
    ) {
      throw new BadRequestException(
        'Source and target nodes must belong to the same organization as the edge',
      );
    }

    const edge = this.edgeRepository.create({
      ...dto,
      weight: dto.weight !== undefined ? dto.weight : 1.0,
      properties: dto.properties || {},
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    const savedEdge = await this.edgeRepository.save(edge);
    this.logger.log(
      `Created edge: ${sourceNode.name} -> ${targetNode.name} (${savedEdge.type})`,
    );
    return savedEdge;
  }

  /**
   * Find all edges with optional filters
   */
  async findAllEdges(filters?: {
    organizationId?: string;
    type?: EdgeType;
    sourceNodeId?: string;
    targetNodeId?: string;
    isActive?: boolean;
  }): Promise<Edge[]> {
    const query = this.edgeRepository.createQueryBuilder('edge');

    if (filters?.organizationId) {
      query.andWhere('edge.organization_id = :orgId', {
        orgId: filters.organizationId,
      });
    }

    if (filters?.type) {
      query.andWhere('edge.type = :type', { type: filters.type });
    }

    if (filters?.sourceNodeId) {
      query.andWhere('edge.source_node_id = :sourceId', {
        sourceId: filters.sourceNodeId,
      });
    }

    if (filters?.targetNodeId) {
      query.andWhere('edge.target_node_id = :targetId', {
        targetId: filters.targetNodeId,
      });
    }

    if (filters?.isActive !== undefined) {
      query.andWhere('edge.is_active = :isActive', {
        isActive: filters.isActive,
      });
    }

    return query
      .leftJoinAndSelect('edge.sourceNode', 'sourceNode')
      .leftJoinAndSelect('edge.targetNode', 'targetNode')
      .orderBy('edge.created_at', 'DESC')
      .getMany();
  }

  /**
   * Find a single edge by ID
   */
  async findEdgeById(id: string): Promise<Edge> {
    const edge = await this.edgeRepository.findOne({
      where: { id },
      relations: ['sourceNode', 'targetNode'],
    });

    if (!edge) {
      throw new NotFoundException(`Edge with ID ${id} not found`);
    }

    return edge;
  }

  /**
   * Update an edge
   */
  async updateEdge(id: string, dto: UpdateEdgeDto): Promise<Edge> {
    const edge = await this.findEdgeById(id);

    Object.assign(edge, dto);

    const updatedEdge = await this.edgeRepository.save(edge);
    this.logger.log(`Updated edge: ${updatedEdge.id} (${updatedEdge.type})`);
    return updatedEdge;
  }

  /**
   * Soft delete an edge by setting isActive to false
   */
  async softDeleteEdge(id: string): Promise<void> {
    const edge = await this.findEdgeById(id);
    edge.isActive = false;
    await this.edgeRepository.save(edge);
    this.logger.log(`Soft deleted edge: ${edge.id} (${edge.type})`);
  }

  /**
   * Hard delete an edge (permanently remove from database)
   */
  async deleteEdge(id: string): Promise<void> {
    const edge = await this.findEdgeById(id);
    await this.edgeRepository.remove(edge);
    this.logger.log(`Deleted edge: ${edge.id} (${edge.type})`);
  }

  // ========================================
  // Graph Query Operations
  // ========================================

  /**
   * Get all outgoing edges from a node
   */
  async getOutgoingEdges(nodeId: string): Promise<Edge[]> {
    return this.edgeRepository.find({
      where: { sourceNodeId: nodeId, isActive: true },
      relations: ['targetNode'],
    });
  }

  /**
   * Get all incoming edges to a node
   */
  async getIncomingEdges(nodeId: string): Promise<Edge[]> {
    return this.edgeRepository.find({
      where: { targetNodeId: nodeId, isActive: true },
      relations: ['sourceNode'],
    });
  }

  /**
   * Get all neighbors of a node (both incoming and outgoing)
   */
  async getNodeNeighbors(nodeId: string): Promise<{
    outgoing: Edge[];
    incoming: Edge[];
  }> {
    const [outgoing, incoming] = await Promise.all([
      this.getOutgoingEdges(nodeId),
      this.getIncomingEdges(nodeId),
    ]);

    return { outgoing, incoming };
  }

  /**
   * Find nodes by type and organization
   */
  async findNodesByType(
    type: NodeType,
    organizationId: string,
  ): Promise<Node[]> {
    return this.nodeRepository.find({
      where: {
        type,
        organizationId,
        isActive: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find edges by type between specific nodes
   */
  async findEdgesByType(
    type: EdgeType,
    organizationId?: string,
  ): Promise<Edge[]> {
    const where: any = {
      type,
      isActive: true,
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.edgeRepository.find({
      where,
      relations: ['sourceNode', 'targetNode'],
      order: { createdAt: 'DESC' },
    });
  }
}
