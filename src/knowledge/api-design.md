# Knowledge Management API Design

## Overview

The Knowledge Management API provides a comprehensive system for managing, searching, and organizing knowledge artifacts within the Hollon-AI system. It supports CRUD operations, advanced search capabilities, knowledge relationships, and administrative functions.

## Architecture Principles

- **RESTful Design**: Standard HTTP methods (GET, POST, PATCH, DELETE) for resource management
- **UUID-based Identifiers**: All resources use UUID primary keys
- **Hierarchical Organization**: Support for knowledge hierarchy and relationships
- **Role-based Access Control (RBAC)**: Fine-grained permissions based on user roles
- **Standardized Responses**: Consistent response format across all endpoints
- **Error Handling**: Standardized error response format with detailed error codes
- **Pagination**: Offset-based pagination for list endpoints
- **Filtering & Search**: Flexible query parameters for filtering and searching

## Authentication & Authorization

### Authentication
- **Bearer Token Authentication**: JWT tokens passed in `Authorization: Bearer <token>` header
- **Token Validation**: Tokens must be valid and not expired
- **Scope-based Access**: Tokens include scopes defining permitted operations

### Authorization Strategy

#### Role-Based Access Control (RBAC)

**Roles:**
- `admin`: Full access to all knowledge management operations, including admin endpoints
- `knowledge_manager`: Can create, read, update, delete knowledge items and manage taxonomies
- `knowledge_contributor`: Can create and edit own knowledge items, read all
- `knowledge_reader`: Read-only access to knowledge items
- `guest`: Limited read-only access to public knowledge only

#### Permission Matrix

| Resource | Admin | Manager | Contributor | Reader | Guest |
|----------|-------|---------|-------------|--------|-------|
| Create Knowledge | ✓ | ✓ | ✓ | ✗ | ✗ |
| Read All | ✓ | ✓ | ✓ | ✓ | ✓* |
| Update Own | ✓ | ✓ | ✓ | ✗ | ✗ |
| Update All | ✓ | ✓ | ✗ | ✗ | ✗ |
| Delete Own | ✓ | ✓ | ✓ | ✗ | ✗ |
| Delete All | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage Categories | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage Tags | ✓ | ✓ | ✗ | ✗ | ✗ |
| Admin Operations | ✓ | ✗ | ✗ | ✗ | ✗ |

*Guest: Public knowledge only

## API Endpoints

### Knowledge Management

#### Create Knowledge Item
```
POST /api/v1/knowledge
```
Creates a new knowledge item.

**Request Body**: `CreateKnowledgeDto`
- `title` (string, required): Knowledge title (max 500 chars)
- `content` (string, required): Knowledge content
- `description` (string, optional): Short description (max 1000 chars)
- `categoryId` (UUID, optional): Parent category
- `tags` (string[], optional): Associated tags
- `isPublic` (boolean, optional): Visibility flag (default: false)
- `relatedKnowledgeIds` (UUID[], optional): Related knowledge item IDs
- `metadata` (object, optional): Custom metadata

**Response**: `KnowledgeItemDto` with 201 Created status
**Authorization**: Requires `knowledge_contributor` role or higher
**Errors**: 400 (validation), 401 (unauthorized), 403 (forbidden)

#### Get Knowledge Item
```
GET /api/v1/knowledge/:id
```
Retrieves a single knowledge item by ID.

**Path Parameters**:
- `id` (UUID, required): Knowledge item ID

**Response**: `KnowledgeItemDto` with 200 OK status
**Authorization**: Public items accessible to all; private items require `knowledge_reader` role
**Errors**: 401 (unauthorized), 403 (forbidden), 404 (not found)

#### List Knowledge Items
```
GET /api/v1/knowledge
```
Retrieves paginated list of knowledge items with optional filtering.

