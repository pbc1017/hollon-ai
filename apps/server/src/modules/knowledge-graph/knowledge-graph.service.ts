import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Node } from './entities/node.entity';
import { Edge } from './entities/edge.entity';

@Injectable()
export class KnowledgeGraphService {
  /**
   * Creates an instance of KnowledgeGraphService.
   * Initializes the service with required repositories for managing nodes and edges.
   *
   * @param nodeRepository - Repository for Node entity operations
   * @param edgeRepository - Repository for Edge entity operations
   */
  constructor(
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    @InjectRepository(Edge)
    private readonly edgeRepository: Repository<Edge>,
  ) {}

  // Placeholder methods - to be implemented in future tasks
  /**
   * Retrieves all nodes from the knowledge graph.
   *
   * @returns A promise that resolves to an array of all Node entities
   */
  async findAllNodes(): Promise<Node[]> {
    return this.nodeRepository.find();
  }

  /**
   * Retrieves all edges from the knowledge graph.
   *
   * @returns A promise that resolves to an array of all Edge entities
   */
  async findAllEdges(): Promise<Edge[]> {
    return this.edgeRepository.find();
  }
}
