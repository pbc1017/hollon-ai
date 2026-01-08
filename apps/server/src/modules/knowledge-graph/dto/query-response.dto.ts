import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Node, NodeType } from '../entities/node.entity';
import { Edge } from '../entities/edge.entity';
import { RelationshipType } from '../../../knowledge/enums/relationship-type.enum';

/**
 * Node Response DTO
 *
 * Represents a node in the knowledge graph for API responses.
 */
export class NodeResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the node',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Node name',
    example: 'Project Alpha',
  })
  name: string;

  @ApiProperty({
    description: 'Node type',
    enum: NodeType,
    example: NodeType.TASK,
  })
  type: NodeType;

  @ApiPropertyOptional({
    description: 'Node description',
    example: 'Main project for Q1',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: 'Organization ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  organizationId: string;

  @ApiPropertyOptional({
    description: 'Additional properties stored as JSONB',
    example: { priority: 'high', status: 'active' },
  })
  properties?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Tags for the node',
    isArray: true,
    example: ['important', 'urgent'],
  })
  tags?: string[];

  @ApiProperty({
    description: 'Whether the node is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Node creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Node last update timestamp',
    example: '2024-01-16T14:45:30Z',
  })
  updatedAt: Date;

  /**
   * Convert Node entity to response DTO
   */
  static fromEntity(node: Node): NodeResponseDto {
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      description: node.description,
      organizationId: node.organizationId,
      properties: node.properties,
      tags: node.tags,
      isActive: node.isActive,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };
  }
}

/**
 * Relationship Response DTO
 *
 * Represents a relationship (edge) in the knowledge graph for API responses.
 */
export class RelationshipResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the relationship',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  id: string;

  @ApiProperty({
    description: 'Source node ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  sourceNodeId: string;

  @ApiProperty({
    description: 'Target node ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  targetNodeId: string;

  @ApiProperty({
    description: 'Relationship type',
    enum: RelationshipType,
    example: RelationshipType.DEPENDS_ON,
  })
  type: RelationshipType;

  @ApiProperty({
    description: 'Organization ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  organizationId: string;

  @ApiPropertyOptional({
    description: 'Edge weight for weighted graphs',
    example: 1.0,
  })
  weight?: number;

  @ApiPropertyOptional({
    description: 'Additional properties stored as JSONB',
    example: { confidence: 0.95, source: 'inference' },
  })
  properties?: Record<string, any>;

  @ApiProperty({
    description: 'Whether the relationship is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Relationship creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Relationship last update timestamp',
    example: '2024-01-16T14:45:30Z',
  })
  updatedAt: Date;

  /**
   * Convert Edge entity to response DTO
   */
  static fromEntity(edge: Edge): RelationshipResponseDto {
    return {
      id: edge.id,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      type: edge.type,
      organizationId: edge.organizationId,
      weight: edge.weight,
      properties: edge.properties,
      isActive: edge.isActive,
      createdAt: edge.createdAt,
      updatedAt: edge.updatedAt,
    };
  }
}

/**
 * Paginated Response DTO
 *
 * Wrapper for paginated results with metadata.
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({
    description: 'Array of items in the current page',
    isArray: true,
  })
  data: T[];

  @ApiProperty({
    description: 'Total number of items matching the query',
    example: 42,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  totalPages: number;

  /**
   * Create paginated response
   */
  static create<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponseDto<T> {
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

/**
 * Nodes Response DTO
 *
 * Response wrapper for node queries.
 */
export class NodesResponseDto extends PaginatedResponseDto<NodeResponseDto> {}

/**
 * Relationships Response DTO
 *
 * Response wrapper for relationship queries.
 */
export class RelationshipsResponseDto extends PaginatedResponseDto<RelationshipResponseDto> {}

/**
 * Subgraph Response DTO
 *
 * Represents a subgraph with nodes and relationships.
 */
export class SubgraphResponseDto {
  @ApiProperty({
    description: 'Nodes in the subgraph',
    type: [NodeResponseDto],
  })
  nodes: NodeResponseDto[];

  @ApiProperty({
    description: 'Relationships in the subgraph',
    type: [RelationshipResponseDto],
  })
  relationships: RelationshipResponseDto[];

  @ApiProperty({
    description: 'Root node ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  rootNodeId: string;

  @ApiProperty({
    description: 'Depth of the extracted subgraph',
    example: 3,
  })
  depth: number;

  /**
   * Create subgraph response
   */
  static create(
    nodes: Node[],
    edges: Edge[],
    rootNodeId: string,
    depth: number,
  ): SubgraphResponseDto {
    return {
      nodes: nodes.map((node) => NodeResponseDto.fromEntity(node)),
      relationships: edges.map((edge) =>
        RelationshipResponseDto.fromEntity(edge),
      ),
      rootNodeId,
      depth,
    };
  }
}

/**
 * Query Response DTO
 *
 * Generic response for custom graph queries.
 */
export class QueryResponseDto {
  @ApiProperty({
    description: 'Nodes matching the query',
    type: [NodeResponseDto],
  })
  nodes: NodeResponseDto[];

  @ApiProperty({
    description: 'Relationships matching the query',
    type: [RelationshipResponseDto],
  })
  relationships: RelationshipResponseDto[];

  @ApiProperty({
    description: 'Total number of matching nodes',
    example: 15,
  })
  nodeCount: number;

  @ApiProperty({
    description: 'Total number of matching relationships',
    example: 8,
  })
  relationshipCount: number;

  /**
   * Create query response
   */
  static create(nodes: Node[], relationships: Edge[]): QueryResponseDto {
    return {
      nodes: nodes.map((node) => NodeResponseDto.fromEntity(node)),
      relationships: relationships.map((edge) =>
        RelationshipResponseDto.fromEntity(edge),
      ),
      nodeCount: nodes.length,
      relationshipCount: relationships.length,
    };
  }
}

/**
 * Error Response DTO
 *
 * Standard error response format.
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Invalid query parameters',
  })
  message: string;

  @ApiProperty({
    description: 'Error details',
    example: 'organizationId is required',
  })
  error: string;

  @ApiProperty({
    description: 'Request timestamp',
    example: '2024-01-16T14:45:30Z',
  })
  timestamp: Date;

  @ApiProperty({
    description: 'Request path',
    example: '/graph/nodes',
  })
  path: string;
}