**Query Parameters**:
- `page` (number, optional): Page number (default: 1, min: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `categoryId` (UUID, optional): Filter by category
- `tags` (string, optional): Comma-separated tags filter (AND logic)
- `search` (string, optional): Full-text search across title and content
- `isPublic` (boolean, optional): Filter by visibility
- `sortBy` (string, optional): Sort field (createdAt, updatedAt, title)
- `sortOrder` (string, optional): Sort order (asc, desc)

**Response**: `PaginatedKnowledgeListDto` with 200 OK status
**Authorization**: Filters results based on user role
**Errors**: 400 (invalid parameters), 401 (unauthorized)

#### Update Knowledge Item
```
PATCH /api/v1/knowledge/:id
```
Updates an existing knowledge item.

**Path Parameters**:
- `id` (UUID, required): Knowledge item ID

**Request Body**: `UpdateKnowledgeDto` (all fields optional)
- `title` (string, optional): Updated title
- `content` (string, optional): Updated content
- `description` (string, optional): Updated description
- `categoryId` (UUID, optional): New category
- `tags` (string[], optional): Updated tags
- `isPublic` (boolean, optional): Updated visibility
- `relatedKnowledgeIds` (UUID[], optional): Updated relationships
- `metadata` (object, optional): Updated metadata

**Response**: `KnowledgeItemDto` with 200 OK status
**Authorization**: Requires ownership or `knowledge_manager` role
**Errors**: 400 (validation), 401 (unauthorized), 403 (forbidden), 404 (not found)

#### Delete Knowledge Item
```
DELETE /api/v1/knowledge/:id
```
Deletes a knowledge item (soft delete).

**Path Parameters**:
- `id` (UUID, required): Knowledge item ID

**Response**: 204 No Content
**Authorization**: Requires ownership or `knowledge_manager` role
**Errors**: 401 (unauthorized), 403 (forbidden), 404 (not found)

### Search & Discovery

#### Advanced Search
```
GET /api/v1/knowledge/search/advanced
```
Performs advanced search with multiple criteria.

**Query Parameters**:
- `query` (string, optional): Full-text search query
- `categoryIds` (UUID, optional): Comma-separated category IDs
- `tags` (string, optional): Comma-separated tags
- `createdAfter` (ISO date, optional): Filter by creation date
- `createdBefore` (ISO date, optional): Filter by creation date
- `updatedAfter` (ISO date, optional): Filter by update date
- `updatedBefore` (ISO date, optional): Filter by update date
- `authors` (string, optional): Comma-separated author names
- `isPublic` (boolean, optional): Filter by visibility
- `hasRelationships` (boolean, optional): Only items with relationships
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `sortBy` (string, optional): relevance, createdAt, updatedAt, title
- `sortOrder` (string, optional): asc, desc

**Response**: `SearchResultsDto` with 200 OK status
**Authorization**: Filters results based on user role
**Errors**: 400 (invalid query), 401 (unauthorized)

#### Get Related Knowledge
```
GET /api/v1/knowledge/:id/related
```
Retrieves knowledge items related to the specified item.

**Path Parameters**:
- `id` (UUID, required): Knowledge item ID

**Query Parameters**:
- `limit` (number, optional): Max items to return (default: 10, max: 50)
- `depth` (number, optional): Relationship depth (default: 1, max: 3)

**Response**: `RelatedKnowledgeDto` with 200 OK status
**Authorization**: Same as parent knowledge item
**Errors**: 401 (unauthorized), 404 (not found)

### Category Management

#### Create Category
```
POST /api/v1/knowledge/categories
```
Creates a new knowledge category.

**Request Body**: `CreateCategoryDto`
- `name` (string, required): Category name (max 100 chars)
- `description` (string, optional): Category description
- `parentCategoryId` (UUID, optional): Parent category for hierarchy
- `icon` (string, optional): Icon identifier

**Response**: `CategoryDto` with 201 Created status
**Authorization**: Requires `knowledge_manager` role
**Errors**: 400 (validation), 401 (unauthorized), 403 (forbidden), 409 (duplicate)

#### List Categories
```
GET /api/v1/knowledge/categories
```
Retrieves all knowledge categories in hierarchical format.

**Query Parameters**:
- `parentCategoryId` (UUID, optional): Filter by parent (null = root categories)
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 50)

**Response**: `CategoryListDto` with 200 OK status
**Authorization**: No authorization required
**Errors**: None expected

#### Get Category
```
GET /api/v1/knowledge/categories/:id
```
Retrieves a single category.

**Path Parameters**:
- `id` (UUID, required): Category ID

**Response**: `CategoryDto` with 200 OK status
**Authorization**: No authorization required
**Errors**: 404 (not found)

