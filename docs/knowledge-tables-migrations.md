# Knowledge Tables Database Migrations

## Overview

This document describes the TypeORM database migrations for the knowledge management system. These migrations create four interconnected tables that support a comprehensive knowledge graph with vector similarity search capabilities.

## Migration Details

### Migration File
- **Location**: `apps/server/src/database/migrations/1766495849000-CreateKnowledgeTables.ts`
- **Timestamp**: 1766495849000
- **Status**: Creates knowledge base infrastructure for semantic search and relationship management

## Table Schemas

### 1. knowledge_items
Core table for storing knowledge items with content and metadata.

**Columns:**
- `id` (UUID, PK): Unique identifier
- `organization_id` (UUID, FK): Owner organization
- `source_type` (VARCHAR): Type of knowledge source (e.g., 'task', 'document', 'decision', 'memory')
- `source_id` (UUID): Reference to the source entity
- `title` (VARCHAR): Knowledge item title
- `content` (TEXT): Full content of the knowledge item
- `summary` (TEXT): Brief summary of the knowledge item
- `keywords` (JSONB): Array of associated keywords
- `metadata` (JSONB): Extended metadata object
- `version` (INTEGER): Version number for tracking changes
- `is_active` (BOOLEAN): Soft delete flag
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Constraints:**
- Foreign key to `organizations(id)` on delete cascade

**Indexes:**
- `IDX_knowledge_items_org_source`: Composite on (organization_id, source_type)
- `IDX_knowledge_items_org_active`: Composite on (organization_id, is_active)
- `IDX_knowledge_items_updated`: Single on updated_at for sorting/filtering

### 2. knowledge_embeddings
Stores vector embeddings for semantic similarity search using pgvector extension.

**Columns:**
- `id` (UUID, PK): Unique identifier
- `knowledge_item_id` (UUID, FK): Reference to knowledge_items (one-to-one)
- `embedding` (vector(1536)): 1536-dimensional embedding vector
- `embedding_model` (VARCHAR): Model used to generate the embedding (default: 'text-embedding-3-small')
- `content_hash` (VARCHAR): Hash of the content for change detection
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Constraints:**
- Unique foreign key to `knowledge_items(id)` on delete cascade (one embedding per item)

**Indexes:**
- `IDX_knowledge_embeddings_vector`: IVFFlat index on embedding column for cosine similarity search
- `IDX_knowledge_embeddings_model`: Index on embedding_model for filtering by model version

**Note:** Requires PostgreSQL pgvector extension (already enabled in InitialSchema migration)

### 3. knowledge_relations
Manages relationships between knowledge items, forming a knowledge graph.

**Columns:**
- `id` (UUID, PK): Unique identifier
- `source_knowledge_id` (UUID, FK): Source knowledge item
- `target_knowledge_id` (UUID, FK): Target knowledge item
- `relation_type` (ENUM): Type of relationship (related, dependency, precedent, similar, alternative, extends, contradicts)
- `confidence_score` (DECIMAL): Confidence level of the relationship (0.00-1.00)
- `discovered_at` (TIMESTAMP): When the relationship was discovered
- `metadata` (JSONB): Additional relationship metadata
- `created_at` (TIMESTAMP): Creation timestamp

**Constraints:**
- Foreign key to `knowledge_items(id)` for source on delete cascade
- Foreign key to `knowledge_items(id)` for target on delete cascade
- Check constraint preventing self-references (source != target)

**Relation Types:**
- `related`: General relationship
- `dependency`: Target is a prerequisite for source
- `precedent`: Source comes before target
- `similar`: Items are similar in content/purpose
- `alternative`: Items are alternative solutions
- `extends`: Target extends or builds upon source
- `contradicts`: Items contradict each other

**Indexes:**
- `IDX_knowledge_relations_source`: Index on source_knowledge_id for outgoing edges
- `IDX_knowledge_relations_target`: Index on target_knowledge_id for incoming edges
- `IDX_knowledge_relations_type`: Index on relation_type for filtering by relationship
- `IDX_knowledge_relations_bidirectional`: Composite on (source, target) for path queries

### 4. knowledge_metadata
Extended metadata for knowledge items including analytics and filtering information.

