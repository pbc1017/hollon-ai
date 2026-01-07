# Knowledge Graph Indexing Analysis

## Overview

This document provides a comprehensive analysis of the knowledge graph schema, including entity definitions, foreign key relationships, query patterns, and indexing recommendations to optimize graph traversal and query performance.

## Current Schema Structure

### Entities

#### 1. Node Entity (`knowledge_graph_nodes`)

Represents entities or concepts in the knowledge graph.

**Columns:**
- `id` (UUID, PK) - Primary key, auto-generated
- `name` (VARCHAR(255)) - Node name/label
- `type` (ENUM) - Node type classification (person, organization, team, task, document, code, concept, goal, skill, tool, custom)
- `description` (TEXT, nullable) - Optional description
- `organization_id` (UUID) - Organization scope
- `properties` (JSONB) - Flexible properties storage (default: {})
- `tags` (TEXT[]) - Array of tags for search/filtering (default: [])
- `is_active` (BOOLEAN) - Soft delete flag (default: true)
- `created_at` (TIMESTAMP) - Record creation timestamp
- `updated_at` (TIMESTAMP) - Record update timestamp

**Relationships:**
- `outgoingEdges` (OneToMany → Edge.sourceNode) - Edges where this node is the source
- `incomingEdges` (OneToMany → Edge.targetNode) - Edges where this node is the target

#### 2. Edge Entity (`knowledge_graph_edges`)

Represents relationships between nodes in the knowledge graph.

**Columns:**
- `id` (UUID, PK) - Primary key, auto-generated
- `source_node_id` (UUID, FK) - Source node reference
- `target_node_id` (UUID, FK) - Target node reference
- `type` (ENUM) - Edge type classification (created_by, belongs_to, manages, collaborates_with, depends_on, references, implements, derives_from, related_to, child_of, part_of, custom)
- `organization_id` (UUID) - Organization scope
- `weight` (FLOAT) - Edge weight for weighted graphs (default: 1.0)
- `properties` (JSONB) - Flexible relationship metadata (default: {})
- `is_active` (BOOLEAN) - Soft delete flag (default: true)
- `created_at` (TIMESTAMP) - Record creation timestamp
- `updated_at` (TIMESTAMP) - Record update timestamp

**Relationships:**
- `sourceNode` (ManyToOne → Node, CASCADE delete) - Source node
- `targetNode` (ManyToOne → Node, CASCADE delete) - Target node

## Foreign Key Relationships

### Edge → Node Foreign Keys

1. **source_node_id → nodes.id**
   - Constraint: ON DELETE CASCADE
   - Purpose: Maintain referential integrity for source node
   - Behavior: Deleting a node automatically deletes all edges where it's the source

2. **target_node_id → nodes.id**
   - Constraint: ON DELETE CASCADE
   - Purpose: Maintain referential integrity for target node
   - Behavior: Deleting a node automatically deletes all edges where it's the target

### Implicit Relationships (No FK Constraints)

- `organization_id` in both Node and Edge tables
  - Currently no foreign key to an organizations table
  - Used for multi-tenancy/organization scoping
  - Important for data isolation and access control

## Current Indexing Strategy

### Node Indexes

```typescript
@Index(['type'])
@Index(['organizationId'])
@Index(['createdAt'])
```

**Current Indexes:**
1. **Single-column index on `type`**
   - Purpose: Filter nodes by type (e.g., all tasks, all documents)
   - Use case: `SELECT * FROM knowledge_graph_nodes WHERE type = 'task'`

2. **Single-column index on `organization_id`**
   - Purpose: Multi-tenancy/organization scoping
   - Use case: `SELECT * FROM knowledge_graph_nodes WHERE organization_id = ?`

3. **Single-column index on `created_at`**
   - Purpose: Temporal ordering and pagination
   - Use case: `ORDER BY created_at DESC`

### Edge Indexes

```typescript
@Index(['type'])
@Index(['sourceNodeId', 'targetNodeId'])
@Index(['sourceNodeId', 'type'])
@Index(['targetNodeId', 'type'])
@Index(['organizationId'])
@Index(['createdAt'])
```

**Current Indexes:**
1. **Single-column index on `type`**
   - Purpose: Filter edges by relationship type
   - Use case: `SELECT * FROM knowledge_graph_edges WHERE type = 'depends_on'`

2. **Composite index on `[source_node_id, target_node_id]`**
   - Purpose: Check if specific edge exists, prevent duplicates
   - Use case: `SELECT * FROM knowledge_graph_edges WHERE source_node_id = ? AND target_node_id = ?`

3. **Composite index on `[source_node_id, type]`**
   - Purpose: Find all outgoing edges of a specific type from a node
   - Use case: Graph traversal - "Find all nodes this task depends_on"
   - Optimization: Left-prefix usable for source_node_id only queries