#### Update Category
```
PATCH /api/v1/knowledge/categories/:id
```
Updates a category.

**Path Parameters**:
- `id` (UUID, required): Category ID

**Request Body**: `UpdateCategoryDto` (all fields optional)
- `name` (string, optional): Updated name
- `description` (string, optional): Updated description
- `parentCategoryId` (UUID, optional): New parent
- `icon` (string, optional): Updated icon

**Response**: `CategoryDto` with 200 OK status
**Authorization**: Requires `knowledge_manager` role
**Errors**: 400 (validation), 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (circular reference)

#### Delete Category
```
DELETE /api/v1/knowledge/categories/:id
```
Deletes a category (and optionally its children).

**Path Parameters**:
- `id` (UUID, required): Category ID

**Query Parameters**:
- `deleteChildren` (boolean, optional): Delete child categories too (default: false)

**Response**: 204 No Content
**Authorization**: Requires `knowledge_manager` role
**Errors**: 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (has children)

### Tag Management

#### List Tags
```
GET /api/v1/knowledge/tags
```
Retrieves all available tags with usage counts.

**Query Parameters**:
- `search` (string, optional): Filter tags by name
- `minUsage` (number, optional): Minimum usage count (default: 0)
- `limit` (number, optional): Max tags to return (default: 100)

**Response**: `TagListDto` with 200 OK status
**Authorization**: No authorization required
**Errors**: None expected

#### Create Tag
```
POST /api/v1/knowledge/tags
```
Creates a new tag.

**Request Body**: `CreateTagDto`
- `name` (string, required): Tag name (max 50 chars)
- `description` (string, optional): Tag description
- `color` (string, optional): Hex color code

**Response**: `TagDto` with 201 Created status
**Authorization**: Requires `knowledge_manager` role
**Errors**: 400 (validation), 401 (unauthorized), 403 (forbidden), 409 (duplicate)

#### Delete Tag
```
DELETE /api/v1/knowledge/tags/:id
```
Deletes a tag (removes from all items).

**Path Parameters**:
- `id` (UUID, required): Tag ID

**Response**: 204 No Content
**Authorization**: Requires `knowledge_manager` role
**Errors**: 401 (unauthorized), 403 (forbidden), 404 (not found)

### Admin Endpoints

#### Get Knowledge Statistics
```
GET /api/v1/admin/knowledge/statistics
```
Retrieves knowledge base statistics and analytics.

**Query Parameters**:
- `timeRange` (string, optional): Period for analytics (7d, 30d, 90d, 1y)

**Response**: `KnowledgeStatisticsDto` with 200 OK status
**Authorization**: Requires `admin` role
**Errors**: 401 (unauthorized), 403 (forbidden)

#### Bulk Operations
```
POST /api/v1/admin/knowledge/bulk
```
Performs bulk operations on knowledge items.

**Request Body**: `BulkOperationDto`
- `operation` (enum, required): Operation type (updateCategory, updateTags, delete, publish, unpublish)
- `knowledgeIds` (UUID[], required): Target knowledge item IDs
- `parameters` (object, optional): Operation-specific parameters

**Response**: `BulkOperationResultDto` with 200 OK status
**Authorization**: Requires `admin` role
**Errors**: 400 (validation), 401 (unauthorized), 403 (forbidden)

#### Export Knowledge Base
```
GET /api/v1/admin/knowledge/export
```
Exports knowledge base in specified format.

**Query Parameters**:
- `format` (string, required): Export format (json, csv, xml)
- `includeMetadata` (boolean, optional): Include metadata (default: true)
- `categoryIds` (UUID, optional): Filter by categories

**Response**: File download with appropriate content-type
**Authorization**: Requires `admin` role
**Errors**: 400 (invalid format), 401 (unauthorized), 403 (forbidden)

#### Import Knowledge Base
```
POST /api/v1/admin/knowledge/import
```
Imports knowledge items from file.

**Request Body**: Multipart form data
- `file` (file, required): Import file (json, csv, xml)
- `mergeStrategy` (string, optional): Merge strategy (overwrite, skip, merge)

**Response**: `ImportResultDto` with 200 OK status
**Authorization**: Requires `admin` role
**Errors**: 400 (invalid file), 401 (unauthorized), 403 (forbidden), 413 (file too large)

