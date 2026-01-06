import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Node } from './entities/node.entity';
import { Edge } from './entities/edge.entity';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { KnowledgeGraphController } from './knowledge-graph.controller';

/**
 * KnowledgeGraphModule
 *
 * This module manages the knowledge graph functionality, providing a flexible
 * graph-based data structure for representing and querying relationships between
 * entities in the Hollon-AI system.
 *
 * Key responsibilities:
 * - Managing graph nodes (entities/concepts)
 * - Managing graph edges (relationships between nodes)
 * - Providing graph traversal and query capabilities
 * - Supporting knowledge extraction and relationship discovery
 */
@Module({
  /**
   * Module imports
   *
   * - TypeOrmModule.forFeature(): Registers Node and Edge entities for repository injection
   *   This enables the module to interact with the database tables for nodes and edges
   */
  imports: [
    TypeOrmModule.forFeature([
      Node, // Graph nodes representing entities/concepts
      Edge, // Graph edges representing relationships between nodes
    ]),
  ],

  /**
   * Controllers
   *
   * HTTP endpoint handlers for the knowledge graph API:
   * - KnowledgeGraphController: REST endpoints for graph operations (CRUD, queries, traversal)
   */
  controllers: [KnowledgeGraphController],

  /**
   * Providers (Services)
   *
   * Internal services available within this module:
   * - KnowledgeGraphService: Core business logic for graph operations, queries, and traversal
   *
   * Future providers may include:
   * - GraphQueryService: Advanced graph query and pattern matching
   * - GraphTraversalService: Specialized graph traversal algorithms
   * - RelationshipInferenceService: ML-based relationship discovery
   * - GraphAnalyticsService: Graph metrics and analysis
   */
  providers: [
    KnowledgeGraphService,
    // Additional services will be added here as the module grows
  ],

  /**
   * Exports (Public API)
   *
   * Services exposed to other modules:
   * - KnowledgeGraphService: Allows other modules to interact with the knowledge graph
   *
   * This enables other modules (e.g., knowledge-extraction, task, orchestration)
   * to leverage graph capabilities without directly accessing repositories.
   */
  exports: [
    KnowledgeGraphService,
    // Additional services may be exported as needed
  ],
})
export class KnowledgeGraphModule {}
