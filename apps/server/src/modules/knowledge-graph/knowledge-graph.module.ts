import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphNode } from './entities/graph-node.entity';
import { GraphEdge } from './entities/graph-edge.entity';
import { KnowledgeGraphService } from './knowledge-graph.service';

@Module({
  imports: [TypeOrmModule.forFeature([GraphNode, GraphEdge])],
  providers: [KnowledgeGraphService],
  exports: [KnowledgeGraphService],
})
export class KnowledgeGraphModule {}
