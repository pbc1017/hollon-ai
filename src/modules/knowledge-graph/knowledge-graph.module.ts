import { Module } from '@nestjs/common';
import { KnowledgeGraphService } from './knowledge-graph.service';

/**
 * KnowledgeGraphModule
 *
 * This module provides knowledge graph management capabilities for the Hollon-AI system.
 * It encapsulates services for managing graph nodes, edges, and relationships between
 * knowledge entries, enabling semantic understanding and navigation of knowledge.
 *
 * ## Module Architecture
 *
 * ### Services
 * - **KnowledgeGraphService**: Core service for knowledge graph operations
 *   - CRUD operations for graph nodes
 *   - CRUD operations for graph edges
 *   - Relationship management between knowledge entities
 *   - Graph traversal and querying
 *   - Knowledge entity linking
 *
 * ### Exports
 * The module exports the KnowledgeGraphService for use by other modules including:
 * - **KnowledgeExtractionModule**: For storing extracted knowledge as graph entities
 * - **TaskModule**: For managing task relationships and dependencies
 * - **OrchestrationModule**: For knowledge-driven orchestration decisions
 * - **MessageModule**: For linking conversation knowledge
 * - **PromptComposerModule**: For knowledge-driven prompt composition
 *
 * ## Dependency Injection Strategy
 *
 * ### Service Lifecycle
 * - Services are provided at module scope with singleton lifecycle
 * - Services are stateless and can be safely shared across modules
 * - No circular dependencies between services
 *
 * ## Module Boundaries
 *
 * ### Responsibilities
 * - ✅ Graph node creation, retrieval, update, and deletion
 * - ✅ Graph edge creation, retrieval, update, and deletion
 * - ✅ Relationship management between knowledge entities
 * - 🔄 Graph traversal algorithms (planned)
 * - 🔄 Advanced graph query capabilities (planned)
 * - 🔄 Relationship inference and discovery (planned)
 * - 🔄 Graph analytics and metrics (planned)
 *
 * ### Integration Points
 * This module is designed to integrate with:
 * - **KnowledgeExtractionModule**: Receives extracted knowledge for storage
 * - **VectorSearchModule**: For semantic search within the knowledge graph
 * - **Database**: PostgreSQL with TypeORM for persistence
 * - **Analytics Services**: For graph metrics and insights (future)
 *
 * ## Configuration
 *
 * The module does not require specific configuration but inherits from the application level.
 * Database connections and ORM configuration are managed at the application level.
 *
 * ## Performance Considerations
 *
 * - Async operations for database interactions
 * - Efficient graph traversal algorithms
 * - Query optimization for complex relationship queries
 * - Connection pooling for database operations
 * - Optional caching for frequently accessed nodes (future)
 *
 * ## Testing Strategy
 *
 * - Unit tests with mocked repositories
 * - Integration tests with test database
 * - Module compilation tests for dependency validation
 * - Export verification for consuming modules
 *
 * @see KnowledgeGraphService - Core graph management logic
 */
@Module({
  providers: [
    // Core knowledge graph management service
    KnowledgeGraphService,
  ],
  exports: [
    // Export service for use by other modules
    // - KnowledgeExtractionModule: Store extracted knowledge entities
    // - TaskModule: Manage task relationships
    // - OrchestrationModule: Knowledge-driven orchestration
    // - MessageModule: Link conversation knowledge
    // - PromptComposerModule: Knowledge-driven prompt composition
    KnowledgeGraphService,
  ],
})
export class KnowledgeGraphModule {}
