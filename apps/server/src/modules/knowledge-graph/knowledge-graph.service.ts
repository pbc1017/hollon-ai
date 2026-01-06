import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Node } from './entities/node.entity';
import { Edge } from './entities/edge.entity';

@Injectable()
export class KnowledgeGraphService {
  constructor(
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    @InjectRepository(Edge)
    private readonly edgeRepository: Repository<Edge>,
  ) {}

  /**
   * Retrieves all nodes from the knowledge graph
   * Placeholder method - to be implemented in future tasks
   *
   * @returns Promise resolving to an array of all Node entities
   */
  async findAllNodes(): Promise<Node[]> {
    return this.nodeRepository.find();
  }

  /**
   * Retrieves all edges from the knowledge graph
   * Placeholder method - to be implemented in future tasks
   *
   * @returns Promise resolving to an array of all Edge entities
   */
  async findAllEdges(): Promise<Edge[]> {
    return this.edgeRepository.find();
  }
}
