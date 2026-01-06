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

  // Placeholder methods - to be implemented in future tasks
  async findAllNodes(): Promise<Node[]> {
    return this.nodeRepository.find();
  }

  async findAllEdges(): Promise<Edge[]> {
    return this.edgeRepository.find();
  }
}
