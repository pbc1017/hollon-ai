import { IsUUID, IsOptional, IsArray, IsEnum, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { NodeType } from '../entities/node.entity';
import { RelationshipType } from '../../../knowledge/enums/relationship-type.enum';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

/**
 * Node Filter Query DTO
 *
 * Parameters for filtering and querying graph nodes.
 * Supports filtering by type, tags, and organization with pagination.
 */
export class NodeFilterQueryDto {
  @ApiProperty({
    description: 'Organization ID to filter nodes by',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    description: 'Node types to filter by',
    enum: NodeType,
    isArray: true,
    example: [NodeType.TASK, NodeType.DOCUMENT],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NodeType, { each: true })
  types?: NodeType[];

  @ApiPropertyOptional({
    description: 'Tags to filter nodes by',
    isArray: true,
    example: ['important', 'archived'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Include inactive nodes in results',
    default: false,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Relationship Filter Query DTO
 *
 * Parameters for filtering and querying graph relationships (edges).
 * Supports filtering by type, source/target nodes, and organization with pagination.
 */
export class RelationshipFilterQueryDto {
  @ApiProperty({
    description: 'Organization ID to filter relationships by',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    description: 'Relationship types to filter by',
    enum: RelationshipType,
    isArray: true,
    example: [RelationshipType.DEPENDS_ON, RelationshipType.RELATES_TO],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(RelationshipType, { each: true })
  types?: RelationshipType[];

  @ApiPropertyOptional({
    description: 'Source node ID to filter relationships originating from',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  sourceNodeId?: string;

  @ApiPropertyOptional({
    description: 'Target node ID to filter relationships pointing to',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  targetNodeId?: string;

  @ApiPropertyOptional({
    description: 'Include inactive relationships in results',
    default: false,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Custom Graph Query DTO
 *
 * Parameters for executing custom graph queries.
 * Supports complex filtering with node types, relationship types, and tags.
 */
export class GraphQueryRequestDto {
  @ApiProperty({
    description: 'Organization ID for the query scope',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    description: 'Node types to include in query results',
    enum: NodeType,
    isArray: true,
    example: [NodeType.TASK, NodeType.DOCUMENT],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(NodeType, { each: true })
  nodeTypes?: NodeType[];

  @ApiPropertyOptional({
    description: 'Relationship types to include in query results',
    enum: RelationshipType,
    isArray: true,
    example: [RelationshipType.DEPENDS_ON, RelationshipType.RELATES_TO],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(RelationshipType, { each: true })
  relationshipTypes?: RelationshipType[];

  @ApiPropertyOptional({
    description: 'Tags that nodes should match',
    isArray: true,
    example: ['important', 'urgent'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Include inactive nodes and relationships',
    default: false,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Subgraph Query DTO
 *
 * Parameters for extracting a subgraph from a given starting node.
 * Supports depth-based traversal and filtering.
 */
export class SubgraphQueryDto {
  @ApiProperty({
    description: 'Starting node ID for subgraph extraction',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  nodeId: string;

  @ApiProperty({
    description: 'Depth of traversal from the starting node',
    minimum: 1,
    maximum: 10,
    example: 3,
  })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(10)
  depth: number;

  @ApiPropertyOptional({
    description: 'Include inactive nodes in subgraph',
    default: false,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Relationship types to follow during traversal',
    enum: RelationshipType,
    isArray: true,
    example: [RelationshipType.DEPENDS_ON],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(RelationshipType, { each: true })
  relationshipTypes?: RelationshipType[];
}
