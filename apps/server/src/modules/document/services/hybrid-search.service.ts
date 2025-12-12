import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import {
  HybridSearchDto,
  HybridSearchResponse,
  HybridSearchResult,
  SearchMetrics,
  SearchStrategy,
  RelationshipContext,
} from '../dto/hybrid-search.dto';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Team } from '../../team/entities/team.entity';
import { Project } from '../../project/entities/project.entity';
import { Task } from '../../task/entities/task.entity';

interface GraphNode {
  entityId: string;
  entityType: string;
  distance: number;
  path: string[];
}

@Injectable()
export class HybridSearchService {
  private readonly logger = new Logger(HybridSearchService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  /**
   * Perform hybrid search combining vector similarity and graph traversal
   */
  async search(dto: HybridSearchDto): Promise<HybridSearchResponse> {
    const startTime = Date.now();
    this.logger.log(
      `Starting hybrid search: strategy=${dto.strategy}, query="${dto.query}"`,
    );

    // Validate weights
    this.validateWeights(dto);

    let results: HybridSearchResult[] = [];
    let vectorMatches = 0;
    let graphMatches = 0;

    if (
      dto.strategy === SearchStrategy.VECTOR_ONLY ||
      dto.strategy === SearchStrategy.HYBRID
    ) {
      const vectorResults = await this.performVectorSearch(dto);
      vectorMatches = vectorResults.length;

      if (dto.strategy === SearchStrategy.VECTOR_ONLY) {
        results = vectorResults;
      } else {
        // Hybrid: combine with graph results
        const graphResults = await this.performGraphSearch(dto);
        graphMatches = graphResults.length;
        results = this.combineResults(
          vectorResults,
          graphResults,
          dto.vectorWeight ?? 0.6,
          dto.graphWeight ?? 0.4,
        );
      }
    } else if (dto.strategy === SearchStrategy.GRAPH_ONLY) {
      const graphResults = await this.performGraphSearch(dto);
      graphMatches = graphResults.length;
      results = graphResults;
    }

    // Sort by combined score and apply limit
    results.sort((a, b) => b.combinedScore - a.combinedScore);
    results = results.slice(0, dto.limit ?? 10);

    const searchTimeMs = Date.now() - startTime;

    const metrics: SearchMetrics = {
      totalDocuments: results.length,
      vectorMatches,
      graphMatches,
      hybridMatches: results.length,
      avgVectorScore:
        results.reduce((sum, r) => sum + r.vectorScore, 0) / results.length ||
        0,
      avgGraphScore:
        results.reduce((sum, r) => sum + r.graphScore, 0) / results.length || 0,
      avgCombinedScore:
        results.reduce((sum, r) => sum + r.combinedScore, 0) / results.length ||
        0,
      searchTimeMs,
    };

    this.logger.log(
      `Hybrid search completed in ${searchTimeMs}ms: ${results.length} results`,
    );

    return {
      results,
      metrics,
      query: dto.query,
      strategy: dto.strategy ?? SearchStrategy.HYBRID,
    };
  }

  /**
   * Perform vector similarity search using pgvector
   */
  private async performVectorSearch(
    dto: HybridSearchDto,
  ): Promise<HybridSearchResult[]> {
    this.logger.log('Performing vector similarity search');

    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(dto.query);

    if (!queryEmbedding) {
      this.logger.warn(
        'Failed to generate query embedding, returning empty results',
      );
      return [];
    }

    // Build query with pgvector cosine similarity
    const queryBuilder = this.documentRepo
      .createQueryBuilder('doc')
      .select('doc.*')
      .addSelect(`1 - (doc.embedding <=> '${queryEmbedding}')`, 'similarity')
      .where('doc.embedding IS NOT NULL')
      .andWhere(
        `1 - (doc.embedding <=> '${queryEmbedding}') >= :minSimilarity`,
        {
          minSimilarity: dto.minSimilarity ?? 0.5,
        },
      );

    // Apply filters
    if (dto.organizationId) {
      queryBuilder.andWhere('doc.organization_id = :orgId', {
        orgId: dto.organizationId,
      });
    }
    if (dto.projectId) {
      queryBuilder.andWhere('doc.project_id = :projectId', {
        projectId: dto.projectId,
      });
    }
    if (dto.teamId) {
      queryBuilder.andWhere('doc.team_id = :teamId', { teamId: dto.teamId });
    }
    if (dto.hollonId) {
      queryBuilder.andWhere('doc.hollon_id = :hollonId', {
        hollonId: dto.hollonId,
      });
    }

    queryBuilder.orderBy('similarity', 'DESC').limit((dto.limit ?? 10) * 2); // Get more for combining

    const rawResults = await queryBuilder.getRawMany();

    return rawResults.map((raw) => ({
      documentId: raw.doc_id,
      title: raw.doc_title,
      content: raw.doc_content,
      type: raw.doc_type,
      vectorScore: parseFloat(raw.similarity),
      graphScore: 0,
      combinedScore: parseFloat(raw.similarity),
      relationships: [],
      metadata: raw.doc_metadata || {},
      tags: raw.doc_tags || [],
    }));
  }

  /**
   * Perform graph traversal search based on entity relationships
   */
  private async performGraphSearch(
    dto: HybridSearchDto,
  ): Promise<HybridSearchResult[]> {
    this.logger.log('Performing graph traversal search');

    // Start from specified entity or find relevant entities
    const startNodes = await this.identifyStartNodes(dto);

    if (startNodes.length === 0) {
      this.logger.warn('No start nodes found for graph search');
      return [];
    }

    // Traverse graph to find related documents
    const relatedDocuments = new Map<
      string,
      { document: Document; relationships: RelationshipContext[] }
    >();

    for (const node of startNodes) {
      const traversalResults = await this.traverseGraph(
        node,
        dto.maxGraphDepth ?? 3,
        new Set<string>(),
      );

      for (const result of traversalResults) {
        const documents = await this.getDocumentsForNode(result);

        for (const doc of documents) {
          const existing = relatedDocuments.get(doc.id);
          const relationship: RelationshipContext = {
            type: result.entityType,
            entityId: result.entityId,
            entityType: result.entityType,
            distance: result.distance,
            path: result.path,
          };

          if (existing) {
            existing.relationships.push(relationship);
          } else {
            relatedDocuments.set(doc.id, {
              document: doc,
              relationships: [relationship],
            });
          }
        }
      }
    }

    // Convert to results with graph scores
    const results: HybridSearchResult[] = [];

    for (const [docId, { document, relationships }] of relatedDocuments) {
      const graphScore = this.calculateGraphScore(
        relationships,
        dto.maxGraphDepth ?? 3,
      );

      // Filter by text relevance
      const textRelevance = this.calculateTextRelevance(dto.query, document);

      if (textRelevance > 0.1) {
        // Minimum text relevance threshold
        results.push({
          documentId: docId,
          title: document.title,
          content: document.content,
          type: document.type,
          vectorScore: 0,
          graphScore: graphScore * textRelevance, // Combine with text relevance
          combinedScore: graphScore * textRelevance,
          relationships,
          metadata: document.metadata || {},
          tags: document.tags || [],
        });
      }
    }

    return results;
  }

  /**
   * Combine vector and graph results with weighted scoring
   */
  private combineResults(
    vectorResults: HybridSearchResult[],
    graphResults: HybridSearchResult[],
    vectorWeight: number,
    graphWeight: number,
  ): HybridSearchResult[] {
    const combined = new Map<string, HybridSearchResult>();

    // Add vector results
    for (const result of vectorResults) {
      combined.set(result.documentId, {
        ...result,
        combinedScore: result.vectorScore * vectorWeight,
      });
    }

    // Merge graph results
    for (const result of graphResults) {
      const existing = combined.get(result.documentId);

      if (existing) {
        // Document found in both searches - combine scores
        existing.graphScore = result.graphScore;
        existing.relationships = result.relationships;
        existing.combinedScore =
          existing.vectorScore * vectorWeight + result.graphScore * graphWeight;
      } else {
        // Document only in graph results
        combined.set(result.documentId, {
          ...result,
          combinedScore: result.graphScore * graphWeight,
        });
      }
    }

    return Array.from(combined.values());
  }

  /**
   * Identify starting nodes for graph traversal
   */
  private async identifyStartNodes(dto: HybridSearchDto): Promise<GraphNode[]> {
    const nodes: GraphNode[] = [];

    if (dto.hollonId) {
      nodes.push({
        entityId: dto.hollonId,
        entityType: 'hollon',
        distance: 0,
        path: [dto.hollonId],
      });
    }

    if (dto.teamId) {
      nodes.push({
        entityId: dto.teamId,
        entityType: 'team',
        distance: 0,
        path: [dto.teamId],
      });
    }

    if (dto.projectId) {
      nodes.push({
        entityId: dto.projectId,
        entityType: 'project',
        distance: 0,
        path: [dto.projectId],
      });
    }

    // If no specific entity provided, find relevant entities from query
    if (nodes.length === 0 && dto.organizationId) {
      // Find projects matching query terms
      const projects = await this.projectRepo
        .createQueryBuilder('p')
        .where('p.organization_id = :orgId', { orgId: dto.organizationId })
        .andWhere(
          '(LOWER(p.name) LIKE :query OR LOWER(p.description) LIKE :query)',
          { query: `%${dto.query.toLowerCase()}%` },
        )
        .limit(5)
        .getMany();

      for (const project of projects) {
        nodes.push({
          entityId: project.id,
          entityType: 'project',
          distance: 0,
          path: [project.id],
        });
      }
    }

    return nodes;
  }

  /**
   * Traverse graph from a node to find related entities
   */
  private async traverseGraph(
    node: GraphNode,
    maxDepth: number,
    visited: Set<string>,
  ): Promise<GraphNode[]> {
    if (node.distance >= maxDepth || visited.has(node.entityId)) {
      return [node];
    }

    visited.add(node.entityId);
    const results: GraphNode[] = [node];

    try {
      switch (node.entityType) {
        case 'hollon': {
          const hollon = await this.hollonRepo.findOne({
            where: { id: node.entityId },
            relations: ['team'],
          });

          if (hollon?.teamId) {
            const teamNode: GraphNode = {
              entityId: hollon.teamId,
              entityType: 'team',
              distance: node.distance + 1,
              path: [...node.path, hollon.teamId],
            };
            const teamResults = await this.traverseGraph(
              teamNode,
              maxDepth,
              visited,
            );
            results.push(...teamResults);
          }
          break;
        }

        case 'team': {
          const team = await this.teamRepo.findOne({
            where: { id: node.entityId },
            relations: ['hollons'],
          });

          if (team) {
            // Traverse to hollons in team
            for (const hollon of team.hollons || []) {
              const hollonNode: GraphNode = {
                entityId: hollon.id,
                entityType: 'hollon',
                distance: node.distance + 1,
                path: [...node.path, hollon.id],
              };
              const hollonResults = await this.traverseGraph(
                hollonNode,
                maxDepth,
                visited,
              );
              results.push(...hollonResults);
            }

            // Find projects for this team's organization
            const projects = await this.projectRepo.find({
              where: { organizationId: team.organizationId },
              take: 10,
            });

            for (const project of projects) {
              const projectNode: GraphNode = {
                entityId: project.id,
                entityType: 'project',
                distance: node.distance + 1,
                path: [...node.path, project.id],
              };
              const projectResults = await this.traverseGraph(
                projectNode,
                maxDepth,
                visited,
              );
              results.push(...projectResults);
            }
          }
          break;
        }

        case 'project': {
          // Only traverse to tasks if we haven't hit max depth yet
          if (node.distance + 1 < maxDepth) {
            const tasks = await this.taskRepo.find({
              where: { projectId: node.entityId },
              take: 20,
            });

            for (const task of tasks || []) {
              const taskNode: GraphNode = {
                entityId: task.id,
                entityType: 'task',
                distance: node.distance + 1,
                path: [...node.path, task.id],
              };
              results.push(taskNode);
            }
          }
          break;
        }

        case 'task': {
          // Tasks are leaf nodes in our graph
          results.push(node);
          break;
        }
      }
    } catch (error) {
      this.logger.error(
        `Error traversing graph at node ${node.entityId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return results;
  }

  /**
   * Get documents associated with a graph node
   */
  private async getDocumentsForNode(node: GraphNode): Promise<Document[]> {
    const queryBuilder = this.documentRepo.createQueryBuilder('doc');

    switch (node.entityType) {
      case 'hollon':
        queryBuilder.where('doc.hollon_id = :id', { id: node.entityId });
        break;
      case 'team':
        queryBuilder.where('doc.team_id = :id', { id: node.entityId });
        break;
      case 'project':
        queryBuilder.where('doc.project_id = :id', { id: node.entityId });
        break;
      case 'task':
        queryBuilder.where('doc.task_id = :id', { id: node.entityId });
        break;
      default:
        return [];
    }

    return queryBuilder.getMany();
  }

  /**
   * Calculate graph relevance score based on relationships
   */
  private calculateGraphScore(
    relationships: RelationshipContext[],
    maxDepth: number,
  ): number {
    if (relationships.length === 0) return 0;

    // Score based on:
    // 1. Number of relationships (more connections = more relevant)
    // 2. Distance (closer = more relevant)
    // 3. Relationship diversity (multiple types = more relevant)

    const relationshipScore = Math.min(relationships.length / 5, 1); // Max at 5 relationships

    const avgDistance =
      relationships.reduce((sum, r) => sum + r.distance, 0) /
      relationships.length;
    const distanceScore = 1 - avgDistance / maxDepth;

    const uniqueTypes = new Set(relationships.map((r) => r.type)).size;
    const diversityScore = Math.min(uniqueTypes / 4, 1); // Max at 4 types

    return relationshipScore * 0.4 + distanceScore * 0.4 + diversityScore * 0.2;
  }

  /**
   * Calculate text relevance using simple keyword matching
   * (Can be enhanced with more sophisticated NLP later)
   */
  private calculateTextRelevance(query: string, document: Document): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const docText = `${document.title} ${document.content}`.toLowerCase();

    let matches = 0;
    for (const term of queryTerms) {
      if (term.length > 2 && docText.includes(term)) {
        matches++;
      }
    }

    return queryTerms.length > 0 ? matches / queryTerms.length : 0;
  }

  /**
   * Generate embedding for text
   * Placeholder - should integrate with actual embedding service (e.g., OpenAI)
   */
  private async generateEmbedding(_text: string): Promise<string | null> {
    // TODO: Integrate with actual embedding service (OpenAI, etc.)
    // For now, return null to skip vector search in absence of real embeddings
    this.logger.warn(
      'Embedding generation not implemented - vector search will be skipped',
    );
    return null;
  }

  /**
   * Validate search weights
   */
  private validateWeights(dto: HybridSearchDto): void {
    if (dto.strategy === SearchStrategy.HYBRID) {
      const totalWeight = (dto.vectorWeight ?? 0.6) + (dto.graphWeight ?? 0.4);
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        throw new Error(
          `Vector and graph weights must sum to 1.0 (got ${totalWeight})`,
        );
      }
    }
  }
}
