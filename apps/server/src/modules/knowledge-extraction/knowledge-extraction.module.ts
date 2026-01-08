import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeItem } from './entities/knowledge-item.entity';
import { KnowledgeExtractionService } from './services/knowledge-extraction.service';
import { VectorSearchService } from './services/vector-search.service';
import { ConversationMessageTextExtractionService } from './services/conversation-message-text-extraction.service';

/**
 * KnowledgeExtractionModule
 *
 * This module provides knowledge extraction and storage capabilities for the Hollon-AI system.
 * It manages the lifecycle of knowledge items extracted from various sources including
 * conversations, documents, and agent interactions.
 *
 * ## Module Architecture
 *
 * ### Entities
 * - **KnowledgeItem**: Core entity storing extracted knowledge with metadata, content, and
 *   temporal information. Includes multi-tenant organization scoping.
 *
 * ### Services
 * - **KnowledgeExtractionService**: Primary service for CRUD operations, search, and analytics
 *   on knowledge items. Provides comprehensive querying capabilities including:
 *   - Organization-scoped retrieval
 *   - Type-based filtering
 *   - Date range queries
 *   - Content search
 *   - Pagination and batch operations
 *   - Temporal distribution analysis
 *   - Metadata-based queries
 *
 * - **VectorSearchService**: Service for semantic search using vector embeddings. Currently
 *   a placeholder for future integration with pgvector-based similarity search.
 *
 * ### Exports
 * Both services are exported for use by other modules including:
 * - **PromptComposerModule**: For retrieving relevant context
 * - **OrchestrationModule**: For knowledge-driven decision making
 * - **MessageModule**: For storing conversation knowledge
 * - **DocumentModule**: For document knowledge extraction
 *
 * ## Dependency Injection Strategy
 *
 * ### Repository Pattern
 * The module uses TypeORM's Repository pattern for data access:
 * - KnowledgeItem repository is injected via `@InjectRepository` decorator
 * - Automatic repository creation through `TypeOrmModule.forFeature()`
 * - Type-safe database operations with TypeORM query builder
 *
 * ### Service Lifecycle
 * - Services are provided at module scope with singleton lifecycle
 * - No circular dependencies between services
 * - Repository injection handled by TypeORM's dependency injection
 *
 * ## Module Boundaries
 *
 * ### Responsibilities
 * - ✅ Storage and retrieval of knowledge items
 * - ✅ Search and filtering capabilities
 * - ✅ Analytics and temporal analysis
 * - ✅ Batch operations for high-volume scenarios
 * - 🔄 Vector embedding storage (planned)
 * - 🔄 Semantic similarity search (planned)
 *
 * ### External Dependencies
 * - **TypeORM**: Database access and entity management
 * - **Organization Entity**: Multi-tenant relationship (via cascade delete)
 *
 * ### Integration Points
 * This module is designed to integrate with:
 * - **KnowledgeGraphModule**: For entity relationship mapping (future)
 * - **VectorSearchModule**: For enhanced semantic search (future)
 * - **BrainProviderModule**: For AI-driven knowledge extraction (future)
 * - **NLP Services**: For entity recognition and sentiment analysis (future)
 *
 * ## Configuration
 *
 * ### Database Schema
 * The module manages the `knowledge_items` table with:
 * - UUID primary keys
 * - Organization-based multi-tenancy
 * - JSONB metadata storage
 * - Temporal indexing for performance
 * - Full-text search capabilities (planned)
 *
 * ### Indexes
 * Optimized indexes on:
 * - `organization_id`: For tenant scoping
 * - `type`: For knowledge classification
 * - `extracted_at`: For temporal queries
 * - Future: Full-text search on `content`
 * - Future: GIN index on `metadata` JSONB
 *
 * ## Performance Considerations
 *
 * - Query optimization through strategic index usage
 * - Batch insert operations for bulk processing
 * - Connection pooling via TypeORM
 * - Pagination support for large result sets
 * - Efficient date range queries with timestamp indexes
 *
 * ## Testing Strategy
 *
 * - Unit tests with mocked repositories
 * - Integration tests with test database
 * - Module compilation tests for dependency validation
 * - Export verification for consuming modules
 *
 * @see KnowledgeExtractionService - Core business logic
 * @see VectorSearchService - Semantic search capabilities
 * @see KnowledgeItem - Entity definition
 */
@Module({
  imports: [
    // TypeORM entity registration for repository injection
    TypeOrmModule.forFeature([KnowledgeItem]),
  ],
  providers: [
    // Core knowledge extraction and storage service
    KnowledgeExtractionService,
    // Vector-based semantic search service (future integration)
    VectorSearchService,
    // Conversation message text extraction service
    ConversationMessageTextExtractionService,
  ],
  exports: [
    // Export services for use by other modules
    // - PromptComposerModule: Context retrieval
    // - OrchestrationModule: Knowledge-driven decisions
    // - MessageModule: Conversation knowledge storage
    // - DocumentModule: Document knowledge extraction
    KnowledgeExtractionService,
    VectorSearchService,
    ConversationMessageTextExtractionService,
  ],
})
export class KnowledgeExtractionModule {}
