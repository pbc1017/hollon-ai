import { Module } from '@nestjs/common';
import { KnowledgeExtractionService } from './knowledge-extraction.service';

/**
 * KnowledgeExtractionModule
 *
 * This module provides knowledge extraction capabilities for the Hollon-AI system.
 * It manages the lifecycle of the KnowledgeExtractionService and makes it available
 * to other modules through dependency injection.
 *
 * ## Module Architecture
 *
 * ### Services
 * - **KnowledgeExtractionService**: Core service for extracting structured knowledge
 *   from various document types and sources. Provides functionality for:
 *   - Content processing and analysis
 *   - Entity recognition and extraction
 *   - Relationship detection between entities
 *   - Document metadata extraction
 *
 * ### Exports
 * The KnowledgeExtractionService is exported for use by other modules including:
 * - **PromptComposerModule**: For context and knowledge retrieval
 * - **OrchestrationModule**: For knowledge-driven decision making
 * - **MessageModule**: For storing conversation knowledge
 * - **DocumentModule**: For document knowledge extraction
 *
 * ## Dependency Injection Strategy
 *
 * ### Service Lifecycle
 * - Services are provided at module scope with singleton lifecycle
 * - Service dependencies are injected through the constructor
 * - Type-safe dependency injection following NestJS conventions
 *
 * ## Module Boundaries
 *
 * ### Responsibilities
 * - ✅ Knowledge extraction from various sources
 * - ✅ Entity recognition and relationship detection
 * - ✅ Metadata extraction and organization
 *
 * ### Integration Points
 * This module is designed to integrate with:
 * - **KnowledgeGraphModule**: For entity relationship mapping
 * - **VectorSearchModule**: For semantic search capabilities
 * - **BrainProviderModule**: For AI-driven knowledge extraction
 *
 * @see KnowledgeExtractionService - Core business logic for knowledge extraction
 */
@Module({
  imports: [],
  providers: [KnowledgeExtractionService],
  exports: [KnowledgeExtractionService],
})
export class KnowledgeExtractionModule {}
