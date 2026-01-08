import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { KnowledgeGraphService } from './knowledge-graph.service';
import {
  NodeFilterQueryDto,
  RelationshipFilterQueryDto,
  GraphQueryRequestDto,
  SubgraphQueryDto,
} from './dto/query-request.dto';
import {
  NodeResponseDto,
  RelationshipResponseDto,
  PaginatedResponseDto,
  SubgraphResponseDto,
  QueryResponseDto,
  ErrorResponseDto,
} from './dto/query-response.dto';

/**
 * Knowledge Graph REST API Controller
 *
 * Provides REST endpoints for:
 * - Listing and filtering graph nodes
 * - Listing and filtering graph relationships
 * - Executing custom graph queries
 * - Extracting subgraphs
 *
 * All endpoints support pagination and filtering by organization, type, and tags.
 */
@ApiTags('Knowledge Graph')
@Controller('graph')
export class KnowledgeGraphController {
  constructor(private readonly knowledgeGraphService: KnowledgeGraphService) {}

  /**
   * GET /graph/nodes
   *
   * List all nodes with optional filtering by type, tags, and organization.
   * Supports pagination with page and limit parameters.
   *
   * Query Parameters:
   * - organizationId (required): Filter by organization
   * - types (optional): Filter by node types (array)
   * - tags (optional): Filter by tags (array)
   * - isActive (optional): Include only active nodes (default: true)
   * - page (optional): Page number (default: 1)
   * - limit (optional): Items per page (default: 20, max: 100)
   *
   * @returns Paginated list of nodes
   */
  @Get('nodes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List graph nodes',
    description:
      'Retrieve a paginated list of graph nodes with optional filtering by type, tags, and organization.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved nodes',
    type: PaginatedResponseDto<NodeResponseDto>,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters',
    type: ErrorResponseDto,
  })
  async getNodes(
    @Query() query: NodeFilterQueryDto,
  ): Promise<PaginatedResponseDto<NodeResponseDto>> {
    try {
      const {
        organizationId,
        types,
        tags,
        isActive,
        page = 1,
        limit = 20,
      } = query;

      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        throw new BadRequestException(
          'Invalid pagination parameters: page must be >= 1, limit must be between 1 and 100',
        );
      }

      // Build query builder with filters
      const queryBuilder = this.knowledgeGraphService.createNodeQuery();

      // Apply filters
      queryBuilder.where('node.organizationId = :organizationId', {
        organizationId,
      });

      if (types && types.length > 0) {
        queryBuilder.andWhere('node.type IN (:...types)', { types });
      }

      if (tags && tags.length > 0) {
        queryBuilder.andWhere('node.tags && :tags', { tags });
      }

      if (isActive !== undefined) {
        queryBuilder.andWhere('node.isActive = :isActive', { isActive });
      } else {
        queryBuilder.andWhere('node.isActive = :isActive', { isActive: true });
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply pagination and sorting
      const nodes = await queryBuilder
        .orderBy('node.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

      const nodesDtos = nodes.map((node) => NodeResponseDto.fromEntity(node));

      return PaginatedResponseDto.create(nodesDtos, total, page, limit);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to retrieve nodes: ${error.message}`,
      );
    }
  }

  /**
   * GET /graph/relationships
   *
   * List all relationships (edges) with optional filtering by type, source/target nodes, and organization.
   * Supports pagination with page and limit parameters.
   *
   * Query Parameters:
   * - organizationId (required): Filter by organization
   * - types (optional): Filter by relationship types (array)
   * - sourceNodeId (optional): Filter by source node
   * - targetNodeId (optional): Filter by target node
   * - isActive (optional): Include only active relationships (default: true)
   * - page (optional): Page number (default: 1)
   * - limit (optional): Items per page (default: 20, max: 100)
   *
   * @returns Paginated list of relationships
   */
  @Get('relationships')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List graph relationships',
    description:
      'Retrieve a paginated list of graph relationships (edges) with optional filtering by type and connected nodes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved relationships',
    type: PaginatedResponseDto<RelationshipResponseDto>,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters',
    type: ErrorResponseDto,
  })
  async getRelationships(
    @Query() query: RelationshipFilterQueryDto,
  ): Promise<PaginatedResponseDto<RelationshipResponseDto>> {
    try {
      const {
        organizationId,
        types,
        sourceNodeId,
        targetNodeId,
        isActive,
        page = 1,
        limit = 20,
      } = query;

      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        throw new BadRequestException(
          'Invalid pagination parameters: page must be >= 1, limit must be between 1 and 100',
        );
      }

      // Build query builder with filters
      const queryBuilder = this.knowledgeGraphService.createEdgeQuery();

      // Apply filters
      queryBuilder.where('edge.organizationId = :organizationId', {
        organizationId,
      });

      if (types && types.length > 0) {
        queryBuilder.andWhere('edge.type IN (:...types)', { types });
      }

      if (sourceNodeId) {
        queryBuilder.andWhere('edge.sourceNodeId = :sourceNodeId', {
          sourceNodeId,
        });
      }

      if (targetNodeId) {
        queryBuilder.andWhere('edge.targetNodeId = :targetNodeId', {
          targetNodeId,
        });
      }

      if (isActive !== undefined) {
        queryBuilder.andWhere('edge.isActive = :isActive', { isActive });
      } else {
        queryBuilder.andWhere('edge.isActive = :isActive', { isActive: true });
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply pagination and sorting
      const edges = await queryBuilder
        .orderBy('edge.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

      const edgeDtos = edges.map((edge) =>
        RelationshipResponseDto.fromEntity(edge),
      );

      return PaginatedResponseDto.create(edgeDtos, total, page, limit);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to retrieve relationships: ${error.message}`,
      );
    }
  }

  /**
   * POST /graph/query
   *
   * Execute a custom graph query to find nodes and relationships matching the specified criteria.
   *
   * Request Body:
   * - organizationId (required): Organization scope
   * - nodeTypes (optional): Filter nodes by types (array)
   * - relationshipTypes (optional): Filter relationships by types (array)
   * - tags (optional): Filter nodes by tags (array)
   * - isActive (optional): Include only active entities (default: true)
   * - page (optional): Page number (default: 1)
   * - limit (optional): Items per page (default: 20, max: 100)
   *
   * @param query Graph query criteria
   * @returns Nodes and relationships matching the query
   */
  @Post('query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Execute custom graph query',
    description:
      'Execute a custom query to find nodes and relationships matching the specified criteria. Supports filtering by type, tags, and organization.',
  })
  @ApiResponse({
    status: 200,
    description: 'Query executed successfully',
    type: QueryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters',
    type: ErrorResponseDto,
  })
  async queryGraph(
    @Body() query: GraphQueryRequestDto,
  ): Promise<QueryResponseDto> {
    try {
      const {
        organizationId,
        nodeTypes,
        relationshipTypes,
        tags,
        isActive,
        page = 1,
        limit = 20,
      } = query;

      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        throw new BadRequestException(
          'Invalid pagination parameters: page must be >= 1, limit must be between 1 and 100',
        );
      }

      // Query nodes
      const nodeQueryBuilder = this.knowledgeGraphService.createNodeQuery();
      nodeQueryBuilder.where('node.organizationId = :organizationId', {
        organizationId,
      });

      if (nodeTypes && nodeTypes.length > 0) {
        nodeQueryBuilder.andWhere('node.type IN (:...nodeTypes)', {
          nodeTypes,
        });
      }

      if (tags && tags.length > 0) {
        nodeQueryBuilder.andWhere('node.tags && :tags', { tags });
      }

      if (isActive !== undefined) {
        nodeQueryBuilder.andWhere('node.isActive = :isActive', { isActive });
      } else {
        nodeQueryBuilder.andWhere('node.isActive = :isActive', {
          isActive: true,
        });
      }

      const nodes = await nodeQueryBuilder
        .orderBy('node.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

      // Query relationships
      const edgeQueryBuilder = this.knowledgeGraphService.createEdgeQuery();
      edgeQueryBuilder.where('edge.organizationId = :organizationId', {
        organizationId,
      });

      if (relationshipTypes && relationshipTypes.length > 0) {
        edgeQueryBuilder.andWhere('edge.type IN (:...relationshipTypes)', {
          relationshipTypes,
        });
      }

      if (isActive !== undefined) {
        edgeQueryBuilder.andWhere('edge.isActive = :isActive', { isActive });
      } else {
        edgeQueryBuilder.andWhere('edge.isActive = :isActive', {
          isActive: true,
        });
      }

      const edges = await edgeQueryBuilder.getMany();

      return QueryResponseDto.create(nodes, edges);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to execute query: ${error.message}`,
      );
    }
  }

  /**
   * GET /graph/subgraph/:id
   *
   * Extract a subgraph starting from a given node with specified depth.
   * Traverses the graph up to the specified depth, collecting all connected nodes and relationships.
   *
   * Path Parameters:
   * - id: Root node ID
   *
   * Query Parameters:
   * - depth (required): Maximum depth for traversal (1-10)
   * - isActive (optional): Include only active nodes (default: true)
   * - relationshipTypes (optional): Only follow specific relationship types (array)
   *
   * @param id Root node ID
   * @param query Subgraph extraction parameters
   * @returns Subgraph with nodes and relationships
   */
  @Get('subgraph/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Extract subgraph',
    description:
      'Extract a subgraph starting from a given node with specified depth. Traverses the graph collecting all connected nodes and relationships.',
  })
  @ApiParam({
    name: 'id',
    description: 'Root node ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Subgraph extracted successfully',
    type: SubgraphResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Node not found',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid parameters',
    type: ErrorResponseDto,
  })
  async getSubgraph(
    @Param('id') id: string,
    @Query() query: SubgraphQueryDto,
  ): Promise<SubgraphResponseDto> {
    try {
      // Validate node ID format
      if (
        !id.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        )
      ) {
        throw new BadRequestException(
          'Invalid node ID format. Must be a valid UUID.',
        );
      }

      // Check if node exists
      const rootNode = await this.knowledgeGraphService.findNodeById(id);
      if (!rootNode) {
        throw new NotFoundException(`Node with ID ${id} not found`);
      }

      // Validate depth parameter
      const { depth, isActive, relationshipTypes } = query;
      if (!depth || depth < 1 || depth > 10) {
        throw new BadRequestException('Depth must be between 1 and 10');
      }

      // Extract subgraph
      const { nodes, edges } = await this.knowledgeGraphService.extractSubgraph(
        id,
        depth,
        isActive !== false,
        relationshipTypes,
      );

      return SubgraphResponseDto.create(nodes, edges, id, depth);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to extract subgraph: ${error.message}`,
      );
    }
  }
}
