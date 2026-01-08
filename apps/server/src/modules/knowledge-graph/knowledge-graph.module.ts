import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Node } from './entities/node.entity';
import { Edge } from './entities/edge.entity';
import { KnowledgeGraphService } from './knowledge-graph.service';

@Module({
  imports: [TypeOrmModule.forFeature([Node, Edge])],
  providers: [KnowledgeGraphService],
  exports: [KnowledgeGraphService],
})
export class KnowledgeGraphModule {}