4. **Composite index on `[target_node_id, type]`**
   - Purpose: Find all incoming edges of a specific type to a node
   - Use case: Reverse traversal - "Find all tasks that depend_on this node"
   - Optimization: Left-prefix usable for target_node_id only queries

5. **Single-column index on `organization_id`**
   - Purpose: Multi-tenancy/organization scoping
   - Use case: `SELECT * FROM knowledge_graph_edges WHERE organization_id = ?`

6. **Single-column index on `created_at`**
   - Purpose: Temporal ordering and pagination
   - Use case: `ORDER BY created_at DESC`

## Query Pattern Analysis

### Common Query Patterns (from service)

#### Node Queries

1. **Find all nodes (with pagination)**
   ```typescript
   nodeRepository.find() // Uses: None (full table scan)
   nodeRepository.findAndCount({ order: { createdAt: 'DESC' } }) // Uses: created_at index
   ```

2. **Find node by ID**
   ```typescript
   nodeRepository.findOne({ where: { id }, relations: [...] }) // Uses: PK index
   ```

3. **Create/Update/Delete node**
   ```typescript
   nodeRepository.save(node) // Uses: PK index for updates
   nodeRepository.remove(node) // Uses: PK index + triggers cascade deletes on edges
   ```

#### Edge Queries

1. **Find all edges (with pagination)**
   ```typescript
   edgeRepository.find() // Uses: None (full table scan)
   edgeRepository.findAndCount({ 
     order: { createdAt: 'DESC' },
     relations: ['sourceNode', 'targetNode']
   }) // Uses: created_at index + FK joins
   ```

2. **Find edge by ID**
   ```typescript
   edgeRepository.findOne({ 
     where: { id },
     relations: ['sourceNode', 'targetNode']
   }) // Uses: PK index + FK joins
   ```

3. **Validate edge creation**
   ```typescript
   // Checks both source and target nodes exist
   findOneNode(sourceNodeId) // Uses: PK index
   findOneNode(targetNodeId) // Uses: PK index
   ```

### Expected Future Query Patterns

Based on graph operations and common knowledge graph use cases:

1. **Organization-scoped queries** (multi-tenancy)
   - Find all nodes/edges for an organization
   - Filter by organization + type
   - Filter by organization + active status

2. **Graph traversal queries**
   - Find all outgoing edges from a node
   - Find all incoming edges to a node
   - Find neighbors (adjacent nodes)
   - Path finding between nodes
   - Multi-hop traversals

3. **Filtered queries**
   - Find nodes by type and organization
   - Find active nodes only
   - Find edges by type and organization
   - Search by tags (array operations)

4. **Analytics queries**
   - Count nodes/edges by type
   - Node degree (in-degree, out-degree)
   - Graph metrics (centrality, clustering)

## Indexing Gap Analysis

### Current Coverage

✅ **Well-Covered:**
- Single entity lookups by ID (primary key)
- Edge existence checks (source + target composite)
- Type-specific graph traversal (source/target + type composites)
- Temporal ordering (created_at indexes)

⚠️ **Partially Covered:**
- Organization scoping (single-column indexes, but no composites)
- Graph traversal (good for type-specific, missing general traversal)

❌ **Missing Coverage:**
- Multi-tenancy + filtering combinations
- Soft delete filtering (is_active not indexed)
- Tag-based searches (array operations)
- Node name searches
- Combined organization + type queries
- Combined organization + active status queries

### Performance Risks

1. **Full table scans on filtered queries**
   - Queries like `WHERE organization_id = ? AND type = ?` won't fully use indexes
   - Soft delete checks `WHERE is_active = true` require table scans

2. **Suboptimal multi-tenancy**
   - Most real-world queries will filter by organization first
   - Current single-column organization indexes may not be sufficient for composite filters

3. **Tag searches**
   - No GIN index on tags array
   - Tag filtering requires sequential scans

4. **JSONB properties**
   - No GIN/GiST indexes for JSONB columns
   - Property-based searches will be slow

## Indexing Recommendations

### Priority 1: Critical for Performance

#### 1.1 Node - Composite Organization + Type Index

**Rationale:** Most queries will scope by organization first (multi-tenancy), then filter by type.

```typescript
@Index(['organizationId', 'type'])
```

**Benefits:**
- Efficient for: `WHERE organization_id = ? AND type = ?`
- Can use left-prefix for organization-only queries
- Supports most common filtering pattern

**Trade-offs:**
- Slightly redundant with existing single-column indexes
- Additional storage overhead
- Maintained on all inserts/updates

#### 1.2 Node - Composite Organization + Active Status Index

