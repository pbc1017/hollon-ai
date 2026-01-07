/**
 * Knowledge Graph Interfaces
 *
 * Barrel export for all knowledge graph interfaces, enums, and types.
 * 
 * Includes:
 * - Core data structures (IGraphNode, IGraphEdge)
 * - Graph operations (IGraphService, IGraphQuery, IGraphTraversalOptions)
 * - Storage strategies (IStorageProvider, StorageStrategy)
 * - Duplicate detection and merging (IDuplicateMergingStrategy)
 * - Incremental updates (IIncrementalUpdateStrategy)
 * - Analytics and integration (IGraphAnalytics, IGraphIntegrationPoint)
 * - API response wrappers (IApiResponse, IPaginatedResponse, IBulkOperationResult)
 */

export * from './graph.interface';