**Columns:**
- `id` (UUID, PK): Unique identifier
- `knowledge_item_id` (UUID, FK): Reference to knowledge_items (one-to-one)
- `access_count` (INTEGER): Number of times the knowledge item was accessed
- `last_accessed_at` (TIMESTAMP): Timestamp of last access
- `relevance_score` (DECIMAL): Calculated relevance score (0.00-999.99)
- `quality_score` (DECIMAL): Quality assessment score (0.00-999.99)
- `tags` (JSONB): Array of tags for categorization
- `context` (VARCHAR): Context/domain of the knowledge (e.g., 'development', 'architecture')
- `language` (VARCHAR): Language of the content (default: 'en')
- `domain` (VARCHAR): Domain classification
- `complexity_level` (VARCHAR): Complexity assessment (e.g., 'basic', 'intermediate', 'advanced')
- `usage_statistics` (JSONB): Object containing usage patterns and statistics
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Constraints:**
- Unique foreign key to `knowledge_items(id)` on delete cascade (one metadata per item)

**Indexes:**
- `IDX_knowledge_metadata_access`: Index on access_count for popularity queries
- `IDX_knowledge_metadata_relevance`: Index on relevance_score for ranking
- `IDX_knowledge_metadata_domain`: Index on domain for categorization
- `IDX_knowledge_metadata_complexity`: Index on complexity_level for filtering

## Index Strategy

### Vector Similarity Search
- Uses IVFFlat index on embeddings for efficient cosine similarity search
- Trades some accuracy for speed in large datasets
- Suitable for semantic search queries returning top-k results

### Composite Indexes
- (organization_id, source_type): Optimizes queries for finding all knowledge items of a specific type
- (organization_id, is_active): Filters active items by organization
- (source_knowledge_id, target_knowledge_id): Enables fast lookup of specific relationships

### Metadata Filtering
- Individual indexes on access_count, relevance_score, domain, complexity_level
- Enables efficient filtering and sorting of knowledge items by metadata

## Rollback Migration

The `down()` method safely removes all tables and custom types in reverse order:

1. Drops knowledge_metadata table
2. Drops knowledge_relations table and relation_type_enum
3. Drops knowledge_embeddings table
4. Drops knowledge_items table

All foreign key relationships ensure cascading deletes are handled correctly.

## Running the Migration

### Forward (Apply)
```bash
pnpm exec typeorm migration:run -d src/config/typeorm.config.ts
```

### Backward (Revert)
```bash
pnpm exec typeorm migration:revert -d src/config/typeorm.config.ts
```

### Check Migration Status
```bash
pnpm exec typeorm migration:show -d src/config/typeorm.config.ts
```

## Usage Patterns

### Storing Knowledge
```sql
INSERT INTO knowledge_items (organization_id, source_type, source_id, title, content)
VALUES (org_id, 'task', task_id, 'Task Title', 'Task content...');
```

### Adding Embeddings
```sql
INSERT INTO knowledge_embeddings (knowledge_item_id, embedding, embedding_model)
VALUES (item_id, '[0.1, 0.2, ..., 0.9]'::vector, 'text-embedding-3-small');
```

### Creating Relations
```sql
INSERT INTO knowledge_relations (source_knowledge_id, target_knowledge_id, relation_type, confidence_score)
VALUES (source_id, target_id, 'dependency', 0.95);
```

### Similarity Search
```sql
SELECT id, title, (embedding <=> query_vector) AS distance
FROM knowledge_embeddings
ORDER BY embedding <=> query_vector
LIMIT 10;
```

### Graph Traversal
```sql
-- Find all related knowledge items (depth 1)
SELECT kr.target_knowledge_id, kr.relation_type
FROM knowledge_relations kr
WHERE kr.source_knowledge_id = ? AND kr.relation_type = 'related';
```

## Performance Considerations

1. **Vector Index**: IVFFlat provides good balance between accuracy and performance. For very large datasets (>1M embeddings), consider tuning the `lists` parameter.

2. **Composite Indexes**: Help filter organizations and source types efficiently, reducing full table scans.

3. **Metadata Indexes**: Enable quick filtering and sorting without table scans.

4. **Cascade Deletes**: Ensure cascading deletes are understood - deleting a knowledge_item cascades to embeddings, relations, and metadata.

## Dependencies

- PostgreSQL with pgvector extension (already enabled)
- TypeORM 0.3+
- UUID generation (built-in PostgreSQL)

## Future Enhancements

1. **Partitioning**: For very large organizations, consider partitioning knowledge_items by organization_id.

2. **Full-Text Search**: Add GIN index on text content and keywords for full-text search capabilities.

3. **Temporal Data**: Add temporal tables to track knowledge item history.

4. **Materialized Views**: Create materialized views for complex queries like "related items by domain".

5. **Time-to-Live (TTL)**: Implement automatic cleanup of old, unused knowledge items.