**Rationale:** Soft delete pattern requires filtering active records within organization scope.

```typescript
@Index(['organizationId', 'isActive'])
```

**Benefits:**
- Efficient for: `WHERE organization_id = ? AND is_active = true`
- Critical for production queries that should exclude soft-deleted records
- Supports common data isolation pattern

**Trade-offs:**
- Low cardinality on is_active (mostly true values)
- May have limited selectivity

#### 1.3 Edge - Composite Organization + Type Index

**Rationale:** Match node indexing strategy for consistent multi-tenancy performance.

```typescript
@Index(['organizationId', 'type'])
```

**Benefits:**
- Efficient for: `WHERE organization_id = ? AND type = ?`
- Can use left-prefix for organization-only queries
- Supports relationship-type filtering within organization

**Trade-offs:**
- Additional storage overhead
- Maintained on all inserts/updates

#### 1.4 Edge - Composite Organization + Active Status Index

**Rationale:** Soft delete pattern for edges within organization scope.

```typescript
@Index(['organizationId', 'isActive'])
```

**Benefits:**
- Efficient for: `WHERE organization_id = ? AND is_active = true`
- Ensures active edge queries are performant
- Matches node indexing pattern

**Trade-offs:**
- Low cardinality on is_active
- Limited selectivity improvement

### Priority 2: Important for Specific Use Cases

#### 2.1 Node - GIN Index on Tags Array

**Rationale:** Enable efficient tag-based searches and filtering.

```typescript
@Index(['tags'], { synchronize: false }) // Requires raw SQL for GIN index
// In migration:
// CREATE INDEX idx_nodes_tags_gin ON knowledge_graph_nodes USING GIN (tags);
```

**Benefits:**
- Efficient for: `WHERE 'tag' = ANY(tags)` or `WHERE tags @> ARRAY['tag1', 'tag2']`
- Supports tag-based knowledge discovery
- Enables efficient multi-tag searches

**Trade-offs:**
- Larger index size than B-tree
- Slower updates (GIN index maintenance)
- Requires PostgreSQL-specific SQL

**Alternative:**
If tag searches are infrequent, defer this optimization.

#### 2.2 Node - Composite Organization + Type + Active Index

**Rationale:** Cover the most common three-column filter combination.

```typescript
@Index(['organizationId', 'type', 'isActive'])
```

**Benefits:**
- Optimal for: `WHERE organization_id = ? AND type = ? AND is_active = true`
- Reduces index lookups for common query pattern
- Can use left-prefixes for partial matches

**Trade-offs:**
- Significant redundancy with Priority 1 indexes
- Higher storage overhead
- Only worthwhile if this exact combination is frequent

**Recommendation:**
Add only if query profiling shows this pattern is dominant. Otherwise, Priority 1 indexes are sufficient.

#### 2.3 Edge - Composite Source + Target + Type (Unique)

**Rationale:** Prevent duplicate relationships and optimize edge lookups.

```typescript
@Index(['sourceNodeId', 'targetNodeId', 'type'], { unique: true })
```

**Benefits:**
- Enforces business rule: only one edge of each type between two nodes
- Efficient for exact edge lookups
- Prevents data integrity issues

**Trade-offs:**
- May limit flexibility if multiple edges of same type are valid
- Existing 2-column index may be sufficient

**Recommendation:**
Only add if business logic requires uniqueness constraint. Otherwise, existing `[sourceNodeId, targetNodeId]` index is adequate.

### Priority 3: Advanced Optimizations

#### 3.1 Node - Partial Index on Active Records

**Rationale:** If soft-deleted records are rare and never queried, index only active records.

```typescript
// Requires raw SQL in migration:
// CREATE INDEX idx_nodes_active_partial 
// ON knowledge_graph_nodes (organization_id, type) 
// WHERE is_active = true;
```

**Benefits:**
- Smaller index size (only active records)
- Faster queries on active records
- Reduced maintenance overhead

**Trade-offs:**
- Doesn't help queries that include soft-deleted records
- PostgreSQL-specific feature
- More complex migration management

**Recommendation:**
Consider if soft-deleted records accumulate significantly and active record queries dominate.

#### 3.2 JSONB Properties GIN Index

**Rationale:** Enable efficient property-based searches if needed.

```typescript
// Requires raw SQL in migration:
// CREATE INDEX idx_nodes_properties_gin 
// ON knowledge_graph_nodes USING GIN (properties);
// CREATE INDEX idx_edges_properties_gin 
// ON knowledge_graph_edges USING GIN (properties);
```

**Benefits:**
- Efficient for: `WHERE properties @> '{"key": "value"}'`
- Enables flexible property queries
- Supports complex JSON containment queries

**Trade-offs:**
- Large index size
- Slower updates
- May not be needed if properties are only metadata