#### Audit Log
```
GET /api/v1/admin/knowledge/audit
```
Retrieves audit log of knowledge operations.

**Query Parameters**:
- `knowledgeId` (UUID, optional): Filter by knowledge item
- `userId` (UUID, optional): Filter by user
- `operation` (string, optional): Filter by operation (create, update, delete, view)
- `startDate` (ISO date, optional): Start date
- `endDate` (ISO date, optional): End date
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 50)

**Response**: `AuditLogDto` with 200 OK status
**Authorization**: Requires `admin` role
**Errors**: 400 (invalid parameters), 401 (unauthorized), 403 (forbidden)

## Error Response Format

### Standard Error Response

All error responses follow this format:

```json
{
  "statusCode": 400,
  "timestamp": "2024-12-23T10:30:00.000Z",
  "path": "/api/v1/knowledge",
  "method": "POST",
  "message": "Validation failed",
  "error": "Bad Request",
  "details": {
    "field": "title",
    "constraint": "maxLength",
    "value": "..."
  }
}
```

### Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_INPUT | Request validation failed |
| 400 | DUPLICATE_RESOURCE | Resource with same unique field exists |
| 401 | UNAUTHORIZED | Missing or invalid authentication |
| 403 | FORBIDDEN | User lacks required permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Business logic conflict (e.g., circular reference) |
| 413 | PAYLOAD_TOO_LARGE | File or payload exceeds size limit |
| 500 | INTERNAL_ERROR | Unexpected server error |

## Request/Response Examples

### Create Knowledge Item

**Request:**
```
POST /api/v1/knowledge
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "NestJS Best Practices",
  "content": "Key guidelines for NestJS development...",
  "description": "A comprehensive guide to NestJS best practices",
  "categoryId": "550e8400-e29b-41d4-a716-446655440000",
  "tags": ["nestjs", "backend", "typescript"],
  "isPublic": true,
  "metadata": {
    "difficulty": "intermediate",
    "version": "1.0"
  }
}
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "NestJS Best Practices",
  "content": "Key guidelines for NestJS development...",
  "description": "A comprehensive guide to NestJS best practices",
  "categoryId": "550e8400-e29b-41d4-a716-446655440000",
  "tags": ["nestjs", "backend", "typescript"],
  "isPublic": true,
  "createdAt": "2024-12-23T10:00:00.000Z",
  "updatedAt": "2024-12-23T10:00:00.000Z",
  "createdBy": "user-123",
  "version": 1,
  "metadata": {
    "difficulty": "intermediate",
    "version": "1.0"
  }
}
```

### Search Knowledge Items

**Request:**
```
GET /api/v1/knowledge/search/advanced?query=nestjs&tags=backend&isPublic=true&page=1&limit=20
Authorization: Bearer <token>
```

**Response:**
```json
{
  "items": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "NestJS Best Practices",
      "description": "A comprehensive guide to NestJS best practices",
      "tags": ["nestjs", "backend", "typescript"],
      "relevanceScore": 0.95,
      "createdAt": "2024-12-23T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  },
  "facets": {
    "categories": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Backend",
        "count": 15
      }
    ],
    "tags": [
      {
        "name": "nestjs",
        "count": 28
      }
    ]
  }
}
```

## Versioning

- **API Version**: v1
- **Versioning Strategy**: URL-based (/api/v1/)
- **Backward Compatibility**: Maintained for minor versions
- **Deprecation**: Old versions deprecated after 6 months notice

## Rate Limiting

- **Standard Tier**: 100 requests/minute
- **Premium Tier**: 1000 requests/minute
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Pagination Guidelines

- **Default Limit**: 20 items
- **Max Limit**: 100 items
- **Strategy**: Offset-based pagination using page/limit

## Caching Strategy

- **Cache Control**: Public resources cached for 1 hour
- **Private Resources**: No-cache headers
- **Invalidation**: Cache invalidated on item update

## Future Enhancements

1. GraphQL endpoint for flexible querying
2. Webhooks for knowledge item changes
3. Full-text search optimization with Elasticsearch
4. Knowledge recommendations using ML
5. Version history and change tracking
6. Integration with external knowledge sources
7. Knowledge validation and quality scoring
8. Collaborative knowledge editing
