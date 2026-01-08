import { Module } from '@nestjs/common';
import { KnowledgeExtractionService } from './knowledge-extraction.service';

/**
 * KnowledgeExtractionModule
 *
 * This module provides knowledge extraction capabilities for the Hollon-AI system.
 * It encapsulates services for extracting knowledge entities, relationships, and metadata
 * from various sources including conversations, documents, and agent interactions.
 *
 * ## Module Architecture
 *
 * ### Services
 * - **KnowledgeExtractionService**: Core service for knowledge extraction operations
 *   - Extraction of knowledge entities from content
 *   - Extraction of relationships between entities
 *   - Metadata extraction from content
 *   - Data processing and normalization
 *   - Knowledge validation
 *
 * ### Exports
 * The module exports the KnowledgeExtractionService for use by other modules including:
 * - **PromptComposerModule**: For knowledge-driven prompt composition
 * - **OrchestrationModule**: For knowledge-driven orchestration decisions
 * - **MessageModule**: For storing conversation knowledge
 * - **DocumentModule**: For document knowledge extraction
 * - **KnowledgeGraphModule**: For storing extracted knowledge as graph entities
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
 * - ✅ Knowledge entity extraction from content
 * - ✅ Relationship extraction between entities
 * - ✅ Metadata extraction and processing
 * - ✅ Data normalization and validation
 * - 🔄 Integration with AI providers (planned)
 * - 🔄 Vector embedding generation (planned)\n *
 * ### Integration Points
 * This module is designed to integrate with:
 * - **BrainProviderModule**: For AI-driven knowledge extraction (future)
 * - **KnowledgeGraphModule**: For storing extracted knowledge entities
 * - **VectorSearchModule**: For semantic search of extracted knowledge (future)
 * - **NLP Services**: For entity recognition and sentiment analysis (future)
 *
 * ## Configuration
 *
 * The module does not require specific configuration but inherits from the application level.
 * All external dependencies (AI providers, NLP services) should be passed through
 * dependency injection or configured at the application level.
 *
 * ## Performance Considerations
 *
 * - Async operations for CPU-intensive extraction tasks
 * - Support for batch processing of multiple documents
 * - Optional caching of extraction results (future)
 * - Connection pooling for external service calls (future)
 *
 * ## Testing Strategy
 *
 * - Unit tests with mocked extraction services
 * - Integration tests with real content samples
 * - Module compilation tests for dependency validation
 * - Export verification for consuming modules
 *
 * @see KnowledgeExtractionService - Core extraction logic
 */
@Module({
  providers: [
    // Core knowledge extraction service
    KnowledgeExtractionService,
  ],
  exports: [
    // Export service for use by other modules
    // - PromptComposerModule: Knowledge-driven composition
    // - OrchestrationModule: Knowledge-driven decisions
    // - MessageModule: Conversation knowledge storage
    // - DocumentModule: Document knowledge extraction
    // - KnowledgeGraphModule: Entity storage and retrieval
    KnowledgeExtractionService,
  ],
})
export class KnowledgeExtractionModule {}