**Recommendation:**
Add only if property-based querying becomes a core feature.

#### 3.3 Node Name Full-Text Search Index

**Rationale:** Enable efficient text search on node names if search feature is needed.

```typescript
// Requires raw SQL in migration:
// ALTER TABLE knowledge_graph_nodes ADD COLUMN name_tsv tsvector;
// CREATE INDEX idx_nodes_name_fts 
// ON knowledge_graph_nodes USING GIN (name_tsv);
// CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
// ON knowledge_graph_nodes FOR EACH ROW EXECUTE FUNCTION
// tsvector_update_trigger(name_tsv, 'pg_catalog.english', name);
```

**Benefits:**
- Efficient full-text search on node names
- Supports fuzzy matching, stemming
- Better than LIKE patterns for search

**Trade-offs:**
- Complex setup with triggers
- Additional column and maintenance
- May be overkill for simple name lookups

**Recommendation:**
Add only if implementing search features. Use ILIKE for simple patterns initially.

## Implementation Strategy

### Phase 1: Essential Indexes (Immediate)

Add the following indexes to both entity files:

**Node Entity Updates:**
```typescript
@Index(['organizationId', 'type'])
@Index(['organizationId', 'isActive'])
```

**Edge Entity Updates:**
```typescript
@Index(['organizationId', 'type'])
@Index(['organizationId', 'isActive'])
```

**Impact:**
- Improves multi-tenancy query performance
- Enables efficient soft-delete filtering
- Minimal storage overhead
- Backward compatible

### Phase 2: Use-Case Specific (As Needed)

Monitor query patterns and add:
- GIN index on tags (if tag searches become common)
- JSONB GIN indexes (if property querying is needed)
- Additional composite indexes based on actual query logs

### Phase 3: Advanced Optimizations (Future)

Consider after performance profiling:
- Partial indexes for active records
- Full-text search on node names
- Additional covering indexes based on analytics

## Maintenance Considerations

### Index Monitoring

1. **Track index usage:**
   ```sql
   SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE tablename IN ('knowledge_graph_nodes', 'knowledge_graph_edges')
   ORDER BY idx_scan DESC;
   ```

2. **Identify unused indexes:**
   ```sql
   SELECT schemaname, tablename, indexname
   FROM pg_stat_user_indexes
   WHERE idx_scan = 0
   AND indexname NOT LIKE '%_pkey';
   ```

3. **Monitor index size:**
   ```sql
   SELECT tablename, indexname, pg_size_pretty(pg_relation_size(indexname::regclass))
   FROM pg_indexes
   WHERE tablename IN ('knowledge_graph_nodes', 'knowledge_graph_edges');
   ```

### Index Health

1. **Check for bloat:** Run REINDEX periodically on heavily updated indexes
2. **Analyze statistics:** Run ANALYZE after bulk operations
3. **Review query plans:** Use EXPLAIN ANALYZE to validate index usage

## Expected Performance Improvements

### Before Optimization

**Typical Query:** Find all active tasks for an organization
```sql
SELECT * FROM knowledge_graph_nodes 
WHERE organization_id = ? AND type = 'task' AND is_active = true;
```
- Uses: Single-column organization_id index
- Then: Filters type and is_active in memory
- Rows scanned: All nodes for organization

### After Phase 1 Optimization

**Same Query:**
- Uses: Composite `[organization_id, type]` index
- Then: Filters is_active from smaller result set
- Rows scanned: Only tasks for organization

**Improvement:** ~10x fewer rows scanned (depending on type distribution)

### Additional Benefits

1. **Reduced I/O:** Fewer disk reads from index-only scans
2. **Better caching:** Smaller working set fits in PostgreSQL buffer cache
3. **Faster writes:** With proper index strategy, minimal overhead
4. **Scalability:** Maintains performance as graph grows

## Conclusion

The current indexing strategy provides a solid foundation for basic graph operations and traversal. The proposed Phase 1 indexes address critical gaps in multi-tenancy and soft-delete filtering patterns. Additional optimizations in Phase 2 and 3 should be data-driven based on actual query patterns and performance metrics.

### Key Takeaways

1. ✅ **Good foundation:** Current indexes handle core graph traversal patterns well
2. ⚠️ **Multi-tenancy gap:** Need composite indexes for organization scoping
3. ⚠️ **Soft delete gap:** is_active filtering needs index support
4. 🎯 **Priority:** Add organization + type/active composite indexes
5. 📊 **Monitor:** Track index usage and query patterns before advanced optimizations

### Next Steps

1. Implement Phase 1 indexes in entity files
2. Generate TypeORM migration
3. Test migration in development environment
4. Monitor query performance improvements
5. Plan Phase 2 based on actual usage patterns
