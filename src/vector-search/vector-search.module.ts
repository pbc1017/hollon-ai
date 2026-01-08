import { Module } from '@nestjs/common';
import { VectorSearchService } from './vector-search.service';

/**
 * VectorSearchModule
 *
 * This module provides vector-based search capabilities for the Hollon-AI system.
 * It encapsulates services for semantic search, similarity matching, and vector
 * operations on embeddings generated from various sources including conversations,
 * documents, and knowledge entities.
 *
 * ## Module Architecture
 *
 * ### Services
 * - **VectorSearchService**: Core service for vector search operations
 *   - Semantic search using vector embeddings
 *   - Similarity matching and ranking
 *   - Vector distance calculations
 *   - Query embedding generation
 *   - Result filtering and pagination
 *
 * ### Exports
 * The module exports the VectorSearchService for use by other modules including:
 * - **KnowledgeGraphModule**: For semantic search of knowledge entities
 * - **MessageModule**: For conversation similarity search
 * - **DocumentModule**: For document semantic search
 * - **PromptComposerModule**: For context retrieval based on relevance
 * - **OrchestrationModule**: For knowledge-driven decision making
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
 * - ✅ Vector search and similarity matching
 * - ✅ Query embedding processing
 * - ✅ Result ranking and filtering
 * - 🔄 Vector database integration (planned)
 * - 🔄 Advanced search algorithms (planned)
 * - 🔄 Caching of search results (planned)
 *
 * ### Integration Points
 * This module is designed to integrate with:
 * - **BrainProviderModule**: For embedding generation (future)
 * - **KnowledgeGraphModule**: For entity search and retrieval
 * - **KnowledgeExtractionModule**: For extracted knowledge search (future)
 * - **Vector Database**: For persistent vector storage (future)
 *
 * ## Configuration
 *
 * The module does not require specific configuration but inherits from the application level.
 * All external dependencies (vector databases, embedding services) should be passed through
 * dependency injection or configured at the application level.
 *
 * ## Performance Considerations
 *
 * - Async operations for search queries
 * - Support for batch similarity calculations
 * - Optional result caching (future)
 * - Connection pooling for vector database (future)
 * - Approximate nearest neighbor search for scalability (future)
 *
 * ## Testing Strategy
 *
 * - Unit tests with mocked vector operations
 * - Integration tests with sample embeddings
 * - Module compilation tests for dependency validation
 * - Export verification for consuming modules
 * - Performance benchmarks for search operations
 *
 * @see VectorSearchService - Core vector search logic
 */
@Module({
  providers: [
    // Core vector search service
    VectorSearchService,
  ],
  exports: [
    // Export service for use by other modules
    // - KnowledgeGraphModule: Semantic entity search
    // - MessageModule: Conversation similarity search
    // - DocumentModule: Document semantic search
    // - PromptComposerModule: Context retrieval
    // - OrchestrationModule: Knowledge-driven decisions
    VectorSearchService,
  ],
})
export class VectorSearchModule {}
